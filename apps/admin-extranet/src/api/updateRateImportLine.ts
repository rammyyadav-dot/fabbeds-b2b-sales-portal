import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Update mapping fields on a rate import line',
  inputSchema: z.object({
    lineId: z.string(),
    mappedRoomTypeId: z.string().optional(),
    mappedRoomTypeName: z.string().optional(),
    mappedMealPlan: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    await zite.rateImportLines.update({
      id: input.lineId,
      record: {
        mappedRoomTypeId: input.mappedRoomTypeId,
        mappedRoomTypeName: input.mappedRoomTypeName,
        mappedMealPlan: input.mappedMealPlan,
        validationStatus: 'Pending',
      },
    });
    return { success: true };
  },
});
