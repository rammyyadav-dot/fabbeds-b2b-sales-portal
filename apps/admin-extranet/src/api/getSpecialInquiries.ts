import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Fetch all special / offline inquiries with optional status filter',
  inputSchema: z.object({
    status: z.string().optional(),
    inquiryType: z.string().optional(),
  }),
  outputSchema: z.object({
    inquiries: z.array(z.object({
      id: z.string(),
      inquiryRef: z.any().optional(),
      inquiryType: z.string().optional(),
      status: z.string().optional(),
      hotelName: z.string().optional(),
      checkinDate: z.string().optional(),
      checkoutDate: z.string().optional(),
      rooms: z.number().optional(),
      adults: z.number().optional(),
      children: z.number().optional(),
      roomType: z.string().optional(),
      mealPlan: z.string().optional(),
      ourRateAed: z.number().optional(),
      competitorPriceAed: z.number().optional(),
      competitorSourceUrl: z.string().optional(),
      destination: z.string().optional(),
      starPreference: z.string().optional(),
      boardBasis: z.string().optional(),
      budgetRange: z.string().optional(),
      urgentWithin72H: z.boolean().optional(),
      agentCompany: z.string().optional(),
      agentName: z.string().optional(),
      agentEmail: z.string().optional(),
      agentWhatsApp: z.string().optional(),
      notes: z.string().optional(),
      adminNotes: z.string().optional(),
      submittedAt: z.string().optional(),
    })),
  }),
  execute: async ({ input }) => {
    const filters: any = {};
    if (input.status) filters.status = input.status;
    if (input.inquiryType) filters.inquiryType = input.inquiryType;
    const res = await zite.specialInquiries.findAll({ filters, limit: 500 });
    return { inquiries: res.records as any[] };
  },
});
