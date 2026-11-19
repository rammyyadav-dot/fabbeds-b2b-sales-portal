import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';

const holdSchema=z.object({
  holdToken:z.string(),
  status:z.string(),
  partnerId:z.string(),
  partnerName:z.string(),
  hotelId:z.string(),
  hotelName:z.string(),
  expiresAt:z.string(),
  quotedSellTotal:z.number(),
  signature:z.string(),
  roomNights:z.number(),
  roomsHeld:z.number(),
  ratePlans:z.number(),
  bookingId:z.string(),
  secondsRemaining:z.number(),
});

const exposureSchema=z.object({
  hotelId:z.string(),
  hotelName:z.string(),
  roomTypeId:z.string(),
  roomTypeName:z.string(),
  ratePlanId:z.string(),
  ratePlanName:z.string(),
  stayDate:z.string(),
  status:z.string(),
  allocation:z.number().nullable(),
  activeHeld:z.number(),
  bookedSold:z.number(),
  totalConsumed:z.number(),
  remaining:z.number().nullable(),
  utilizationPct:z.number().nullable(),
  risk:z.enum(['OK','WATCH','FULL','OVER']),
});

const bookingSchema=z.object({
  bookingId:z.string(),
  bookingReference:z.string(),
  hotelName:z.string(),
  partnerName:z.string(),
  status:z.string(),
  pricingStatus:z.string(),
  rooms:z.number(),
  nights:z.number(),
  sellTotal:z.number(),
  priceRecheckedAt:z.string(),
  holdToken:z.string(),
  holdStatus:z.string(),
  nightlySnapshots:z.number(),
  expectedNightlySnapshots:z.number(),
  snapshotCoverage:z.enum(['COMPLETE','INCOMPLETE','MISSING']),
  pricingVersion:z.string(),
  certificationStatus:z.enum(['PASS','WARN','FAIL']),
  confirmationGate:z.enum(['ALLOW','WARN','BLOCK']),
  certificationReasons:z.array(z.string()),
  sellDelta:z.number(),
});

const alertSchema=z.object({
  severity:z.enum(['P0','P1','P2']),
  code:z.string(),
  title:z.string(),
  detail:z.string(),
  holdToken:z.string(),
  bookingId:z.string(),
});

