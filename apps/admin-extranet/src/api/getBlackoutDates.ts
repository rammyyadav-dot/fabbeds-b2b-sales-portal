import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get blackout dates for a hotel',
  inputSchema: z.object({
    hotelId: z.string(),
  }),
  outputSchema: z.object({
    blackoutDates: z.array(z.object({
      id: z.string(),
      blackoutName: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      reason: z.string().optional(),
      roomTypeId: z.string().optional(),
    })),
  }),
  execute: async ({ input }) => {
    const result = await zite.blackoutDates.findAll({
      filters: { hotel: input.hotelId },
      limit: 500,
    });
    return {
      blackoutDates: result.records.map(r => ({
        id: r.id,
        blackoutName: r.blackoutName,
        startDate: r.startDate,
        endDate: r.endDate,
        reason: r.reason,
        roomTypeId: Array.isArray(r.roomType) ? r.roomType[0] : r.roomType,
      })),
    };
  },
});
