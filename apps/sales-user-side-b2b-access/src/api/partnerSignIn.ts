import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { createPartnerToken } from '@/lib/partnerSecurity';

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const hashArr = new Uint8Array(bits);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArr).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const pairs = saltHex.match(/.{2}/g);
  if (!pairs) return false;
  const salt = new Uint8Array(pairs.map(h => parseInt(h, 16)));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === hashHex;
}

export { hashPassword, verifyPassword };

export default createEndpoint({
  description: 'Signs in a travel trade partner and returns credit-account profile',
  inputSchema: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    token: z.string().optional(),
    partner: z.object({
      id: z.string(),
      agencyEmail: z.string(),
      agencyName: z.string(),
      businessType: z.string().optional(),
      agencyMobile: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      creditLimit: z.number(),
      creditStatus: z.string(),
      creditTermsDays: z.number(),
    }).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ input }) => {
    const { records } = await zite.partnerAccounts.findAll({
      filters: { agencyEmail: input.email.toLowerCase() },
      limit: 1,
    });
    const account = records[0] as any;
    if (!account || !account.passwordHash) {
      return { success: false, error: 'Invalid email or password' };
    }
    if (account.accountStatus === 'Suspended') {
      return { success: false, error: 'Account is suspended. Contact operations.' };
    }
    const valid = await verifyPassword(input.password, account.passwordHash);
    if (!valid) {
      return { success: false, error: 'Invalid email or password' };
    }

    await zite.partnerAccounts.update({
      id: account.id,
      record: { lastSignedIn: new Date().toISOString() },
    });

    const token = await createPartnerToken(account.id);

    await zite.bookingEvents.create({
      record: {
        eventName: 'partner_signed_in',
        details: `Partner ${account.agencyEmail || account.id} signed in`,
      },
    });

    return {
      success: true,
      token,
      partner: {
        id: account.id,
        agencyEmail: account.agencyEmail || '',
        agencyName: account.agencyName || '',
        businessType: account.businessType,
        agencyMobile: account.agencyMobile,
        country: account.country,
        city: account.city,
        creditLimit: Math.max(0, Number(account.creditLimitAed || 0)),
        creditStatus: account.creditStatus || 'Pending Review',
        creditTermsDays: Math.max(0, Number(account.creditTermsDays || 0)),
      },
    };
  },
});
