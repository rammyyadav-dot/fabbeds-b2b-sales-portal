import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a room allotment entry',
  inputSchema: z.object({
    id: z.string().optional(),
    hotelId: z.string(),
    date: z.string(),
    totalRooms: z.number().optional(),
    roomsOnAllotment: z.number().optional(),
    roomsBlocked: z.number().optional(),
    releaseDays: z.number().optional(),
    releaseHour: z.number().optional(),
    onRequest: z.number().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const record = {
      hotel: input.hotelId,
      date: input.date,
      totalRooms: input.totalRooms ?? input.roomsOnAllotment ?? 0,
      roomsOnAllotment: input.roomsOnAllotment ?? 0,
      roomsBlocked: input.roomsBlocked ?? 0,
      releaseDays: input.releaseDays ?? 0,
      releaseHour: input.releaseHour ?? 18,
      onRequest: input.onRequest ?? 0,
    };
    if (input.id) {
      await zite.roomAllotment.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const created = await zite.roomAllotment.create({ record });
      return { id: created.id };
    }
  },
});
