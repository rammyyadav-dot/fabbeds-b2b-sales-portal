import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireAdmin} from '../lib/requireAdmin';
import {linkedId,periodDates} from '../lib/attractionCommercialRules';
export default createEndpoint({
 authenticated:true,description:'Publishes a complete draft or toggles plan-period stop sale while preserving contracted allocation and prices',
 inputSchema:z.object({periodId:z.string(),action:z.enum(['publish','stop','resume'])}),outputSchema:z.object({success:z.boolean()}),
 execute:async({input,context})=>{
 const actor=await requireAdmin(context,'publish attraction periods');
 const p=await zite.attractionRatePeriods.findOne({id:input.periodId}) as any;
 if(!p)throw new ZiteError({code:'NOT_FOUND',message:'Period not found.'});
 if(input.action==='publish'){
 if(p.status!=='Draft')throw new ZiteError({code:'CONFLICT',message:'Only complete drafts can be published.'});
 const dates=periodDates(String(p.validFrom).slice(0,10),String(p.validTo).slice(0,10),String(p.weekdays).split(',').map(Number));
 const count=await zite.sql({query:'SELECT COUNT(*) AS count, COUNT(DISTINCT r."date") AS days FROM "AttractionRates" r JOIN "AttractionRatePeriodsAttractionRates" l ON l."attractionRatesId"=r.id WHERE l."attractionRatePeriodsId"=$1',params:[p.id]});
 if(Number(count.rows[0]?.count)!==dates.length||Number(count.rows[0]?.days)!==dates.length)throw new ZiteError({code:'CONFLICT',message:'Incomplete period. Regenerate before publishing.'});
 }
 const record:any=input.action==='publish'?{status:'Published',publishedAt:new Date().toISOString()}:{stopSale:input.action==='stop'};
 await zite.attractionRatePeriods.update({id:p.id,record});
 await zite.attractionRateAuditEvents.create({record:{eventLabel:p.periodName+' · '+input.action,ticketOption:linkedId((await zite.attractionRatePlans.findOne({id:linkedId(p.ratePlan)}))?.ticketProduct),action:input.action.toUpperCase(),beforeSnapshot:JSON.stringify(p),afterSnapshot:JSON.stringify(record),reason:'Period action · '+actor.email} as any});
 return{success:true};
 }});
