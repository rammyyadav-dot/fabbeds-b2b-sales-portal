import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Submit a Price Match or Offline Hotel Inquiry ticket',
  inputSchema: z.object({
    inquiryType: z.enum(['PRICE_MATCH', 'OFFLINE_REQUEST']),
    // Shared
    hotelName: z.string().optional(),
    hotelId: z.string().optional(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    rooms: z.number().optional(),
    adults: z.number().optional(),
    children: z.number().optional(),
    roomType: z.string().optional(),
    mealPlan: z.string().optional(),
    notes: z.string().optional(),
    // Agent
    agentCompany: z.string(),
    agentName: z.string(),
    agentEmail: z.string(),
    agentWhatsApp: z.string().optional(),
    // Price Match only
    ourRate: z.number().optional(),
    competitorPrice: z.number().optional(),
    competitorSourceUrl: z.string().optional(),
    // Offline only
    destination: z.string().optional(),
    starPreference: z.string().optional(),
    boardBasis: z.string().optional(),
    budgetRange: z.string().optional(),
    urgent: z.boolean().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    inquiryRef: z.string(),
  }),
  execute: async ({ input }) => {
    const record = await zite.specialInquiries.create({
      record: {
        inquiryType: input.inquiryType === 'PRICE_MATCH' ? 'Price Match' : 'Offline Request',
        status: input.inquiryType === 'PRICE_MATCH' ? 'Pending Review' : 'Pending Review',
        hotelName: input.hotelName,
        hotel: input.hotelId ? input.hotelId : undefined,
        checkinDate: input.checkIn,
        checkoutDate: input.checkOut,
        rooms: input.rooms,
        adults: input.adults,
        children: input.children,
        roomType: input.roomType,
        mealPlan: input.mealPlan,
        notes: input.notes,
        agentCompany: input.agentCompany,
        agentName: input.agentName,
        agentEmail: input.agentEmail,
        agentWhatsApp: input.agentWhatsApp,
        ourRateAed: input.ourRate,
        competitorPriceAed: input.competitorPrice,
        competitorSourceUrl: input.competitorSourceUrl,
        destination: input.destination,
        starPreference: input.starPreference,
        boardBasis: input.boardBasis,
        budgetRange: input.budgetRange,
        urgentWithin72H: input.urgent,
        submittedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      inquiryRef: String(record.inquiryRef ?? record.id),
    };
  },
});
