import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a season',
  inputSchema: z.object({
    id: z.string().optional(),
    seasonName: z.string(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    seasonType: z.string().optional(),
    year: z.number().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const record = {
      seasonName: input.seasonName,
      startDate: input.startDate,
      endDate: input.endDate,
      seasonType: input.seasonType,
      year: input.year,
    };
    if (input.id) {
      await zite.seasons.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const created = await zite.seasons.create({ record });
      return { id: created.id };
    }
  },
});
