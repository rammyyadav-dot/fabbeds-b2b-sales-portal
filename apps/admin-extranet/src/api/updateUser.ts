import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAdmin } from '../lib/requireAdmin';

const MAIN_ADMIN_EMAIL = 'rammy.yadav@gmail.com';

export default createEndpoint({
  authenticated: true,
  description: 'Update DMC staff user details (Admin only)',
  inputSchema: z.object({
    userId: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    status: z.enum(['Active', 'Inactive', 'Suspended']).optional(),
    email: z.string().optional(),
    actingUserId: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context, 'edit users');
    const target = await zite.users.findOne({ id: input.userId, fields: ['email'] });
    if (target?.email === MAIN_ADMIN_EMAIL) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'The main Admin account cannot be modified.' });
    }
    const { userId, actingUserId, ...fields } = input;
    await zite.users.update({ id: userId, record: fields });
    return { success: true };
  },
});
