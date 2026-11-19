import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireAdmin} from '../lib/requireAdmin';
import {linkedId} from '../lib/attractionCommercialRules';
import {allAttractionRecords} from '../lib/allAttractionRecords';
export default createEndpoint({
 authenticated:true,description:'Creates or updates attraction events, meal entitlements and enforced blackout periods',
 inputSchema:z.object({id:z.string().optional(),attractionId:z.string(),kind:z.enum(['event','meal','blackout']),name:z.string().trim().min(2).max(150),ticketId:z.string().default(''),start:z.string().default(''),end:z.string().default(''),notes:z.string().default(''),code:z.string().default(''),status:z.enum(['Active','Inactive']).default('Active')}),
 outputSchema:z.object({id:z.string()}),
 execute:async({input,context})=>{
 const actor=await requireAdmin(context,'manage attraction operations');
 const bad=(message:string):never=>{throw new ZiteError({code:'BAD_REQUEST',message});};
 if(!await zite.attractions.findOne({id:input.attractionId}))bad('Attraction not found.');
 if(input.ticketId){const t=await zite.ticketOptions.findOne({id:input.ticketId});if(!t||linkedId(t.attraction)!==input.attractionId)bad('Ticket product belongs to another attraction.');}
 if(input.kind!=='meal'){
 const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid(input.start)||!valid(input.end)||input.start>input.end)bad('Select a valid inclusive date range.');
 }else if(!input.code.trim())bad('Meal plan code is required.');
 const client:any=input.kind==='event'?zite.attractionEvents:input.kind==='meal'?zite.attractionMealPlans:zite.attractionBlackouts;
 const before=input.id?await client.findOne({id:input.id}):null;
 if(input.id&&(!before||linkedId(before.attraction)!==input.attractionId))bad('This record does not belong to the selected attraction.');
 if(input.kind==='meal'){
 const meals=await allAttractionRecords(zite.attractionMealPlans,{filters:{attraction:input.attractionId}});
 if(meals.records.some(r=>r.id!==input.id&&String(r.code||'').toUpperCase()===input.code.trim().toUpperCase()))bad('Meal code already exists in this attraction.');
 }
 const record:any={attraction:input.attractionId,status:input.status};
 if(input.kind==='meal')Object.assign(record,{mealName:input.name,code:input.code.trim().toUpperCase(),inclusions:input.notes});
 else Object.assign(record,{[input.kind==='event'?'eventName':'blackoutName']:input.name,ticketProduct:input.ticketId||null,startDate:input.start,endDate:input.end,[input.kind==='event'?'notes':'reason']:input.notes});
 const id=input.id||(await client.create({record})).id;
 if(input.id)await client.update({id,record});
 await zite.attractionRateAuditEvents.create({record:{eventLabel:input.kind+' · '+input.name,ticketOption:input.ticketId||null,action:input.id?'UPDATE':'CREATE',beforeSnapshot:before?JSON.stringify(before):'',afterSnapshot:JSON.stringify(record),reason:'Attraction operations · '+actor.email} as any});
 return{id};
 }});
