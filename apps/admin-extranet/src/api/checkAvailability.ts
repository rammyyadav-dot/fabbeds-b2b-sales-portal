import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

function getDatesInRange(checkin: string, checkout: string): string[] {
  const dates: string[] = [];
  const start = new Date(checkin);
  const end = new Date(checkout);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export default createEndpoint({
  description: 'Check availability on a verified room and rate plan for every requested night',
  inputSchema: z.object({
    hotelId: z.string(),
    roomTypeId: z.string(),
    ratePlanId: z.string(),
    checkinDate: z.string(),
    checkoutDate: z.string(),
    rooms: z.number(),
  }),
  outputSchema: z.object({
    available: z.boolean(),
    reason: z.string().optional(),
    blockedDates: z.array(z.string()),
    minAllocation: z.number().optional(),
  }),
  execute: async ({ input }) => {
    const dates = getDatesInRange(input.checkinDate, input.checkoutDate);
    if (!dates.length || input.rooms < 1) {
      return { available: false, reason: 'Invalid dates or room count', blockedDates: [] };
    }
    const idOf = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
    const plan = await zite.ratePlans.findOne({ id: input.ratePlanId });
    if (!plan || plan.status !== 'Active' || idOf(plan.hotel) !== input.hotelId ||
        idOf(plan.roomType) !== input.roomTypeId) {
      return { available: false, reason: 'Rate Plan does not belong to this hotel and room', blockedDates: dates };
    }
    const { records } = await zite.dailyRates.findAll({
      filters: {
        hotel: { contains: input.hotelId },
        roomType: { contains: input.roomTypeId },
        rateDate: { gte: new Date(input.checkinDate), lt: new Date(input.checkoutDate) },
      },
      limit: 2000,
    });
    const verified = records.filter(r => r.ratePlanId === input.ratePlanId &&
      idOf(r.ratePlan) === input.ratePlanId && r.integrityStatus !== 'Quarantined');
    const rateMap = new Map(verified.map(r => [String(r.rateDate ?? '').split('T')[0], r]));
    const blockedDates: string[] = [];
    let minAllocation: number | undefined;
    for (const date of dates) {
      const rate = rateMap.get(date);
      if (!rate || rate.status === 'Stop Sale' ||
          (rate.allocation != null && rate.allocation < input.rooms)) {
        blockedDates.push(date);
      }
      if (rate?.allocation != null) {
        minAllocation = minAllocation == null ? rate.allocation : Math.min(minAllocation, rate.allocation);
      }
    }
    return blockedDates.length
      ? { available: false, reason: `No verified rate or availability on ${blockedDates.length} date(s)`, blockedDates, minAllocation }
      : { available: true, blockedDates: [], minAllocation };
  },
});
