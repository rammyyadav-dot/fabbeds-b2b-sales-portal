import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all markup rules',
  inputSchema: z.object({}),
  outputSchema: z.object({
    rules: z.array(z.object({
      id: z.string(),
      ruleName: z.string().optional(),
      markupType: z.string().optional(),
      markupValue: z.number().optional(),
      appliesTo: z.string().optional(),
      specificHotel: z.union([z.array(z.string()), z.string()]).optional(),
      isActive: z.boolean().optional(),
      notes: z.string().optional(),
      ruleCategory: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      maxMarkupValue: z.number().optional(),
    })),
  }),
  execute: async () => {
    const result = await zite.markupRules.findAll({ limit: 500 });
    return {
      rules: result.records.map(r => ({
        id: r.id,
        ruleName: r.ruleName,
        markupType: r.markupType,
        markupValue: r.markupValue,
        appliesTo: r.appliesTo,
        specificHotel: r.specificHotel,
        isActive: r.isActive,
        notes: r.notes,
        ruleCategory: r.ruleCategory,
        startDate: r.startDate,
        endDate: r.endDate,
        maxMarkupValue: r.maxMarkupValue,
      })),
    };
  },
});
