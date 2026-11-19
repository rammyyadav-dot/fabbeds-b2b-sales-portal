import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';

export default createEndpoint({
  description: 'Deprecated attraction status mutation endpoint. Use Admin Extranet reservation workflow.',
  inputSchema: z.object({
    bookingId: z.string(),
    status: z.enum(['Confirmed', 'Vouchered', 'Cancelled']),
    offlineNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    bookingId: z.string(),
    newStatus: z.string(),
  }),
  execute: async ({ input }) => {
    throw new ZiteError({
      code: 'FORBIDDEN',
      message: 'Attraction reservation status is controlled by the Admin Extranet confirmation workflow.',
    });
  },
});
