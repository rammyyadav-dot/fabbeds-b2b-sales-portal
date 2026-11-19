import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Get recent activities across all bookings for the dashboard activity log',
  inputSchema: z.object({ limit: z.number().optional() }),
  outputSchema: z.array(z.object({
    id: z.string(),
    eventType: z.string().optional(),
    notes: z.string().optional(),
    createdAt: z.string().optional(),
    createdBy: z.string().optional(),
    bookingRef: z.string().optional(),
    guestName: z.string().optional(),
  })),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getRecentActivities');
    const limit = input.limit ?? 25;
    const [activitiesRes, bookingsRes] = await Promise.all([
      zite.bookingActivities.findAll({ limit: 200 }),
      zite.bookings.findAll({ limit: 500 }),
    ]);
    const bookingMap = new Map(bookingsRes.records.map(b => [b.id, b]));
    return activitiesRes.records
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, limit)
      .map(act => {
        const bookingId = Array.isArray(act.booking) ? act.booking[0] : act.booking;
        const booking = bookingId ? bookingMap.get(bookingId) : undefined;
        return {
          id: act.id,
          eventType: act.eventType,
          notes: act.notes,
          createdAt: act.createdAt,
          createdBy: act.createdBy,
          bookingRef: booking?.bookingRef?.toString(),
          guestName: booking?.guestName,
        };
      });
  },
});
