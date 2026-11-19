import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';
import { appendBookingMovements, ensureBookedInventoryLedger } from '@project/pricing/inventoryLedger';

export default createEndpoint({
  authenticated:true,
  description:'Reconcile missing durable booked-inventory ledger rows from converted multi-room-v3 hold evidence',
  inputSchema:z.object({bookingId:z.string().optional(),limit:z.number().int().min(1).max(200).default(100)}),
  outputSchema:z.object({
    scanned:z.number(),reconciled:z.number(),createdRows:z.number(),skipped:z.number(),
    errors:z.array(z.object({bookingId:z.string(),message:z.string()})),
  }),
  execute:async({input,context})=>{
    const actor=await requireAdmin(context,'reconcile booked inventory');
    const bookings=input.bookingId
      ? {records:[await zite.bookings.findOne({id:input.bookingId})].filter(Boolean) as any[]}
      : await zite.bookings.findAll({limit:input.limit});

    let scanned=0,reconciled=0,createdRows=0,skipped=0;
    const errors:{bookingId:string;message:string}[]=[];

    for(const booking of bookings.records as any[]){
      scanned++;
      if(['Cancelled','Rejected'].includes(String(booking.status||''))){skipped++;continue;}
      let snapshot:any={};try{snapshot=JSON.parse(booking.snapshotJson||'{}');}catch{}
      if(String(snapshot.pricingVersion||'')!=='multi-room-v3'||!snapshot.holdToken){skipped++;continue;}
      try{
        const holds=await zite.rateHolds.findAll({filters:{holdToken:String(snapshot.holdToken)},limit:100});
        if(!holds.records.some(h=>h.holdStatus==='Converted')) throw new Error('Converted hold evidence is required before ledger reconciliation.');
        const ref=String(booking.bookingReference||booking.bookingRef||booking.id);
        const result=await ensureBookedInventoryLedger({
          bookingId:booking.id,bookingReference:ref,holdToken:String(snapshot.holdToken),pricingVersion:'multi-room-v3',
        });
        await appendBookingMovements({
          bookingId:booking.id,bookingReference:ref,holdToken:String(snapshot.holdToken),
          source:'admin_inventory_reconciliation',actor:actor.email||'Admin',
          notes:'Booked ledger reconciled from converted authoritative hold evidence',
        });
        reconciled++;createdRows+=result.created;
        await zite.bookingEvents.create({record:{
          eventName:'booked_inventory_reconciled',
          booking:booking.id,
          details:`Admin ${actor.email||'Admin'} reconciled durable sold inventory; created ${result.created} of ${result.total} ledger rows`,
        }});
      }catch(err:any){errors.push({bookingId:booking.id,message:err?.message||'Reconciliation failed'});}
    }
    return {scanned,reconciled,createdRows,skipped,errors};
  },
});
