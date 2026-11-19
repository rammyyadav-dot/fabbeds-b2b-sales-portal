import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAdmin } from '../lib/requireAdmin';

const MAIN_ADMIN_EMAIL = 'rammy.yadav@gmail.com';

const DMC_ROLES = [
  'Admin',
  'Contracting Team',
  'Sales Manager',
  'Finance Controller',
  'Reservations Agent',
  'Read Only',
] as const;

export default createEndpoint({
  authenticated: true,
  description: 'Update the role of a DMC staff user (Admin only)',
  inputSchema: z.object({
    userId: z.string(),
    role: z.enum(DMC_ROLES),
    oldRole: z.string().optional(),
    userName: z.string().optional(),
    userEmail: z.string().optional(),
    actingUserId: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const actor = await requireAdmin(context, 'update user roles');

    // Block changes to the main admin account
    if (input.userEmail === MAIN_ADMIN_EMAIL) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'The main Admin account cannot be modified.' });
    }

    // Also fetch by ID to double-check email (safety net)
    const targetUser = await zite.users.findOne({ id: input.userId, fields: ['email'] });
    if (targetUser?.email === MAIN_ADMIN_EMAIL) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'The main Admin account cannot be modified.' });
    }

    await zite.users.update({ id: input.userId, record: { role: input.role } });

    // Log audit entry
    await zite.auditLog.create({
      record: {
        userChanged: input.userName ?? input.userEmail ?? input.userId,
        changedBy: [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.email || 'System',
        oldRole: input.oldRole ?? '—',
        newRole: input.role,
        date: new Date().toISOString(),
        userEmail: input.userEmail ?? '',
        adminEmail: actor.email ?? '',
      },
    });
    return { success: true };
  },
});
