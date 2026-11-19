import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { verifyPartnerToken } from '@/lib/partnerSecurity';

export default createEndpoint({
  description:'Release an active mixed-room hotel rate hold owned by the signed-in partner',
  inputSchema:z.object({partnerToken:z.string(),holdToken:z.string().min(1)}),
  outputSchema:z.object({released:z.boolean()}),
  execute:async({input})=>{
    const partnerId=await verifyPartnerToken(input.partnerToken);
    if(!partnerId) throw new ZiteError({code:'UNAUTHORIZED',message:'Partner session expired.'});
    const lines=await zite.rateHoldLines.findAll({filters:{holdToken:input.holdToken},limit:1000});
    if(lines.records.some(x=>x.partnerId && x.partnerId!==partnerId)){
      throw new ZiteError({code:'FORBIDDEN',message:'This hold belongs to another partner account.'});
    }
    for(const line of lines.records){
      if(line.status==='Active') await zite.rateHoldLines.update({id:line.id,record:{status:'Released'}});
    }
    const masters=await zite.rateHolds.findAll({filters:{holdToken:input.holdToken},limit:100});
    for(const hold of masters.records){
      if(hold.holdStatus==='Active') await zite.rateHolds.update({id:hold.id,record:{holdStatus:'Released'}});
    }
    return {released:true};
  },
});
