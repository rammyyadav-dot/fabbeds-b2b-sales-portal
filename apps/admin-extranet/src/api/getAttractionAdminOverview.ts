import {isAttractionBlackout,effectiveAttractionRateRows,applyAttractionAvailability} from '../../../../shared/attractionPolicy';
import {allAttractionRecords} from '../lib/allAttractionRecords';
import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import {requireAdmin} from '../lib/requireAdmin';

const linkedId=(v:unknown)=>Array.isArray(v)?String(v[0]||''):String(v||'');

export default createEndpoint({
  authenticated:true,
  description:'Returns attraction catalogue, packages, SKU, rate, allocation, holds and reservation data for fabBeds admin',
  inputSchema:z.object({}),
  outputSchema:z.object({
    attractions:z.array(z.object({
      id:z.string(),title:z.string(),city:z.string(),category:z.string(),status:z.string(),
      slug:z.string(),description:z.string(),shortDescription:z.string(),address:z.string(),
      instantConfirmation:z.boolean(),cancellationPolicy:z.string(),rating:z.number(),reviewCount:z.number(),
    })),
    packages:z.array(z.object({
      id:z.string(),attractionId:z.string(),name:z.string(),description:z.string(),badge:z.string(),
      sortOrder:z.number(),status:z.string(),ticketOptionIds:z.array(z.string()),
    })),
    ticketOptions:z.array(z.object({
      id:z.string(),attractionId:z.string(),name:z.string(),skuCode:z.string(),ticketType:z.string(),
      status:z.string(),requiresSlot:z.boolean(),instantConfirmationEligible:z.boolean(),
      minPax:z.number(),maxPax:z.number(),adultAgeFrom:z.number().nullable(),childAgeFrom:z.number().nullable(),
      childAgeTo:z.number().nullable(),cancellationRule:z.string(),inclusions:z.string(),highlights:z.string(),mealPlanId:z.string(),
    })),
    rates:z.array(z.object({
      id:z.string(),ticketOptionId:z.string(),ratePlanId:z.string(),date:z.string(),slotTime:z.string(),
      netAdult:z.number(),netChild:z.number(),retailAdult:z.number(),retailChild:z.number(),
      capacity:z.number(),sold:z.number(),held:z.number(),remaining:z.number().nullable(),inventoryStatus:z.string(),
      stopSale:z.boolean(),cutoffHours:z.number(),rateLayer:z.string(),priority:z.number(),isFuture:z.boolean(),
    })),
    holds:z.array(z.object({
      id:z.string(),holdReference:z.string(),ticketOptionId:z.string(),rateId:z.string(),
      visitDate:z.string(),slotTime:z.string(),heldPax:z.number(),amount:z.number(),
      status:z.string(),expiresAt:z.string(),
    })),
    reservations:z.array(z.object({
      id:z.string(),bookingReference:z.string(),status:z.string(),attractionName:z.string(),
      ticketOptionName:z.string(),sku:z.string(),targetDate:z.string(),targetSlot:z.string(),
      adults:z.number(),children:z.number(),agency:z.string(),guest:z.string(),total:z.number(),
      supplierConfirmationNo:z.string().optional(),creditSettlementStatus:z.string().optional(),
    })),
    auditEvents:z.array(z.object({
      id:z.string(),eventLabel:z.string(),ticketOptionId:z.string(),rateRowId:z.string(),
      action:z.string(),effectiveDate:z.string(),timeSlot:z.string(),reason:z.string(),createdAt:z.string(),
    })),
    readiness:z.object({
      activeAttractions:z.number(),
      activeSkus:z.number(),
      activePackages:z.number(),
      sellableSkus:z.number(),
      rateGapSkus:z.number(),
      activeHolds:z.number(),
      expiringWithin24h:z.number(),
      stopSaleRows:z.number(),
      soldOutRows:z.number(),
      zeroAllocationRows:z.number(),
      timedSkuMissingSlots:z.number(),
    }),
  }),
  execute:async({context})=>{
    await requireAdmin(context,'manage attractions');
    const [attrs,tickets,rates,packages,holds,bookings,audits]=await Promise.all([
      allAttractionRecords(zite.attractions,{limit:500}),
      allAttractionRecords(zite.ticketOptions,{limit:1000}),
      allAttractionRecords(zite.attractionRates,{limit:2000}),
      allAttractionRecords(zite.attractionPackages,{limit:500}),
      allAttractionRecords(zite.attractionInventoryHolds,{limit:2000}),
      allAttractionRecords(zite.attractionBookings,{limit:1000}),
      allAttractionRecords(zite.attractionRateAuditEvents,{limit:1000}),
    ]);

    const now=Date.now();
    const today=new Date().toISOString().slice(0,10);
    const activeHeldByRate=new Map<string,number>();
    for(const h of holds.records as any[]){
      if(h.status!=='ACTIVE') continue;
      const exp=new Date(h.expiresAt||0).getTime();
      if(exp<=now) continue;
      const rateId=linkedId(h.attractionRate);
      activeHeldByRate.set(rateId,(activeHeldByRate.get(rateId)||0)+Math.max(0,Number(h.heldPax||0)));
    }

    const policies=await allAttractionRecords(zite.attractionAvailability,{});
    const policyMap=new Map(policies.records.map(p=>[linkedId(p.ticketProduct)+'|'+String(p.date).slice(0,10),p]));
    const blackoutRes=await allAttractionRecords(zite.attractionBlackouts,{filters:{status:'Active'}});
    const ticketMap=new Map((tickets.records as any[]).map(t=>[t.id,t]));
    const periodIds=[...new Set((rates.records as any[]).map(r=>linkedId(r.ratePeriod)).filter(Boolean))];
    const periodRes=periodIds.length?await allAttractionRecords(zite.attractionRatePeriods,{filters:{id:{in:periodIds}},limit:2000}):{records:[]};
    const periodMap=new Map((periodRes.records as any[]).map(p=>[p.id,p]));
    const mappedRates=(rates.records as any[]).filter(r=>!linkedId(r.ratePeriod)||periodMap.get(linkedId(r.ratePeriod))?.status==='Published').map(original=>{
      const tid=linkedId(original.ticketOption);
      const raw=applyAttractionAvailability(original,policyMap.get(tid+'|'+String(original.date).slice(0,10)));
      const r={...raw,stopSale:raw.stopSale||!!periodMap.get(linkedId(raw.ratePeriod))?.stopSale||isAttractionBlackout(String(raw.date).slice(0,10),linkedId(ticketMap.get(tid)?.attraction),tid,blackoutRes.records)};
      const capacity=Math.max(0,Number(r.totalCapacity||0));
      const sold=Math.max(0,Number(r.soldCount||0));
      const held=activeHeldByRate.get(r.id)||0;
      const remaining=r.stopSale?0:capacity>0?Math.max(0,capacity-sold-held):null;
      return{
        id:r.id,ticketOptionId:linkedId(r.ticketOption),ratePlanId:linkedId(r.ratePlan),date:String(r.date||'').slice(0,10),slotTime:r.slotTime||'',
        netAdult:Number(r.netCostAdult||0),netChild:Number(r.netCostChild||0),
        retailAdult:Number(r.retailAdult||0),retailChild:Number(r.retailChild||0),
        capacity,sold,held,remaining,inventoryStatus:r.inventoryStatus||'Available',stopSale:!!r.stopSale,
        cutoffHours:Number(r.bookingCutoffHours||0),rateLayer:r.rateLayer||'BASE',priority:Number(r.priority||0),
        isFuture:String(r.date||'').slice(0,10)>=today,
      };
    });

    const mappedTickets=(tickets.records as any[]).map(t=>({
      id:t.id,attractionId:linkedId(t.attraction),name:t.name||'',skuCode:t.skuCode||'',
      ticketType:t.ticketType||'Open Date',status:t.status||'Inactive',requiresSlot:!!t.requiresSlot,
      instantConfirmationEligible:!!t.instantConfirmationEligible,minPax:Number(t.minPax||1),maxPax:Number(t.maxPax||99),
      adultAgeFrom:t.adultAgeFrom==null?null:Number(t.adultAgeFrom),childAgeFrom:t.childAgeFrom==null?null:Number(t.childAgeFrom),
      childAgeTo:t.childAgeTo==null?null:Number(t.childAgeTo),cancellationRule:t.cancellationRule||'',inclusions:t.inclusions||'',highlights:t.highlights||'',mealPlanId:linkedId(t.mealPlan),
    }));

    const validRateTicketIds=new Set(effectiveAttractionRateRows(mappedRates).filter(r=>
      r.isFuture&&!r.stopSale&&r.inventoryStatus!=='Sold Out'&&(r.netAdult>0||r.netChild>0)&&(r.remaining===null||r.remaining>0)
    ).map(r=>r.ticketOptionId));

    const timedSkuMissingSlots=mappedTickets.filter(t=>
      t.status==='Active'&&t.requiresSlot&&!mappedRates.some(r=>r.ticketOptionId===t.id&&r.isFuture&&!r.stopSale&&!!r.slotTime)
    ).length;

    const activeHolds=(holds.records as any[]).filter(h=>h.status==='ACTIVE'&&new Date(h.expiresAt||0).getTime()>now);
    const expiringWithin24h=mappedRates.filter(r=>r.isFuture&&r.date<=new Date(now+86400000).toISOString().slice(0,10)&&r.inventoryStatus!=='Sold Out').length;

    return{
      attractions:(attrs.records as any[]).map(a=>({
        id:a.id,title:a.title||'',city:a.city||'',category:a.category||'',status:a.status||'Draft',
        slug:a.slug||'',description:a.description||'',shortDescription:a.shortDescription||'',address:a.address||'',
        instantConfirmation:!!a.instantConfirmation,cancellationPolicy:a.cancellationPolicy||'',
        rating:Number(a.rating||0),reviewCount:Number(a.reviewCount||0),
      })),
      packages:(packages.records as any[]).map(p=>({
        id:p.id,attractionId:linkedId(p.attraction),name:p.packageName||'',description:p.description||'',
        badge:p.badge||'',sortOrder:Number(p.sortOrder||0),status:p.status||'Inactive',
        ticketOptionIds:Array.isArray(p.ticketOptions)?p.ticketOptions.map(String):[],
      })),
      ticketOptions:mappedTickets,
      rates:mappedRates,
      holds:(holds.records as any[]).map(h=>({
        id:h.id,holdReference:h.holdReference||'',ticketOptionId:linkedId(h.ticketOption),rateId:linkedId(h.attractionRate),
        visitDate:String(h.visitDate||'').slice(0,10),slotTime:h.timeSlot||'',heldPax:Number(h.heldPax||0),
        amount:Number(h.heldAmountAed||0),status:h.status||'',expiresAt:h.expiresAt?new Date(h.expiresAt).toISOString():'',
      })),
      reservations:(bookings.records as any[]).map(b=>({
        id:b.id,bookingReference:b.bookingReference||'',status:b.reservationStatus||b.bookingStatus||'Awaiting Confirmation',
        attractionName:b.attractionName||'',ticketOptionName:b.ticketOptionName||'',sku:b.skuSnapshot||'',
        targetDate:String(b.targetDate||'').slice(0,10),targetSlot:b.targetSlot||'',
        adults:Number(b.adultCount||0),children:Number(b.childCount||0),agency:b.companyName||'',
        guest:b.guestName||'',total:Number(b.totalSellPrice||0),
        supplierConfirmationNo:b.supplierConfirmationNo||undefined,
        creditSettlementStatus:b.creditSettlementStatus||undefined,
      })),
      auditEvents:(audits.records as any[]).map(a=>({
        id:a.id,eventLabel:a.eventLabel||'',ticketOptionId:linkedId(a.ticketOption),rateRowId:linkedId(a.rateRow),
        action:a.action||'',effectiveDate:String(a.effectiveDate||'').slice(0,10),timeSlot:a.timeSlot||'',
        reason:a.reason||'',createdAt:a.createdAt?new Date(a.createdAt).toISOString():'',
      })).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,500),
      readiness:{
        activeAttractions:(attrs.records as any[]).filter(a=>a.status==='Active').length,
        activeSkus:mappedTickets.filter(t=>t.status==='Active').length,
        activePackages:(packages.records as any[]).filter(p=>p.status==='Active').length,
        sellableSkus:mappedTickets.filter(t=>t.status==='Active'&&validRateTicketIds.has(t.id)).length,
        rateGapSkus:mappedTickets.filter(t=>t.status==='Active'&&!validRateTicketIds.has(t.id)).length,
        activeHolds:activeHolds.length,
        expiringWithin24h,
        stopSaleRows:mappedRates.filter(r=>r.isFuture&&r.stopSale).length,
        soldOutRows:mappedRates.filter(r=>r.isFuture&&r.inventoryStatus==='Sold Out').length,
        zeroAllocationRows:mappedRates.filter(r=>r.isFuture&&r.capacity===0&&!r.stopSale).length,
        timedSkuMissingSlots,
      },
    };
  },
});
