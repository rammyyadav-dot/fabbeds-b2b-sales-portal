import { zite } from 'zitejs/db';

export type InventoryConsumption={held:number;booked:number;total:number};

export function inventoryKey(hotelId:string,roomTypeId:string,ratePlanId:string,stayDate:string){
  return `${hotelId}|${roomTypeId}|${ratePlanId}|${stayDate}`;
}

export async function loadInventoryConsumption(args:{
  checkIn:string;
  checkOut:string;
  hotelId?:string;
  excludeHoldToken?:string;
}){
  const [heldSql,bookedSql]=await Promise.all([
    zite.sql({
      query:`
        SELECT "hotelId","roomTypeId","ratePlanId","stayDate",COALESCE(SUM("quantity"),0) AS "qty"
        FROM "RateHoldLines"
        WHERE "status"='Active'
          AND "expiresAt">CURRENT_TIMESTAMP
          AND "stayDate">=$1
          AND "stayDate"<$2
          AND ($3::text IS NULL OR "hotelId"=$3)
          AND ($4::text IS NULL OR "holdToken"!=$4)
        GROUP BY "hotelId","roomTypeId","ratePlanId","stayDate"
      `,
      params:[args.checkIn,args.checkOut,args.hotelId||null,args.excludeHoldToken||null],
    }),
    zite.sql({
      query:`
        SELECT "hotelId","roomTypeId","ratePlanId","stayDate",COALESCE(SUM("quantity"),0) AS "qty"
        FROM "BookedInventoryLedger"
        WHERE "status"='Booked'
          AND "stayDate">=$1
          AND "stayDate"<$2
          AND ($3::text IS NULL OR "hotelId"=$3)
        GROUP BY "hotelId","roomTypeId","ratePlanId","stayDate"
      `,
      params:[args.checkIn,args.checkOut,args.hotelId||null],
    }),
  ]);

  const map=new Map<string,InventoryConsumption>();
  const dateOnly=(v:any)=>!v?'':typeof v==='string'?v.slice(0,10):new Date(v).toISOString().slice(0,10);
  for(const row of heldSql.rows as any[]){
    const key=inventoryKey(String(row.hotelId||''),String(row.roomTypeId||''),String(row.ratePlanId||''),dateOnly(row.stayDate));
    const qty=Math.max(0,Number(row.qty||0));
    map.set(key,{held:qty,booked:0,total:qty});
  }
  for(const row of bookedSql.rows as any[]){
    const key=inventoryKey(String(row.hotelId||''),String(row.roomTypeId||''),String(row.ratePlanId||''),dateOnly(row.stayDate));
    const qty=Math.max(0,Number(row.qty||0));
    const current=map.get(key)||{held:0,booked:0,total:0};
    map.set(key,{held:current.held,booked:qty,total:current.held+qty});
  }
  return map;
}

export function remainingAllocation(args:{
  allocation:number|null|undefined;
  status:string|undefined;
  consumed:InventoryConsumption|undefined;
  overbookingAllowance?:number|null;
}){
  const status=args.status||'Free Sale';
  if(args.allocation==null && status==='Free Sale') return null;
  const contracted=Math.max(0,Number(args.allocation||0));
  const overbook=Math.max(0,Number(args.overbookingAllowance||0));
  return Math.max(0,contracted+overbook-Math.max(0,args.consumed?.total||0));
}

export async function ensureBookedInventoryLedger(args:{
  bookingId:string;
  bookingReference:string;
  holdToken:string;
  pricingVersion:string;
}){
  const holdLines=await zite.rateHoldLines.findAll({filters:{holdToken:args.holdToken},limit:2000});
  if(!holdLines.records.length) throw new Error('Cannot create booked inventory ledger without converted hold lines.');

  const existing=await zite.bookedInventoryLedger.findAll({filters:{bookingId:args.bookingId},limit:2000});
  const existingKeys=new Set(existing.records.filter(x=>x.status==='Booked').map(x=>String(x.ledgerKey||'')));
  const bookedAt=new Date().toISOString();
  const rows=holdLines.records.map(line=>{
    const date=line.stayDate?String(line.stayDate).slice(0,10):'';
    const key=`${args.bookingId}|${line.roomTypeId}|${line.ratePlanId}|${date}`;
    return {
      ledgerKey:key,
      bookingId:args.bookingId,
      bookingReference:args.bookingReference,
      hotelId:String(line.hotelId||''),
      roomTypeId:String(line.roomTypeId||''),
      ratePlanId:String(line.ratePlanId||''),
      stayDate:date,
      quantity:Math.max(0,Number(line.quantity||0)),
      status:'Booked',
      sourceHoldToken:args.holdToken,
      bookedAt,
      pricingVersion:args.pricingVersion,
    };
  }).filter(row=>row.stayDate&&row.hotelId&&row.roomTypeId&&row.ratePlanId&&row.quantity>0&&!existingKeys.has(row.ledgerKey));

  for(let i=0;i<rows.length;i+=100) await zite.bookedInventoryLedger.bulkCreate({records:rows.slice(i,i+100)});
  return {created:rows.length,total:holdLines.records.length};
}

