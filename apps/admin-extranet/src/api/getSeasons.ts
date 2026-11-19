import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all seasons',
  inputSchema: z.object({ year: z.number().optional() }),
  outputSchema: z.object({
    seasons: z.array(z.object({
      id: z.string(),
      seasonName: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      seasonType: z.string().optional(),
      year: z.number().optional(),
    })),
  }),
  execute: async ({ input }) => {
    const filters = input.year ? { year: input.year } : {};
    const result = await zite.seasons.findAll({ filters, limit: 500 });
    return {
      seasons: result.records.map(s => ({
        id: s.id,
        seasonName: s.seasonName,
        startDate: s.startDate,
        endDate: s.endDate,
        seasonType: s.seasonType,
        year: s.year,
      })),
    };
  },
});
