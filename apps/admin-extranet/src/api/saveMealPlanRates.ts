import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const rateSchema = z.object({
  date: z.string(),
  mealPlan: z.string(),
  adultRate: z.number().optional(),
  childRate: z.number().optional(),
});

export default createEndpoint({
  authenticated: true,
  description: 'Bulk save meal plan supplement rates for a hotel',
  inputSchema: z.object({
    hotelId: z.string(),
    rates: z.array(rateSchema),
  }),
  outputSchema: z.object({ saved: z.number() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'saveMealPlanRates');
    const { hotelId, rates } = input;

    // Fetch existing records for the hotel
    const existing = await zite.mealPlanSupplements.findAll({ limit: 2000 });
    const existingMap: Record<string, string> = {};
    for (const r of existing.records) {
      const hid = Array.isArray(r.hotel) ? r.hotel[0] : r.hotel;
      if (hid !== hotelId || !r.validFrom || !r.mealPlan) continue;
      const key = `${r.mealPlan}__${r.validFrom.split('T')[0]}`;
      existingMap[key] = r.id;
    }

    const toCreate: { record: any }[] = [];
    const toUpdate: { id: string; record: any }[] = [];

    for (const rate of rates) {
      const key = `${rate.mealPlan}__${rate.date}`;
      const record = {
        supplementName: `${rate.mealPlan} ${rate.date}`,
        hotel: hotelId,
        mealPlan: rate.mealPlan,
        validFrom: rate.date,
        validTo: rate.date,
        adultSupplementPerNight: rate.adultRate,
        childSuppAge611Pppn: rate.childRate,
        childSupplementPerNight: rate.childRate,
      };
      if (existingMap[key]) {
        toUpdate.push({ id: existingMap[key], record });
      } else {
        toCreate.push({ record });
      }
    }

    // Batch create new records (max 100 per call)
    for (let i = 0; i < toCreate.length; i += 100) {
      await zite.mealPlanSupplements.bulkCreate({ records: toCreate.slice(i, i + 100).map(r => r.record) });
    }

    // Update existing records
    for (const u of toUpdate) {
      await zite.mealPlanSupplements.update({ id: u.id, record: u.record });
    }

    return { saved: toCreate.length + toUpdate.length };
  },
});
