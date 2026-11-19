import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';
import { appendHoldMovements } from '@project/pricing/inventoryLedger';

export default createEndpoint({
  authenticated:true,
  description:'Admin release of an active hotel inventory hold with audit event',
  inputSchema:z.object({holdToken:z.string().min(1)}),
  outputSchema:z.object({releasedLines:z.number(),releasedMasters:z.number()}),
  execute:async({input,context})=>{
    const actor=await requireAdmin(context,'release hotel inventory holds');
    const [lines,masters]=await Promise.all([
      zite.rateHoldLines.findAll({filters:{holdToken:input.holdToken},limit:1000}),
      zite.rateHolds.findAll({filters:{holdToken:input.holdToken},limit:100}),
    ]);
    if(!lines.records.length&&!masters.records.length) throw new ZiteError({code:'NOT_FOUND',message:'Hold token not found.'});
    if(masters.records.some(m=>m.holdStatus==='Converted')){
      throw new ZiteError({code:'CONFLICT',message:'Converted holds cannot be released from inventory administration.'});
    }
    let releasedLines=0,releasedMasters=0;
    for(const line of lines.records){
      if(line.status==='Active'){
        await zite.rateHoldLines.update({id:line.id,record:{status:'Released'}});
        releasedLines++;
      }
    }
    for(const hold of masters.records){
      if(hold.holdStatus==='Active'){
        await zite.rateHolds.update({id:hold.id,record:{holdStatus:'Released'}});
        releasedMasters++;
      }
    }
    await appendHoldMovements({
      holdToken:input.holdToken,movementType:'RELEASED',quantitySign:-1,
      source:'admin_hold_release',actor:actor.email||'Admin',notes:'Admin explicitly released active hold',
    });
    const bookingIds=Array.from(new Set(masters.records.flatMap(m=>Array.isArray(m.booking)?m.booking:(m.booking?[m.booking]:[]))));
    for(const bookingId of bookingIds){
      await zite.bookingEvents.create({record:{
        eventName:'admin_inventory_hold_released',
        booking:bookingId,
        details:`Hold ${input.holdToken} released by ${actor.email||'Admin'}; lines ${releasedLines}; masters ${releasedMasters}`,
      }});
    }
    return {releasedLines,releasedMasters};
  },
});
