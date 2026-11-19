import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint} from 'zitejs/backend';
import {requireAdmin} from '../lib/requireAdmin';
async function queryAll(query:string){
 const rows:any[]=[];
 for(let offset=0;;offset+=2000){
 const page=await zite.sql({query:query+' LIMIT 2000 OFFSET '+offset,params:[]});
 rows.push(...page.rows);
 if(page.rows.length<2000)break;
 }
 return{rows};
}
export default createEndpoint({
 authenticated:true,description:'Rate plans and explicit periods with actual linked daily row counts',
 inputSchema:z.object({}),
 outputSchema:z.object({
 plans:z.array(z.object({id:z.string(),ticketOptionId:z.string(),name:z.string(),cancellation:z.string(),inclusions:z.string(),restrictions:z.string(),slot:z.string(),markets:z.string(),promoCode:z.string()})),
 periods:z.array(z.object({id:z.string(),planId:z.string(),start:z.string(),end:z.string(),weekdays:z.array(z.number()),netAdult:z.number(),netChild:z.number(),retailAdult:z.number(),retailChild:z.number(),allocation:z.number(),cutoff:z.number(),layer:z.string(),priority:z.number(),inventoryStatus:z.string(),status:z.string(),stopSale:z.boolean(),rows:z.number(),failure:z.string()})),
 legacyRows:z.number()
 }),
 execute:async({context})=>{
 await requireAdmin(context,'view attraction contracting');
 const [plans,periods,legacy]=await Promise.all([
 queryAll('SELECT p.*, l."ticketOptionsId" AS "ticketOptionId" FROM "AttractionRatePlans" p JOIN "AttractionRatePlansTicketOptions" l ON l."attractionRatePlansId"=p.id ORDER BY p.id'),
 queryAll(`SELECT p.*, l."attractionRatePlansId" AS "planId", (SELECT COUNT(*) FROM "AttractionRatePeriodsAttractionRates" r WHERE r."attractionRatePeriodsId"=p.id) AS "rowCount" FROM "AttractionRatePeriods" p JOIN "AttractionRatePeriodsAttractionRatePlans" l ON l."attractionRatePeriodsId"=p.id ORDER BY p."validFrom" DESC, p.id`),
 zite.sql({query:'SELECT COUNT(*) AS count FROM "AttractionRates" r WHERE NOT EXISTS (SELECT 1 FROM "AttractionRatePeriodsAttractionRates" l WHERE l."attractionRatesId"=r.id)',params:[]})
 ]);
 return{plans:plans.rows.map((p:any)=>({id:p.id,ticketOptionId:p.ticketOptionId,name:p.planName||'',cancellation:p.cancellationPolicy||'',inclusions:p.inclusions||'',restrictions:p.restrictions||'',slot:p.slotTime||'',markets:p.markets||'',promoCode:p.promoCode||''})),
 periods:periods.rows.map((p:any)=>({id:p.id,planId:p.planId,start:String(p.validFrom||'').slice(0,10),end:String(p.validTo||'').slice(0,10),weekdays:String(p.weekdays||'').split(',').filter(Boolean).map(Number),netAdult:Number(p.adultNet||0),netChild:Number(p.childNet||0),retailAdult:Number(p.adultRetail||0),retailChild:Number(p.childRetail||0),allocation:Number(p.allocation||0),cutoff:Number(p.cutoffHours||0),layer:p.rateLayer||'BASE',priority:Number(p.priority||0),inventoryStatus:p.inventoryStatus||'Available',status:p.status||'Draft',stopSale:!!p.stopSale,rows:Number(p.rowCount||0),failure:p.failure||''})),legacyRows:Number(legacy.rows[0]?.count||0)};
 }});
