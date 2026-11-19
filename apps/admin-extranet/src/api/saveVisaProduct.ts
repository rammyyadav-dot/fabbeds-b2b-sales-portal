import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
    authenticated:true,
description:'Create or update a visa product',
  inputSchema:z.object({
    actingUserId:z.string().min(1),
    id:z.string().optional(),visaName:z.string().min(2),visaCategory:z.string().min(2),
    validityDays:z.number().int().min(1),stayDurationDays:z.number().int().min(1),
    entryType:z.enum(['Single Entry','Multiple Entry']),processingType:z.enum(['Standard (3-5 Days)','Express (24-48 Hrs)']),
    netCost:z.number().min(0),sellingPrice:z.number().min(0),expressSurcharge:z.number().min(0),
    requiresSecurityDeposit:z.boolean(),depositAmount:z.number().min(0),description:z.string().optional(),active:z.boolean(),
  }),
  outputSchema:z.object({id:z.string()}),
  execute:async({input,context})=>{
    await requireAdminSessionVerified(context,input.actingUserId,'manage visa products');
    if(input.sellingPrice<input.netCost) throw new Error('Selling price cannot be below net cost.');
    if(input.requiresSecurityDeposit&&input.depositAmount<=0) throw new Error('Deposit amount is required when security deposit is enabled.');
    const record={
      visaName:input.visaName,visaCategory:input.visaCategory,validityDays:input.validityDays,stayDurationDays:input.stayDurationDays,
      entryType:input.entryType,processingType:input.processingType,netCost:input.netCost,sellingPrice:input.sellingPrice,
      expressSurcharge:input.expressSurcharge,requiresSecurityDeposit:input.requiresSecurityDeposit,
      depositAmount:input.requiresSecurityDeposit?input.depositAmount:0,description:input.description||'',active:input.active,
    };
    if(input.id){await zite.visaProducts.update({id:input.id,record}); return {id:input.id};}
    const created=await zite.visaProducts.create({record}); return {id:created.id};
  },
});
