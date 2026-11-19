import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { verifyPartnerToken } from '@/lib/partnerSecurity';

const bookingSchema = z.object({
  id: z.string(),
  bookingReference: z.string().optional(),
  hotelName: z.string().optional(),
  roomTypeName: z.string().optional(),
  checkinDate: z.string().optional(),
  checkoutDate: z.string().optional(),
  status: z.string().optional(),
  sellTotal: z.number().optional(),
  guestName: z.string().optional(),
  rooms: z.number().optional(),
  adults: z.number().optional(),
  children: z.number().optional(),
  mealPlan: z.string().optional(),
  companyName: z.string().optional(),
  contactEmail: z.string().optional(),
  createdAt: z.string().optional(),
});

function mapBooking(r:any) {
  return {
    id: r.id,
    bookingReference: r.bookingReference,
    hotelName: r.hotelName,
    roomTypeName: r.roomTypeName,
    checkinDate: r.checkinDate,
    checkoutDate: r.checkoutDate,
    status: r.status,
    sellTotal: r.sellTotal ? Number(r.sellTotal) : undefined,
    guestName: r.guestName,
    rooms: r.rooms ? Number(r.rooms) : undefined,
    adults: r.adults ? Number(r.adults) : undefined,
    children: r.children ? Number(r.children) : undefined,
    mealPlan: r.mealPlan,
    companyName: r.companyName,
    contactEmail: r.contactEmail,
    createdAt: r.createdAt,
  };
}

export default createEndpoint({
  description: 'Lists or finds bookings strictly within the authenticated partner account',
  inputSchema: z.object({
    token: z.string(),
    reference: z.string().trim().min(1).optional(),
    statusFilter: z.string().optional(),
  }),
  outputSchema: z.object({ bookings: z.array(bookingSchema) }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.token);
    if (!partnerId) return { bookings: [] };

    const params:any[] = [partnerId];
    const where:string[] = ['bpa."partnerAccountsId" = $1'];

    if (input.reference) {
      params.push(input.reference);
      where.push(`b."bookingReference" = $${params.length}`);
    }

    if (input.statusFilter && input.statusFilter !== 'all') {
      params.push(input.statusFilter);
      where.push(`b."status" = $${params.length}`);
    }

    const { rows } = await zite.sql({
      query: `
        SELECT b."id", b."bookingReference", b."checkinDate", b."checkoutDate",
               b."status", b."sellTotal", b."guestName", b."rooms", b."adults",
               b."children", b."mealPlan", b."companyName", b."contactEmail", b."createdAt",
               h."hotelName", rt."roomTypeName"
        FROM "Bookings" b
        JOIN "BookingsPartnerAccounts" bpa ON bpa."bookingsId" = b."id"
        LEFT JOIN "BookingsHotels" bh ON bh."bookingsId" = b."id"
        LEFT JOIN "Hotels" h ON h."id" = bh."hotelsId"
        LEFT JOIN "BookingsRoomTypes" brt ON brt."bookingsId" = b."id"
        LEFT JOIN "RoomTypes" rt ON rt."id" = brt."roomTypesId"
        WHERE ${where.join(' AND ')}
        ORDER BY b."createdAt" DESC
        LIMIT ${input.reference ? 1 : 100}
      `,
      params,
    });

    return { bookings: rows.map(mapBooking) };
  },
});