export async function ensureDirectBookedInventoryLedger(args:{
  bookingId:string;
  bookingReference:string;
  hotelId:string;
  roomTypeId:string;
  ratePlanId:string;
  checkIn:string;
  checkOut:string;
  quantity:number;
  pricingVersion:string;
}){
  const existing=await zite.bookedInventoryLedger.findAll({filters:{bookingId:args.bookingId},limit:2000});
  const existingKeys=new Set(existing.records.filter(x=>x.status==='Booked').map(x=>String(x.ledgerKey||'')));
  const rows:any[]=[];
  const d=new Date(args.checkIn+'T00:00:00Z');
  const end=new Date(args.checkOut+'T00:00:00Z');
  const bookedAt=new Date().toISOString();
  while(d<end){
    const date=d.toISOString().slice(0,10);
    const key=`${args.bookingId}|${args.roomTypeId}|${args.ratePlanId}|${date}`;
    if(!existingKeys.has(key)) rows.push({
      ledgerKey:key,bookingId:args.bookingId,bookingReference:args.bookingReference,
      hotelId:args.hotelId,roomTypeId:args.roomTypeId,ratePlanId:args.ratePlanId,
      stayDate:date,quantity:Math.max(0,args.quantity),status:'Booked',
      sourceHoldToken:'',bookedAt,pricingVersion:args.pricingVersion,
    });
    d.setUTCDate(d.getUTCDate()+1);
  }
  for(let i=0;i<rows.length;i+=100) await zite.bookedInventoryLedger.bulkCreate({records:rows.slice(i,i+100)});
  return {created:rows.length,total:rows.length+existingKeys.size};
}


export type InventoryMovementType='HOLD'|'BOOKED'|'RELEASED'|'EXPIRED'|'RECONCILED';

async function effectiveContractedAllocation(hotelId:string,roomTypeId:string,ratePlanId:string,stayDate:string){
  const result=await zite.sql({
    query:`
      SELECT dr."allocation",dr."status"
      FROM "DailyRates" dr
      JOIN "DailyRatesHotels" h ON h."dailyRatesId"=dr.id
      JOIN "DailyRatesRoomTypes" rt ON rt."dailyRatesId"=dr.id
      JOIN "DailyRatesRatePlans" rp ON rp."dailyRatesId"=dr.id
      WHERE h."hotelsId"::text=$1 AND rt."roomTypesId"::text=$2 AND rp."ratePlansId"::text=$3
        AND dr."rateDate"=$4
        AND (dr."integrityStatus" IS NULL OR dr."integrityStatus"!='Quarantined')
      ORDER BY CASE COALESCE(dr."layer",'BASE') WHEN 'OVERRIDE' THEN 4 WHEN 'PROMO' THEN 3 WHEN 'BASE' THEN 2 WHEN 'FALLBACK' THEN 1 ELSE 0 END DESC,
               COALESCE(dr."priority",0) DESC,dr.updated_at DESC,dr.id DESC
      LIMIT 1
    `,
    params:[hotelId,roomTypeId,ratePlanId,stayDate],
  });
  const row=result.rows[0] as any;
  return row?{allocation:row.allocation==null?null:Number(row.allocation||0),status:String(row.status||'Free Sale')}:{allocation:null,status:''};
}

