import { zite } from 'zitejs/db';

export type CertificationStatus='PASS'|'WARN'|'FAIL';
export type ConfirmationGate='ALLOW'|'WARN'|'BLOCK';

export type BookingCertificationResult={
  bookingId:string;
  bookingReference:string;
  status:CertificationStatus;
  gate:ConfirmationGate;
  checkedAt:string;
  reasons:string[];
  criticalReasons:string[];
  warnings:string[];
  pricingVersion:string;
  nightlyExpected:number;
  nightlyActual:number;
  nightlyCoverage:'COMPLETE'|'INCOMPLETE'|'MISSING';
  bookingRoomsExpected:number;
  bookingRoomsActual:number;
  holdToken:string;
  holdStatus:string;
  sellTotal:number;
  sellTotalFromNights:number;
  sellDelta:number;
  legacy:boolean;
};

const linkedId=(v:any)=>Array.isArray(v)?String(v[0]||''):String(v||'');

export async function assessBookingCertification(bookingId:string):Promise<BookingCertificationResult>{
  const booking=await zite.bookings.findOne({id:bookingId}) as any;
  if(!booking) throw new Error('Booking not found');

  let snapshot:any={};
  try{snapshot=JSON.parse(booking.snapshotJson||'{}');}catch{}
  const pricingVersion=String(snapshot.pricingVersion||'');
  const isV3=pricingVersion==='multi-room-v3';
  const isV2=pricingVersion==='multi-room-v2';
  const legacy=!isV3;

  const [roomsRes,nightsRes,ledgerRes]=await Promise.all([
    zite.bookingRooms.findAll({filters:{booking:bookingId},limit:200}),
    zite.bookingNightlySnapshots.findAll({filters:{bookingId},limit:2000}),
    zite.bookedInventoryLedger.findAll({filters:{bookingId},limit:2000}),
  ]);

  const holdToken=String(snapshot.holdToken||'');
  const [holdMasters,holdLines]=holdToken?await Promise.all([
    zite.rateHolds.findAll({filters:{holdToken},limit:100}),
    zite.rateHoldLines.findAll({filters:{holdToken},limit:2000}),
  ]):[{records:[] as any[]},{records:[] as any[]}];

  const checkIn=String(booking.checkinDate||'');
  const checkOut=String(booking.checkoutDate||'');
  const nightsCount=checkIn&&checkOut?Math.max(0,Math.round((new Date(checkOut).getTime()-new Date(checkIn).getTime())/86400000)):0;
  const roomsExpected=Math.max(0,Number(booking.rooms||snapshot.requestedRoomConfigs?.length||0));
  const expectedNightly=roomsExpected*nightsCount;
  const actualNightly=nightsRes.records.length;
  const nightlyCoverage=expectedNightly<=0||actualNightly===0?'MISSING':actualNightly===expectedNightly?'COMPLETE':'INCOMPLETE';
  const sellTotal=Math.round(Number(booking.sellTotal||0)*100)/100;
  const sellFromNights=Math.round(nightsRes.records.reduce((sum:any,n:any)=>sum+Number(n.sellTotal||0),0)*100)/100;
  const sellDelta=Math.round((sellFromNights-sellTotal)*100)/100;
  const holdStatus=holdMasters.records.some((x:any)=>x.holdStatus==='Converted')?'Converted':String((holdMasters.records[0] as any)?.holdStatus||'Missing');

  const critical:string[]=[];
  const warnings:string[]=[];

  if(isV3){
    if(!holdToken) critical.push('HOLD_TOKEN_MISSING');
    if(holdStatus!=='Converted') critical.push('HOLD_NOT_CONVERTED');
    if(!holdMasters.records.length) critical.push('HOLD_MASTER_MISSING');
    if(!holdLines.records.length) critical.push('HOLD_LINES_MISSING');
    const activeLedger=ledgerRes.records.filter(x=>x.status==='Booked');
    if(activeLedger.length!==holdLines.records.length) critical.push('BOOKED_INVENTORY_LEDGER_INCOMPLETE');
    const holdQtyByKey=new Map<string,number>(holdLines.records.map(x=>[
      `${x.roomTypeId}|${x.ratePlanId}|${String(x.stayDate||'').slice(0,10)}`,
      Number(x.quantity||0)
    ] as [string,number]));
    if(activeLedger.some(x=>holdQtyByKey.get(`${x.roomTypeId}|${x.ratePlanId}|${String(x.stayDate||'').slice(0,10)}`)!==Number(x.quantity||0))) {
      critical.push('BOOKED_INVENTORY_LEDGER_QUANTITY_MISMATCH');
    }
    if(roomsRes.records.length!==roomsExpected) critical.push('BOOKING_ROOM_COUNT_MISMATCH');
    if(nightlyCoverage!=='COMPLETE') critical.push('NIGHTLY_SNAPSHOT_COVERAGE_INCOMPLETE');
    if(Math.abs(sellDelta)>=0.01) critical.push('NIGHTLY_SELL_RECONCILIATION_FAILED');
    if(String(booking.pricingStatus||'')!=='Booked') critical.push('PRICING_STATUS_NOT_BOOKED');
    if(!booking.priceRecheckedAt&&!snapshot.recheckedAt) critical.push('PRICE_RECHECK_TIMESTAMP_MISSING');
    if(!snapshot.combinationSignature) critical.push('COMBINATION_SIGNATURE_MISSING');
    if(!Array.isArray(snapshot.requestedRoomConfigs)||snapshot.requestedRoomConfigs.length!==roomsExpected) critical.push('ROOM_CONFIG_SNAPSHOT_MISMATCH');
    if(!Array.isArray(snapshot.assignments)||snapshot.assignments.length!==roomsExpected) critical.push('ASSIGNMENT_SNAPSHOT_MISMATCH');

    for(const room of roomsRes.records as any[]){
      if(String(room.coverageStatus||'')!=='Complete') critical.push('ROOM_COVERAGE_INCOMPLETE');
      if(Number(room.roomTotal||0)<=0) critical.push('ROOM_TOTAL_INVALID');
      if(!linkedId(room.roomType)||!linkedId(room.ratePlan)) critical.push('ROOM_COMMERCIAL_LINKAGE_MISSING');
    }
    for(const night of nightsRes.records as any[]){
      if(String(night.pricingVersion||'')!=='multi-room-v3') critical.push('NIGHTLY_VERSION_MISMATCH');
      if(Number(night.sellTotal||0)<=0||Number(night.netTotal||0)<=0) critical.push('NIGHTLY_PRICE_INVALID');
      if(Number(night.sellTotal||0)+0.001<Number(night.netTotal||0)) critical.push('NIGHTLY_SELL_BELOW_NET');
      if(!night.roomTypeId||!night.ratePlanId||!night.stayDate) critical.push('NIGHTLY_COMMERCIAL_LINKAGE_MISSING');
    }
  } else {
    warnings.push(isV2?'LEGACY_MULTI_ROOM_V2':'LEGACY_BOOKING_NOT_V3');
    if(!booking.hotel||!booking.roomType||!booking.ratePlan) critical.push('LEGACY_COMMERCIAL_LINKAGE_MISSING');
    if(sellTotal<=0) critical.push('LEGACY_SELL_TOTAL_INVALID');
    if(!checkIn||!checkOut||nightsCount<=0) critical.push('LEGACY_STAY_DATES_INVALID');
    if(roomsExpected<=0) critical.push('LEGACY_ROOM_COUNT_INVALID');
  }

  const reasons=Array.from(new Set([...critical,...warnings]));
  const status:CertificationStatus=critical.length?'FAIL':warnings.length?'WARN':'PASS';
  const gate:ConfirmationGate=critical.length?'BLOCK':warnings.length?'WARN':'ALLOW';

  return {
    bookingId,
    bookingReference:String(booking.bookingReference||booking.bookingRef||booking.id),
    status,gate,checkedAt:new Date().toISOString(),
    reasons,criticalReasons:Array.from(new Set(critical)),warnings:Array.from(new Set(warnings)),
    pricingVersion,nightlyExpected:expectedNightly,nightlyActual:actualNightly,nightlyCoverage,
    bookingRoomsExpected:roomsExpected,bookingRoomsActual:roomsRes.records.length,
    holdToken,holdStatus,sellTotal,sellTotalFromNights:sellFromNights,sellDelta,legacy,
  };
}

