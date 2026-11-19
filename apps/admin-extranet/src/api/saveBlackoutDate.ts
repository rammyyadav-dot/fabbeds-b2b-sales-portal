import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a blackout date',
  inputSchema: z.object({
    id: z.string().optional(),
    hotelId: z.string(),
    blackoutName: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().optional(),
    roomTypeId: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const record = {
      blackoutName: input.blackoutName,
      hotel: input.hotelId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      roomType: input.roomTypeId || undefined,
    };
    if (input.id) {
      await zite.blackoutDates.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const created = await zite.blackoutDates.create({ record });
      return { id: created.id };
    }
  },
});
