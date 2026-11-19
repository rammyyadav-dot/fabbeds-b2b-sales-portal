import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';
export default createEndpoint({
   authenticated:true,
description:'Create or update a package itinerary day',
 inputSchema:z.object({actingUserId:z.string().min(1),id:z.string().optional(),packageId:z.string(),dayNumber:z.number().int().min(1).max(30),title:z.string().trim().min(2),description:z.string().max(1200).optional(),morning:z.string().max(300).optional(),afternoon:z.string().max(300).optional(),evening:z.string().max(300).optional(),meals:z.enum(['Breakfast Only','Half Board','Full Board','No Meals']),overnight:z.string().trim().min(2).max(120)}),
 outputSchema:z.object({id:z.string()}),
 execute:async({input,context})=>{
  await requireAdminSessionVerified(context,input.actingUserId,'manage package itineraries');
  const pkg=await zite.packageMasters.findOne({id:input.packageId}); if(!pkg)throw new Error('Package not found.');
  if(input.dayNumber>Number(pkg.totalDays||0))throw new Error('Day number exceeds package duration.');
  const all=await zite.packageItineraryDays.findAll({filters:{_package:input.packageId},limit:100});
  const duplicate=all.records.find(x=>Number(x.dayNumber||0)===input.dayNumber&&x.id!==input.id); if(duplicate)throw new Error('This package already has Day '+input.dayNumber+'.');
  const record={dayTitle:input.title,_package:input.packageId,dayNumber:input.dayNumber,dayDescription:input.description||'',morningActivity:input.morning||'',afternoonActivity:input.afternoon||'',eveningActivity:input.evening||'',mealsIncluded:input.meals,overnightLocation:input.overnight};
  if(input.id){await zite.packageItineraryDays.update({id:input.id,record});return{id:input.id};}
  const x=await zite.packageItineraryDays.create({record});return{id:x.id};
 }
});
