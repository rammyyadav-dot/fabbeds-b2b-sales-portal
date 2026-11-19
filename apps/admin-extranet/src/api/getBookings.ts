import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Get all bookings for admin with reservation/document/credit fields',
  inputSchema: z.object({
    status: z.string().optional(),
  }),
  outputSchema: z.object({
    bookings: z.array(z.object({
      id: z.string(),
      bookingRef: z.string().optional(),
      bookingReference: z.string().optional(),
      invoiceNumber: z.string().optional(),
      hotelConfirmationNo: z.string().optional(),
      confirmedAt: z.string().optional(),
      creditSettlementStatus: z.string().optional(),
      creditDueDate: z.string().optional(),
      companyName: z.string().optional(),
      guestName: z.string().optional(),
      checkinDate: z.string().optional(),
      checkoutDate: z.string().optional(),
      rooms: z.number().optional(),
      adults: z.number().optional(),
      children: z.number().optional(),
      contactEmail: z.string().optional(),
      whatsAppNumber: z.string().optional(),
      hotelName: z.string().optional(),
      roomTypeName: z.string().optional(),
      status: z.string().optional(),
      specialRequests: z.string().optional(),
      adminNotes: z.string().optional(),
      createdAt: z.string().optional(),
      mealPlan: z.string().optional(),
      sellTotal: z.number().optional(),
      netTotal: z.number().optional(),
    })),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getBookings');
    const validStatuses = ['Pending','Awaiting Hotel','Awaiting Payment','Confirmed','Cancelled','Approved','Rejected'];
    const filters = (input.status && validStatuses.includes(input.status)) ? { status: input.status } : {};
    const [bookingsRes, hotelsRes, roomTypesRes] = await Promise.all([
      zite.bookings.findAll({ filters, limit: 500 }),
      zite.hotels.findAll({ limit: 500 }),
      zite.roomTypes.findAll({ limit: 500 }),
    ]);

    const hotelMap = new Map(hotelsRes.records.map(h => [h.id, h.hotelName]));
    const rtMap = new Map(roomTypesRes.records.map(r => [r.id, r.roomTypeName]));
    const getId = (v: string | string[] | undefined | null) => Array.isArray(v) ? v[0] : v;

    return {
      bookings: bookingsRes.records.map(raw => {
        const b = raw as any;
        return {
          id: b.id,
          bookingRef: String(b.bookingRef ?? ''),
          bookingReference: b.bookingReference || undefined,
          invoiceNumber: b.invoiceNumber || undefined,
          hotelConfirmationNo: b.hotelConfirmationNo || undefined,
          confirmedAt: b.confirmedAt || undefined,
          creditSettlementStatus: b.creditSettlementStatus || undefined,
          creditDueDate: b.creditDueDate || undefined,
          companyName: b.companyName,
          guestName: b.guestName,
          checkinDate: b.checkinDate,
          checkoutDate: b.checkoutDate,
          rooms: b.rooms,
          adults: b.adults,
          children: b.children,
          contactEmail: b.contactEmail,
          whatsAppNumber: b.whatsAppNumber,
          hotelName: hotelMap.get(getId(b.hotel) ?? '') ?? '',
          roomTypeName: rtMap.get(getId(b.roomType) ?? '') ?? '',
          status: b.status,
          specialRequests: b.specialRequests,
          adminNotes: b.adminNotes,
          createdAt: b.createdAt,
          mealPlan: b.mealPlan,
          sellTotal: b.sellTotal,
          netTotal: b.netTotal,
        };
      }),
    };
  },
});
