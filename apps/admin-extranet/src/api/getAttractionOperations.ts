import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireAdmin} from '../lib/requireAdmin';
import {allAttractionRecords} from '../lib/allAttractionRecords';
import {linkedId} from '../lib/attractionCommercialRules';
export default createEndpoint({
 authenticated:true,description:'Loads attraction-scoped events, meal plans and blackout dates',
 inputSchema:z.object({attractionId:z.string()}),
 outputSchema:z.object({records:z.array(z.object({id:z.string(),kind:z.enum(['event','meal','blackout']),name:z.string(),ticketId:z.string(),start:z.string(),end:z.string(),notes:z.string(),code:z.string(),status:z.string()}))}),
 execute:async({input,context})=>{
 await requireAdmin(context,'view attraction operations');
 if(!await zite.attractions.findOne({id:input.attractionId}))throw new ZiteError({code:'NOT_FOUND',message:'Attraction not found.'});
 const clients=[zite.attractionEvents,zite.attractionMealPlans,zite.attractionBlackouts],kinds=['event','meal','blackout'] as const;
 const lists=await Promise.all(clients.map(client=>allAttractionRecords(client,{filters:{attraction:input.attractionId}})));
 return{records:lists.flatMap((list,i)=>list.records.map((r:any)=>({id:r.id,kind:kinds[i],name:r.eventName||r.mealName||r.blackoutName||'',ticketId:linkedId(r.ticketProduct),start:String(r.startDate||'').slice(0,10),end:String(r.endDate||'').slice(0,10),notes:r.notes||r.inclusions||r.reason||'',code:r.code||'',status:r.status||'Active'})))};
 }});
