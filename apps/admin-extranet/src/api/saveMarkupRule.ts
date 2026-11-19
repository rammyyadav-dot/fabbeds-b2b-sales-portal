import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a markup rule',
  inputSchema: z.object({
    id: z.string().optional(),
    ruleName: z.string(),
    markupType: z.string(),
    markupValue: z.number(),
    appliesTo: z.string(),
    specificHotelId: z.string().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
    ruleCategory: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    maxMarkupValue: z.number().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const record = {
      ruleName: input.ruleName,
      markupType: input.markupType,
      markupValue: input.markupValue,
      appliesTo: input.appliesTo,
      specificHotel: input.specificHotelId,
      isActive: input.isActive ?? true,
      notes: input.notes,
      ruleCategory: input.ruleCategory ?? 'standard',
      startDate: input.startDate,
      endDate: input.endDate,
      maxMarkupValue: input.maxMarkupValue,
    };
    if (input.id) {
      await zite.markupRules.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const created = await zite.markupRules.create({ record });
      return { id: created.id };
    }
  },
});
