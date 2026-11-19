import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
   authenticated:true,
description:'Create or update transfer markup rules',
 inputSchema:z.object({
  actingUserId:z.string().min(1),id:z.string().optional(),name:z.string().trim().min(2).max(120),
  markupType:z.enum(['Flat Amount (AED)','Percentage (%)']),markupValue:z.number().min(0),appliesTo:z.enum(['Global (All Transfers)','City Transfers Only','Intercity Transfers Only','Airport Transfers Only','Specific Route']),
  specificRouteId:z.string().optional(),maxCap:z.number().min(0),priority:z.number().int().min(0).max(999),notes:z.string().max(1000).optional(),active:z.boolean(),
 }),
 outputSchema:z.object({id:z.string()}),
 execute:async({input,context})=>{
  await requireAdminSessionVerified(context,input.actingUserId,'manage transfer markup rules');
  if(input.markupType==='Percentage (%)'&&input.markupValue>100) throw new Error('Percentage markup cannot exceed 100%.');
  if(input.appliesTo==='Specific Route'&&!input.specificRouteId) throw new Error('Specific Route markup requires a route.');
  if(input.specificRouteId&&!await zite.transferRates.findOne({id:input.specificRouteId})) throw new Error('Selected transfer route does not exist.');
  const record={ruleName:input.name,markupType:input.markupType,markupValue:input.markupValue,appliesTo:input.appliesTo,specificRoute:input.appliesTo==='Specific Route'?(input.specificRouteId||null):null,maxMarkupCap:input.maxCap,isActive:input.active,priority:input.priority,notes:input.notes||''};
  if(input.id){await zite.transferMarkupRules.update({id:input.id,record});return{id:input.id};}
  const created=await zite.transferMarkupRules.create({record});return{id:created.id};
 },
});
