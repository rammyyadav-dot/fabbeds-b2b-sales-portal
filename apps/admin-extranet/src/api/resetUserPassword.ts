import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { requireAdmin } from '../lib/requireAdmin';

export default createEndpoint({
  authenticated: true,
  description: 'Set or reset a DMC staff user password (Admin only)',
  inputSchema: z.object({
    userId: z.string(),
    password: z.string().min(1),
    actingUserId: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context, 'reset user passwords');
    await zite.users.update({ id: input.userId, record: { password: input.password } });
    return { success: true };
  },
});
