import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';
import { appendInventoryMovement } from '@project/pricing/inventoryLedger';

const dateOnly=(v:any)=>!v?'':typeof v==='string'?v.slice(0,10):new Date(v).toISOString().slice(0,10);

export default createEndpoint({
  authenticated:true,
  description:'Append explicit reconciliation movements for legacy active holds/booked ledger rows that predate movement accounting',
  inputSchema:z.object({limit:z.number().int().min(1).max(500).default(200)}),
  outputSchema:z.object({scanned:z.number(),created:z.number(),skipped:z.number(),errors:z.array(z.string())}),
  execute:async({input,context})=>{
    const actor=await requireAdmin(context,'reconcile inventory movement accounting');
    const [holds,ledger,movements]=await Promise.all([
      zite.rateHoldLines.findAll({limit:Math.min(2000,input.limit*5)}),
      zite.bookedInventoryLedger.findAll({limit:Math.min(2000,input.limit*5)}),
      zite.inventoryMovements.findAll({limit:2000}),
    ]);
    const keys=new Set(movements.records.map(m=>String(m.movementKey||'')));
    let scanned=0,created=0,skipped=0;
    const errors:string[]=[];

    for(const h of holds.records){
      if(scanned>=input.limit) break;
      if(h.status!=='Active'||!h.expiresAt||new Date(h.expiresAt).getTime()<=Date.now()) continue;
      scanned++;
      const stayDate=dateOnly(h.stayDate);
      const expected=`HOLD|${h.holdToken}|${h.roomTypeId}|${h.ratePlanId}|${stayDate}`;
      const reconcileKey=`RECONCILED|${expected}`;
      if(keys.has(expected)||keys.has(reconcileKey)){skipped++;continue;}
      try{
        const result=await appendInventoryMovement({
          movementKey:reconcileKey,movementType:'RECONCILED',quantityDelta:0,
          hotelId:String(h.hotelId||''),roomTypeId:String(h.roomTypeId||''),ratePlanId:String(h.ratePlanId||''),stayDate,
          holdToken:String(h.holdToken||''),correlationId:String(h.holdToken||''),
          source:'admin_movement_reconciliation',actor:actor.email||'Admin',
          notes:`Legacy active hold existed before movement accounting; current held quantity ${Number(h.quantity||0)} acknowledged without inventing historical timestamp`,
        });
        if(result.created)created++;else skipped++;
      }catch(err:any){errors.push(err?.message||'Hold reconciliation failed');}
    }

    for(const l of ledger.records){
      if(scanned>=input.limit) break;
      if(l.status!=='Booked') continue;
      scanned++;
      const stayDate=dateOnly(l.stayDate);
      const expected=`BOOKED|${l.bookingId}|${l.roomTypeId}|${l.ratePlanId}|${stayDate}`;
      const reconcileKey=`RECONCILED|${expected}`;
      if(keys.has(expected)||keys.has(reconcileKey)){skipped++;continue;}
      try{
        const result=await appendInventoryMovement({
          movementKey:reconcileKey,movementType:'RECONCILED',quantityDelta:0,
          hotelId:String(l.hotelId||''),roomTypeId:String(l.roomTypeId||''),ratePlanId:String(l.ratePlanId||''),stayDate,
          holdToken:String(l.sourceHoldToken||''),bookingId:String(l.bookingId||''),bookingReference:String(l.bookingReference||''),
          correlationId:String(l.bookingId||''),source:'admin_movement_reconciliation',actor:actor.email||'Admin',
          notes:`Legacy booked ledger existed before movement accounting; current booked quantity ${Number(l.quantity||0)} acknowledged without inventing historical timestamp`,
        });
        if(result.created)created++;else skipped++;
      }catch(err:any){errors.push(err?.message||'Booked reconciliation failed');}
    }
    return {scanned,created,skipped,errors};
  },
});
