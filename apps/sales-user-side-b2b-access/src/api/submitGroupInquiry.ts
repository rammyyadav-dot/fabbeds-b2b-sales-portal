import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Submit a Group / MICE inquiry',
  inputSchema: z.object({
    // Section A
    companyName: z.string(),
    contactPerson: z.string(),
    email: z.string(),
    whatsApp: z.string().optional(),
    country: z.string().optional(),
    // Section B
    inquiryType: z.enum(['Group Leisure', 'MICE / Conference', 'Corporate Group', 'Crew / Long Stay', 'Wedding / Social']),
    destination: z.string(),
    preferredHotel: z.string().optional(),
    checkIn: z.string(),
    checkOut: z.string(),
    flexDates: z.string().optional(),
    rooms: z.number(),
    nationality: z.string().optional(),
    // Section C
    singleRooms: z.number().optional(),
    doubleRooms: z.number().optional(),
    tripleRooms: z.number().optional(),
    adults: z.number().optional(),
    children: z.number().optional(),
    mealPlan: z.string().optional(),
    budgetRange: z.string().optional(),
    // Section D (MICE)
    delegates: z.number().optional(),
    meetingDays: z.number().optional(),
    setupStyle: z.string().optional(),
    breakoutRooms: z.number().optional(),
    galaDinner: z.boolean().optional(),
    siteInspection: z.boolean().optional(),
    decisionDeadline: z.string().optional(),
    // Section E
    airportTransfers: z.boolean().optional(),
    tours: z.boolean().optional(),
    visaSupport: z.boolean().optional(),
    // Section F
    specialRequests: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), inquiryRef: z.string() }),
  execute: async ({ input }) => {
    const nights = input.checkIn && input.checkOut
      ? Math.round((new Date(input.checkOut).getTime() - new Date(input.checkIn).getTime()) / 86400000)
      : 0;

    const noteLines = [
      `=== GROUP / MICE INQUIRY ===`,
      `Type: ${input.inquiryType}`,
      `Destination: ${input.destination}`,
      `Preferred Hotel/Area: ${input.preferredHotel || '—'}`,
      `Nights: ${nights}`,
      `Flex Dates: ${input.flexDates || 'No'}`,
      `Nationality/Market: ${input.nationality || '—'}`,
      `Country: ${input.country || '—'}`,
      ``,
      `--- Rooming Mix ---`,
      `Single: ${input.singleRooms ?? 0} | Double: ${input.doubleRooms ?? 0} | Triple: ${input.tripleRooms ?? 0}`,
      `Adults: ${input.adults ?? 0} | Children: ${input.children ?? 0}`,
      `Meal Plan: ${input.mealPlan || '—'}`,
      `Budget (AED/room/night): ${input.budgetRange || 'Not specified'}`,
    ];

    if (input.inquiryType === 'MICE / Conference') {
      noteLines.push(
        ``,
        `--- MICE Details ---`,
        `Delegates/day: ${input.delegates ?? '—'}`,
        `Meeting days: ${input.meetingDays ?? '—'}`,
        `Setup style: ${input.setupStyle || '—'}`,
        `Breakout rooms: ${input.breakoutRooms ?? 0}`,
        `Gala dinner: ${input.galaDinner ? 'Yes' : 'No'}`,
        `Site inspection: ${input.siteInspection ? 'Yes' : 'No'}`,
        `Decision deadline: ${input.decisionDeadline || '—'}`,
      );
    }

    noteLines.push(
      ``,
      `--- Add-ons ---`,
      `Transfers: ${input.airportTransfers ? 'Yes' : 'No'} | Tours: ${input.tours ? 'Yes' : 'No'} | Visa: ${input.visaSupport ? 'Yes' : 'No'}`,
      ``,
      `--- Special Requests ---`,
      input.specialRequests || '—',
    );

    const record = await zite.specialInquiries.create({
      record: {
        inquiryType: 'Group/MICE' as any,
        status: 'Pending Review',
        destination: input.destination,
        checkinDate: input.checkIn,
        checkoutDate: input.checkOut,
        rooms: input.rooms,
        adults: input.adults,
        children: input.children,
        mealPlan: input.mealPlan,
        budgetRange: input.budgetRange,
        agentCompany: input.companyName,
        agentName: input.contactPerson,
        agentEmail: input.email,
        agentWhatsApp: input.whatsApp,
        notes: noteLines.join('\n'),
        submittedAt: new Date().toISOString(),
      },
    });

    return { success: true, inquiryRef: String(record.inquiryRef ?? record.id) };
  },
});
