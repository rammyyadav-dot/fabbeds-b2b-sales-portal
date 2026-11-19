import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
   authenticated:true,
description:'Create or update transfer vehicle categories',
 inputSchema:z.object({
  actingUserId:z.string().min(1),id:z.string().optional(),name:z.string().trim().min(2).max(100),models:z.string().trim().max(200).optional(),
  maxPax:z.number().int().min(1).max(60),maxLuggage:z.number().int().min(0).max(80),wheelchair:z.boolean(),
  tier:z.enum(['Economy','Standard','Business','Luxury','VIP']),supplier:z.string().trim().max(150).optional(),active:z.boolean(),
 }),
 outputSchema:z.object({id:z.string()}),
 execute:async({input,context})=>{
  await requireAdminSessionVerified(context,input.actingUserId,'manage transfer vehicles');
  if(input.maxLuggage===0&&input.maxPax>4) throw new Error('Large passenger vehicles must define luggage capacity.');
  const record={categoryName:input.name,exampleModels:input.models||'',maxPassengers:input.maxPax,maxLuggage:input.maxLuggage,wheelchairAccessible:input.wheelchair,tier:input.tier,supplierName:input.supplier||'',active:input.active};
  if(input.id){await zite.vehicleCategories.update({id:input.id,record});return{id:input.id};}
  const created=await zite.vehicleCategories.create({record});return{id:created.id};
 },
});
