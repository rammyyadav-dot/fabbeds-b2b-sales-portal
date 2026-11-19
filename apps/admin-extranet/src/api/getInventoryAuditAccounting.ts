import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';

const movementSchema=z.object({
  id:z.string(),movementKey:z.string(),movementType:z.string(),quantityDelta:z.number(),
  hotelId:z.string(),hotelName:z.string(),roomTypeId:z.string(),roomTypeName:z.string(),
  ratePlanId:z.string(),ratePlanName:z.string(),stayDate:z.string(),holdToken:z.string(),
  bookingId:z.string(),bookingReference:z.string(),correlationId:z.string(),source:z.string(),
  actor:z.string(),occurredAt:z.string(),contractedAllocation:z.number().nullable(),
  heldAfter:z.number(),bookedAfter:z.number(),remainingAfter:z.number().nullable(),notes:z.string(),
});
const cellSchema=z.object({
  cellKey:z.string(),hotelId:z.string(),hotelName:z.string(),roomTypeId:z.string(),roomTypeName:z.string(),
  ratePlanId:z.string(),ratePlanName:z.string(),stayDate:z.string(),status:z.string(),
  allocation:z.number().nullable(),held:z.number(),booked:z.number(),consumed:z.number(),
  remaining:z.number().nullable(),utilizationPct:z.number().nullable(),
  risk:z.enum(['OK','WATCH','FULL','OVER']),movementCount:z.number(),lastMovementAt:z.string(),
});
const anomalySchema=z.object({
  severity:z.enum(['P0','P1','P2']),code:z.string(),title:z.string(),detail:z.string(),
  cellKey:z.string(),bookingId:z.string(),holdToken:z.string(),
});

