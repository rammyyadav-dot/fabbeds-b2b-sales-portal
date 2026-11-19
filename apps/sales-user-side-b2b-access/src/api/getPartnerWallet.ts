import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { getPartnerCreditPosition } from '@/lib/partnerCredit';

export default createEndpoint({
  description: 'Returns authenticated partner credit wallet and open booking exposure',
  inputSchema: z.object({ token: z.string() }),
  outputSchema: z.object({
    valid: z.boolean(),
    creditStatus: z.string(),
    creditLimit: z.number(),
    creditUsed: z.number(),
    creditAvailable: z.number(),
    creditTermsDays: z.number(),
    canBookOnCredit: z.boolean(),
    openBookings: z.number(),
    overdueBookings: z.number(),
    usedByProduct: z.object({ hotels: z.number(), attractions: z.number(), transfers: z.number() }).optional(),
    blockReason: z.string().nullable().optional(),
  }),
  execute: async ({ input }) => {
    const accountId = await verifyPartnerToken(input.token);
    if (!accountId) {
      return {
        valid: false, creditStatus: 'Disabled', creditLimit: 0, creditUsed: 0,
        creditAvailable: 0, creditTermsDays: 0, canBookOnCredit: false,
        openBookings: 0, overdueBookings: 0,
      };
    }

    const account = await zite.partnerAccounts.findOne({ id: accountId }) as any;
    if (!account || account.accountStatus === 'Suspended') {
      return {
        valid: false, creditStatus: 'Disabled', creditLimit: 0, creditUsed: 0,
        creditAvailable: 0, creditTermsDays: 0, canBookOnCredit: false,
        openBookings: 0, overdueBookings: 0,
      };
    }

    const pos = await getPartnerCreditPosition(accountId);
    return {
      valid: true,
      creditStatus: pos.creditStatus,
      creditLimit: pos.creditLimit,
      creditUsed: pos.used,
      creditAvailable: pos.available,
      creditTermsDays: pos.termsDays,
      canBookOnCredit: pos.canBook,
      openBookings: pos.openBookings,
      overdueBookings: pos.overdue,
      usedByProduct: { hotels: pos.hotelUsed, attractions: pos.attractionUsed, transfers: pos.transferUsed },
      blockReason: pos.blockReason,
    };
  },
});
