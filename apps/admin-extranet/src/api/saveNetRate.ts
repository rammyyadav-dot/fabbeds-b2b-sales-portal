import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a net rate',
  inputSchema: z.object({
    id: z.string().optional(),
    hotelId: z.string(),
    roomTypeId: z.string(),
    seasonId: z.string(),
    netRatePerNight: z.number(),
    singleOccupancyRate: z.number().optional(),
    tripleOccupancyRate: z.number().optional(),
    extraBedRate: z.number().optional(),
    childSupplementPerNight: z.number().optional(),
    childAgeFrom: z.number().optional(),
    childAgeTo: z.number().optional(),
    minNights: z.number().optional(),
    currency: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const record = {
      hotel: input.hotelId,
      roomType: input.roomTypeId,
      season: input.seasonId,
      netRatePerNight: input.netRatePerNight,
      singleOccupancyRate: input.singleOccupancyRate,
      tripleOccupancyRate: input.tripleOccupancyRate,
      extraBedRate: input.extraBedRate,
      childSupplementPerNight: input.childSupplementPerNight,
      childAgeFrom: input.childAgeFrom,
      childAgeTo: input.childAgeTo,
      minNights: input.minNights,
      currency: input.currency || 'AED',
    };
    if (input.id) {
      await zite.netRates.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const created = await zite.netRates.create({ record });
      return { id: created.id };
    }
  },
});