export async function appendInventoryMovement(args:{
  movementKey:string;
  movementType:InventoryMovementType;
  quantityDelta:number;
  hotelId:string;
  roomTypeId:string;
  ratePlanId:string;
  stayDate:string;
  holdToken?:string;
  bookingId?:string;
  bookingReference?:string;
  correlationId?:string;
  source:string;
  actor?:string;
  notes?:string;
}){
  const existing=await zite.inventoryMovements.findOne({filters:{movementKey:args.movementKey}});
  if(existing) return {created:false,id:existing.id};

  const [contract,consumption]=await Promise.all([
    effectiveContractedAllocation(args.hotelId,args.roomTypeId,args.ratePlanId,args.stayDate),
    loadInventoryConsumption({
      checkIn:args.stayDate,
      checkOut:new Date(new Date(args.stayDate+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10),
      hotelId:args.hotelId,
    }),
  ]);
  const state=consumption.get(inventoryKey(args.hotelId,args.roomTypeId,args.ratePlanId,args.stayDate))||{held:0,booked:0,total:0};
  const unlimited=contract.status==='Free Sale'&&contract.allocation==null;
  const remaining=contract.allocation==null?null:Math.max(0,Number(contract.allocation||0)-state.total);
  const record=await zite.inventoryMovements.create({record:{
    movementKey:args.movementKey,
    movementType:args.movementType,
    quantityDelta:args.quantityDelta,
    hotelId:args.hotelId,
    roomTypeId:args.roomTypeId,
    ratePlanId:args.ratePlanId,
    stayDate:args.stayDate,
    holdToken:args.holdToken||'',
    bookingId:args.bookingId||'',
    bookingReference:args.bookingReference||'',
    correlationId:args.correlationId||args.holdToken||args.bookingId||'',
    source:args.source,
    actor:args.actor||'System',
    occurredAt:new Date().toISOString(),
    contractedAllocation:contract.allocation,
    heldAfter:state.held,
    bookedAfter:state.booked,
    remainingAfter:remaining,
    notes:args.notes||'',
  }});
  return {created:true,id:record.id};
}

export async function appendHoldMovements(args:{
  holdToken:string;
  movementType:'HOLD'|'RELEASED'|'EXPIRED';
  quantitySign:1|-1;
  source:string;
  actor?:string;
  notes?:string;
}){
  const lines=await zite.rateHoldLines.findAll({filters:{holdToken:args.holdToken},limit:2000});
  let created=0;
  for(const line of lines.records){
    const stayDate=String(line.stayDate||'').slice(0,10);
    if(!stayDate||!line.hotelId||!line.roomTypeId||!line.ratePlanId) continue;
    const movementKey=`${args.movementType}|${args.holdToken}|${line.roomTypeId}|${line.ratePlanId}|${stayDate}`;
    const result=await appendInventoryMovement({
      movementKey,movementType:args.movementType,
      quantityDelta:args.quantitySign*Math.max(0,Number(line.quantity||0)),
      hotelId:String(line.hotelId),roomTypeId:String(line.roomTypeId),ratePlanId:String(line.ratePlanId),stayDate,
      holdToken:args.holdToken,correlationId:args.holdToken,source:args.source,actor:args.actor,notes:args.notes,
    });
    if(result.created) created++;
  }
  return created;
}

export async function appendBookingMovements(args:{
  bookingId:string;
  bookingReference:string;
  holdToken?:string;
  source:string;
  actor?:string;
  directDelta?:number;
  notes?:string;
}){
  const ledger=await zite.bookedInventoryLedger.findAll({filters:{bookingId:args.bookingId,status:'Booked'},limit:2000});
  let created=0;
  for(const row of ledger.records){
    const stayDate=String(row.stayDate||'').slice(0,10);
    if(!stayDate||!row.hotelId||!row.roomTypeId||!row.ratePlanId) continue;
    const movementKey=`BOOKED|${args.bookingId}|${row.roomTypeId}|${row.ratePlanId}|${stayDate}`;
    const result=await appendInventoryMovement({
      movementKey,movementType:'BOOKED',
      quantityDelta:args.directDelta==null?0:args.directDelta*Math.max(0,Number(row.quantity||0)),
      hotelId:String(row.hotelId),roomTypeId:String(row.roomTypeId),ratePlanId:String(row.ratePlanId),stayDate,
      holdToken:args.holdToken||String(row.sourceHoldToken||''),bookingId:args.bookingId,bookingReference:args.bookingReference,
      correlationId:args.holdToken||args.bookingId,source:args.source,actor:args.actor,notes:args.notes,
    });
    if(result.created) created++;
  }
  return created;
}

export async function releaseBookedInventory(bookingId:string,reason:string,actor='System',source='booking_status'){
  const rows=await zite.bookedInventoryLedger.findAll({filters:{bookingId,status:'Booked'},limit:2000});
  const releasedAt=new Date().toISOString();
  for(const row of rows.records){
    await zite.bookedInventoryLedger.update({id:row.id,record:{status:'Released',releasedAt,releaseReason:reason}});
  }
  let movements=0;
  for(const row of rows.records){
    const stayDate=String(row.stayDate||'').slice(0,10);
    if(!stayDate||!row.hotelId||!row.roomTypeId||!row.ratePlanId) continue;
    const movementKey=`RELEASED|BOOKED|${bookingId}|${row.roomTypeId}|${row.ratePlanId}|${stayDate}`;
    const result=await appendInventoryMovement({
      movementKey,movementType:'RELEASED',quantityDelta:-Math.max(0,Number(row.quantity||0)),
      hotelId:String(row.hotelId),roomTypeId:String(row.roomTypeId),ratePlanId:String(row.ratePlanId),stayDate,
      holdToken:String(row.sourceHoldToken||''),bookingId,bookingReference:String(row.bookingReference||''),
      correlationId:bookingId,source,actor,notes:reason,
    });
    if(result.created) movements++;
  }
  return {released:rows.records.length,movements};
}
