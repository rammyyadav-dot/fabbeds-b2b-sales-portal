import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import {
  applyMarkup,
  linkedId,
  resolveEffectiveRate,
  resolveMarkupRule,
  safeNum,
  CANONICAL_MEAL_PLANS,
} from '@project/pricing/hotelPricing';

const rateCellSchema = z.object({
  adult1Rate: z.number().optional(),
  adult2Rate: z.number().optional(),
  adult3Rate: z.number().optional(),
  childSupplement: z.number().optional(),
  extraBedRate: z.number().optional(),
  allocation: z.number().optional(),
  status: z.string().optional(),
  sellRate2: z.number().optional(),
  layer: z.string().optional(),
  source: z.literal('daily').optional(),
  ratePlanId: z.string().optional(),
  integrityStatus: z.string().optional(),
});

const rowSchema = z.object({
  id: z.string(),
  roomTypeId: z.string(),
  roomTypeName: z.string(),
  maxOccupancy: z.number().optional(),
  maxAdults: z.number().optional(),
  ratePlanId: z.string(),
  ratePlanName: z.string(),
  ratePlanCode: z.string().optional(),
  mealPlan: z.string(),
  cancellationType: z.string().optional(),
  rates: z.record(z.string(), rateCellSchema),
});

export default createEndpoint({
  authenticated: true,
  description: 'Rate-plan-aware tariff calendar using exact DailyRate inventory only',
  inputSchema: z.object({
    hotelId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
  }),
  outputSchema: z.object({
    dates: z.array(z.string()),
    rows: z.array(rowSchema),
    roomTypes: z.array(z.object({
      id: z.string(),
      name: z.string(),
      mealPlan: z.string().optional(),
      maxOccupancy: z.number().optional(),
      maxAdults: z.number().optional(),
      rates: z.record(z.string(), rateCellSchema),
    })),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getTariffCalendar');
    const dates: string[] = [];
    const cur = new Date(input.startDate + 'T00:00:00Z');
    const end = new Date(input.endDate + 'T00:00:00Z');
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const [roomTypesRes, dailyRatesRes, markupRes, ratePlansRes] = await Promise.all([
      zite.roomTypes.findAll({ filters: { hotel: { contains: input.hotelId } }, limit: 500 }),
      zite.dailyRates.findAll({
        filters: {
          hotel: { contains: input.hotelId },
          rateDate: { gte: new Date(input.startDate), lte: new Date(input.endDate) },
        },
        limit: 2000,
      }),
      zite.markupRules.findAll({ filters: { isActive: true }, limit: 500 }),
      zite.ratePlans.findAll({ filters: { hotel: { contains: input.hotelId } }, limit: 500 }),
    ]);

    const roomTypeById = new Map(roomTypesRes.records.map(rt => [rt.id, rt]));
    const activePlans = ratePlansRes.records.filter(plan =>
      plan.status === 'Active' &&
      linkedId(plan.hotel) === input.hotelId &&
      !!linkedId(plan.roomType) &&
      !!linkedId(plan.mealPlanMaster) &&
      CANONICAL_MEAL_PLANS.includes((plan.mealPlan || '') as any) &&
      (!plan.sellCurrency || plan.sellCurrency === 'AED')
    );
    const planById = new Map(activePlans.map(plan => [plan.id, plan]));

    const buckets = new Map<string, typeof dailyRatesRes.records>();
    for (const rate of dailyRatesRes.records) {
      if (rate.integrityStatus === 'Quarantined') continue;
      if (rate.currency && rate.currency !== 'AED') continue;
      const hotelId = linkedId(rate.hotel);
      const roomTypeId = linkedId(rate.roomType);
      const ratePlanId = linkedId(rate.ratePlan);
      if (!hotelId || !roomTypeId || !ratePlanId || hotelId !== input.hotelId) continue;
      if (rate.ratePlanId && rate.ratePlanId !== ratePlanId) continue;

      const plan = planById.get(ratePlanId);
      if (!plan || linkedId(plan.roomType) !== roomTypeId) continue;
      if (!roomTypeById.has(roomTypeId)) continue;
      if (!rate.rateDate) continue;

      const key = `${rate.rateDate.slice(0,10)}|${roomTypeId}|${ratePlanId}`;
      const bucket = buckets.get(key) || [];
      bucket.push(rate);
      buckets.set(key, bucket);
    }

    const rows = activePlans.flatMap(plan => {
      const roomTypeId = linkedId(plan.roomType);
      const rt = roomTypeId ? roomTypeById.get(roomTypeId) : undefined;
      if (!roomTypeId || !rt) return [];

      const rates: Record<string, z.infer<typeof rateCellSchema>> = {};
      for (const date of dates) {
        const effective = resolveEffectiveRate(buckets.get(`${date}|${roomTypeId}|${plan.id}`) || []);
        if (!effective) continue;

        const rule = resolveMarkupRule(input.hotelId, markupRes.records, date);
        const net2 = safeNum(effective.adult2Rate) || safeNum(effective.adult1Rate);
        rates[date] = {
          adult1Rate: effective.adult1Rate,
          adult2Rate: effective.adult2Rate,
          adult3Rate: effective.adult3Rate,
          childSupplement: effective.childSupplement,
          extraBedRate: effective.extraBedRate,
          allocation: effective.allocation,
          status: effective.status,
          sellRate2: net2 > 0 ? Math.round(applyMarkup(net2, rule)) : undefined,
          layer: effective.layer || 'BASE',
          source: 'daily',
          ratePlanId: plan.id,
          integrityStatus: effective.integrityStatus,
        };
      }

      return [{
        id: `${roomTypeId}|${plan.id}`,
        roomTypeId,
        roomTypeName: rt.roomTypeName || 'Room',
        maxOccupancy: rt.maxOccupancy,
        maxAdults: rt.maxAdults,
        ratePlanId: plan.id,
        ratePlanName: plan.ratePlanName || plan.id,
        ratePlanCode: plan.ratePlanCode,
        mealPlan: plan.mealPlan || 'Room Only',
        cancellationType: plan.cancellationType,
        rates,
      }];
    });

    // Compatibility projection for older consumers: one row per room type using
    // the first active rate plan. The Admin UI uses the rate-plan-aware rows above.
    const firstByRoom = new Map<string, typeof rows[number]>();
    for (const row of rows) if (!firstByRoom.has(row.roomTypeId)) firstByRoom.set(row.roomTypeId, row);

    return {
      dates,
      rows,
      roomTypes: Array.from(firstByRoom.values()).map(row => ({
        id: row.roomTypeId,
        name: row.roomTypeName,
        mealPlan: row.mealPlan,
        maxOccupancy: row.maxOccupancy,
        maxAdults: row.maxAdults,
        rates: row.rates,
      })),
    };
  },
});
