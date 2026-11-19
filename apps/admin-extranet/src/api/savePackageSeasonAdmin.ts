import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';
export default createEndpoint({
   authenticated:true,
description:'Create or update package season pricing',
 inputSchema:z.object({actingUserId:z.string().min(1),id:z.string().optional(),packageId:z.string(),name:z.string().trim().min(2),validFrom:z.string(),validTo:z.string(),netTwin:z.number().min(0),netSingle:z.number().min(0),netChildBed:z.number().min(0),netChildNoBed:z.number().min(0),sellTwin:z.number().min(0),sellSingle:z.number().min(0),sellChildBed:z.number().min(0),sellChildNoBed:z.number().min(0),allotmentCap:z.number().int().min(0)}),
 outputSchema:z.object({id:z.string()}),
 execute:async({input,context})=>{
  await requireAdminSessionVerified(context,input.actingUserId,'manage package season pricing');
  if(!await zite.packageMasters.findOne({id:input.packageId})) throw new Error('Package not found.');
  if(input.validFrom>input.validTo) throw new Error('Season valid-from date must be before valid-to date.');
  const pairs:[[number,number,string],[number,number,string],[number,number,string],[number,number,string]]=[[input.netTwin,input.sellTwin,'Adult Twin'],[input.netSingle,input.sellSingle,'Adult Single'],[input.netChildBed,input.sellChildBed,'Child With Bed'],[input.netChildNoBed,input.sellChildNoBed,'Child No Bed']];
  for(const [net,sell,label] of pairs){if(sell<net) throw new Error(label+' selling price cannot be below net cost.');}
  const record={seasonName:input.name,_package:input.packageId,validFrom:input.validFrom,validTo:input.validTo,netCostAdultTwin:input.netTwin,netCostAdultSingle:input.netSingle,netCostChildWithBed:input.netChildBed,netCostChildNoBed:input.netChildNoBed,retailAdultTwin:input.sellTwin,retailAdultSingle:input.sellSingle,retailChildWithBed:input.sellChildBed,retailChildNoBed:input.sellChildNoBed,allotmentCap:input.allotmentCap};
  if(input.id){await zite.packageSeasonPrices.update({id:input.id,record});return{id:input.id};}
  const s=await zite.packageSeasonPrices.create({record});return{id:s.id};
 }
});
