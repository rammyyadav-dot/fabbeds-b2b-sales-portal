import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all hotels',
  inputSchema: z.object({
    status: z.string().optional(),
    emirate: z.string().optional(),
  }),
  outputSchema: z.object({
    hotels: z.array(z.object({
      id: z.string(),
      hotelName: z.string().optional(),
      location: z.string().optional(),
      starRating: z.string().optional(),
      emirate: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      reservationEmail: z.string().optional(),
      financeEmail: z.string().optional(),
      salesManager: z.string().optional(),
      mobileNo: z.string().optional(),
      hotelCode: z.string().optional(),
      lifecycleStatus: z.string().optional(),
      lastValidatedAt: z.string().optional(),
      openIntegrityIssues: z.number().optional(),
    })),
  }),
  execute: async ({ input }) => {
    const filters: Record<string, string> = {};
    if (input.status) filters.status = input.status;
    if (input.emirate) filters.emirate = input.emirate;
    const result = await zite.hotels.findAll({ filters, limit: 500 });
    return {
      hotels: result.records.map(h => ({
        id: h.id,
        hotelName: h.hotelName,
        location: h.location,
        starRating: h.starRating,
        emirate: h.emirate,
        description: h.description,
        status: h.status,
        reservationEmail: h.reservationEmail,
        financeEmail: h.financeEmail,
        salesManager: h.salesManager,
        mobileNo: h.mobileNo,
        hotelCode: h.hotelCode,
        lifecycleStatus: h.lifecycleStatus,
        lastValidatedAt: h.lastValidatedAt,
        openIntegrityIssues: h.openIntegrityIssues,
      })),
    };
  },
});
