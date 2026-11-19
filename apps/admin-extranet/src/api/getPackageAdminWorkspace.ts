import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

const linkId=(v:unknown)=>Array.isArray(v)?String(v[0]||''):String(v||'');
const iso=(v:unknown)=>v?new Date(String(v)).toISOString():'';
const UAE=new Set(['Dubai','Abu Dhabi','Sharjah','Ras Al Khaimah','Fujairah','Ajman']);

export default createEndpoint({
   authenticated:true,
description:'Compact admin package workspace with UAE-only product, pricing, itinerary and booking controls',
 inputSchema:z.object({actingUserId:z.string().min(1)}),
 outputSchema:z.object({
  packages:z.array(z.object({
   id:z.string(),title:z.string(),slug:z.string(),days:z.number(),nights:z.number(),destinations:z.array(z.string()),star:z.string(),transferType:z.string(),category:z.string(),
   inclusions:z.string(),exclusions:z.string(),terms:z.string(),startingPrice:z.number(),active:z.boolean(),seasonCount:z.number(),itineraryCount:z.number(),bookingCount:z.number(),
   ready:z.boolean(),issues:z.array(z.string()),
  })),
  seasons:z.array(z.object({id:z.string(),packageId:z.string(),name:z.string(),validFrom:z.string(),validTo:z.string(),netTwin:z.number(),netSingle:z.number(),netChildBed:z.number(),netChildNoBed:z.number(),sellTwin:z.number(),sellSingle:z.number(),sellChildBed:z.number(),sellChildNoBed:z.number(),allotmentCap:z.number()})),
  itinerary:z.array(z.object({id:z.string(),packageId:z.string(),dayNumber:z.number(),title:z.string(),description:z.string(),morning:z.string(),afternoon:z.string(),evening:z.string(),meals:z.string(),overnight:z.string()})),
  bookings:z.array(z.object({id:z.string(),reference:z.string(),packageId:z.string(),packageTitle:z.string(),travelDate:z.string(),leadTraveler:z.string(),email:z.string(),phone:z.string(),adultsTwin:z.number(),adultsSingle:z.number(),childrenBed:z.number(),childrenNoBed:z.number(),net:z.number(),sell:z.number(),status:z.string(),assignedOps:z.string(),vouchers:z.string(),notes:z.string(),season:z.string(),createdAt:z.string()})),
  stats:z.object({active:z.number(),ready:z.number(),blocked:z.number(),submitted:z.number(),allocating:z.number(),voucherPending:z.number(),confirmed:z.number(),bookings:z.number()}),
 }),
 execute:async({input,context})=>{
  await requireAdminSessionVerified(context,input.actingUserId,'manage holiday packages');
  const [pm,ps,pi,pb]=await Promise.all([
   zite.packageMasters.findAll({limit:1000}),
   zite.packageSeasonPrices.findAll({limit:2000}),
   zite.packageItineraryDays.findAll({limit:2000}),
   zite.packageBookings.findAll({limit:2000}),
  ]);
  const seasonBy=new Map<string,typeof ps.records>(), itinBy=new Map<string,typeof pi.records>(), bookingBy=new Map<string,typeof pb.records>();
  for(const s of ps.records){const id=linkId(s._package);const a=seasonBy.get(id)||[];a.push(s);seasonBy.set(id,a);}
  for(const x of pi.records){const id=linkId(x._package);const a=itinBy.get(id)||[];a.push(x);itinBy.set(id,a);}
  for(const b of pb.records){const id=linkId(b._package);const a=bookingBy.get(id)||[];a.push(b);bookingBy.set(id,a);}
  const pmap=new Map(pm.records.map(p=>[p.id,p]));
  const packages=pm.records.map(p=>{
    const seasons=seasonBy.get(p.id)||[], itinerary=itinBy.get(p.id)||[], bookings=bookingBy.get(p.id)||[];
    const dest=Array.isArray(p.destinations)?p.destinations.map(String):[];
    const issues:string[]=[];
    if(!p.packageTitle?.trim()) issues.push('Package title missing');
    if(!p.slug?.trim()) issues.push('Slug missing');
    if(Number(p.totalDays||0)<2) issues.push('Package must have at least 2 days');
    if(Number(p.totalNights||0)!==Math.max(0,Number(p.totalDays||0)-1)) issues.push('Nights must equal days minus one');
    if(!dest.length) issues.push('At least one UAE destination is required');
    if(dest.some(x=>!UAE.has(x))) issues.push('Non-UAE destination detected');
    if(!p.hotelStarRating) issues.push('Hotel tier missing');
    if(!p.transferType) issues.push('Transfer type missing');
    if(!p.packageCategory) issues.push('Category missing');
    if(!p.inclusions?.trim()) issues.push('Inclusions missing');
    if(!p.exclusions?.trim()) issues.push('Exclusions missing');
    if(!p.termsAndConditions?.trim()) issues.push('Terms missing');
    if(Number(p.startingPrice||0)<=0) issues.push('Starting price must be positive');
    if(!seasons.length) issues.push('No season pricing');
    if(itinerary.length!==Number(p.totalDays||0)) issues.push('Itinerary must contain exactly '+Number(p.totalDays||0)+' days');
    for(const s of seasons){
      if(!s.validFrom||!s.validTo||String(s.validFrom)>String(s.validTo)) issues.push('Invalid season date range');
      if(Number(s.retailAdultTwin||0)<Number(s.netCostAdultTwin||0)) issues.push('Season selling price below net cost');
    }
    return {id:p.id,title:p.packageTitle||'',slug:p.slug||'',days:Number(p.totalDays||0),nights:Number(p.totalNights||0),destinations:dest,star:p.hotelStarRating||'',transferType:p.transferType||'',category:p.packageCategory||'',inclusions:p.inclusions||'',exclusions:p.exclusions||'',terms:p.termsAndConditions||'',startingPrice:Number(p.startingPrice||0),active:!!p.isActive,seasonCount:seasons.length,itineraryCount:itinerary.length,bookingCount:bookings.length,ready:issues.length===0,issues};
  });
  return {
   packages,
   seasons:ps.records.map(s=>({id:s.id,packageId:linkId(s._package),name:s.seasonName||'',validFrom:s.validFrom||'',validTo:s.validTo||'',netTwin:Number(s.netCostAdultTwin||0),netSingle:Number(s.netCostAdultSingle||0),netChildBed:Number(s.netCostChildWithBed||0),netChildNoBed:Number(s.netCostChildNoBed||0),sellTwin:Number(s.retailAdultTwin||0),sellSingle:Number(s.retailAdultSingle||0),sellChildBed:Number(s.retailChildWithBed||0),sellChildNoBed:Number(s.retailChildNoBed||0),allotmentCap:Number(s.allotmentCap||0)})),
   itinerary:pi.records.map(x=>({id:x.id,packageId:linkId(x._package),dayNumber:Number(x.dayNumber||0),title:x.dayTitle||'',description:x.dayDescription||'',morning:x.morningActivity||'',afternoon:x.afternoonActivity||'',evening:x.eveningActivity||'',meals:x.mealsIncluded||'No Meals',overnight:x.overnightLocation||''})),
   bookings:pb.records.map(b=>({id:b.id,reference:b.bookingReference||'',packageId:linkId(b._package),packageTitle:pmap.get(linkId(b._package))?.packageTitle||'Unmapped package',travelDate:b.travelStartDate||'',leadTraveler:b.leadTravelerName||'',email:b.contactEmail||'',phone:b.contactPhone||'',adultsTwin:Number(b.adultsTwin||0),adultsSingle:Number(b.adultsSingle||0),childrenBed:Number(b.childrenWithBed||0),childrenNoBed:Number(b.childrenNoBed||0),net:Number(b.totalNetCost||0),sell:Number(b.totalSellPrice||0),status:b.bookingStatus||'Submitted',assignedOps:b.assignedOpsUser||'',vouchers:b.supplierVouchers||'',notes:b.internalNotes||'',season:b.seasonApplied||'',createdAt:iso(b.createdAt)})),
   stats:{active:packages.filter(p=>p.active).length,ready:packages.filter(p=>p.active&&p.ready).length,blocked:packages.filter(p=>p.active&&!p.ready).length,submitted:pb.records.filter(b=>b.bookingStatus==='Submitted').length,allocating:pb.records.filter(b=>b.bookingStatus==='Allocating').length,voucherPending:pb.records.filter(b=>b.bookingStatus==='Voucher Pending').length,confirmed:pb.records.filter(b=>b.bookingStatus==='Confirmed').length,bookings:pb.records.length},
  };
 }
});
