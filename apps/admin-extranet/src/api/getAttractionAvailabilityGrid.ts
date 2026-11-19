import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireAdmin} from '../lib/requireAdmin';
import {allAttractionRecords} from '../lib/allAttractionRecords';
import {linkedId,periodDates} from '../lib/attractionCommercialRules';
import {isAttractionBlackout,effectiveAttractionRateRows,applyAttractionAvailability,attractionAvailabilityRevision} from '../../../../shared/attractionPolicy';
export default createEndpoint({
 authenticated:true,description:'Returns an attraction-wide SKU/date paint matrix with real rates, holds and enforced closures',
 inputSchema:z.object({attractionId:z.string(),start:z.string(),days:z.number().int().min(7).max(60)}),
 outputSchema:z.object({dates:z.array(z.string()),tickets:z.array(z.object({id:z.string(),name:z.string(),sku:z.string(),type:z.string(),status:z.string(),cells:z.array(z.object({date:z.string(),status:z.string(),policyStatus:z.string(),revision:z.string(),allocation:z.number().nullable(),remaining:z.number().nullable(),rateCount:z.number(),blocked:z.boolean()}))}))}),
 execute:async({input,context})=>{
 await requireAdmin(context,'view attraction availability');
 if(!await zite.attractions.findOne({id:input.attractionId}))throw new ZiteError({code:'NOT_FOUND',message:'Attraction not found.'});
 let dates:string[];try{const end=new Date(Date.parse(input.start)+(input.days-1)*86400000).toISOString().slice(0,10);dates=periodDates(input.start,end,[0,1,2,3,4,5,6]);}catch{throw new ZiteError({code:'BAD_REQUEST',message:'Invalid calendar start date.'});}
 const tickets=await allAttractionRecords(zite.ticketOptions,{filters:{attraction:input.attractionId}});
 const ids=tickets.records.map(t=>t.id);
 const [rates,policies,blackouts,holds]=await Promise.all([
 allAttractionRecords(zite.attractionRates,{filters:{ticketOption:{in:ids},date:{gte:dates[0],lte:dates[dates.length-1]}}}),
 allAttractionRecords(zite.attractionAvailability,{filters:{ticketProduct:{in:ids}}}),
 allAttractionRecords(zite.attractionBlackouts,{filters:{attraction:input.attractionId,status:'Active'}}),
 allAttractionRecords(zite.attractionInventoryHolds,{filters:{status:'ACTIVE'}})]);
 const pids=[...new Set(rates.records.map(r=>linkedId(r.ratePeriod)).filter(Boolean))];
 const periods=pids.length?await allAttractionRecords(zite.attractionRatePeriods,{filters:{id:{in:pids}}}):{records:[]};
 const periodMap=new Map(periods.records.map(p=>[p.id,p])),policyMap=new Map(policies.records.map(p=>[linkedId(p.ticketProduct)+'|'+String(p.date).slice(0,10),p]));
 const held=new Map<string,number>();for(const h of holds.records){if(h.status==='ACTIVE'&&new Date(h.expiresAt||0).getTime()>Date.now()){const rid=linkedId(h.attractionRate);held.set(rid,(held.get(rid)||0)+Number(h.heldPax||0));}}
 const rows=effectiveAttractionRateRows(rates.records.filter(r=>!linkedId(r.ratePeriod)||periodMap.get(linkedId(r.ratePeriod))?.status==='Published'));
 return{dates,tickets:tickets.records.map(t=>({id:t.id,name:t.name||'',sku:t.skuCode||'',type:t.ticketType||'',status:t.status||'',cells:dates.map(date=>{
 const policy=policyMap.get(t.id+'|'+date),blackedOut=isAttractionBlackout(date,input.attractionId,t.id,blackouts.records);
 const source=rows.filter(r=>linkedId(r.ticketOption)===t.id&&String(r.date).slice(0,10)===date).map(raw=>{const r=applyAttractionAvailability(raw,policy);return{...r,periodStop:!!periodMap.get(linkedId(r.ratePeriod))?.stopSale,stopSale:r.stopSale||!!periodMap.get(linkedId(r.ratePeriod))?.stopSale};});
 const positive=source.filter(r=>Number(r.netCostAdult||0)>0||Number(r.netCostChild||0)>0);
 const available=positive.filter(r=>!r.stopSale&&r.inventoryStatus!=='Sold Out');
 const remaining=available.length?available.some(r=>Number(r.totalCapacity||0)===0)?null:available.reduce((n,r)=>n+Math.max(0,Number(r.totalCapacity||0)-Number(r.soldCount||0)-(held.get(r.id)||0)),0):0;
 const blocked=blackedOut||(source.length>0&&source.every(r=>r.periodStop));
 let status='Rate Missing';
 if(blocked||policy?.status==='Stop Sale'||(source.length&&source.every(r=>r.stopSale)))status='Stop Sale';
 else if(!positive.length)status='Rate Missing';
 else if(t.status!=='Active'||source.every(r=>Date.now()>new Date(date+'T00:00:00Z').getTime()-Number(r.bookingCutoffHours||0)*3600000))status='Closed';
 else if(!available.length||remaining===0)status='Sold Out';
 else if(available.every(r=>r.inventoryStatus==='On Request'))status='On Request';
 else if(policy?.status==='Limited'||(remaining!==null&&remaining<=10))status='Limited';
 else status='Free Sale';
 return{date,status,policyStatus:policy?.status||'',revision:attractionAvailabilityRevision(policy),allocation:policy?.allocation==null?null:Number(policy.allocation),remaining,rateCount:source.length,blocked};
 })}))};
 }});
