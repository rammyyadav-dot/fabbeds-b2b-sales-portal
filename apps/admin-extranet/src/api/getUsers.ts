import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Fetch all DMC staff users',
  inputSchema: z.object({}),
  outputSchema: z.array(z.object({
    id: z.string(),
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    role: z.string().optional(),
    password: z.string().optional(),
    status: z.string().optional(),
  })),
  execute: async ({ context }) => {
    await requireStaff(context, 'getUsers');
    const { records } = await zite.users.findAll({ limit: 500 });
    // Normalize legacy DB role names to app role names
    const normalizeRole = (role?: string) => {
      if (!role) return '';
      if (role === 'Contracting Manager') return 'Contracting Team';
      return role;
    };

    return records.map(r => ({
      id: r.id,
      email: r.email ?? '',
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      companyName: r.companyName ?? '',
      role: normalizeRole(r.role),
      password: r.password ?? '',
      status: r.status ?? 'Active',
    }));
  },
});
