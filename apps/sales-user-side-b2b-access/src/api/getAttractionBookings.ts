import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'List attraction bookings for DMC ops dashboard with filters',
  authenticated: true,
  inputSchema: z.object({
    status: z.string().optional(),
    agentSearch: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    search: z.string().optional(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({
    bookings: z.array(z.object({
      id: z.string(),
      bookingReference: z.string(),
      attractionName: z.string(),
      ticketOptionName: z.string(),
      targetDate: z.string(),
      targetSlot: z.string(),
      adultCount: z.number(),
      childCount: z.number(),
      totalNetCost: z.number(),
      totalSellPrice: z.number(),
      bookingStatus: z.string(),
      paymentStatus: z.string(),
      paymentPreference: z.string(),
      companyName: z.string(),
      agentName: z.string(),
      contactEmail: z.string(),
      whatsAppNumber: z.string(),
      guestName: z.string(),
      guestNationality: z.string(),
      specialRequests: z.string(),
      createdAt: z.string(),
    })),
    hasMore: z.boolean(),
    total: z.number(),
  }),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const isAdmin = context.user.role === 'Admin' || context.user.role === 'Contracting Team' || context.user.role === 'Finance Controller';

    const filters: Record<string, any> = {};
    if (input.status && input.status !== 'all') filters.bookingStatus = input.status;
    if (input.dateFrom) filters.targetDate = { gte: input.dateFrom };
    if (input.dateTo) filters.targetDate = { ...(filters.targetDate || {}), lte: input.dateTo };
    if (input.search) filters.bookingReference = { contains: input.search };
    if (input.agentSearch) filters.agentName = { contains: input.agentSearch };

    // Non-admin agents only see own bookings
    if (!isAdmin) filters.user = context.user.id;

    const limit = input.limit || 50;
    const offset = input.offset || 0;

    const { records, hasMore } = await zite.attractionBookings.findAll({ filters, limit, offset });

    return {
      bookings: records.map(r => ({
        id: r.id,
        bookingReference: r.bookingReference || '',
        attractionName: r.attractionName || '',
        ticketOptionName: r.ticketOptionName || '',
        targetDate: r.targetDate || '',
        targetSlot: r.targetSlot || '',
        adultCount: r.adultCount || 0,
        childCount: r.childCount || 0,
        totalNetCost: r.totalNetCost || 0,
        totalSellPrice: r.totalSellPrice || 0,
        bookingStatus: r.bookingStatus || 'Initiated',
        paymentStatus: r.paymentStatus || 'Pending',
        paymentPreference: r.paymentPreference || '',
        companyName: r.companyName || '',
        agentName: r.agentName || '',
        contactEmail: r.contactEmail || '',
        whatsAppNumber: r.whatsAppNumber || '',
        guestName: r.guestName || '',
        guestNationality: r.guestNationality || '',
        specialRequests: r.specialRequests || '',
        createdAt: r.createdAt || '',
      })),
      hasMore,
      total: records.length,
    };
  },
});
