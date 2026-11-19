import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Apply room type and meal plan mappings to all lines in a rate import job',
  inputSchema: z.object({
    jobId: z.string(),
    roomMappings: z.array(z.object({
      label: z.string(),
      roomTypeId: z.string(),
      roomTypeName: z.string(),
    })),
    mealMappings: z.array(z.object({
      label: z.string(),
      mealPlanCode: z.string(),
    })),
  }),
  outputSchema: z.object({ updatedCount: z.number() }),
  execute: async ({ input }) => {
    const roomMap = new Map<string, { roomTypeId: string; roomTypeName: string }>(input.roomMappings.map(m => [m.label, { roomTypeId: m.roomTypeId, roomTypeName: m.roomTypeName }]));
    const mealMap = new Map(input.mealMappings.map(m => [m.label, m.mealPlanCode]));

    // Fetch all lines in pages
    const allLines: any[] = [];
    let offset = 0;
    while (true) {
      const { records, hasMore } = await zite.rateImportLines.findAll({
        filters: { importJob: input.jobId },
        offset, limit: 500,
        fields: ['id', 'roomLabel', 'mealLabel'],
      });
      allLines.push(...records);
      if (!hasMore) break;
      offset += 500;
    }

    // Build batch of updated records
    const toUpdate = allLines
      .map(line => {
        const rm = roomMap.get(line.roomLabel ?? '');
        const meal = mealMap.get(line.mealLabel ?? '');
        if (!rm && !meal) return null;
        return {
          id: line.id,
          ...(rm ? { mappedRoomTypeId: rm.roomTypeId, mappedRoomTypeName: rm.roomTypeName } : {}),
          ...(meal ? { mappedMealPlan: meal } : {}),
          validationStatus: 'Pending',
        };
      })
      .filter(Boolean) as any[];

    // Bulk upsert in batches of 100
    const BATCH = 100;
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      await zite.rateImportLines.bulkCreate({
        records: toUpdate.slice(i, i + BATCH),
        matchOn: ['id'],
      });
    }

    return { updatedCount: toUpdate.length };
  },
});
