import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';

/**
 * Server-side gate for staff-only endpoints: the caller must be signed in to Zite
 * and match exactly one Active row in the Users (staff) table by email.
 */
export async function requireStaff(
  context: { user?: ({ email?: string } & Record<string, unknown>) | null },
  action: string,
) {
  const email = context.user?.email?.trim().toLowerCase();
  if (!email) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Staff sign-in required', userFacingMessage: 'Please sign in to continue.' });
  const result = await zite.sql({ query: 'SELECT id FROM "Users" WHERE LOWER("email")=$1', params: [email] });
  if (result.rows.length !== 1) throw new ZiteError({ code: 'FORBIDDEN', message: `No unique staff account for ${action}`, userFacingMessage: 'Your account is not set up as staff.' });
  const actor = await zite.users.findOne({ id: String(result.rows[0].id) });
  if (!actor || actor.status !== 'Active') throw new ZiteError({ code: 'FORBIDDEN', message: `Inactive staff account for ${action}`, userFacingMessage: 'Your staff account is not active.' });
  return actor;
}
