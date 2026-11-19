import { z } from 'zod';
import { zite } from 'zitejs/db';
import { getPartnerCreditPosition } from '@/lib/partnerCredit';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { recheckMultiRoomOffer } from '../lib/multiRoomRecheck';
import { appendBookingMovements, appendHoldMovements, ensureBookedInventoryLedger } from '@project/pricing/inventoryLedger';

const roomConfigSchema=z.object({
  adults:z.number().int().min(1),
  children:z.number().int().min(0),
  childAges:z.array(z.number().int().min(0)),
});
const assignmentSchema=z.object({
  requestedRoomNo:z.number().int().min(1),
  roomTypeId:z.string().min(1),
  ratePlanId:z.string().min(1),
});

async function getOpenExposure(partnerId: string): Promise<number> {
  // Shared ledger: hotels + attractions + transfers (previously hotels only).
  return (await getPartnerCreditPosition(partnerId)).used;
}

async function getOverdueCount(partnerId: string): Promise<number> {
  return (await getPartnerCreditPosition(partnerId)).overdue;
}

export default createEndpoint({
  description:'Create a partner credit booking request from an authoritatively rechecked mixed-room offer',
  inputSchema:z.object({
    partnerToken:z.string(),
    hotelId:z.string().min(1),
    checkIn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    roomConfigs:z.array(roomConfigSchema).min(1),
    assignments:z.array(assignmentSchema).min(1),
    nationality:z.string().trim().min(2).max(3).optional(),
    extraMarkupPct:z.number().min(0).max(50).optional(),
    expectedSellTotal:z.number().positive(),
    expectedSignature:z.string().min(1),
    holdToken:z.string().min(1),
    guestName:z.string().trim().min(2),
    specialRequests:z.string().optional(),
  }),
  outputSchema:z.object({
    success:z.boolean(),
    bookingId:z.string(),
    bookingReference:z.string(),
    creditAvailableAfter:z.number(),
    pricingStatus:z.literal('Booked'),
  }),
  execute:async({input})=>{
    const partnerId=await verifyPartnerToken(input.partnerToken);
    if(!partnerId) throw new ZiteError({code:'UNAUTHORIZED',message:'Your partner session has expired. Please sign in again.'});

    const partner=await zite.partnerAccounts.findOne({id:partnerId}) as any;
    if(!partner || partner.accountStatus!=='Active') {
      throw new ZiteError({code:'FORBIDDEN',message:'Partner account is not active.'});
    }

    const requestKey=`multi:${input.holdToken}`;
    const existing=await zite.bookings.findAll({filters:{requestKey},limit:10});
    if(existing.records[0]){
      const existingBooking=existing.records[0];
      if(['Cancelled','Rejected'].includes(String(existingBooking.status||''))) {
        throw new ZiteError({code:'CONFLICT',message:'This idempotent booking request already ended in a terminal status. Create a new hold before retrying.'});
      }
      const existingReference=existingBooking.bookingReference||String(existingBooking.bookingRef||existingBooking.id);
      await ensureBookedInventoryLedger({
        bookingId:existingBooking.id,
        bookingReference:existingReference,
        holdToken:input.holdToken,
        pricingVersion:'multi-room-v3',
      });
      await appendBookingMovements({
        bookingId:existingBooking.id,bookingReference:existingReference,holdToken:input.holdToken,
        source:'idempotent_booking_repair',actor:partner.agencyEmail||'Partner',
        notes:'Idempotent booking retry verified durable booked inventory',
      });
      const exposure=await getOpenExposure(partnerId);
      return {
        success:true,
        bookingId:existingBooking.id,
        bookingReference:existingReference,
        creditAvailableAfter:Math.max(0,Math.max(0,Number(partner.creditLimitAed||0))-exposure),
        pricingStatus:'Booked' as const,
      };
    }

    const [holdLines,holdMasters]=await Promise.all([
      zite.rateHoldLines.findAll({filters:{holdToken:input.holdToken},limit:1000}),
      zite.rateHolds.findAll({filters:{holdToken:input.holdToken},limit:100}),
    ]);
    const now=Date.now();
    if(!holdLines.records.length || !holdMasters.records.length) {
      throw new ZiteError({code:'CONFLICT',message:'The room and price hold was not found. Please hold the offer again.'});
    }
    if(holdLines.records.some(x=>x.partnerId!==partnerId)) {
      throw new ZiteError({code:'FORBIDDEN',message:'The inventory hold belongs to another partner account.'});
    }
    const expired=holdLines.records.some(x=>x.status!=='Active' || !x.expiresAt || new Date(x.expiresAt).getTime()<=now) ||
      holdMasters.records.some(x=>x.holdStatus!=='Active' || !x.expiresAt || new Date(x.expiresAt).getTime()<=now);
    if(expired) {
      for(const line of holdLines.records){
        if(line.status==='Active') await zite.rateHoldLines.update({id:line.id,record:{status:'Expired'}});
      }
      for(const hold of holdMasters.records){
        if(hold.holdStatus==='Active') await zite.rateHolds.update({id:hold.id,record:{holdStatus:'Expired'}});
      }
      await appendHoldMovements({
        holdToken:input.holdToken,movementType:'EXPIRED',quantitySign:-1,
        source:'booking_submit_expiry',actor:partner.agencyEmail||'Partner',
        notes:'Hold expired before booking submission',
      });
      throw new ZiteError({code:'CONFLICT',message:'The 10-minute room and price hold has expired. Please recheck and hold the offer again.'});
    }
    if(holdLines.records.some(x=>x.combinationSignature!==input.expectedSignature || Math.abs(Number(x.quotedSellTotal||0)-input.expectedSellTotal)>=0.01) ||
       holdMasters.records.some(x=>Math.abs(Number(x.quotedSellTotal||0)-input.expectedSellTotal)>=0.01)) {
      throw new ZiteError({code:'CONFLICT',message:'The held room combination or price no longer matches this checkout.'});
    }
    let heldSnapshot:any=null;
    try{heldSnapshot=JSON.parse(holdMasters.records[0]?.rateSnapshot||'{}');}catch{}
    if(!heldSnapshot || heldSnapshot.hotelId!==input.hotelId || heldSnapshot.checkIn!==input.checkIn || heldSnapshot.checkOut!==input.checkOut ||
       heldSnapshot.signature!==input.expectedSignature || JSON.stringify(heldSnapshot.roomConfigs)!==JSON.stringify(input.roomConfigs) ||
       String(heldSnapshot.nationality||'')!==String(input.nationality||'') ||
       Number(heldSnapshot.extraMarkupPct||0)!==Number(input.extraMarkupPct||0)) {
      throw new ZiteError({code:'CONFLICT',message:'Checkout details changed after the room hold was created. Please recheck and hold the offer again.'});
    }

    const expectedGroups=new Map<string,number>();
    for(const a of input.assignments){
      const key=`${a.roomTypeId}|${a.ratePlanId}`;
      expectedGroups.set(key,(expectedGroups.get(key)||0)+1);
    }
    const expectedDates:string[]=[];
    const holdDate=new Date(input.checkIn+'T00:00:00Z');
    const holdEnd=new Date(input.checkOut+'T00:00:00Z');
    while(holdDate<holdEnd){expectedDates.push(holdDate.toISOString().slice(0,10));holdDate.setUTCDate(holdDate.getUTCDate()+1);}
    const expectedLineKeys=new Map<string,number>();
    for(const [key,qty] of expectedGroups){
      for(const date of expectedDates) expectedLineKeys.set(`${key}|${date}`,qty);
    }
    if(holdLines.records.length!==expectedLineKeys.size) {
      throw new ZiteError({code:'CONFLICT',message:'The inventory hold no longer covers every room night. Please hold the offer again.'});
    }
    for(const line of holdLines.records){
      const date=line.stayDate?String(line.stayDate).slice(0,10):'';
      const key=`${line.roomTypeId}|${line.ratePlanId}|${date}`;
      if(line.hotelId!==input.hotelId || expectedLineKeys.get(key)!==Number(line.quantity||0)) {
        throw new ZiteError({code:'CONFLICT',message:'The held inventory does not match this room combination.'});
      }
    }

    const recheck=await recheckMultiRoomOffer({
      hotelId:input.hotelId,
      checkIn:input.checkIn,
      checkOut:input.checkOut,
      roomConfigs:input.roomConfigs,
      assignments:input.assignments,
      nationality:input.nationality,
      extraMarkupPct:input.extraMarkupPct,
      expectedSellTotal:input.expectedSellTotal,
      expectedSignature:input.expectedSignature,
      excludeHoldToken:input.holdToken,
    });

    if(recheck.status==='PRICE_CHANGED') {
      throw new ZiteError({
        code:'CONFLICT',
        message:`Price changed during authoritative recheck. Updated total is AED ${recheck.sellTotal.toFixed(2)}. Please review the new total before submitting again.`,
      });
    }
    if(recheck.status!=='RECHECKED') {
      throw new ZiteError({
        code:'CONFLICT',
        message:`Mixed-room offer is no longer bookable: ${recheck.reasonCodes.join(' | ') || recheck.status}.`,
      });
    }

    const creditLimit=Math.max(0,Number(partner.creditLimitAed||0));
    const terms=Math.max(0,Number(partner.creditTermsDays||0));
    if(partner.creditStatus!=='Approved' || creditLimit<=0) {
      throw new ZiteError({code:'FORBIDDEN',message:'Agency credit is not approved for booking.'});
    }
    if(await getOverdueCount(partnerId)>0) {
      throw new ZiteError({code:'FORBIDDEN',message:'Agency has overdue credit exposure. Contact finance.'});
    }
    const exposureBefore=await getOpenExposure(partnerId);
    const availableBefore=Math.max(0,creditLimit-exposureBefore);
    if(recheck.sellTotal>availableBefore) {
      throw new ZiteError({code:'FORBIDDEN',message:`Insufficient agency credit. Available AED ${availableBefore.toFixed(2)}; booking requires AED ${recheck.sellTotal.toFixed(2)}.`});
    }

    const due=new Date();
    due.setUTCDate(due.getUTCDate()+terms);
    const dueDate=due.toISOString().slice(0,10);
    const adults=input.roomConfigs.reduce((s,r)=>s+r.adults,0);
    const children=input.roomConfigs.reduce((s,r)=>s+r.children,0);
    const lead=recheck.assignments[0];

    const snapshotJson=JSON.stringify({
      pricingVersion:'multi-room-v3',
      holdToken:input.holdToken,
      holdExpiresAt:holdLines.records[0]?.expiresAt || null,
      recheckStatus:recheck.status,
      recheckedAt:recheck.recheckedAt,
      combinationSignature:recheck.signature,
      requestedRoomConfigs:input.roomConfigs,
      assignments:recheck.assignments,
      totals:{netTotal:recheck.netTotal,sellTotal:recheck.sellTotal},
      nationality:input.nationality,
      agency:{partnerId,agencyName:partner.agencyName||'',agencyEmail:partner.agencyEmail||''},
      credit:{limit:creditLimit,availableBefore,termsDays:terms},
    });

    const booking=await zite.bookings.create({
      record:{
        companyName:partner.agencyName||'',
        guestName:input.guestName,
        checkinDate:input.checkIn,
        checkoutDate:input.checkOut,
        rooms:input.roomConfigs.length,
        adults,
        children,
        contactEmail:partner.agencyEmail||'',
        whatsAppNumber:partner.agencyMobile,
        hotel:input.hotelId,
        roomType:lead.roomTypeId,
        ratePlan:lead.ratePlanId,
        mealPlan:lead.mealPlan as any,
        partnerAccount:partnerId,
        bookingSource:'Partner Account',
        businessType:partner.businessType,
        contactCountry:partner.country,
        contactCity:partner.city,
        status:'Awaiting Hotel',
        pricingStatus:'Booked',
        holdExpiresAt:holdLines.records[0]?.expiresAt || null,
        priceRecheckedAt:recheck.recheckedAt,
        requestKey,
        specialRequests:input.specialRequests,
        adminNotes:snapshotJson,
        netTotal:recheck.netTotal,
        sellTotal:recheck.sellTotal,
        snapshotJson,
        creditSettlementStatus:'Open',
        creditDueDate:dueDate,
      } as any,
    });

    const mealMap:Record<string,string>={'Room Only':'Room Only','Bed & Breakfast':'Bed & Breakfast','Half Board':'Half Board','Full Board':'Full Board','All Inclusive':'All Inclusive'};
    await zite.bookingRooms.bulkCreate({
      records:recheck.assignments.map((a,index)=>{
        const rc=input.roomConfigs[index];
        const nightlyCount=Math.max(1,a.nightly.length);
        return {
          booking:booking.id,
          roomNo:a.requestedRoomNo,
          roomType:a.roomTypeId,
          ratePlan:a.ratePlanId,
          mealPlan:(mealMap[a.mealPlan]||a.mealPlan) as any,
          adults:rc.adults,
          children:rc.children,
          childAges:rc.childAges.join(','),
          nights:recheck.nights,
          baseRate:a.nightly.reduce((s,n)=>s+n.baseNet,0),
          childTotal:a.childTotal,
          extraBedTotal:a.extraBedTotal,
          nightlyTotal:a.roomSellTotal/nightlyCount,
          roomTotal:a.roomSellTotal,
          isValidOccupancy:true,
          payingChildren:a.childTotal>0?rc.children:0,
          freeChildren:a.childTotal>0?0:rc.children,
          coverageStatus:'Complete',
        };
      }),
    });

    const bookedRooms=await zite.bookingRooms.findAll({filters:{booking:booking.id},limit:100});
    const roomIdByNo=new Map(bookedRooms.records.map(r=>[Number(r.roomNo||0),r.id]));
    const nightlySnapshots:any[]=[];
    for(let roomIndex=0;roomIndex<recheck.assignments.length;roomIndex++){
      const a=recheck.assignments[roomIndex];
      const rc=input.roomConfigs[roomIndex];
      const prePromoSell=a.nightly.reduce((s,n)=>s+n.sell,0);
      let allocatedFinal=0;
      for(let nightIndex=0;nightIndex<a.nightly.length;nightIndex++){
        const n=a.nightly[nightIndex];
        const isLast=nightIndex===a.nightly.length-1;
        const finalNightSell=isLast
          ? Math.round((a.roomSellTotal-allocatedFinal)*100)/100
          : Math.round((prePromoSell>0?a.roomSellTotal*(n.sell/prePromoSell):a.roomSellTotal/a.nightly.length)*100)/100;
        allocatedFinal=Math.round((allocatedFinal+finalNightSell)*100)/100;
        nightlySnapshots.push({
          snapshotKey:`${booking.id}:${a.requestedRoomNo}:${n.date}`,
          bookingId:booking.id,
          bookingRoomId:roomIdByNo.get(a.requestedRoomNo)||'',
          roomNo:a.requestedRoomNo,
          stayDate:n.date,
          roomTypeId:a.roomTypeId,
          ratePlanId:a.ratePlanId,
          occupancyBasis:n.occupancyBasis,
          adults:rc.adults,
          children:rc.children,
          childDetailsJson:JSON.stringify(n.childCharges||[]),
          baseNet:n.baseNet,
          childTotal:n.childTotal,
          extraBedCount:n.extraBedCount,
          extraBedTotal:n.extraBedTotal,
          eventSupplement:n.eventSupplement,
          netTotal:n.net,
          sellTotal:finalNightSell,
          currency:'AED',
          pricingVersion:'multi-room-v3',
          recheckedAt:recheck.recheckedAt,
        });
      }
    }
    for(let i=0;i<nightlySnapshots.length;i+=100){
      await zite.bookingNightlySnapshots.bulkCreate({records:nightlySnapshots.slice(i,i+100)});
    }

    const seq=String((booking as any).bookingRef||'').padStart(6,'0');
    const refDate=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const suffix=seq||booking.id.slice(0,6).toUpperCase();
    const bookingReference=`UAEWB-${refDate}-${suffix}`;
    await zite.bookings.update({id:booking.id,record:{bookingReference,invoiceNumber:`INV-${refDate}-${suffix}`} as any});

    const exposureAfter=await getOpenExposure(partnerId);
    if(exposureAfter>creditLimit) {
      await zite.bookings.update({
        id:booking.id,
        record:{status:'Rejected',creditSettlementStatus:'Released',pricingStatus:'Expired',adminNotes:snapshotJson+'\nCREDIT_GUARD: concurrent exposure exceeded limit'} as any,
      });
      for(const line of holdLines.records){
        if(line.status==='Active') await zite.rateHoldLines.update({id:line.id,record:{status:'Released'}});
      }
      for(const hold of holdMasters.records){
        if(hold.holdStatus==='Active') await zite.rateHolds.update({id:hold.id,record:{holdStatus:'Released',booking:booking.id}});
      }
      throw new ZiteError({code:'CONFLICT',message:'Credit availability changed during submission. The inventory hold was released; please review your wallet and try again.'});
    }

    const ledgerResult=await ensureBookedInventoryLedger({
      bookingId:booking.id,
      bookingReference,
      holdToken:input.holdToken,
      pricingVersion:'multi-room-v3',
    });

    for(const line of holdLines.records){
      if(line.status==='Active') await zite.rateHoldLines.update({id:line.id,record:{status:'Converted'}});
    }
    for(const hold of holdMasters.records){
      if(hold.holdStatus==='Active') await zite.rateHolds.update({id:hold.id,record:{holdStatus:'Converted',booking:booking.id}});
    }
    const movementRows=await appendBookingMovements({
      bookingId:booking.id,bookingReference,holdToken:input.holdToken,
      source:'hold_to_booking',actor:partner.agencyEmail||'Partner',
      notes:'Inventory reclassified from active hold to durable booked inventory',
    });

    await zite.bookingEvents.create({
      record:{
        eventName:'partner_multi_room_booking_requested',
        booking:booking.id,
        details:`Rooms ${recheck.rooms}; signature ${recheck.signature}; hold ${input.holdToken}; booked inventory ledger ${ledgerResult.created}/${ledgerResult.total}; inventory movements ${movementRows}; nightly snapshots ${nightlySnapshots.length}; sell AED ${recheck.sellTotal.toFixed(2)}; available after AED ${Math.max(0,creditLimit-exposureAfter).toFixed(2)}`,
      },
    });

    return {
      success:true,
      bookingId:booking.id,
      bookingReference,
      creditAvailableAfter:Math.max(0,creditLimit-exposureAfter),
      pricingStatus:'Booked' as const,
    };
  },
});
