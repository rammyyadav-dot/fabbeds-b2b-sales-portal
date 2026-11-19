import {requireAdmin} from '../lib/requireAdmin';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Create a new TMS user account (admin-initiated or self-registration)',
  inputSchema: z.object({
    fullName: z.string(),
    email: z.string(),
    password: z.string(),
    role: z.string().refine(v=>v.split(',').every(r=>['Admin','Contracting Team','Sales Manager','Finance Controller','Reservations Agent','Read Only'].includes(r.trim())), 'Unsupported staff role').optional(),
    companyName: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    id: z.string().optional(),
    email: z.string().optional(),
    role: z.string().refine(v=>v.split(',').every(r=>['Admin','Contracting Team','Sales Manager','Finance Controller','Reservations Agent','Read Only'].includes(r.trim())), 'Unsupported staff role').optional(),
  }),
  execute: async ({ input, context }) => {
    await requireAdmin(context, "create staff users");
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await zite.users.findOne({ filters: { email: normalizedEmail }, fields: ['id'] });
    if (existing) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const role = input.role ?? 'Reservations Agent';
    const nameParts = input.fullName.trim().split(' ');
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') || undefined;

    const created = await zite.users.create({
      record: {
        email: normalizedEmail,
        firstName,
        lastName,
        companyName: input.companyName,
        role,
        password: input.password || undefined,
        status: 'Active',
      },
    });

    return {
      success: true,
      id: created.id,
      email: created.email ?? input.email,
      role: created.role ?? role,
    };
  },
});
