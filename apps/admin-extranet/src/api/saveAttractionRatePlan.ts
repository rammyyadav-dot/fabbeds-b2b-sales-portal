import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireAdmin} from '../lib/requireAdmin';
export default createEndpoint({
 authenticated:true,
 description:'Creates a commercial rate plan attached to an existing ticket product',
 inputSchema:z.object({ticketOptionId:z.string(),planName:z.string().trim().min(2).max(100),cancellationPolicy:z.string().trim().min(3),inclusions:z.string().default(''),restrictions:z.string().default(''),slotTime:z.string().default(''),markets:z.string().default(''),promoCode:z.string().default('')}),
 outputSchema:z.object({id:z.string()}),
 execute:async({input,context})=>{
 await requireAdmin(context,'manage attraction rate plans');
 const ticket=await zite.ticketOptions.findOne({id:input.ticketOptionId});
 if(!ticket||ticket.status!=='Active')throw new ZiteError({code:'BAD_REQUEST',message:'Select an active ticket product.'});
 if(ticket.requiresSlot&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.slotTime))throw new ZiteError({code:'BAD_REQUEST',message:'Timed products require a valid HH:mm slot.'});
 if(!ticket.requiresSlot&&input.slotTime)throw new ZiteError({code:'BAD_REQUEST',message:'Open-date products cannot have a slot.'});
 const duplicate=await zite.sql({query:'SELECT p.id FROM "AttractionRatePlans" p JOIN "AttractionRatePlansTicketOptions" l ON l."attractionRatePlansId"=p.id WHERE l."ticketOptionsId"=$1 AND LOWER(p."planName")=LOWER($2)',params:[input.ticketOptionId,input.planName]});
 if(duplicate.rows.length)throw new ZiteError({code:'CONFLICT',message:'This plan name already exists for the ticket. Select the existing plan.'});
 const plan=await zite.attractionRatePlans.create({record:{planName:input.planName,ticketProduct:input.ticketOptionId,cancellationPolicy:input.cancellationPolicy,inclusions:input.inclusions,restrictions:input.restrictions,slotTime:input.slotTime,markets:input.markets.trim().toUpperCase(),promoCode:input.promoCode.trim(),status:'Active'} as any});
 return{id:plan.id};
 }});
