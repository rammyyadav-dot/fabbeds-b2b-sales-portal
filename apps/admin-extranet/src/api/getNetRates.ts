import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get net rates',
  inputSchema: z.object({
    hotelId: z.string().optional(),
    roomTypeId: z.string().optional(),
    seasonId: z.string().optional(),
  }),
  outputSchema: z.object({
    rates: z.array(z.object({
      id: z.string(),
      rateId: z.any().optional(),
      hotel: z.union([z.array(z.string()), z.string()]).optional(),
      roomType: z.union([z.array(z.string()), z.string()]).optional(),
      season: z.union([z.array(z.string()), z.string()]).optional(),
      netRatePerNight: z.number().optional(),
      singleOccupancyRate: z.number().optional(),
      tripleOccupancyRate: z.number().optional(),
      extraBedRate: z.number().optional(),
      childSupplementPerNight: z.number().optional(),
      childAgeFrom: z.number().optional(),
      childAgeTo: z.number().optional(),
      minNights: z.number().optional(),
      currency: z.string().optional(),
    })),
  }),
  execute: async ({ input }) => {
    const filters: Record<string, string> = {};
    if (input.hotelId) filters.hotel = input.hotelId;
    if (input.roomTypeId) filters.roomType = input.roomTypeId;
    if (input.seasonId) filters.season = input.seasonId;
    const result = await zite.netRates.findAll({ filters, limit: 2000 });
    return {
      rates: result.records.map(r => ({
        id: r.id,
        rateId: r.rateId,
        hotel: r.hotel,
        roomType: r.roomType,
        season: r.season,
        netRatePerNight: r.netRatePerNight,
        singleOccupancyRate: r.singleOccupancyRate,
        tripleOccupancyRate: r.tripleOccupancyRate,
        extraBedRate: r.extraBedRate,
        childSupplementPerNight: r.childSupplementPerNight,
        childAgeFrom: r.childAgeFrom,
        childAgeTo: r.childAgeTo,
        minNights: r.minNights,
        currency: r.currency,
      })),
    };
  },
});
