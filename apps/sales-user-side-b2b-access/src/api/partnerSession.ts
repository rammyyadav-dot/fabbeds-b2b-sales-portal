import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { verifyPartnerSession, createPartnerToken, SESSION_REFRESH_AFTER_MS } from '@/lib/partnerSecurity';

export default createEndpoint({
  description: 'Validates a partner session token and returns the current credit-account profile',
  inputSchema: z.object({ token: z.string() }),
  outputSchema: z.object({
    valid: z.boolean(),
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
  }),
  execute: async ({ input }) => {
    const session = await verifyPartnerSession(input.token);
    if (!session) return { valid: false };
    const accountId = session.accountId;
    // Sliding session: re-issue a fresh 12-hour token once the current one is an hour old.
    const token = Date.now() - session.issuedAt > SESSION_REFRESH_AFTER_MS ? await createPartnerToken(accountId) : undefined;

    const account = await zite.partnerAccounts.findOne({ id: accountId }) as any;
    if (!account || account.accountStatus === 'Suspended') return { valid: false };

    return {
      valid: true,
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
