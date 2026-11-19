import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';
const UAE=['Dubai','Abu Dhabi','Sharjah','Ras Al Khaimah','Fujairah','Ajman'] as const;
export default createEndpoint({
   authenticated:true,
description:'Create or update a UAE-only holiday package master',
 inputSchema:z.object({actingUserId:z.string().min(1),id:z.string().optional(),title:z.string().trim().min(3).max(160),slug:z.string().trim().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),days:z.number().int().min(2).max(30),nights:z.number().int().min(1).max(29),destinations:z.array(z.enum(UAE)).min(1),star:z.enum(['3-Star','4-Star','5-Star']),transferType:z.enum(['Shared SIC','Private Vehicle']),category:z.enum(['Classic','Premium','Luxury','Honeymoon','Family','Adventure']),inclusions:z.string().trim().min(10),exclusions:z.string().trim().min(10),terms:z.string().trim().min(10),startingPrice:z.number().positive(),active:z.boolean()}),
 outputSchema:z.object({id:z.string()}),
 execute:async({input,context})=>{
  await requireAdminSessionVerified(context,input.actingUserId,'manage package masters');
  if(input.nights!==input.days-1) throw new Error('Total nights must equal total days minus one.');
  const dup=await zite.packageMasters.findOne({filters:{slug:input.slug}});
  if(dup&&dup.id!==input.id) throw new Error('Package slug already exists.');
  const record={packageTitle:input.title,slug:input.slug,totalDays:input.days,totalNights:input.nights,destinations:input.destinations,hotelStarRating:input.star,transferType:input.transferType,packageCategory:input.category,inclusions:input.inclusions,exclusions:input.exclusions,termsAndConditions:input.terms,startingPrice:input.startingPrice,isActive:input.active};
  if(input.id){await zite.packageMasters.update({id:input.id,record});return{id:input.id};}
  const p=await zite.packageMasters.create({record});return{id:p.id};
 }
});
