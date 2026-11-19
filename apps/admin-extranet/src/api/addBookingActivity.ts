import { requireStaff } from '../lib/requireStaff';
import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Add an activity/event to a booking timeline',
  inputSchema: z.object({
    bookingId: z.string(),
    eventType: z.string(),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'addBookingActivity');
    await enrichCurrentUser(context);
    await zite.bookingActivities.create({
      record: {
        eventType: input.eventType,
        booking: input.bookingId,
        notes: input.notes,
        createdAt: new Date().toISOString(),
        createdBy: context?.user?.email || 'System',
      },
    });
    return { success: true };
  },
});
