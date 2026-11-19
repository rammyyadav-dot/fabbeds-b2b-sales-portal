import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';
import { assessBookingCertification } from '../lib/bookingCertification';

export default createEndpoint({
  authenticated:true,
  description:'Admin evidence viewer for a certified multi-room booking',
  inputSchema:z.object({bookingId:z.string().min(1)}),
  outputSchema:z.object({
    booking:z.object({
      id:z.string(),reference:z.string(),status:z.string(),pricingStatus:z.string(),sellTotal:z.number(),netTotal:z.number(),
      checkIn:z.string(),checkOut:z.string(),rooms:z.number(),adults:z.number(),children:z.number(),
      pricingVersion:z.string(),holdToken:z.string(),holdExpiresAt:z.string(),priceRecheckedAt:z.string(),
      snapshotJson:z.string(),
    }),
    rooms:z.array(z.object({
      roomNo:z.number(),roomTypeId:z.string(),roomTypeName:z.string(),ratePlanId:z.string(),ratePlanName:z.string(),
      mealPlan:z.string(),adults:z.number(),children:z.number(),childAges:z.string(),nights:z.number(),roomTotal:z.number(),
      childTotal:z.number(),extraBedTotal:z.number(),coverageStatus:z.string(),
    })),
    nights:z.array(z.object({
      roomNo:z.number(),stayDate:z.string(),roomTypeId:z.string(),ratePlanId:z.string(),occupancyBasis:z.string(),
      adults:z.number(),children:z.number(),childDetailsJson:z.string(),baseNet:z.number(),childTotal:z.number(),
      extraBedCount:z.number(),extraBedTotal:z.number(),eventSupplement:z.number(),netTotal:z.number(),sellTotal:z.number(),
      currency:z.string(),pricingVersion:z.string(),recheckedAt:z.string(),
    })),
    hold:z.object({token:z.string(),status:z.string(),expiresAt:z.string(),quotedSellTotal:z.number(),masters:z.number(),lines:z.number()}),
    evidence:z.object({
      expectedNightlySnapshots:z.number(),actualNightlySnapshots:z.number(),nightlyCoverage:z.string(),
      sellTotalFromNights:z.number(),sellDelta:z.number(),
      inventoryLedgerExpected:z.number(),inventoryLedgerBooked:z.number(),inventoryLedgerCoverage:z.string(),
    }),
    certification:z.object({
      status:z.enum(['PASS','WARN','FAIL']),gate:z.enum(['ALLOW','WARN','BLOCK']),checkedAt:z.string(),
      reasons:z.array(z.string()),criticalReasons:z.array(z.string()),warnings:z.array(z.string()),
    }),
  }),
  execute:async({input,context})=>{
    await requireAdmin(context,'view booking certification evidence');
    const booking=await zite.bookings.findOne({id:input.bookingId});
    if(!booking) throw new ZiteError({code:'NOT_FOUND',message:'Booking not found.'});
    let snap:any={};try{snap=JSON.parse(booking.snapshotJson||'{}');}catch{}
    const [bookingRoomsRes,nightRes,ledgerRes,roomTypesRes,plansRes]=await Promise.all([
      zite.bookingRooms.findAll({filters:{booking:input.bookingId},limit:100}),
      zite.bookingNightlySnapshots.findAll({filters:{bookingId:input.bookingId},limit:1000}),
      zite.bookedInventoryLedger.findAll({filters:{bookingId:input.bookingId},limit:2000}),
      zite.roomTypes.findAll({limit:1000}),
      zite.ratePlans.findAll({limit:1500}),
    ]);
    const roomNames=new Map(roomTypesRes.records.map(r=>[r.id,r.roomTypeName||r.id]));
    const planNames=new Map(plansRes.records.map(r=>[r.id,r.ratePlanName||r.id]));
    const token=String(snap.holdToken||'');
    const [holdMasters,holdLines]=token?await Promise.all([
      zite.rateHolds.findAll({filters:{holdToken:token},limit:100}),
      zite.rateHoldLines.findAll({filters:{holdToken:token},limit:1000}),
    ]):[{records:[] as any[]},{records:[] as any[]}];
    const masterStatus=holdMasters.records.some((h:any)=>h.holdStatus==='Converted')?'Converted':String((holdMasters.records[0] as any)?.holdStatus||'Missing');
    const rooms=bookingRoomsRes.records.sort((a,b)=>Number(a.roomNo||0)-Number(b.roomNo||0)).map(r=>{
      const rt=String(Array.isArray(r.roomType)?r.roomType[0]||'':r.roomType||'');
      const rp=String(Array.isArray(r.ratePlan)?r.ratePlan[0]||'':r.ratePlan||'');
      return {
        roomNo:Number(r.roomNo||0),roomTypeId:rt,roomTypeName:roomNames.get(rt)||rt,
        ratePlanId:rp,ratePlanName:planNames.get(rp)||rp,mealPlan:String(r.mealPlan||''),
        adults:Number(r.adults||0),children:Number(r.children||0),childAges:String(r.childAges||''),
        nights:Number(r.nights||0),roomTotal:Number(r.roomTotal||0),childTotal:Number(r.childTotal||0),
        extraBedTotal:Number(r.extraBedTotal||0),coverageStatus:String(r.coverageStatus||''),
      };
    });
    const nights=nightRes.records.sort((a,b)=>Number(a.roomNo||0)-Number(b.roomNo||0)||String(a.stayDate||'').localeCompare(String(b.stayDate||''))).map(n=>({
      roomNo:Number(n.roomNo||0),stayDate:String(n.stayDate||''),roomTypeId:String(n.roomTypeId||''),ratePlanId:String(n.ratePlanId||''),
      occupancyBasis:String(n.occupancyBasis||''),adults:Number(n.adults||0),children:Number(n.children||0),
      childDetailsJson:String(n.childDetailsJson||''),baseNet:Number(n.baseNet||0),childTotal:Number(n.childTotal||0),
      extraBedCount:Number(n.extraBedCount||0),extraBedTotal:Number(n.extraBedTotal||0),eventSupplement:Number(n.eventSupplement||0),
      netTotal:Number(n.netTotal||0),sellTotal:Number(n.sellTotal||0),currency:String(n.currency||'AED'),
      pricingVersion:String(n.pricingVersion||''),recheckedAt:String(n.recheckedAt||''),
    }));
    const bookingRooms=Number(booking.rooms||rooms.length||0);
    const checkIn=String(booking.checkinDate||'');
    const checkOut=String(booking.checkoutDate||'');
    const nightsCount=Math.max(0,Math.round((new Date(checkOut).getTime()-new Date(checkIn).getTime())/86400000));
    const expected=bookingRooms*nightsCount;
    const sellFromNights=Math.round(nights.reduce((s,n)=>s+n.sellTotal,0)*100)/100;
    const bookingSell=Number(booking.sellTotal||0);
    const certification=await assessBookingCertification(input.bookingId);
    return {
      booking:{
        id:booking.id,reference:booking.bookingReference||String(booking.bookingRef||booking.id),status:String(booking.status||''),
        pricingStatus:String(booking.pricingStatus||''),sellTotal:bookingSell,netTotal:Number(booking.netTotal||0),
        checkIn,checkOut,rooms:bookingRooms,adults:Number(booking.adults||0),children:Number(booking.children||0),
        pricingVersion:String(snap.pricingVersion||''),holdToken:token,holdExpiresAt:String(booking.holdExpiresAt||snap.holdExpiresAt||''),
        priceRecheckedAt:String(booking.priceRecheckedAt||snap.recheckedAt||''),snapshotJson:booking.snapshotJson||'',
      },
      rooms,nights,
      hold:{token,status:masterStatus,expiresAt:String((holdMasters.records[0] as any)?.expiresAt||''),quotedSellTotal:Number((holdMasters.records[0] as any)?.quotedSellTotal||0),masters:holdMasters.records.length,lines:holdLines.records.length},
      evidence:{
        expectedNightlySnapshots:expected,actualNightlySnapshots:nights.length,
        nightlyCoverage:expected>0&&nights.length===expected?'COMPLETE':nights.length?'INCOMPLETE':'MISSING',
        sellTotalFromNights:sellFromNights,sellDelta:Math.round((sellFromNights-bookingSell)*100)/100,
        inventoryLedgerExpected:holdLines.records.length,
        inventoryLedgerBooked:ledgerRes.records.filter(x=>x.status==='Booked').length,
        inventoryLedgerCoverage:holdLines.records.length>0&&ledgerRes.records.filter(x=>x.status==='Booked').length===holdLines.records.length?'COMPLETE':ledgerRes.records.some(x=>x.status==='Booked')?'INCOMPLETE':'MISSING',
      },
      certification:{
        status:certification.status,gate:certification.gate,checkedAt:certification.checkedAt,
        reasons:certification.reasons,criticalReasons:certification.criticalReasons,warnings:certification.warnings,
      },
    };
  },
});
