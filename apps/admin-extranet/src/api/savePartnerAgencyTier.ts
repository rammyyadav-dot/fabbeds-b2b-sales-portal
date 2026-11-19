import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';

export default createEndpoint({
  authenticated: true,
  description: 'Sets an agency pricing tier used by attraction markup rules',
  inputSchema: z.object({ partnerAccountId: z.string(), agencyTier: z.enum(['Standard', 'Silver', 'Gold', 'Platinum']) }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context, 'change agency tiers');
    if (!(await zite.partnerAccounts.findOne({ id: input.partnerAccountId }))) throw new ZiteError({ code: 'NOT_FOUND', message: 'Agency not found.' });
    await zite.partnerAccounts.update({ id: input.partnerAccountId, record: { agencyTier: input.agencyTier } as any });
    return { success: true };
  },
});
