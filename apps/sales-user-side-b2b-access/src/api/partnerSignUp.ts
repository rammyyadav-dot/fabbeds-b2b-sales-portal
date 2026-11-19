import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { hashPassword } from './partnerSignIn';

export default createEndpoint({
  description: 'Creates a travel trade partner account pending credit review',
  inputSchema: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    agencyName: z.string().min(1),
    businessType: z.string().optional(),
    agencyMobile: z.string().optional(),
    country: z.string().optional(),
    city: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    partner: z.object({
      id: z.string(),
      agencyEmail: z.string(),
      agencyName: z.string(),
      businessType: z.string().optional(),
      agencyMobile: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
    }).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ input }) => {
    const email = input.email.toLowerCase();
    const { records } = await zite.partnerAccounts.findAll({
      filters: { agencyEmail: email },
      limit: 1,
    });
    if (records.length > 0) {
      return { success: false, error: 'An account with this email already exists. Please sign in.' };
    }

    const passwordHash = await hashPassword(input.password);
    const account = await zite.partnerAccounts.create({
      record: {
        agencyEmail: email,
        passwordHash,
        agencyName: input.agencyName,
        businessType: input.businessType || null,
        agencyMobile: input.agencyMobile || null,
        country: input.country || null,
        city: input.city || null,
        accountStatus: 'Active',
        creditLimitAed: 0,
        creditStatus: 'Pending Review',
        creditTermsDays: 0,
      } as any,
    });

    await zite.bookingEvents.create({
      record: {
        eventName: 'partner_account_created',
        details: `Partner account created for ${email}; credit review pending`,
      },
    });

    return {
      success: true,
      partner: {
        id: account.id,
        agencyEmail: email,
        agencyName: input.agencyName,
        businessType: input.businessType,
        agencyMobile: input.agencyMobile,
        country: input.country,
        city: input.city,
      },
    };
  },
});
