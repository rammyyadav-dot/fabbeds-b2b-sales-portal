import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
    authenticated:true,
description:'Update visa security deposit status',
  inputSchema:z.object({
    actingUserId:z.string().min(1),
    depositId:z.string(),depositStatus:z.enum(['Not Required','Held (Credit Line)','Escrow Paid','Released','Forfeited']),
    forfeitReason:z.string().optional(),
  }),
  outputSchema:z.object({success:z.boolean()}),
  execute:async({input,context})=>{
    await requireAdminSessionVerified(context,input.actingUserId,'manage visa security deposits');
    if(input.depositStatus==='Forfeited'&&!input.forfeitReason?.trim()) throw new Error('Forfeit reason is required.');
    await zite.visaSecurityDeposits.update({id:input.depositId,record:{
      depositStatus:input.depositStatus,forfeitReason:input.forfeitReason||'',
    }});
    return {success:true};
  },
});
