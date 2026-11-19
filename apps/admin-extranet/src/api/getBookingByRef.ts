import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Public: look up a booking by reference number and guest email',
  inputSchema: z.object({
    bookingRef: z.string(),
    email: z.string(),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    booking: z.object({
      id: z.string(),
      bookingRef: z.string(),
      guestName: z.string(),
      companyName: z.string().optional(),
      checkinDate: z.string(),
      checkoutDate: z.string(),
      rooms: z.number(),
      adults: z.number(),
      children: z.number(),
      status: z.string(),
      hotelName: z.string(),
      roomTypeName: z.string().optional(),
      mealPlan: z.string().optional(),
      specialRequests: z.string().optional(),
      adminNotes: z.string().optional(),
      createdAt: z.string().optional(),
      sellTotal: z.number().optional(),
      netTotal: z.number().optional(),
    }).optional(),
  }),
  execute: async ({ input }) => {
    const { records } = await zite.bookings.findAll({
      filters: { contactEmail: input.email.toLowerCase().trim() },
    });

    const booking = records.find(
      b => String(b.bookingRef ?? '').toLowerCase() === input.bookingRef.toLowerCase().trim()
    );

    if (!booking) return { found: false };

    const hotelId = Array.isArray(booking.hotel) ? booking.hotel[0] : booking.hotel;
    const roomTypeId = Array.isArray(booking.roomType) ? booking.roomType[0] : booking.roomType;

    const [hotel, roomType] = await Promise.all([
      hotelId ? zite.hotels.findOne({ id: hotelId, fields: ['hotelName'] }) : Promise.resolve(undefined),
      roomTypeId ? zite.roomTypes.findOne({ id: roomTypeId, fields: ['roomTypeName'] }) : Promise.resolve(undefined),
    ]);

    return {
      found: true,
      booking: {
        id: booking.id,
        bookingRef: String(booking.bookingRef ?? ''),
        guestName: booking.guestName ?? '',
        companyName: booking.companyName,
        checkinDate: booking.checkinDate ?? '',
        checkoutDate: booking.checkoutDate ?? '',
        rooms: booking.rooms ?? 0,
        adults: booking.adults ?? 0,
        children: booking.children ?? 0,
        status: booking.status ?? '',
        hotelName: hotel?.hotelName ?? '',
        roomTypeName: roomType?.roomTypeName,
        mealPlan: booking.mealPlan,
        specialRequests: booking.specialRequests,
        adminNotes: booking.adminNotes,
        createdAt: booking.createdAt,
        sellTotal: booking.sellTotal,
        netTotal: booking.netTotal,
      },
    };
  },
});
