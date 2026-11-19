import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import {requireAdmin} from '../lib/requireAdmin';

export default createEndpoint({
  authenticated:true,
  description: 'Creates or updates an attraction SKU/ticket option',
  inputSchema: z.object({
    id:z.string().optional(),
    mealPlanId:z.string().optional(),
    attractionId:z.string(),
    name:z.string().min(2),
    skuCode:z.string().min(2),
    ticketType:z.enum(['Timed Slot','Open Date','Flexi Pass']),
    requiresSlot:z.boolean(),
    minPax:z.number().int().min(1),
    maxPax:z.number().int().min(1),
    inclusions:z.string().optional(),
    highlights:z.string().optional(),
    status:z.enum(['Active','Inactive']),
    instantConfirmationEligible:z.boolean(),
    adultAgeFrom:z.number().int().min(0).optional(),
    childAgeFrom:z.number().int().min(0).optional(),
    childAgeTo:z.number().int().min(0).optional(),
    cancellationRule:z.string().optional(),
  }),
  outputSchema:z.object({ id:z.string(), success:z.boolean() }),
  execute:async ({input,context})=>{
    await requireAdmin(context,'manage attractions');
    if (input.maxPax < input.minPax) throw new ZiteError({code:'BAD_REQUEST',message:'Max pax must be >= min pax.'});
    if (input.childAgeFrom != null && input.childAgeTo != null && input.childAgeTo < input.childAgeFrom) {
      throw new ZiteError({code:'BAD_REQUEST',message:'Child age-to must be >= child age-from.'});
    }
    if (input.ticketType === 'Timed Slot' && !input.requiresSlot) {
      throw new ZiteError({code:'BAD_REQUEST',message:'Timed Slot ticket options must require a time slot.'});
    }
    if (input.ticketType !== 'Timed Slot' && input.requiresSlot) {
      throw new ZiteError({code:'BAD_REQUEST',message:'Only Timed Slot ticket options may require a time slot.'});
    }
    const attraction=await zite.attractions.findOne({id:input.attractionId});
    if(!attraction) throw new ZiteError({code:'NOT_FOUND',message:'Attraction not found.'});

    if(input.id){
      const current=await zite.ticketOptions.findOne({id:input.id});
      const parent=Array.isArray(current?.attraction)?current.attraction[0]:current?.attraction;
      if(!current||parent!==input.attractionId)throw new ZiteError({code:'BAD_REQUEST',message:'Ticket belongs to another attraction.'});
      if(current.ticketType!==input.ticketType){
        const plans=await zite.attractionRatePlans.findAll({filters:{ticketProduct:input.id},limit:1});
        if(plans.records.length)throw new ZiteError({code:'CONFLICT',message:'Ticket type cannot change after rate plans are created.'});
      }
    }
    if(input.mealPlanId){
      const meal=await zite.attractionMealPlans.findOne({id:input.mealPlanId});
      const parent=Array.isArray(meal?.attraction)?meal.attraction[0]:meal?.attraction;
      if(!meal||meal.status!=='Active'||parent!==input.attractionId)throw new ZiteError({code:'BAD_REQUEST',message:'Select an active meal plan for this attraction.'});
    }
    const existing=await zite.ticketOptions.findAll({filters:{skuCode:input.skuCode},limit:10});
    const conflict=existing.records.find((r:any)=>!input.id||r.id!==input.id);
    if(conflict) throw new ZiteError({code:'CONFLICT',message:'SKU code already exists.'});

    const record:any={
      attraction:input.attractionId,name:input.name,skuCode:input.skuCode,ticketType:input.ticketType,
      requiresSlot:input.requiresSlot,minPax:input.minPax,maxPax:input.maxPax,inclusions:input.inclusions||'',
      highlights:input.highlights||'',status:input.status,instantConfirmationEligible:input.instantConfirmationEligible,
      adultAgeFrom:input.adultAgeFrom??null,childAgeFrom:input.childAgeFrom??null,childAgeTo:input.childAgeTo??null,
      cancellationRule:input.cancellationRule||'',
      ...(input.mealPlanId!==undefined?{mealPlan:input.mealPlanId||null}:{}),
    };
    if(input.id){await zite.ticketOptions.update({id:input.id,record});return{id:input.id,success:true};}
    const created=await zite.ticketOptions.create({record});return{id:created.id,success:true};
  },
});
