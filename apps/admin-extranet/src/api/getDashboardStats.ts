import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get dashboard statistics including bookings and room nights',
  inputSchema: z.object({}),
  outputSchema: z.object({
    totalHotels: z.number(),
    activeHotels: z.number(),
    totalRoomTypes: z.number(),
    totalSeasons: z.number(),
    totalRates: z.number(),
    activeMarkupRules: z.number(),
    totalBookings: z.number(),
    confirmedBookings: z.number(),
    pendingBookings: z.number(),
    totalRoomNights: z.number(),
  }),
  execute: async () => {
    const [hotels, roomTypes, seasons, rates, markupRules, bookings] = await Promise.all([
      zite.hotels.findAll({ limit: 500 }),
      zite.roomTypes.findAll({ limit: 500 }),
      zite.seasons.findAll({ limit: 500 }),
      zite.netRates.findAll({ limit: 2000 }),
      zite.markupRules.findAll({ limit: 500 }),
      zite.bookings.findAll({ limit: 2000 }),
    ]);

    const totalRoomNights = bookings.records.reduce((sum, b) => {
      if (!b.checkinDate || !b.checkoutDate) return sum;
      const nights = Math.round((new Date(b.checkoutDate).getTime() - new Date(b.checkinDate).getTime()) / 86400000);
      return sum + (nights > 0 ? nights * (b.rooms ?? 1) : 0);
    }, 0);

    return {
      totalHotels: hotels.records.length,
      activeHotels: hotels.records.filter(h => h.status === 'Active').length,
      totalRoomTypes: roomTypes.records.length,
      totalSeasons: seasons.records.length,
      totalRates: rates.records.length,
      activeMarkupRules: markupRules.records.filter(r => r.isActive === true).length,
      totalBookings: bookings.records.length,
      confirmedBookings: bookings.records.filter(b => b.status === 'Confirmed' || b.status === 'Approved').length,
      pendingBookings: bookings.records.filter(b => b.status === 'Pending').length,
      totalRoomNights,
    };
  },
});