export async function persistBookingCertification(result:BookingCertificationResult,source:string,checkedBy:string){
  const certificationKey='latest:'+result.bookingId;
  const record={
    certificationKey,
    bookingId:result.bookingId,
    bookingReference:result.bookingReference,
    certificationStatus:result.status,
    confirmationGate:result.gate,
    checkedAt:result.checkedAt,
    reasonsJson:JSON.stringify({
      reasons:result.reasons,
      criticalReasons:result.criticalReasons,
      warnings:result.warnings,
      bookingRoomsExpected:result.bookingRoomsExpected,
      bookingRoomsActual:result.bookingRoomsActual,
      sellTotal:result.sellTotal,
      sellTotalFromNights:result.sellTotalFromNights,
      legacy:result.legacy,
    }),
    nightlyExpected:result.nightlyExpected,
    nightlyActual:result.nightlyActual,
    nightlyCoverage:result.nightlyCoverage,
    holdStatus:result.holdStatus,
    sellDeltaAed:result.sellDelta,
    pricingVersion:result.pricingVersion,
    source,
    checkedBy,
  };
  const existing=await zite.bookingCertifications.findOne({filters:{certificationKey}});
  if(existing) await zite.bookingCertifications.update({id:existing.id,record});
  else await zite.bookingCertifications.create({record});

  await zite.bookingEvents.create({record:{
    eventName:'booking_certification_'+result.status.toLowerCase(),
    booking:result.bookingId,
    details:JSON.stringify({
      certificationStatus:result.status,
      confirmationGate:result.gate,
      checkedAt:result.checkedAt,
      reasons:result.reasons,
      criticalReasons:result.criticalReasons,
      warnings:result.warnings,
      pricingVersion:result.pricingVersion,
      nightlyExpected:result.nightlyExpected,
      nightlyActual:result.nightlyActual,
      nightlyCoverage:result.nightlyCoverage,
      bookingRoomsExpected:result.bookingRoomsExpected,
      bookingRoomsActual:result.bookingRoomsActual,
      holdToken:result.holdToken,
      holdStatus:result.holdStatus,
      sellTotal:result.sellTotal,
      sellTotalFromNights:result.sellTotalFromNights,
      sellDelta:result.sellDelta,
      source,checkedBy,
    }),
  }});
}