export default createEndpoint({
  authenticated:true,
  description:'Inventory movement accounting, allocation reconciliation and oversell investigation for hotel inventory',
  inputSchema:z.object({limit:z.number().int().min(50).max(1000).default(500)}),
  outputSchema:z.object({
    checkedAt:z.string(),
    summary:z.object({
      movements:z.number(),holds:z.number(),bookings:z.number(),releases:z.number(),expiries:z.number(),reconciliations:z.number(),
      activeCells:z.number(),watchCells:z.number(),fullCells:z.number(),overCells:z.number(),movementGaps:z.number(),
    }),
    cells:z.array(cellSchema),movements:z.array(movementSchema),anomalies:z.array(anomalySchema),
  }),
  execute:async({input,context})=>{
    await requireAdmin(context,'view inventory movement accounting');

    const [movementsRes,holdsRes,ledgerRes,hotelsRes,roomsRes,plansRes,cellsSql]=await Promise.all([
      zite.inventoryMovements.findAll({limit:Math.min(2000,input.limit)}),
      zite.rateHoldLines.findAll({limit:2000}),
      zite.bookedInventoryLedger.findAll({limit:2000}),
      zite.hotels.findAll({limit:1000}),
      zite.roomTypes.findAll({limit:1000}),
      zite.ratePlans.findAll({limit:1500}),
      zite.sql({query:`
        WITH held AS (
          SELECT "hotelId","roomTypeId","ratePlanId","stayDate",SUM("quantity") AS "held"
          FROM "RateHoldLines"
          WHERE "status"='Active' AND "expiresAt">CURRENT_TIMESTAMP
          GROUP BY "hotelId","roomTypeId","ratePlanId","stayDate"
        ),
        booked AS (
          SELECT "hotelId","roomTypeId","ratePlanId","stayDate",SUM("quantity") AS "booked"
          FROM "BookedInventoryLedger"
          WHERE "status"='Booked'
          GROUP BY "hotelId","roomTypeId","ratePlanId","stayDate"
        ),
        inventory AS (
          SELECT COALESCE(h."hotelId",b."hotelId") AS "hotelId",
                 COALESCE(h."roomTypeId",b."roomTypeId") AS "roomTypeId",
                 COALESCE(h."ratePlanId",b."ratePlanId") AS "ratePlanId",
                 COALESCE(h."stayDate",b."stayDate") AS "stayDate",
                 COALESCE(h."held",0) AS "held",COALESCE(b."booked",0) AS "booked"
          FROM held h FULL OUTER JOIN booked b
            ON b."hotelId"=h."hotelId" AND b."roomTypeId"=h."roomTypeId"
           AND b."ratePlanId"=h."ratePlanId" AND b."stayDate"=h."stayDate"
        ),
        ranked AS (
          SELECT lh."hotelsId"::text AS "hotelId",lrt."roomTypesId"::text AS "roomTypeId",
                 lrp."ratePlansId"::text AS "ratePlanId",dr."rateDate" AS "stayDate",
                 dr."allocation",dr."status",
                 ROW_NUMBER() OVER (
                   PARTITION BY lh."hotelsId",lrt."roomTypesId",lrp."ratePlansId",dr."rateDate"
                   ORDER BY CASE COALESCE(dr."layer",'BASE') WHEN 'OVERRIDE' THEN 4 WHEN 'PROMO' THEN 3 WHEN 'BASE' THEN 2 WHEN 'FALLBACK' THEN 1 ELSE 0 END DESC,
                            COALESCE(dr."priority",0) DESC,dr.updated_at DESC,dr.id DESC
                 ) AS rn
          FROM "DailyRates" dr
          JOIN "DailyRatesHotels" lh ON lh."dailyRatesId"=dr.id
          JOIN "DailyRatesRoomTypes" lrt ON lrt."dailyRatesId"=dr.id
          JOIN "DailyRatesRatePlans" lrp ON lrp."dailyRatesId"=dr.id
          WHERE (dr."integrityStatus" IS NULL OR dr."integrityStatus"!='Quarantined')
        )
        SELECT i."hotelId",i."roomTypeId",i."ratePlanId",i."stayDate",i."held",i."booked",
               r."allocation",r."status"
        FROM inventory i
        LEFT JOIN ranked r ON r."hotelId"=i."hotelId" AND r."roomTypeId"=i."roomTypeId"
          AND r."ratePlanId"=i."ratePlanId" AND r."stayDate"=i."stayDate" AND r.rn=1
        ORDER BY i."stayDate",i."hotelId",i."roomTypeId",i."ratePlanId"
      `}),
    ]);

    const hotels=new Map(hotelsRes.records.map(h=>[h.id,h.hotelName||h.id]));
    const rooms=new Map(roomsRes.records.map(r=>[r.id,r.roomTypeName||r.id]));
    const plans=new Map(plansRes.records.map(p=>[p.id,p.ratePlanName||p.id]));
    const dateOnly=(v:any)=>!v?'':typeof v==='string'?v.slice(0,10):new Date(v).toISOString().slice(0,10);
    const cellKey=(h:string,r:string,p:string,d:string)=>`${h}|${r}|${p}|${d}`;

    const movementCounts=new Map<string,{count:number;last:string}>();
    for(const m of movementsRes.records){
      const key=cellKey(String(m.hotelId||''),String(m.roomTypeId||''),String(m.ratePlanId||''),dateOnly(m.stayDate));
      const at=String(m.occurredAt||'');
      const current=movementCounts.get(key)||{count:0,last:''};
      movementCounts.set(key,{count:current.count+1,last:at>current.last?at:current.last});
    }

    const cells=cellsSql.rows.map((row:any)=>{
      const hotelId=String(row.hotelId||''),roomTypeId=String(row.roomTypeId||''),ratePlanId=String(row.ratePlanId||''),stayDate=dateOnly(row.stayDate);
      const held=Math.max(0,Number(row.held||0)),booked=Math.max(0,Number(row.booked||0)),consumed=held+booked;
      const allocation=row.allocation==null?null:Number(row.allocation||0),status=String(row.status||'');
      const unlimited=status==='Free Sale'&&allocation==null;
      const remaining=allocation==null?null:Math.max(0,allocation-consumed);
      const utilizationPct=unlimited||!allocation?null:Math.round(consumed/allocation*1000)/10;
      const risk=unlimited?'OK':allocation==null&&consumed>0?'OVER':consumed>(allocation||0)?'OVER':consumed===(allocation||0)&&consumed>0?'FULL':utilizationPct!=null&&utilizationPct>=80?'WATCH':'OK';
      const movement=movementCounts.get(cellKey(hotelId,roomTypeId,ratePlanId,stayDate))||{count:0,last:''};
      return {
        cellKey:cellKey(hotelId,roomTypeId,ratePlanId,stayDate),hotelId,hotelName:hotels.get(hotelId)||hotelId,
        roomTypeId,roomTypeName:rooms.get(roomTypeId)||roomTypeId,ratePlanId,ratePlanName:plans.get(ratePlanId)||ratePlanId,
        stayDate,status,allocation,held,booked,consumed,remaining,utilizationPct,
        risk:risk as 'OK'|'WATCH'|'FULL'|'OVER',movementCount:movement.count,lastMovementAt:movement.last,
      };
    });

    const movements=[...movementsRes.records].sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||''))).map(m=>({
      id:m.id,movementKey:String(m.movementKey||''),movementType:String(m.movementType||''),quantityDelta:Number(m.quantityDelta||0),
      hotelId:String(m.hotelId||''),hotelName:hotels.get(String(m.hotelId||''))||String(m.hotelId||''),
      roomTypeId:String(m.roomTypeId||''),roomTypeName:rooms.get(String(m.roomTypeId||''))||String(m.roomTypeId||''),
      ratePlanId:String(m.ratePlanId||''),ratePlanName:plans.get(String(m.ratePlanId||''))||String(m.ratePlanId||''),
      stayDate:dateOnly(m.stayDate),holdToken:String(m.holdToken||''),bookingId:String(m.bookingId||''),
      bookingReference:String(m.bookingReference||''),correlationId:String(m.correlationId||''),source:String(m.source||''),
      actor:String(m.actor||''),occurredAt:String(m.occurredAt||''),contractedAllocation:m.contractedAllocation==null?null:Number(m.contractedAllocation||0),
      heldAfter:Number(m.heldAfter||0),bookedAfter:Number(m.bookedAfter||0),
      remainingAfter:m.remainingAfter==null?null:Number(m.remainingAfter||0),notes:String(m.notes||''),
    }));

    const anomalies:{severity:'P0'|'P1'|'P2';code:string;title:string;detail:string;cellKey:string;bookingId:string;holdToken:string}[]=[];
    for(const cell of cells){
      if(cell.risk==='OVER') anomalies.push({
        severity:'P0',code:'INVENTORY_OVERSELL',title:'Consumed inventory exceeds contracted allocation',
        detail:`${cell.hotelName} · ${cell.roomTypeName} · ${cell.ratePlanName} · ${cell.stayDate}: ${cell.held} held + ${cell.booked} booked = ${cell.consumed}, allocation ${cell.allocation}`,
        cellKey:cell.cellKey,bookingId:'',holdToken:'',
      });
      else if(cell.risk==='FULL') anomalies.push({
        severity:'P1',code:'INVENTORY_FULL',title:'Contracted inventory fully consumed',
        detail:`${cell.hotelName} · ${cell.roomTypeName} · ${cell.stayDate}: remaining 0`,
        cellKey:cell.cellKey,bookingId:'',holdToken:'',
      });
    }

    const movementKeys=new Set(movementsRes.records.map(m=>String(m.movementKey||'')));
    for(const h of holdsRes.records){
      if(h.status!=='Active'||!h.expiresAt||new Date(h.expiresAt).getTime()<=Date.now()) continue;
      const date=dateOnly(h.stayDate);
      const expected=`HOLD|${h.holdToken}|${h.roomTypeId}|${h.ratePlanId}|${date}`;
      if(!movementKeys.has(expected)&&!movementKeys.has('RECONCILED|'+expected)) anomalies.push({
        severity:'P2',code:'HOLD_MOVEMENT_GAP',title:'Active hold lacks immutable movement evidence',
        detail:`${h.holdToken} · ${date} · quantity ${Number(h.quantity||0)}`,
        cellKey:cellKey(String(h.hotelId||''),String(h.roomTypeId||''),String(h.ratePlanId||''),date),
        bookingId:'',holdToken:String(h.holdToken||''),
      });
    }
    for(const l of ledgerRes.records){
      if(l.status!=='Booked') continue;
      const date=dateOnly(l.stayDate);
      const expected=`BOOKED|${l.bookingId}|${l.roomTypeId}|${l.ratePlanId}|${date}`;
      if(!movementKeys.has(expected)&&!movementKeys.has('RECONCILED|'+expected)) anomalies.push({
        severity:'P2',code:'BOOKED_MOVEMENT_GAP',title:'Booked ledger row lacks immutable movement evidence',
        detail:`${l.bookingReference||l.bookingId} · ${date} · quantity ${Number(l.quantity||0)}`,
        cellKey:cellKey(String(l.hotelId||''),String(l.roomTypeId||''),String(l.ratePlanId||''),date),
        bookingId:String(l.bookingId||''),holdToken:String(l.sourceHoldToken||''),
      });
    }

    const count=(type:string)=>movements.filter(m=>m.movementType===type).length;
    return {
      checkedAt:new Date().toISOString(),
      summary:{
        movements:movements.length,holds:count('HOLD'),bookings:count('BOOKED'),releases:count('RELEASED'),expiries:count('EXPIRED'),reconciliations:count('RECONCILED'),
        activeCells:cells.length,watchCells:cells.filter(c=>c.risk==='WATCH').length,fullCells:cells.filter(c=>c.risk==='FULL').length,
        overCells:cells.filter(c=>c.risk==='OVER').length,movementGaps:anomalies.filter(a=>a.code.includes('MOVEMENT_GAP')).length,
      },
      cells,movements,anomalies,
    };
  },
});