export default createEndpoint({
  authenticated:true,
  description:'Admin inventory hold and multi-room booking certification dashboard',
  inputSchema:z.object({}),
  outputSchema:z.object({
    checkedAt:z.string(),
    summary:z.object({
      activeHolds:z.number(),
      activeHeldRoomNights:z.number(),
      expiringSoon:z.number(),
      convertedHolds:z.number(),
      releasedHolds:z.number(),
      expiredHolds:z.number(),
      overAllocationCells:z.number(),
      certifiedBookings:z.number(),
      warningBookings:z.number(),
      failedBookings:z.number(),
      blockedConfirmations:z.number(),
      incompleteBookings:z.number(),
      alerts:z.number(),
    }),
    activeHolds:z.array(holdSchema),
    holdHistory:z.array(holdSchema),
    exposure:z.array(exposureSchema),
    bookings:z.array(bookingSchema),
    alerts:z.array(alertSchema),
  }),
  execute:async({context})=>{
    await requireAdmin(context,'view booking certification and inventory holds');
    const now=Date.now();

    const [linesRes,mastersRes,bookingsRes,bookingRoomsRes,snapshotsRes,ledgerRes,hotelsRes,roomsRes,plansRes,partnersRes,exposureSql]=await Promise.all([
      zite.rateHoldLines.findAll({limit:2000}),
      zite.rateHolds.findAll({limit:2000}),
      zite.bookings.findAll({limit:1000}),
      zite.bookingRooms.findAll({limit:2000}),
      zite.bookingNightlySnapshots.findAll({limit:2000}),
      zite.bookedInventoryLedger.findAll({limit:2000}),
      zite.hotels.findAll({limit:1000}),
      zite.roomTypes.findAll({limit:1000}),
      zite.ratePlans.findAll({limit:1500}),
      zite.partnerAccounts.findAll({limit:1000}),
      zite.sql({query:`
        WITH held AS (
          SELECT "hotelId","roomTypeId","ratePlanId","stayDate",
                 SUM("quantity") AS "activeHeld"
          FROM "RateHoldLines"
          WHERE "status"='Active' AND "expiresAt">CURRENT_TIMESTAMP
          GROUP BY "hotelId","roomTypeId","ratePlanId","stayDate"
        ),
        sold AS (
          SELECT "hotelId","roomTypeId","ratePlanId","stayDate",
                 SUM("quantity") AS "bookedSold"
          FROM "BookedInventoryLedger"
          WHERE "status"='Booked'
          GROUP BY "hotelId","roomTypeId","ratePlanId","stayDate"
        ),
        inventory AS (
          SELECT COALESCE(h."hotelId",s."hotelId") AS "hotelId",
                 COALESCE(h."roomTypeId",s."roomTypeId") AS "roomTypeId",
                 COALESCE(h."ratePlanId",s."ratePlanId") AS "ratePlanId",
                 COALESCE(h."stayDate",s."stayDate") AS "stayDate",
                 COALESCE(h."activeHeld",0) AS "activeHeld",
                 COALESCE(s."bookedSold",0) AS "bookedSold"
          FROM held h
          FULL OUTER JOIN sold s ON s."hotelId"=h."hotelId" AND s."roomTypeId"=h."roomTypeId"
            AND s."ratePlanId"=h."ratePlanId" AND s."stayDate"=h."stayDate"
        ),
        ranked AS (
          SELECT l_h."hotelsId"::text AS "hotelId",
                 l_rt."roomTypesId"::text AS "roomTypeId",
                 l_rp."ratePlansId"::text AS "ratePlanId",
                 dr."rateDate" AS "stayDate",
                 dr."allocation",dr."status",dr."layer",dr."priority",dr.updated_at,
                 ROW_NUMBER() OVER (
                   PARTITION BY l_h."hotelsId",l_rt."roomTypesId",l_rp."ratePlansId",dr."rateDate"
                   ORDER BY
                     CASE COALESCE(dr."layer",'BASE') WHEN 'OVERRIDE' THEN 4 WHEN 'PROMO' THEN 3 WHEN 'BASE' THEN 2 WHEN 'FALLBACK' THEN 1 ELSE 0 END DESC,
                     COALESCE(dr."priority",0) DESC,dr.updated_at DESC,dr.id DESC
                 ) AS rn
          FROM "DailyRates" dr
          JOIN "DailyRatesHotels" l_h ON l_h."dailyRatesId"=dr.id
          JOIN "DailyRatesRoomTypes" l_rt ON l_rt."dailyRatesId"=dr.id
          JOIN "DailyRatesRatePlans" l_rp ON l_rp."dailyRatesId"=dr.id
          WHERE (dr."integrityStatus" IS NULL OR dr."integrityStatus"!='Quarantined')
        )
        SELECT i."hotelId",i."roomTypeId",i."ratePlanId",i."stayDate",i."activeHeld",i."bookedSold",
               r."allocation",r."status"
        FROM inventory i
        LEFT JOIN ranked r ON r."hotelId"=i."hotelId" AND r."roomTypeId"=i."roomTypeId"
          AND r."ratePlanId"=i."ratePlanId" AND r."stayDate"=i."stayDate" AND r.rn=1
        ORDER BY i."stayDate",i."hotelId",i."roomTypeId"
      `}),
    ]);

    const hotels=new Map(hotelsRes.records.map(h=>[h.id,h]));
    const rooms=new Map(roomsRes.records.map(r=>[r.id,r]));
    const plans=new Map(plansRes.records.map(p=>[p.id,p]));
    const partners=new Map(partnersRes.records.map(p=>[p.id,p]));
    const mastersByToken=new Map<string,typeof mastersRes.records>();
    for(const m of mastersRes.records){
      const key=String(m.holdToken||''); if(!key)continue;
      const list=mastersByToken.get(key)||[];list.push(m);mastersByToken.set(key,list);
    }

    const lineGroups=new Map<string,typeof linesRes.records>();
    for(const line of linesRes.records){
      const token=String(line.holdToken||'');if(!token)continue;
      const list=lineGroups.get(token)||[];list.push(line);lineGroups.set(token,list);
    }

    const holdRows=[...lineGroups.entries()].map(([token,lines])=>{
      const master=mastersByToken.get(token)||[];
      const statuses=new Set(lines.map(x=>String(x.status||'')));
      const status=statuses.has('Active')?'Active':statuses.has('Converted')?'Converted':statuses.has('Released')?'Released':'Expired';
      const first=lines[0];
      const expiry=lines.map(x=>x.expiresAt||'').filter(Boolean).sort()[0]||master[0]?.expiresAt||'';
      const expiresMs=expiry?new Date(expiry).getTime():0;
      const partner=partners.get(String(first.partnerId||''));
      const hotel=hotels.get(String(first.hotelId||''));
      const bookingId=String(Array.isArray(master[0]?.booking)?master[0]?.booking?.[0]||'':master[0]?.booking||'');
      const uniqueRoomDates=new Set(lines.map(x=>`${x.roomTypeId}|${x.ratePlanId}|${x.stayDate}`));
      const roomsHeld=Math.max(0,...lines.map(x=>Number(x.quantity||0)));
      const ratePlans=new Set(lines.map(x=>String(x.ratePlanId||'')).filter(Boolean)).size;
      return {
        holdToken:token,status,partnerId:String(first.partnerId||''),partnerName:partner?.agencyName||partner?.agencyEmail||String(first.partnerId||''),
        hotelId:String(first.hotelId||''),hotelName:hotel?.hotelName||String(first.hotelId||''),
        expiresAt:expiry,quotedSellTotal:Number(first.quotedSellTotal||master[0]?.quotedSellTotal||0),
        signature:String(first.combinationSignature||''),roomNights:uniqueRoomDates.size,roomsHeld,ratePlans,bookingId,
        secondsRemaining:expiresMs?Math.max(0,Math.ceil((expiresMs-now)/1000)):0,
      };
    }).sort((a,b)=>(b.status==='Active'?1:0)-(a.status==='Active'?1:0)||String(b.expiresAt).localeCompare(String(a.expiresAt)));

    const exposure=exposureSql.rows.map((row:any)=>{
      const allocation=row.allocation==null?null:Number(row.allocation||0);
      const held=Number(row.activeHeld||0);
      const bookedSold=Number(row.bookedSold||0);
      const totalConsumed=held+bookedSold;
      const status=String(row.status||'');
      const unlimited=status==='Free Sale' && allocation==null;
      const remaining=unlimited?null:Math.max(0,(allocation||0)-totalConsumed);
      const pct=unlimited||!allocation?null:Math.round((totalConsumed/allocation)*1000)/10;
      const risk=unlimited?'OK':totalConsumed>(allocation||0)?'OVER':totalConsumed===(allocation||0)&&totalConsumed>0?'FULL':pct!=null&&pct>=80?'WATCH':'OK';
      return {
        hotelId:String(row.hotelId||''),hotelName:hotels.get(String(row.hotelId||''))?.hotelName||String(row.hotelId||''),
        roomTypeId:String(row.roomTypeId||''),roomTypeName:rooms.get(String(row.roomTypeId||''))?.roomTypeName||String(row.roomTypeId||''),
        ratePlanId:String(row.ratePlanId||''),ratePlanName:plans.get(String(row.ratePlanId||''))?.ratePlanName||String(row.ratePlanId||''),
        stayDate:row.stayDate?new Date(row.stayDate).toISOString().slice(0,10):'',
        status,allocation,activeHeld:held,bookedSold,totalConsumed,remaining,utilizationPct:pct,risk:risk as 'OK'|'WATCH'|'FULL'|'OVER',
      };
    });

    const snapshotsByBooking=new Map<string,typeof snapshotsRes.records>();
    for(const s of snapshotsRes.records){
      const key=String(s.bookingId||'');if(!key)continue;
      const list=snapshotsByBooking.get(key)||[];list.push(s);snapshotsByBooking.set(key,list);
    }
    const roomsByBooking=new Map<string,typeof bookingRoomsRes.records>();
    for(const room of bookingRoomsRes.records){
      const key=String(Array.isArray(room.booking)?room.booking[0]||'':room.booking||'');if(!key)continue;
      const list=roomsByBooking.get(key)||[];list.push(room);roomsByBooking.set(key,list);
    }
    const ledgerByBooking=new Map<string,typeof ledgerRes.records>();
    for(const ledger of ledgerRes.records){
      const key=String(ledger.bookingId||'');if(!key)continue;
      const list=ledgerByBooking.get(key)||[];list.push(ledger);ledgerByBooking.set(key,list);
    }
    const bookingRows=bookingsRes.records
      .filter(b=>!['Cancelled','Rejected'].includes(String(b.status||'')))
      .map(b=>{
        let snap:any={};try{snap=JSON.parse(b.snapshotJson||'{}');}catch{}
        const nightly=snapshotsByBooking.get(b.id)||[];
        const rooms=Number(b.rooms||snap.requestedRoomConfigs?.length||0);
        const nights=Math.max(0,Math.round((new Date(String(b.checkoutDate||'')).getTime()-new Date(String(b.checkinDate||'')).getTime())/86400000));
        const expected=rooms*nights;
        const coverage=expected<=0||nightly.length===0?'MISSING':nightly.length===expected?'COMPLETE':'INCOMPLETE';
        const hotelId=String(Array.isArray(b.hotel)?b.hotel[0]||'':b.hotel||'');
        const partnerId=String(Array.isArray(b.partnerAccount)?b.partnerAccount[0]||'':b.partnerAccount||'');
        const token=String(snap.holdToken||'');
        const master=mastersByToken.get(token)||[];
        const holdStatus=master.some(x=>x.holdStatus==='Converted')?'Converted':master[0]?.holdStatus||'Missing';
        const bookingRooms=roomsByBooking.get(b.id)||[];
        const pricingVersion=String(snap.pricingVersion||'');
        const sellTotal=Math.round(Number(b.sellTotal||0)*100)/100;
        const sellFromNights=Math.round(nightly.reduce((sum,n)=>sum+Number(n.sellTotal||0),0)*100)/100;
        const sellDelta=Math.round((sellFromNights-sellTotal)*100)/100;
        const reasons:string[]=[];
        const isV3=pricingVersion==='multi-room-v3';
        if(isV3){
          if(!token)reasons.push('HOLD_TOKEN_MISSING');
          if(holdStatus!=='Converted')reasons.push('HOLD_NOT_CONVERTED');
          const activeLedger=(ledgerByBooking.get(b.id)||[]).filter(x=>x.status==='Booked');
          const expectedHoldLines=(lineGroups.get(token)||[]);
          if(activeLedger.length!==expectedHoldLines.length)reasons.push('BOOKED_INVENTORY_LEDGER_INCOMPLETE');
          const holdQtyByKey=new Map(expectedHoldLines.map(x=>[
            `${x.roomTypeId}|${x.ratePlanId}|${String(x.stayDate||'').slice(0,10)}`,
            Number(x.quantity||0)
          ]));
          if(activeLedger.some(x=>holdQtyByKey.get(`${x.roomTypeId}|${x.ratePlanId}|${String(x.stayDate||'').slice(0,10)}`)!==Number(x.quantity||0))) {
            reasons.push('BOOKED_INVENTORY_LEDGER_QUANTITY_MISMATCH');
          }
          if(bookingRooms.length!==rooms)reasons.push('BOOKING_ROOM_COUNT_MISMATCH');
          if(coverage!=='COMPLETE')reasons.push('NIGHTLY_SNAPSHOT_COVERAGE_INCOMPLETE');
          if(Math.abs(sellDelta)>=0.01)reasons.push('NIGHTLY_SELL_RECONCILIATION_FAILED');
          if(String(b.pricingStatus||'')!=='Booked')reasons.push('PRICING_STATUS_NOT_BOOKED');
          if(!b.priceRecheckedAt&&!snap.recheckedAt)reasons.push('PRICE_RECHECK_TIMESTAMP_MISSING');
          if(!snap.combinationSignature)reasons.push('COMBINATION_SIGNATURE_MISSING');
          if(!Array.isArray(snap.requestedRoomConfigs)||snap.requestedRoomConfigs.length!==rooms)reasons.push('ROOM_CONFIG_SNAPSHOT_MISMATCH');
          if(!Array.isArray(snap.assignments)||snap.assignments.length!==rooms)reasons.push('ASSIGNMENT_SNAPSHOT_MISMATCH');
          if(bookingRooms.some(room=>String(room.coverageStatus||'')!=='Complete'||Number(room.roomTotal||0)<=0))reasons.push('ROOM_EVIDENCE_INVALID');
          if(nightly.some(n=>String(n.pricingVersion||'')!=='multi-room-v3'||Number(n.sellTotal||0)<=0||Number(n.netTotal||0)<=0||Number(n.sellTotal||0)+0.001<Number(n.netTotal||0)))reasons.push('NIGHTLY_EVIDENCE_INVALID');
        }else{
          reasons.push(pricingVersion==='multi-room-v2'?'LEGACY_MULTI_ROOM_V2':'LEGACY_BOOKING_NOT_V3');
          if(!b.hotel||!b.roomType||!b.ratePlan||sellTotal<=0||nights<=0||rooms<=0)reasons.push('LEGACY_CORE_EVIDENCE_INCOMPLETE');
        }
        const uniqueReasons=Array.from(new Set(reasons));
        const legacyOnly=uniqueReasons.length===1&&(uniqueReasons[0]==='LEGACY_MULTI_ROOM_V2'||uniqueReasons[0]==='LEGACY_BOOKING_NOT_V3');
        const certificationStatus=(uniqueReasons.length===0?'PASS':legacyOnly?'WARN':'FAIL') as 'PASS'|'WARN'|'FAIL';
        const confirmationGate=(certificationStatus==='PASS'?'ALLOW':certificationStatus==='WARN'?'WARN':'BLOCK') as 'ALLOW'|'WARN'|'BLOCK';
        return {
          bookingId:b.id,bookingReference:b.bookingReference||String(b.bookingRef||b.id),
          hotelName:hotels.get(hotelId)?.hotelName||hotelId,
          partnerName:partners.get(partnerId)?.agencyName||partners.get(partnerId)?.agencyEmail||partnerId,
          status:String(b.status||''),pricingStatus:String(b.pricingStatus||''),rooms,nights,sellTotal,
          priceRecheckedAt:b.priceRecheckedAt?String(b.priceRecheckedAt):'',holdToken:token,holdStatus,
          nightlySnapshots:nightly.length,expectedNightlySnapshots:expected,snapshotCoverage:coverage as 'COMPLETE'|'INCOMPLETE'|'MISSING',
          pricingVersion,certificationStatus,confirmationGate,certificationReasons:uniqueReasons,sellDelta,
        };
      }).sort((a,b)=>String(b.priceRecheckedAt).localeCompare(String(a.priceRecheckedAt)));

    const alerts:Array<{severity:'P0'|'P1'|'P2';code:string;title:string;detail:string;holdToken:string;bookingId:string}>=[];
    for(const hold of holdRows){
      if(hold.status==='Active'&&hold.secondsRemaining===0) alerts.push({severity:'P0',code:'EXPIRED_ACTIVE_HOLD',title:'Expired hold still marked Active',detail:`${hold.hotelName} · ${hold.holdToken}`,holdToken:hold.holdToken,bookingId:hold.bookingId});
      if(hold.status==='Active'&&!mastersByToken.has(hold.holdToken)) alerts.push({severity:'P0',code:'ORPHANED_HOLD_LINES',title:'Active hold has no master hold',detail:`${hold.hotelName} · ${hold.roomNights} room-night lines`,holdToken:hold.holdToken,bookingId:''});
      if(hold.status==='Active'&&hold.secondsRemaining>0&&hold.secondsRemaining<=120) alerts.push({severity:'P2',code:'HOLD_EXPIRING_SOON',title:'Inventory hold expires within 2 minutes',detail:`${hold.partnerName} · ${hold.hotelName}`,holdToken:hold.holdToken,bookingId:hold.bookingId});
    }
    for(const cell of exposure){
      if(cell.risk==='OVER') alerts.push({severity:'P0',code:'ALLOCATION_OVERCONSUMED',title:'Held + booked inventory exceeds authoritative allocation',detail:`${cell.hotelName} · ${cell.roomTypeName} · ${cell.stayDate}: held ${cell.activeHeld}, booked ${cell.bookedSold}, total ${cell.totalConsumed}, allocation ${cell.allocation}`,holdToken:'',bookingId:''});
      else if(cell.risk==='FULL') alerts.push({severity:'P1',code:'ALLOCATION_FULLY_CONSUMED',title:'Authoritative allocation fully consumed',detail:`${cell.hotelName} · ${cell.roomTypeName} · ${cell.stayDate}: held ${cell.activeHeld}, booked ${cell.bookedSold}`,holdToken:'',bookingId:''});
    }
    for(const b of bookingRows){
      if(b.certificationStatus==='FAIL') alerts.push({severity:'P0',code:'BOOKING_CERTIFICATION_FAILED',title:'Booking certification failed — hotel confirmation blocked',detail:`${b.bookingReference}: ${b.certificationReasons.join(' · ')}`,holdToken:b.holdToken,bookingId:b.bookingId});
      else if(b.certificationStatus==='WARN') alerts.push({severity:'P2',code:'BOOKING_CERTIFICATION_WARNING',title:'Legacy booking requires review before confirmation',detail:`${b.bookingReference}: ${b.certificationReasons.join(' · ')}`,holdToken:b.holdToken,bookingId:b.bookingId});
    }
    const severityOrder={P0:0,P1:1,P2:2};alerts.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]);

    const activeHolds=holdRows.filter(x=>x.status==='Active'&&x.secondsRemaining>0);
    const history=holdRows.filter(x=>x.status!=='Active'||x.secondsRemaining===0).slice(0,200);
    return {
      checkedAt:new Date().toISOString(),
      summary:{
        activeHolds:activeHolds.length,
        activeHeldRoomNights:activeHolds.reduce((s,x)=>s+x.roomNights,0),
        expiringSoon:activeHolds.filter(x=>x.secondsRemaining<=120).length,
        convertedHolds:holdRows.filter(x=>x.status==='Converted').length,
        releasedHolds:holdRows.filter(x=>x.status==='Released').length,
        expiredHolds:holdRows.filter(x=>x.status==='Expired'||(x.status==='Active'&&x.secondsRemaining===0)).length,
        overAllocationCells:exposure.filter(x=>x.risk==='OVER').length,
        certifiedBookings:bookingRows.filter(x=>x.certificationStatus==='PASS').length,
        warningBookings:bookingRows.filter(x=>x.certificationStatus==='WARN').length,
        failedBookings:bookingRows.filter(x=>x.certificationStatus==='FAIL').length,
        blockedConfirmations:bookingRows.filter(x=>x.confirmationGate==='BLOCK').length,
        incompleteBookings:bookingRows.filter(x=>x.certificationStatus!=='PASS').length,
        alerts:alerts.length,
      },
      activeHolds,holdHistory:history,exposure,bookings:bookingRows.slice(0,300),alerts:alerts.slice(0,300),
    };
  },
});
