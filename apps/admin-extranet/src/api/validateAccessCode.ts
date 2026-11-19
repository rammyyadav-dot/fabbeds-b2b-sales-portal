import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Validate email and password for TMS authentication',
  inputSchema: z.object({
    email: z.string(),
    password: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    id: z.string().optional(),
    username: z.string().optional(),
    fullName: z.string().optional(),
    email: z.string().optional(),
    role: z.string().optional(),
  }),
  execute: async ({ input }) => {
    const normalizedEmail = input.email.trim().toLowerCase();
    const result = await zite.users.findOne({
      filters: { email: normalizedEmail },
    });

    if (!result) {
      return { success: false, error: 'No account found with this email address.' };
    }

    // Check password — if no password is stored yet (bootstrap), allow any password
    const storedPassword = result.password ?? (result as any).accessCode;
    if (storedPassword && storedPassword !== input.password) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    // Block suspended/inactive accounts
    const status = result.status ?? 'Active';
    if (status === 'Suspended') {
      return { success: false, error: 'Your account has been suspended. Please contact your administrator.' };
    }
    if (status === 'Inactive') {
      return { success: false, error: 'Your account is inactive. Please contact your administrator.' };
    }

    // Normalize legacy "Contracting Manager" -> "Contracting Team"
    const rawRole = result.role ?? 'Reservations Agent';
    const normalizedRole = rawRole === 'Contracting Manager' ? 'Contracting Team' : rawRole;

    return {
      success: true,
      id: result.id,
      username: result.email ?? input.email,
      fullName: `${result.firstName ?? ''} ${result.lastName ?? ''}`.trim() || undefined,
      email: result.email ?? input.email,
      role: normalizedRole,
    };
  },
});
