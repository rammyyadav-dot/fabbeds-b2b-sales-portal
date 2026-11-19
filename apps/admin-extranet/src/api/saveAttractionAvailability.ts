import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireAdmin} from '../lib/requireAdmin';
import {allAttractionRecords} from '../lib/allAttractionRecords';
import {linkedId} from '../lib/attractionCommercialRules';
import {attractionAvailabilityRevision} from '../../../../shared/attractionPolicy';
export default createEndpoint({
 authenticated:true,description:'Persists staged SKU/date availability paint without changing rates or sold quantities',
 inputSchema:z.object({attractionId:z.string(),changes:z.array(z.object({ticketId:z.string(),date:z.string(),status:z.enum(['Free Sale','Stop Sale','On Request','Limited']),allocation:z.number().int().min(1).optional(),revision:z.string()})).min(1).max(1000)}),
 outputSchema:z.object({saved:z.array(z.object({ticketId:z.string(),date:z.string(),revision:z.string(),status:z.string(),allocation:z.number().nullable()})),failed:z.array(z.object({ticketId:z.string(),date:z.string(),message:z.string()}))}),
 execute:async({input,context})=>{
 const actor=await requireAdmin(context,'paint attraction availability');
 const tickets=await allAttractionRecords(zite.ticketOptions,{filters:{attraction:input.attractionId}});
 const ids=new Set(tickets.records.map(t=>t.id));
 const policies=await allAttractionRecords(zite.attractionAvailability,{filters:{ticketProduct:{in:[...ids]}}});
 const rates=await allAttractionRecords(zite.attractionRates,{filters:{ticketOption:{in:[...ids]}}});
 const holds=await allAttractionRecords(zite.attractionInventoryHolds,{filters:{status:'ACTIVE'}});
 const saved:any[]=[],failed:any[]=[];
 const keys=new Set<string>();
 for(const change of input.changes){
 const key=change.ticketId+'|'+change.date;
 if(keys.has(key))throw new ZiteError({code:'BAD_REQUEST',message:'Duplicate paint cells.'});keys.add(key);
 if(!ids.has(change.ticketId)||!/^\d{4}-\d{2}-\d{2}$/.test(change.date)||!Number.isFinite(Date.parse(change.date))||new Date(change.date).toISOString().slice(0,10)!==change.date)throw new ZiteError({code:'BAD_REQUEST',message:'Invalid attraction ticket / date.'});
 }
 for(const change of input.changes){
 try{
 const matches=policies.records.filter(p=>linkedId(p.ticketProduct)===change.ticketId&&String(p.date).slice(0,10)===change.date);
 if(matches.length>1)throw new Error('Duplicate saved availability records require review.');
 const before=matches[0];
 if(change.revision!==attractionAvailabilityRevision(before))throw new Error('Availability changed. Refresh before painting this cell again.');
 const rows=rates.records.filter(r=>linkedId(r.ticketOption)===change.ticketId&&String(r.date).slice(0,10)===change.date);
 if(change.status==='Limited'&&!change.allocation)throw new Error('Limited requires an allocation per plan / slot.');
 for(const r of rows){
 const held=holds.records.filter(h=>linkedId(h.attractionRate)===r.id&&h.status==='ACTIVE'&&new Date(h.expiresAt||0).getTime()>Date.now()).reduce((n,h)=>n+Number(h.heldPax||0),0);
 if(change.status==='Limited'&&Number(change.allocation)<Number(r.soldCount||0)+held)throw new Error('Limited allocation cannot be below sold + active holds.');
 if(change.status==='Free Sale'&&Number(r.totalCapacity||0)<=0)throw new Error('No allocation. Use On Request or load a positive allocation.');
 }
 const record:any={availabilityKey:change.ticketId+'|'+change.date,ticketProduct:change.ticketId,date:change.date,status:change.status,allocation:change.status==='Limited'?change.allocation:null};
 let id:string;
 if(before){id=before.id;const fresh=await zite.attractionAvailability.findOne({id});if(attractionAvailabilityRevision(fresh)!==change.revision)throw new Error('Availability changed during save. Refresh and retry.');await zite.attractionAvailability.update({id,record});}
 else{id=(await zite.attractionAvailability.create({record})).id;}
 const after={...record,id};
 await zite.attractionRateAuditEvents.create({record:{eventLabel:'Availability '+change.date,ticketOption:change.ticketId,action:'PAINT '+change.status.toUpperCase(),effectiveDate:change.date,beforeSnapshot:before?JSON.stringify(before):'',afterSnapshot:JSON.stringify(record),reason:'Availability calendar · '+actor.email} as any});
 saved.push({ticketId:change.ticketId,date:change.date,status:change.status,allocation:record.allocation,revision:attractionAvailabilityRevision(after)});
 }catch(e:any){failed.push({ticketId:change.ticketId,date:change.date,message:e.message||'Paint save failed'});}
 }
 return{saved,failed};
 }});
