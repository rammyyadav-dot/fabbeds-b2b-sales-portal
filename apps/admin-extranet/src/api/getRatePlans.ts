import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const ratePlanSchema = z.object({
  id: z.string(),
  ratePlanName: z.string().optional(),
  hotel: z.union([z.array(z.string()), z.string()]).optional(),
  roomType: z.union([z.array(z.string()), z.string()]).optional(),
  mealPlan: z.string().optional(),
  mealPlanMaster: z.union([z.array(z.string()), z.string()]).optional(),
  cancellationType: z.string().optional(),
  rateType: z.string().optional(),
  refundable: z.boolean().optional(),
  cancellationWindowDays: z.number().optional(),
  noshowRule: z.string().optional(),
  minStayNights: z.number().optional(),
  maxStayNights: z.number().optional(),
  childPolicy: z.string().optional(),
  extraBedPolicy: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  layer: z.string().optional(),
  ratePlanCode: z.string().optional(),
  pmsCode: z.string().optional(),
  crsCode: z.string().optional(),
  otaCode: z.string().optional(),
  nationalityMarket: z.string().optional(),
  marketEligibilityType: z.string().optional(),
  marketApplicability: z.string().optional(),
  sourceMarkets: z.union([z.array(z.string()), z.string()]).optional(),
  includedCountries: z.union([z.array(z.string()), z.string()]).optional(),
  excludedCountries: z.union([z.array(z.string()), z.string()]).optional(),
});

export default createEndpoint({
  description: 'Get rate plans for a hotel',
  inputSchema: z.object({
    hotelId: z.string().optional(),
    roomTypeId: z.string().optional(),
    layer: z.string().optional(),
  }),
  outputSchema: z.object({ ratePlans: z.array(ratePlanSchema) }),
  execute: async ({ input }) => {
    const filters: Record<string, any> = {};
    if (input.hotelId) filters.hotel = input.hotelId;
    if (input.roomTypeId) filters.roomType = input.roomTypeId;
    if (input.layer) filters.layer = input.layer;
    const result = await zite.ratePlans.findAll({ filters, limit: 500 });
    return {
      ratePlans: result.records.map(r => ({
        id: r.id,
        ratePlanName: r.ratePlanName,
        hotel: r.hotel,
        roomType: r.roomType,
        mealPlan: r.mealPlan,
        mealPlanMaster: r.mealPlanMaster,
        cancellationType: r.cancellationType,
        rateType: r.rateType,
        refundable: r.refundable,
        cancellationWindowDays: r.cancellationWindowDays,
        noshowRule: r.noshowRule,
        minStayNights: r.minStayNights,
        maxStayNights: r.maxStayNights,
        childPolicy: r.childPolicy,
        extraBedPolicy: r.extraBedPolicy,
        status: r.status,
        notes: r.notes,
        layer: r.layer,
        ratePlanCode: r.ratePlanCode,
        pmsCode: r.pmsCode,
        crsCode: r.crsCode,
        otaCode: r.otaCode,
        nationalityMarket: r.nationalityMarket,
        marketEligibilityType: r.marketEligibilityType,
        marketApplicability: r.marketApplicability,
        sourceMarkets: r.sourceMarkets,
        includedCountries: r.includedCountries,
        excludedCountries: r.excludedCountries,
      })),
    };
  },
});
