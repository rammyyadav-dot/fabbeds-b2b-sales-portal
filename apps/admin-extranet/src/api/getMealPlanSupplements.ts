import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const supplementSchema = z.object({
  id: z.string(),
  supplementName: z.string().optional(),
  hotel: z.union([z.array(z.string()), z.string()]).optional(),
  season: z.union([z.array(z.string()), z.string()]).optional(),
  mealPlan: z.string().optional(),
  adultSupplementPerNight: z.number().optional(),
  childSupplementPerNight: z.number().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  childSuppAge05Pppn: z.number().optional(),
  childSuppAge611Pppn: z.number().optional(),
  childSuppAge12Pppn: z.number().optional(),
  applyTo: z.string().optional(),
  roundingRule: z.string().optional(),
  supplementRoomType: z.union([z.array(z.string()), z.string()]).optional(),
});

export default createEndpoint({
  description: 'Get meal plan supplements for a hotel with full OTA pricing fields',
  inputSchema: z.object({
    hotelId: z.string().optional(),
    roomTypeId: z.string().optional(),
  }),
  outputSchema: z.object({ supplements: z.array(supplementSchema) }),
  execute: async ({ input }) => {
    const result = await zite.mealPlanSupplements.findAll({ limit: 500 });
    const getId = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;

    const filtered = result.records.filter(s => {
      if (input.hotelId && getId(s.hotel) !== input.hotelId) return false;
      return true;
    });

    return {
      supplements: filtered.map(s => ({
        id: s.id,
        supplementName: s.supplementName,
        hotel: s.hotel,
        season: s.season,
        mealPlan: s.mealPlan,
        adultSupplementPerNight: s.adultSupplementPerNight,
        childSupplementPerNight: s.childSupplementPerNight,
        validFrom: s.validFrom ? s.validFrom.split('T')[0] : undefined,
        validTo: s.validTo ? s.validTo.split('T')[0] : undefined,
        childSuppAge05Pppn: s.childSuppAge05Pppn,
        childSuppAge611Pppn: s.childSuppAge611Pppn,
        childSuppAge12Pppn: s.childSuppAge12Pppn,
        applyTo: s.applyTo,
        roundingRule: s.roundingRule,
        supplementRoomType: s.supplementRoomType,
      })),
    };
  },
});
