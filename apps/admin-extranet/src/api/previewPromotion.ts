import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAdmin } from '../lib/requireAdmin';
import { evaluatePromotion, validatePromotionConfiguration } from '@project/pricing/hotelPromotions';

function datesBetween(start:string,end:string){
  const out:string[]=[]; const d=new Date(start+'T00:00:00Z'); const e=new Date(end+'T00:00:00Z');
  while(d<e){out.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1);}
  return out;
}

export default createEndpoint({
  authenticated:true,
  description:'Read-only promotion pricing simulator. Never writes data.',
  inputSchema:z.object({
    promotionId:z.string(),
    hotelId:z.string(),
    roomTypeId:z.string(),
    ratePlanId:z.string(),
    checkIn:z.string(),
    checkOut:z.string(),
    bookingDate:z.string(),
    sourceMarket:z.string().optional(),
    agencySegment:z.string().optional(),
    memberTier:z.string().optional(),
    isMember:z.boolean().optional(),
    channel:z.string().optional(),
    baseNet:z.number().positive(),
    baseSell:z.number().positive(),
    publicMarkupPct:z.number().min(0).max(50).optional(),
  }),
  outputSchema:z.object({
    eligible:z.boolean(),
    reasons:z.array(z.string()),
    rejectedReasons:z.array(z.string()),
    baseNet:z.number(),
    baseSell:z.number(),
    discountAmount:z.number(),
    promotedSell:z.number(),
    protectedFloor:z.number(),
    floorBreached:z.boolean(),
    overrideApplied:z.boolean(),
    publicMarkupPct:z.number(),
    finalDisplayPrice:z.number(),
    fundingSource:z.string(),
    promotionCode:z.string(),
  }),
  execute:async({input,context})=>{
    await requireAdmin(context,'preview hotel promotions');
    const promo=await zite.promotions.findOne({id:input.promotionId});
    if(!promo)throw new ZiteError({code:'BAD_REQUEST',message:'Promotion not found.'});
    const linkedHotel=Array.isArray(promo.hotel)?promo.hotel[0]:promo.hotel;
    if(linkedHotel!==input.hotelId)throw new ZiteError({code:'BAD_REQUEST',message:'Promotion does not belong to selected hotel.'});
    const rules=await zite.promotionCommercialRules.findAll({filters:{promotionId:input.promotionId},limit:10});
    const rule=rules.records[0]||{};
    const errors=validatePromotionConfiguration(promo,rule);
    if(errors.length)throw new ZiteError({code:'BAD_REQUEST',message:'Promotion configuration is not valid for preview: '+errors.join(' | ')});

    const stayDates=datesBetween(input.checkIn,input.checkOut);
    if(!stayDates.length)throw new ZiteError({code:'BAD_REQUEST',message:'Check-out must be after check-in.'});

    const decision=evaluatePromotion(promo,rule,{
      bookingDate:input.bookingDate,checkIn:input.checkIn,checkOut:input.checkOut,stayDates,
      roomTypeId:input.roomTypeId,ratePlanId:input.ratePlanId,sourceMarket:input.sourceMarket,
      agencySegment:input.agencySegment,memberTier:input.memberTier,isMember:input.isMember,
      channel:input.channel,baseNet:input.baseNet,baseSell:input.baseSell
    });
    const publicMarkupPct=Math.min(50,Math.max(0,input.publicMarkupPct||0));
    const finalDisplayPrice=Math.round(decision.promotedSell*(1+publicMarkupPct/100));
    return{
      eligible:decision.eligible,reasons:decision.reasons,rejectedReasons:decision.rejectedReasons,
      baseNet:input.baseNet,baseSell:input.baseSell,discountAmount:decision.discountAmount,
      promotedSell:decision.promotedSell,protectedFloor:decision.protectedFloor,floorBreached:decision.floorBreached,
      overrideApplied:decision.overrideApplied,publicMarkupPct,finalDisplayPrice,
      fundingSource:decision.fundingSource,promotionCode:decision.code
    };
  }
});
