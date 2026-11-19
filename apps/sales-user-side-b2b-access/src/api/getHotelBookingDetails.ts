import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { verifyPartnerToken } from '@/lib/partnerSecurity';

export default createEndpoint({
  description: 'Returns one authenticated hotel booking with reservation/document state',
  inputSchema: z.object({
    token: z.string(),
    bookingId: z.string(),
  }),
  outputSchema: z.object({
    id: z.string(),
    bookingReference: z.string(),
    invoiceNumber: z.string(),
    status: z.string(),
    pricingStatus: z.string().optional(),
    hotelName: z.string(),
    hotelLocation: z.string().optional(),
    roomTypeName: z.string(),
    ratePlanName: z.string(),
    mealPlan: z.string().optional(),
    guestName: z.string(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    rooms: z.number(),
    adults: z.number(),
    children: z.number(),
    sellTotal: z.number(),
    netTotal: z.number(),
    companyName: z.string(),
    contactEmail: z.string(),
    specialRequests: z.string().optional(),
    cancellationSummary: z.string().optional(),
    hotelConfirmationNo: z.string().optional(),
    confirmedAt: z.string().optional(),
    creditSettlementStatus: z.string().optional(),
    creditDueDate: z.string().optional(),
    createdAt: z.string().optional(),
    voucherAvailable: z.boolean(),
    invoiceLabel: z.string(),
  }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.token);
    if (!partnerId) {
      throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Partner session expired.' });
    }

    const { rows } = await zite.sql({
      query: `
        SELECT
          b."id", b."bookingReference", b."invoiceNumber", b."status", b."pricingStatus",
          b."guestName", b."checkinDate", b."checkoutDate", b."rooms", b."adults",
          b."children", b."sellTotal", b."netTotal", b."companyName", b."contactEmail",
          b."specialRequests", b."hotelConfirmationNo", b."confirmedAt",
          b."creditSettlementStatus", b."creditDueDate", b."createdAt", b."mealPlan",
          h."hotelName", h."location" AS "hotelLocation",
          rt."roomTypeName",
          rp."ratePlanName", rp."refundable", rp."cancellationWindowDays"
        FROM "Bookings" b
        JOIN "BookingsPartnerAccounts" bpa ON bpa."bookingsId" = b."id"
        LEFT JOIN "BookingsHotels" bh ON bh."bookingsId" = b."id"
        LEFT JOIN "Hotels" h ON h."id" = bh."hotelsId"
        LEFT JOIN "BookingsRoomTypes" brt ON brt."bookingsId" = b."id"
        LEFT JOIN "RoomTypes" rt ON rt."id" = brt."roomTypesId"
        LEFT JOIN "BookingsRatePlans" brp ON brp."bookingsId" = b."id"
        LEFT JOIN "RatePlans" rp ON rp."id" = brp."ratePlansId"
        WHERE b."id" = $1
          AND bpa."partnerAccountsId" = $2
        LIMIT 1
      `,
      params: [input.bookingId, partnerId],
    });

    const r: any = rows[0];
    if (!r) {
      throw new ZiteError({ code: 'NOT_FOUND', message: 'Booking not found.' });
    }

    let cancellationSummary = '';
    if (r.refundable === false) {
      cancellationSummary = 'Non-refundable';
    } else if (Number(r.cancellationWindowDays || 0) > 0) {
      cancellationSummary = `Free cancellation subject to ${Number(r.cancellationWindowDays)} day(s) notice`;
    } else if (r.refundable === true) {
      cancellationSummary = 'Refundable';
    }

    const status = r.status || 'Pending';
    const voucherAvailable = status === 'Confirmed';
    const invoiceLabel = voucherAvailable ? 'Credit Invoice' : 'Proforma Invoice';

    return {
      id: r.id,
      bookingReference: r.bookingReference || '',
      invoiceNumber: r.invoiceNumber || '',
      status,
      pricingStatus: r.pricingStatus || undefined,
      hotelName: r.hotelName || '',
      hotelLocation: r.hotelLocation || undefined,
      roomTypeName: r.roomTypeName || '',
      ratePlanName: r.ratePlanName || '',
      mealPlan: r.mealPlan || undefined,
      guestName: r.guestName || '',
      checkIn: r.checkinDate || undefined,
      checkOut: r.checkoutDate || undefined,
      rooms: Number(r.rooms || 0),
      adults: Number(r.adults || 0),
      children: Number(r.children || 0),
      sellTotal: Number(r.sellTotal || 0),
      netTotal: Number(r.netTotal || 0),
      companyName: r.companyName || '',
      contactEmail: r.contactEmail || '',
      specialRequests: r.specialRequests || undefined,
      cancellationSummary: cancellationSummary || undefined,
      hotelConfirmationNo: r.hotelConfirmationNo || undefined,
      confirmedAt: r.confirmedAt || undefined,
      creditSettlementStatus: r.creditSettlementStatus || undefined,
      creditDueDate: r.creditDueDate || undefined,
      createdAt: r.createdAt || undefined,
      voucherAvailable,
      invoiceLabel,
    };
  },
});
