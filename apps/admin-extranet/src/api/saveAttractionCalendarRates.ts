import {z} from 'zod';
import {createEndpoint} from 'zitejs/backend';
import {requireAdmin} from '../lib/requireAdmin';
import {calendarTicket,prepareCalendarEdit,applyCalendarEdit} from '../lib/attractionCalendarEdits';
const edit=z.object({rateId:z.string(),revision:z.string(),adult:z.number().min(0).optional(),child:z.number().min(0).optional(),retailAdult:z.number().min(0).optional(),retailChild:z.number().min(0).optional(),allocation:z.number().int().min(0).optional(),cutoffHours:z.number().int().min(0).max(720).optional()});
export default createEndpoint({
 authenticated:true,description:'Saves individual or bulk daily attraction rate cell edits with stale-row and sold/held guards',
 inputSchema:z.object({attractionId:z.string(),ticketId:z.string(),planId:z.string().optional(),edits:z.array(edit).min(1).max(366)}),
 outputSchema:z.object({saved:z.array(z.object({id:z.string(),revision:z.string(),adult:z.number(),child:z.number(),retailAdult:z.number(),retailChild:z.number(),allocation:z.number(),cutoffHours:z.number()})),failed:z.array(z.object({id:z.string(),message:z.string()}))}),
 execute:async({input,context})=>{
 const actor=await requireAdmin(context,'edit attraction rate cells');
 await calendarTicket(input.attractionId,input.ticketId);
 const prepared=await Promise.all(input.edits.map(edit=>prepareCalendarEdit(input.attractionId,input.ticketId,input.planId,edit)));
 const saved:any[]=[],failed:any[]=[];
 for(const p of prepared){try{saved.push(await applyCalendarEdit(p,String(actor.email||'')));}catch(e:any){failed.push({id:p.row.id,message:e.message||'Save failed'});}}
 return{saved,failed};
 }});
