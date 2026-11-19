import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const CANCELLABLE_STATUSES = ['Pending', 'Awaiting Hotel', 'Awaiting Payment'];

export default createEndpoint({
  description: 'Public: allow a guest to cancel their booking by ref + email, restores inventory',
  inputSchema: z.object({
    bookingRef: z.string(),
    email: z.string(),
    reason: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ input }) => {
    const { records } = await zite.bookings.findAll({
      filters: { contactEmail: input.email.toLowerCase().trim() },
    });

    const booking = records.find(
      b => String(b.bookingRef ?? '').toLowerCase() === input.bookingRef.toLowerCase().trim()
    );

    if (!booking) {
      return { success: false, message: 'Booking not found. Please check your reference number and email address.' };
    }

    if (booking.status === 'Cancelled') {
      return { success: false, message: 'This booking has already been cancelled.' };
    }

    if (!CANCELLABLE_STATUSES.includes(booking.status ?? '')) {
      return {
        success: false,
        message: `Bookings with status "${booking.status}" cannot be cancelled online. Please contact our team directly.`,
      };
    }

    await zite.bookings.update({ id: booking.id, record: { status: 'Cancelled' } });

    // --- Restore inventory ---
    const hotelId = Array.isArray(booking.hotel) ? booking.hotel[0] : booking.hotel;
    const roomTypeId = Array.isArray(booking.roomType) ? booking.roomType[0] : booking.roomType;

    if (hotelId && roomTypeId && booking.checkinDate && booking.checkoutDate && booking.rooms) {
      const { records: rateRecords } = await zite.dailyRates.findAll({
        filters: {
          hotel: { contains: hotelId },
          roomType: { contains: roomTypeId },
          rateDate: { gte: new Date(booking.checkinDate), lt: new Date(booking.checkoutDate) },
        },
        limit: 500,
      });

      for (const rate of rateRecords) {
        if (rate.allocation != null) {
          await zite.dailyRates.update({
            id: rate.id,
            record: { allocation: rate.allocation + booking.rooms },
          });
        }
      }
    }

    await zite.bookingActivities.create({
      record: {
        eventType: 'Cancelled by guest',
        booking: booking.id,
        notes: input.reason
          ? `Guest cancellation reason: ${input.reason}`
          : 'Cancelled via self-service manage booking portal',
        createdAt: new Date().toISOString(),
        createdBy: input.email,
      },
    });

    // TODO: Send cancellation confirmation email to input.email once email integration is connected

    return { success: true, message: 'Your booking has been successfully cancelled.' };
  },
});
