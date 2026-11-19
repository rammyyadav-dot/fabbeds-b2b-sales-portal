import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get room allotments for a hotel by date range or month',
  inputSchema: z.object({
    hotelId: z.string(),
    year: z.number().optional(),
    month: z.number().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  outputSchema: z.object({
    allotments: z.array(z.object({
      id: z.string(),
      date: z.string().optional(),
      totalRooms: z.number().optional(),
      roomsOnAllotment: z.number().optional(),
      roomsBlocked: z.number().optional(),
      releaseDays: z.number().optional(),
      releaseHour: z.number().optional(),
      onRequest: z.number().optional(),
    })),
  }),
  execute: async ({ input }) => {
    let startStr: string;
    let endStr: string;

    if (input.startDate && input.endDate) {
      startStr = input.startDate;
      // Add one day to endDate for lt filter (inclusive end)
      const end = new Date(input.endDate);
      end.setDate(end.getDate() + 1);
      endStr = end.toISOString().slice(0, 10);
    } else {
      const year = input.year!;
      const month = input.month!;
      startStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      endStr = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    }

    const result = await zite.roomAllotment.findAll({
      filters: {
        hotel: input.hotelId,
        date: { gte: new Date(startStr), lt: new Date(endStr) },
      },
      limit: 500,
    });

    return {
      allotments: result.records.map(a => ({
        id: a.id,
        date: a.date,
        totalRooms: a.totalRooms,
        roomsOnAllotment: a.roomsOnAllotment,
        roomsBlocked: a.roomsBlocked,
        releaseDays: a.releaseDays,
        releaseHour: a.releaseHour,
        onRequest: a.onRequest,
      })),
    };
  },
});
