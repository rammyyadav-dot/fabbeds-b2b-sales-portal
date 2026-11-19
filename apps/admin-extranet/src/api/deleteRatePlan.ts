import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Delete a rate plan — blocked if daily rates or bookings depend on it; offers deactivation instead',
  inputSchema: z.object({ id: z.string(), force: z.boolean().optional() }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    dependants: z.object({
      dailyRates: z.number(),
      bookings: z.number(),
    }).optional(),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'deleteRatePlan');
    const { records: dailyRates } = await zite.dailyRates.findAll({
      filters: { ratePlan: { contains: input.id } },
      limit: 1,
      fields: ['id'],
    });
    const { records: bookings } = await zite.bookings.findAll({
      filters: { ratePlan: { contains: input.id } },
      limit: 1,
      fields: ['id'],
    });

    const drCount = dailyRates.length;
    const bkCount = bookings.length;

    if (drCount > 0 || bkCount > 0) {
      if (input.force) {
        // Deactivate instead of delete
        await zite.ratePlans.update({ id: input.id, record: { status: 'Inactive' } });
        return { success: true };
      }
      return {
        success: false,
        error: `Cannot delete: ${drCount > 0 ? `${drCount}+ Daily Rate(s)` : ''}${drCount > 0 && bkCount > 0 ? ' and ' : ''}${bkCount > 0 ? `${bkCount}+ Booking(s)` : ''} depend on this Rate Plan. Use "Deactivate" instead.`,
        dependants: { dailyRates: drCount, bookings: bkCount },
      };
    }

    await zite.ratePlans.delete({ id: input.id });
    return { success: true };
  },
});
