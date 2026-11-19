import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Delete a room type — blocked if rate plans or daily rates depend on it; offers deactivation instead',
  inputSchema: z.object({ id: z.string(), force: z.boolean().optional() }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    dependants: z.object({
      ratePlans: z.number(),
      dailyRates: z.number(),
    }).optional(),
  }),
  execute: async ({ input }) => {
    const { records: ratePlans } = await zite.ratePlans.findAll({
      filters: { roomType: { contains: input.id } },
      limit: 1,
      fields: ['id'],
    });
    const { records: dailyRates } = await zite.dailyRates.findAll({
      filters: { roomType: { contains: input.id } },
      limit: 1,
      fields: ['id'],
    });

    const rpCount = ratePlans.length;
    const drCount = dailyRates.length;

    if (rpCount > 0 || drCount > 0) {
      if (input.force) {
        // Deactivate room type and its rate plans
        await zite.roomTypes.update({ id: input.id, record: { status: 'Inactive' } });
        // Also deactivate any active rate plans on this room
        const { records: activeRPs } = await zite.ratePlans.findAll({
          filters: { roomType: { contains: input.id }, status: 'Active' },
          limit: 100,
          fields: ['id'],
        });
        for (const rp of activeRPs) {
          await zite.ratePlans.update({ id: rp.id, record: { status: 'Inactive' } });
        }
        return { success: true };
      }
      return {
        success: false,
        error: `Cannot delete: ${rpCount > 0 ? `${rpCount}+ Rate Plan(s)` : ''}${rpCount > 0 && drCount > 0 ? ' and ' : ''}${drCount > 0 ? `${drCount}+ Daily Rate(s)` : ''} depend on this Room Type. Use "Deactivate" instead.`,
        dependants: { ratePlans: rpCount, dailyRates: drCount },
      };
    }

    await zite.roomTypes.delete({ id: input.id });
    return { success: true };
  },
});
