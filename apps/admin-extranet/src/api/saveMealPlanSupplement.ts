import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a meal plan supplement with full OTA pricing fields',
  inputSchema: z.object({
    id: z.string().optional(),
    supplementName: z.string(),
    hotelId: z.string(),
    seasonId: z.string().optional(),
    roomTypeId: z.string().optional(),
    validFrom: z.string().optional(),
    validTo: z.string().optional(),
    mealPlan: z.string(),
    // Adult supplement PPPN
    adultSupplementPerNight: z.number().optional(),
    // Age-band child supplements PPPN
    childSuppAge05Pppn: z.number().optional(),
    childSuppAge611Pppn: z.number().optional(),
    childSuppAge12Pppn: z.number().optional(),
    // Legacy single child rate (kept for backward compat)
    childSupplementPerNight: z.number().optional(),
    // Applicability
    applyTo: z.string().optional(),
    roundingRule: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const record: Record<string, any> = {
      supplementName: input.supplementName,
      hotel: input.hotelId,
      mealPlan: input.mealPlan,
      adultSupplementPerNight: input.adultSupplementPerNight,
      childSupplementPerNight: input.childSupplementPerNight ?? input.childSuppAge611Pppn,
      childSuppAge05Pppn: input.childSuppAge05Pppn,
      childSuppAge611Pppn: input.childSuppAge611Pppn,
      childSuppAge12Pppn: input.childSuppAge12Pppn,
      applyTo: input.applyTo,
      roundingRule: input.roundingRule,
    };
    if (input.validFrom) record.validFrom = input.validFrom;
    if (input.validTo) record.validTo = input.validTo;
    if (input.seasonId) record.season = input.seasonId;
    if (input.roomTypeId) record.supplementRoomType = input.roomTypeId;

    if (input.id) {
      await zite.mealPlanSupplements.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const created = await zite.mealPlanSupplements.create({ record });
      return { id: created.id };
    }
  },
});
