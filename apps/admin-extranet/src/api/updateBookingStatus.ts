import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { assessBookingCertification, persistBookingCertification } from '../lib/bookingCertification';
import { releaseBookedInventory } from '@project/pricing/inventoryLedger';

function getDatesInRange(checkin: string, checkout: string): string[] {
  const dates: string[] = [];
  const start = new Date(checkin);
  const end = new Date(checkout);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export default createEndpoint({
  description: 'Update booking lifecycle, require hotel confirmation for Confirmed, log activity, and release credit on terminal statuses',
  inputSchema: z.object({
    id: z.string(),
    status: z.enum(['Pending', 'Awaiting Hotel', 'Awaiting Payment', 'Confirmed', 'Cancelled', 'Approved', 'Rejected']),
    adminNotes: z.string().optional(),
    activityNote: z.string().optional(),
    hotelConfirmationNo: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const booking = await zite.bookings.findOne({ id: input.id }) as any;
    if (!booking) throw new ZiteError({ code: 'NOT_FOUND', message: 'Booking not found' });

    const prevStatus = booking.status || 'Pending';
    const terminal = ['Cancelled', 'Rejected'];
    if (terminal.includes(prevStatus) && input.status !== prevStatus) {
      throw new ZiteError({ code: 'CONFLICT', message: `Booking in terminal status "${prevStatus}" cannot be reopened.` });
    }

    const record: any = {
      status: input.status,
      adminNotes: input.adminNotes,
    };

    let confirmationCertification: Awaited<ReturnType<typeof assessBookingCertification>> | null = null;
    if (input.status === 'Confirmed') {
      confirmationCertification = await assessBookingCertification(input.id);
      await persistBookingCertification(
        confirmationCertification,
        'confirmation_gate',
        context?.user?.email || 'System'
      );
      if (confirmationCertification.gate === 'BLOCK') {
        throw new ZiteError({
          code: 'CONFLICT',
          message: 'Booking certification BLOCKED hotel confirmation: ' + confirmationCertification.criticalReasons.join(' | '),
        });
      }

      const confirmationNo = (input.hotelConfirmationNo || booking.hotelConfirmationNo || '').trim();
      if (!confirmationNo) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Hotel confirmation number is required before confirming a booking.' });
      }
      if (!booking.hotel || !booking.roomType || !booking.ratePlan || Number(booking.sellTotal || 0) <= 0) {
        throw new ZiteError({ code: 'CONFLICT', message: 'Booking is missing hotel/room/rate-plan/pricing linkage and cannot be confirmed.' });
      }
      record.hotelConfirmationNo = confirmationNo;
      record.confirmedAt = booking.confirmedAt || new Date().toISOString();
      record.pricingStatus = 'Booked';
    }

    if (input.status === 'Cancelled' || input.status === 'Rejected') {
      record.creditSettlementStatus = 'Released';
    }

    await zite.bookings.update({ id: input.id, record });

    // Daily Rate allocation is contracted inventory and must never be mutated by booking lifecycle.
    // Release the durable sold-room ledger instead so future search availability restores automatically.
    if ((input.status === 'Cancelled' || input.status === 'Rejected') && input.status !== prevStatus) {
      const releasedLedger = await releaseBookedInventory(
        input.id,
        `${input.status} by ${context?.user?.email || 'Admin'}`,
        context?.user?.email || 'Admin',
        'admin_booking_status'
      );
      await zite.bookingEvents.create({
        record: {
          eventName: 'booked_inventory_released',
          booking: input.id,
          details: `Released ${releasedLedger.released} booked inventory ledger rows; inventory movements ${releasedLedger.movements}; status ${input.status}`,
        },
      });
    }

    await zite.bookingActivities.create({
      record: {
        eventType: `Status changed to ${input.status}`,
        booking: input.id,
        notes: input.activityNote || (input.status === 'Confirmed' ? `Hotel confirmation: ${record.hotelConfirmationNo}` : undefined),
        createdAt: new Date().toISOString(),
        createdBy: context?.user?.email || 'System',
      },
    });

    await zite.bookingEvents.create({
      record: {
        eventName: input.status === 'Confirmed' ? 'hotel_booking_confirmed' : `hotel_booking_status_${input.status.toLowerCase().replace(/\s+/g, '_')}`,
        booking: input.id,
        details: input.status === 'Confirmed'
          ? `Confirmed with hotel reference ${record.hotelConfirmationNo}; certification ${confirmationCertification?.status || 'UNKNOWN'} / gate ${confirmationCertification?.gate || 'UNKNOWN'}`
          : `Booking status changed from ${prevStatus} to ${input.status}`,
      },
    });

    return { success: true };
  },
});
