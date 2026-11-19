import {isAttractionBlackout,effectiveAttractionRateRows,applyAttractionAvailability} from '../../../../shared/attractionPolicy';
import {allAttractionRecords} from './allAttractionRecords';
import {zite} from 'zitejs/db';
export const commercialId=(v:unknown)=>Array.isArray(v)?String(v[0]||''):String(v||'');
export async function commercialRates(rows:any[],input:{market?:string;promoCode?:string}={}){
 const periodIds=[...new Set(rows.map(r=>commercialId(r.ratePeriod)).filter(Boolean))];
 const planIds=[...new Set(rows.map(r=>commercialId(r.ratePlan)).filter(Boolean))];
 const [ps,pls]=await Promise.all([
 periodIds.length?allAttractionRecords(zite.attractionRatePeriods,{filters:{id:{in:periodIds}},limit:2000}):{records:[]},
 planIds.length?allAttractionRecords(zite.attractionRatePlans,{filters:{id:{in:planIds}},limit:2000}):{records:[]}
 ]);
 const ticketIds=[...new Set(rows.map(r=>commercialId(r.ticketOption)).filter(Boolean))];
 const tickets=ticketIds.length?await allAttractionRecords(zite.ticketOptions,{filters:{id:{in:ticketIds}}}):{records:[]};
 const ticketMap=new Map(tickets.records.map(t=>[t.id,t]));
 const attractionIds=[...new Set(tickets.records.map(t=>commercialId(t.attraction)).filter(Boolean))];
 const blackouts=attractionIds.length?await allAttractionRecords(zite.attractionBlackouts,{filters:{attraction:{in:attractionIds},status:'Active'}}):{records:[]};
 const availability=ticketIds.length?await allAttractionRecords(zite.attractionAvailability,{filters:{ticketProduct:{in:ticketIds}}}):{records:[]};
 const policyMap=new Map(availability.records.map(p=>[commercialId(p.ticketProduct)+'|'+String(p.date).slice(0,10),p]));
 const periods=new Map((ps.records as any[]).map(p=>[p.id,p])),plans=new Map((pls.records as any[]).map(p=>[p.id,p]));
 const eligible=rows.filter(r=>{
 const tid=commercialId(r.ticketOption),attractionId=commercialId(ticketMap.get(tid)?.attraction);
 if(isAttractionBlackout(String(r.date).slice(0,10),attractionId,tid,blackouts.records))return false;
 const periodId=commercialId(r.ratePeriod),planId=commercialId(r.ratePlan);
 if(!periodId&&!planId)return !r.publicationStatus||r.publicationStatus==='Published';
 const period=periods.get(periodId),plan=plans.get(planId);
 if(!period||!plan||period.status!=='Published'||plan.status!=='Active'||r.publicationStatus!=='Published')return false;
 const markets=String(plan.markets||'').toUpperCase().split(/[\s,]+/).filter(Boolean);
 if(markets.length&&!markets.includes(String(input.market||'').toUpperCase()))return false;
 if(plan.promoCode&&plan.promoCode!==input.promoCode)return false;
 return true;
 }).map(raw=>{
 const r=applyAttractionAvailability(raw,policyMap.get(commercialId(raw.ticketOption)+'|'+String(raw.date).slice(0,10)));
 return{...r,stopSale:r.stopSale||!!periods.get(commercialId(r.ratePeriod))?.stopSale,commercialPlan:plans.get(commercialId(r.ratePlan))};
 });
 // Effective stop sales must never expose a lower fallback tier.
 return effectiveAttractionRateRows(eligible).filter(r=>!r.stopSale);

}
