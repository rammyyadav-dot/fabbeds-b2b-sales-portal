import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Get activity timeline for a booking',
  inputSchema: z.object({ bookingId: z.string() }),
  outputSchema: z.array(z.object({
    id: z.string(),
    eventType: z.string().optional(),
    notes: z.string().optional(),
    createdAt: z.string().optional(),
    createdBy: z.string().optional(),
  })),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getBookingActivities');
    const result = await zite.bookingActivities.findAll({
      filters: { booking: { contains: input.bookingId } },
      limit: 100,
    });
    return result.records
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .map(r => ({
        id: r.id,
        eventType: r.eventType,
        notes: r.notes,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
      }));
  },
});
