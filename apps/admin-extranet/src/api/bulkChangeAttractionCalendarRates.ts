import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireAdmin} from '../lib/requireAdmin';
import {allAttractionRecords} from '../lib/allAttractionRecords';
import {periodDates,linkedId} from '../lib/attractionCommercialRules';
import {calendarTicket,prepareCalendarEdit,applyCalendarEdit} from '../lib/attractionCalendarEdits';
import {effectiveAttractionRateRows,attractionRateRevision} from '../../../../shared/attractionPolicy';
export default createEndpoint({
 authenticated:true,description:'Bulk changes existing attraction daily rates using set, percentage or fixed adjustments',
 inputSchema:z.object({attractionId:z.string(),ticketId:z.string(),planId:z.string(),start:z.string(),end:z.string(),weekdays:z.array(z.number().int().min(0).max(6)).min(1),operation:z.enum(['set','percent','amount']),adjustment:z.number().finite().optional(),adult:z.number().finite().min(0).optional(),child:z.number().finite().min(0).optional(),retailAdult:z.number().finite().min(0).optional(),retailChild:z.number().finite().min(0).optional(),allocation:z.number().int().min(0).optional(),cutoffHours:z.number().int().min(0).max(720).optional()}),
 outputSchema:z.object({saved:z.number(),failed:z.array(z.object({id:z.string(),message:z.string()})),matched:z.number()}),
 execute:async({input,context})=>{
 const actor=await requireAdmin(context,'bulk change attraction rates');
 await calendarTicket(input.attractionId,input.ticketId);
 const plan=await zite.attractionRatePlans.findOne({id:input.planId});
 if(!plan||linkedId(plan.ticketProduct)!==input.ticketId)throw new ZiteError({code:'BAD_REQUEST',message:'Select a rate plan for this ticket product.'});
 let dates:string[];try{dates=periodDates(input.start,input.end,input.weekdays);}catch(e:any){throw new ZiteError({code:'BAD_REQUEST',message:e.message});}
 if(input.operation!=='set'&&input.adjustment===undefined)throw new ZiteError({code:'BAD_REQUEST',message:'Enter the adjustment.'});
 if(input.operation==='percent'&&Number(input.adjustment)<-100)throw new ZiteError({code:'BAD_REQUEST',message:'Percentage cannot be below -100%.'});
 if(input.operation==='set'&&[input.adult,input.child,input.retailAdult,input.retailChild,input.allocation,input.cutoffHours].every(v=>v===undefined))throw new ZiteError({code:'BAD_REQUEST',message:'Enter at least one rate or allocation change.'});
 const result=await allAttractionRecords(zite.attractionRates,{filters:{ticketOption:input.ticketId,ratePlan:input.planId,date:{gte:input.start,lte:input.end}}});
 const pids=[...new Set(result.records.map(r=>linkedId(r.ratePeriod)).filter(Boolean))];
 const periods=pids.length?await allAttractionRecords(zite.attractionRatePeriods,{filters:{id:{in:pids}}}):{records:[]};
 const pmap=new Map(periods.records.map(p=>[p.id,p]));
 const rows=effectiveAttractionRateRows(result.records.filter(r=>dates.includes(String(r.date).slice(0,10))&&(!linkedId(r.ratePeriod)||pmap.get(linkedId(r.ratePeriod))?.status==='Published')));
 const adjusted=(v:number)=>v<=0?0:Math.round((input.operation==='percent'?v*(1+Number(input.adjustment)/100):v+Number(input.adjustment))*100)/100;
 const prepared=await Promise.all(rows.map(r=>prepareCalendarEdit(input.attractionId,input.ticketId,input.planId,{rateId:r.id,revision:attractionRateRevision(r),adult:input.operation==='set'?input.adult:adjusted(Number(r.netCostAdult||0)),child:input.operation==='set'?input.child:adjusted(Number(r.netCostChild||0)),retailAdult:input.retailAdult,retailChild:input.retailChild,allocation:input.allocation,cutoffHours:input.cutoffHours})));
 let saved=0;const failed:any[]=[];
 for(const p of prepared){try{await applyCalendarEdit(p,String(actor.email||''));saved++;}catch(e:any){failed.push({id:p.row.id,message:e.message});}}
 return{saved,failed,matched:rows.length};
 }});
