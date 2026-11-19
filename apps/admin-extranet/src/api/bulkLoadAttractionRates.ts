import {allAttractionRecords} from '../lib/allAttractionRecords';
import {z} from 'zod';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {zite} from 'zitejs/db';
import {requireAdmin} from '../lib/requireAdmin';
import {periodDates,validatePrices,linkedId} from '../lib/attractionCommercialRules';
export default createEndpoint({
 authenticated:true,description:'Generates plan-specific daily rates from a commercial period with explicit overlap consent',
 inputSchema:z.object({
 ticketOptionId:z.string(),ratePlanId:z.string().optional(),periodId:z.string().optional(),startDate:z.string(),endDate:z.string(),
 weekdaysOnly:z.boolean().optional(),selectedWeekdays:z.array(z.number().int().min(0).max(6)).optional(),slotTime:z.string().optional(),
 netAdult:z.number().min(0),netChild:z.number().min(0),retailAdult:z.number().min(0),retailChild:z.number().min(0),
 totalCapacity:z.number().int().min(0),inventoryStatus:z.enum(['Available','Sold Out','On Request']),stopSale:z.boolean(),
 cutoffHours:z.number().int().min(0).max(720),rateLayer:z.enum(['OVERRIDE','PROMO','BASE','FALLBACK']).default('BASE'),
 priority:z.number().int().min(0).max(999).default(0),reason:z.string().optional(),
 overlapAction:z.enum(['reject','override','secondary']).default('reject'),publish:z.boolean().default(true)
 }),
 outputSchema:z.object({success:z.boolean(),created:z.number(),updated:z.number(),periodId:z.string(),status:z.string()}),
 execute:async({input,context})=>{
 const actor=await requireAdmin(context,'load attraction rates');
 const bad=(message:string):never=>{throw new ZiteError({code:'BAD_REQUEST',message});};
 if(!input.ratePlanId)bad('Select or create a Rate Plan before loading rates.');
 const plan=await zite.attractionRatePlans.findOne({id:input.ratePlanId!}) as any;
 if(!plan||linkedId(plan.ticketProduct)!==input.ticketOptionId)bad('Rate Plan does not belong to this ticket.');
 const ticket=await zite.ticketOptions.findOne({id:input.ticketOptionId});
 if(!ticket||ticket.status!=='Active')bad('Ticket product is not active.');
 let dates:string[]=[];
 try{validatePrices(input.netAdult,input.netChild,input.retailAdult,input.retailChild);dates=periodDates(input.startDate,input.endDate,input.selectedWeekdays??(input.weekdaysOnly?[1,2,3,4,5]:[0,1,2,3,4,5,6]));}catch(e:any){bad(e.message);}
 if(input.inventoryStatus==='Available'&&input.totalCapacity===0&&!input.stopSale)bad('Available inventory requires a positive allocation.');
 const source=await zite.sql({query:`SELECT r.* FROM "AttractionRates" r JOIN "AttractionRatePlansAttractionRates" l ON l."attractionRatesId"=r.id WHERE l."attractionRatePlansId"=$1 AND r."date">=$2::date AND r."date"<($3::date+INTERVAL '1 day')`,params:[plan.id,input.startDate,input.endDate]});
 if(source.truncated)throw new ZiteError({code:'BAD_REQUEST',message:'Too many overlapping tier rows. Load a shorter period.'});
 const existing=(source.rows as any[]).filter(r=>dates.includes(String(r.date).slice(0,10)));
 const tier=existing.filter(r=>String(r.rateLayer||'BASE')===input.rateLayer&&Number(r.priority||0)===input.priority);
 if(existing.length&&input.overlapAction==='reject'&&!input.periodId)throw new ZiteError({code:'CONFLICT',message:'Overlapping dates exist for this plan. Choose Override selected tier or Secondary tier.'});
 if(input.overlapAction==='secondary'&&tier.length)throw new ZiteError({code:'CONFLICT',message:'Secondary tier must use an unused layer/priority for these dates.'});
 if(!input.publish&&tier.length&&!input.periodId)bad('Save Draft cannot override published rates. Publish the override or choose a new tier.');
 if(input.periodId){
 const p=await zite.attractionRatePeriods.findOne({id:input.periodId}) as any;
 if(!p||linkedId(p.ratePlan)!==plan.id||!['Draft','Failed'].includes(p.status))bad('Only draft or failed periods can be regenerated.');
 const requestedDays=(input.selectedWeekdays??[0,1,2,3,4,5,6]).slice().sort().join(',');
 if(String(p.validFrom).slice(0,10)!==input.startDate||String(p.validTo).slice(0,10)!==input.endDate||String(p.weekdays).split(',').map(Number).sort().join(',')!==requestedDays||p.rateLayer!==input.rateLayer||Number(p.priority||0)!==input.priority)bad('Regeneration must keep the same validity, weekdays and tier. Load a new period to change its scope.');

 }
 // Check the full set before changing any row. Sold quantities and active holds survive overrides.
 for(const r of tier){
 const holds=await allAttractionRecords(zite.attractionInventoryHolds,{filters:{attractionRate:r.id},limit:2000});
 const held=(holds.records as any[]).filter(h=>h.status==='ACTIVE'&&new Date(h.expiresAt||0).getTime()>Date.now()).reduce((n,h)=>n+Number(h.heldPax||0),0);
 if(input.totalCapacity<Number(r.soldCount||0)+held)throw new ZiteError({code:'CONFLICT',message:'Allocation cannot be below sold + held quantity on '+String(r.date).slice(0,10)});
 }
 const meta:any={periodName:plan.planName+' · '+input.startDate+' / '+input.endDate,ratePlan:plan.id,validFrom:input.startDate,validTo:input.endDate,weekdays:(input.selectedWeekdays??[0,1,2,3,4,5,6]).join(','),adultNet:input.netAdult,childNet:input.netChild,adultRetail:input.retailAdult,childRetail:input.retailChild,allocation:input.totalCapacity,cutoffHours:input.cutoffHours,rateLayer:input.rateLayer,priority:input.priority,inventoryStatus:input.inventoryStatus,stopSale:input.stopSale,status:'Generating',generatedRows:0,failure:''};
 const period=input.periodId?{id:input.periodId}:await zite.attractionRatePeriods.create({record:meta});
 if(input.periodId)await zite.attractionRatePeriods.update({id:period.id,record:meta});
 let created=0,updated=0;
 try{
 for(const date of dates){
 const match=tier.find(r=>String(r.date).slice(0,10)===date);
 const record:any={ticketOption:input.ticketOptionId,ratePlan:plan.id,ratePeriod:period.id,date,slotTime:plan.slotTime||'',netCostAdult:input.netAdult,netCostChild:input.netChild,retailAdult:input.retailAdult,retailChild:input.retailChild,totalCapacity:input.totalCapacity,soldCount:Number(match?.soldCount||0),inventoryStatus:input.inventoryStatus,currency:'AED',stopSale:input.stopSale,bookingCutoffHours:input.cutoffHours,rateLayer:input.rateLayer,priority:input.priority,publicationStatus:'Published'};
 let rowId:string;
 if(match){await zite.attractionRates.update({id:match.id,record});rowId=match.id;updated++;}else{rowId=(await zite.attractionRates.create({record})).id;created++;}
 await zite.attractionRateAuditEvents.create({record:{eventLabel:plan.planName+' '+date,ticketOption:input.ticketOptionId,rateRow:rowId,action:match?'OVERRIDE':'CREATE',effectiveDate:date,timeSlot:plan.slotTime||'',beforeSnapshot:match?JSON.stringify(match):'',afterSnapshot:JSON.stringify(record),reason:(input.reason||'Period load')+' · '+actor.email} as any});
 }
 const count=await zite.sql({query:'SELECT COUNT(*) AS count FROM "AttractionRatePeriodsAttractionRates" WHERE "attractionRatePeriodsId"=$1',params:[period.id]});
 const actual=Number(count.rows[0]?.count||0);
 if(actual!==dates.length)throw new Error('Generated row count does not match selected weekdays. Regenerate this period.');
 const status=input.publish?'Published':'Draft';
 await zite.attractionRatePeriods.update({id:period.id,record:{status,generatedRows:actual,publishedAt:input.publish?new Date().toISOString():null} as any});
 return{success:true,created,updated,periodId:period.id,status};
 }catch(e:any){
 await zite.attractionRatePeriods.update({id:period.id,record:{status:'Failed',generatedRows:created+updated,failure:e.message} as any});
 throw new ZiteError({code:'CONFLICT',message:'Period '+period.id+' failed after '+(created+updated)+' rows. Regenerate from the periods grid. '+e.message});
 }
 }});
