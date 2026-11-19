import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { requireAdmin } from '../lib/requireAdmin';

export default createEndpoint({
  authenticated: true,
  description: 'Fetch role change audit log (Admin only)',
  inputSchema: z.object({ actingUserId: z.string().optional() }),
  outputSchema: z.array(z.object({
    id: z.string(),
    userChanged: z.string().optional(),
    changedBy: z.string().optional(),
    oldRole: z.string().optional(),
    newRole: z.string().optional(),
    date: z.string().optional(),
    userEmail: z.string().optional(),
    adminEmail: z.string().optional(),
  })),
  execute: async ({ input, context }) => {
    await requireAdmin(context, 'view the audit log');
    const { records } = await zite.auditLog.findAll({ limit: 100 });
    // Sort newest first
    return records
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .map(r => ({
        id: r.id,
        userChanged: r.userChanged ?? '',
        changedBy: r.changedBy ?? '',
        oldRole: r.oldRole ?? '',
        newRole: r.newRole ?? '',
        date: r.date ?? '',
        userEmail: r.userEmail ?? '',
        adminEmail: r.adminEmail ?? '',
      }));
  },
});
