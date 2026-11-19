import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const commercialSchema = {
  fundingSource: z.string().optional(),
  sourceMarkets: z.string().optional(),
  agencySegments: z.string().optional(),
  memberTiers: z.string().optional(),
  wholeStayRequired: z.boolean().optional(),
  minimumSellFloorAed: z.number().optional(),
  minimumMargin: z.number().optional(),
  maximumDiscount: z.number().optional(),
  allowBelowNet: z.boolean().optional(),
  overrideApproved: z.boolean().optional(),
  overrideApprover: z.string().optional(),
  overrideReason: z.string().optional(),
  stackingGroup: z.string().optional(),
  compatiblePromotionIds: z.string().optional(),
  incompatiblePromotionIds: z.string().optional(),
  sameFamilyStacking: z.boolean().optional(),
};

export default createEndpoint({
  description: 'Get promotions and commercial rules for a hotel',
  inputSchema: z.object({ hotelId: z.string() }),
  outputSchema: z.object({
    promotions: z.array(z.object({
      id: z.string(),
      promotionCode: z.string().optional(),
      promotionName: z.string().optional(),
      status: z.string().optional(),
      promoType: z.string().optional(),
      priority: z.number().optional(),
      stackingPolicy: z.string().optional(),
      isFlashSale: z.boolean().optional(),
      memberOnly: z.boolean().optional(),
      discountPercent: z.number().optional(),
      discountAmount: z.number().optional(),
      stayNights: z.number().optional(),
      payNights: z.number().optional(),
      startNightIndex: z.number().optional(),
      minRateAfterDiscount: z.number().optional(),
      minLos: z.number().optional(),
      maxLos: z.number().optional(),
      minAdvanceDays: z.number().optional(),
      maxAdvanceDays: z.number().optional(),
      stayStartDate: z.string().optional(),
      stayEndDate: z.string().optional(),
      bookingStartDate: z.string().optional(),
      bookingEndDate: z.string().optional(),
      applicableDays: z.array(z.string()).optional(),
      channels: z.array(z.string()).optional(),
      roomTypeIDs: z.string().optional(),
      ratePlanIDs: z.string().optional(),
      descriptionPublic: z.string().optional(),
      descriptionInternal: z.string().optional(),
      blackoutDatesJson: z.string().optional(),
      packageBenefitJson: z.string().optional(),
      ...commercialSchema,
    }))
  }),
  execute: async ({ input }) => {
    const [result, rules] = await Promise.all([
      zite.promotions.findAll({ filters: { hotel: input.hotelId }, limit: 500 }),
      zite.promotionCommercialRules.findAll({ filters: { hotelId: input.hotelId }, limit: 500 }),
    ]);
    const ruleByPromotion = new Map(rules.records.map(r => [r.promotionId, r]));
    return {
      promotions: result.records.map(p => {
        const rule = ruleByPromotion.get(p.id);
        return {
          ...p,
          id: p.id,
          fundingSource: rule?.fundingSource || undefined,
          sourceMarkets: rule?.sourceMarkets || undefined,
          agencySegments: rule?.agencySegments || undefined,
          memberTiers: rule?.memberTiers || undefined,
          wholeStayRequired: rule?.wholeStayRequired || false,
          minimumSellFloorAed: rule?.minimumSellFloorAed ?? undefined,
          minimumMargin: rule?.minimumMargin ?? undefined,
          maximumDiscount: rule?.maximumDiscount ?? undefined,
          allowBelowNet: rule?.allowBelowNet || false,
          overrideApproved: rule?.overrideApproved || false,
          overrideApprover: rule?.overrideApprover || undefined,
          overrideReason: rule?.overrideReason || undefined,
          stackingGroup: rule?.stackingGroup || undefined,
          compatiblePromotionIds: rule?.compatiblePromotionIds || undefined,
          incompatiblePromotionIds: rule?.incompatiblePromotionIds || undefined,
          sameFamilyStacking: rule?.sameFamilyStacking || false,
        };
      })
    };
  },
});
