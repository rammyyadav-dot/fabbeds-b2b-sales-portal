import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Get meal plan supplement rates for a hotel, returning per-record data',
  inputSchema: z.object({
    hotelId: z.string(),
    year: z.number(),
    month: z.number(), // 1-12
  }),
  outputSchema: z.object({
    rates: z.array(z.object({
      recordId: z.string(),
      date: z.string(),
      mealPlan: z.string(),
      adultRate: z.number().optional(),
      childRate: z.number().optional(),
    })),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getMealPlanRates');
    const { hotelId, year, month } = input;
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const result = await zite.mealPlanSupplements.findAll({ limit: 2000 });
    const filtered = result.records.filter(r => {
      const hotelId_ = Array.isArray(r.hotel) ? r.hotel[0] : r.hotel;
      if (hotelId_ !== hotelId) return false;
      if (!r.validFrom) return false;
      const d = r.validFrom.split('T')[0];
      return d >= startDate && d <= endDate;
    });

    return {
      rates: filtered.map(r => ({
        recordId: r.id,
        date: r.validFrom!.split('T')[0],
        mealPlan: r.mealPlan ?? '',
        adultRate: r.adultSupplementPerNight,
        childRate: r.childSuppAge611Pppn,
      })),
    };
  },
});
