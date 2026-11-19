import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAdmin } from '../lib/requireAdmin';

const MAIN_ADMIN_EMAIL = 'rammy.yadav@gmail.com';

export default createEndpoint({
  authenticated: true,
  description: 'Delete a DMC staff user (Admin only)',
  inputSchema: z.object({ userId: z.string(), actingUserId: z.string().optional() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context, 'delete users');
    const target = await zite.users.findOne({ id: input.userId, fields: ['email'] });
    if (target?.email === MAIN_ADMIN_EMAIL) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'The main Admin account cannot be deleted.' });
    }
    await zite.users.delete({ id: input.userId });
    return { success: true };
  },
});
