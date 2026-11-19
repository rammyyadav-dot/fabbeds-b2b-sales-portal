import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Get active meal plans from the master list',
  inputSchema: z.object({}),
  outputSchema: z.object({
    mealPlans: z.array(z.object({
      id: z.string(),
      code: z.string(),
      agentLabel: z.string(),
      sortOrder: z.number().nullable(),
    })),
  }),
  execute: async ({ context }) => {
    await requireStaff(context, 'getMealPlans');
    const { records } = await zite.mealPlans.findAll({
      filters: { status: 'Active' },
      limit: 20,
    });
    // RatePlans.Meal Plan only supports these five standard board bases.
    const standardCodes = new Set(['RO', 'BB', 'HB', 'FB', 'AI']);
    const sorted = records
      .filter(r => standardCodes.has(r.code ?? ''))
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    return {
      mealPlans: sorted.map(r => ({
        id: r.id,
        code: r.code ?? '',
        agentLabel: r.agentLabel ?? '',
        sortOrder: r.sortOrder ?? null,
      })),
    };
  },
});
