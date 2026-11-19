import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';

export default createEndpoint({
  description: 'Register a new hotel partner account in the dedicated Hotel Partners table',
  inputSchema: z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    accessCode: z.string().min(6),
    hotelName: z.string().optional(),
  }),
  outputSchema: z.object({
    id: z.string(),
    username: z.string(),
    fullName: z.string(),
    email: z.string(),
    role: z.string(),
  }),
  execute: async ({ input }) => {
    // Check uniqueness in Hotel Partners table (separate from DMC TmsUsers)
    const existing = await zite.hotelPartners.findOne({ filters: { email: input.email }, fields: ['id'] });
    if (existing) {
      throw new ZiteError({ code: 'CONFLICT', message: 'A partner account with this email already exists. Please sign in.' });
    }

    const created = await zite.hotelPartners.create({
      record: {
        email: input.email,
        fullName: input.fullName,
        accessCode: input.accessCode,
        role: 'Hotel Owner',
        approved: false,
      },
    });

    return {
      id: created.id,
      username: created.email ?? input.email,
      fullName: created.fullName ?? input.fullName,
      email: created.email ?? input.email,
      role: created.role ?? 'Hotel Owner',
    };
  },
});
