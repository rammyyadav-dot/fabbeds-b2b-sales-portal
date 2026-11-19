import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get daily rates for a hotel/room type within a date range, optionally filtered by rate plan',
  inputSchema: z.object({
    hotelId: z.string().optional(),
    roomTypeId: z.string().optional(),
    ratePlanId: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
  }),
  outputSchema: z.object({
    rates: z.array(z.object({
      id: z.string(),
      rateDate: z.string().optional(),
      roomType: z.union([z.array(z.string()), z.string()]).optional(),
      hotel: z.union([z.array(z.string()), z.string()]).optional(),
      adult1Rate: z.number().optional(),
      adult2Rate: z.number().optional(),
      adult3Rate: z.number().optional(),
      childSupplement: z.number().optional(),
      extraBedRate: z.number().optional(),
      currency: z.string().optional(),
      minStay: z.number().optional(),
      allocation: z.number().optional(),
      status: z.string().optional(),
      layer: z.string().optional(),
      ratePlanId: z.string().optional(),
    })),
  }),
  execute: async ({ input }) => {
    const getId = (v: string | string[] | undefined): string | undefined =>
      Array.isArray(v) ? v[0] : v;

    const normalizeDate = (d: string | undefined): string | undefined =>
      d ? d.split('T')[0] : undefined;

    // Build server-side filters to avoid fetching all records
    const filters: Record<string, any> = {
      rateDate: {
        gte: new Date(input.startDate),
        lte: new Date(input.endDate),
      },
    };
    if (input.hotelId) filters.hotel = { contains: input.hotelId };
    if (input.roomTypeId) filters.roomType = { contains: input.roomTypeId };

    const result = await zite.dailyRates.findAll({ filters, limit: 2000 });

    // Normal commercial views expose only valid AED Daily Rates with a consistent
    // scalar + linked Rate Plan identity. Quarantined legacy rows remain in DB for audit.
    const filtered = result.records.filter(r => {
      if (r.integrityStatus === 'Quarantined') return false;
      if (r.currency && r.currency !== 'AED') return false;
      const linkedRatePlanId = Array.isArray(r.ratePlan) ? r.ratePlan[0] : r.ratePlan;
      if (!linkedRatePlanId) return false;
      if (r.ratePlanId && r.ratePlanId !== linkedRatePlanId) return false;
      if (input.ratePlanId && linkedRatePlanId !== input.ratePlanId) return false;
      return true;
    });

    return {
      rates: filtered.map(r => ({
        id: r.id,
        rateDate: normalizeDate(r.rateDate),
        roomType: r.roomType,
        hotel: r.hotel,
        adult1Rate: r.adult1Rate,
        adult2Rate: r.adult2Rate,
        adult3Rate: r.adult3Rate,
        childSupplement: r.childSupplement,
        extraBedRate: r.extraBedRate,
        currency: r.currency,
        minStay: r.minStay,
        allocation: r.allocation,
        status: r.status,
        layer: r.layer,
        ratePlanId: r.ratePlanId,
      })),
    };
  },
});
