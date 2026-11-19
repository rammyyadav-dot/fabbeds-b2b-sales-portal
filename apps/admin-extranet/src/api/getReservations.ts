import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const reservationSchema = z.object({
  id: z.string(),
  reservationRef: z.string().nullable(),
  status: z.string().nullable(),
  hotelName: z.string().nullable(),
  destination: z.string().nullable(),
  checkinDate: z.string().nullable(),
  checkoutDate: z.string().nullable(),
  rooms: z.number().nullable(),
  adults: z.number().nullable(),
  children: z.number().nullable(),
  roomType: z.string().nullable(),
  boardBasis: z.string().nullable(),
  agentName: z.string().nullable(),
  agentCompany: z.string().nullable(),
  agentEmail: z.string().nullable(),
  agentWhatsApp: z.string().nullable(),
  netRateAed: z.number().nullable(),
  sellingRateAed: z.number().nullable(),
  profitAed: z.number().nullable(),
  profitMargin: z.number().nullable(),
  lpoNumber: z.string().nullable(),
  lpoSentAt: z.string().nullable(),
  hotelConfirmationNumber: z.string().nullable(),
  hotelConfirmedAt: z.string().nullable(),
  voucherSentAt: z.string().nullable(),
  invoiceSentAt: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  inquiryRef: z.string().nullable(),
  specialRequests: z.string().nullable(),
  internalNotes: z.string().nullable(),
  createdAt: z.string().nullable(),
});

export default createEndpoint({
  authenticated: true,
  description: 'Get all reservations',
  inputSchema: z.object({
    status: z.string().optional(),
    search: z.string().optional(),
  }),
  outputSchema: z.object({
    reservations: z.array(reservationSchema),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getReservations');
    const { records } = await zite.reservations.findAll({ limit: 500 });
    let reservations = records.map(r => ({
      id: r.id,
      reservationRef: r.reservationRef ?? null,
      status: r.status ?? null,
      hotelName: r.hotelName ?? null,
      destination: r.destination ?? null,
      checkinDate: r.checkinDate ?? null,
      checkoutDate: r.checkoutDate ?? null,
      rooms: r.rooms ?? null,
      adults: r.adults ?? null,
      children: r.children ?? null,
      roomType: r.roomType ?? null,
      boardBasis: r.boardBasis ?? null,
      agentName: r.agentName ?? null,
      agentCompany: r.agentCompany ?? null,
      agentEmail: r.agentEmail ?? null,
      agentWhatsApp: r.agentWhatsApp ?? null,
      netRateAed: r.netRateAed ?? null,
      sellingRateAed: r.sellingRateAed ?? null,
      profitAed: r.profitAed ?? null,
      profitMargin: r.profitMargin ?? null,
      lpoNumber: r.lpoNumber ?? null,
      lpoSentAt: r.lpoSentAt ?? null,
      hotelConfirmationNumber: r.hotelConfirmationNumber ?? null,
      hotelConfirmedAt: r.hotelConfirmedAt ?? null,
      voucherSentAt: r.voucherSentAt ?? null,
      invoiceSentAt: r.invoiceSentAt ?? null,
      invoiceNumber: r.invoiceNumber ?? null,
      inquiryRef: r.inquiryRef ?? null,
      specialRequests: r.specialRequests ?? null,
      internalNotes: r.internalNotes ?? null,
      createdAt: r.createdAt ?? null,
    }));

    if (input.status) {
      reservations = reservations.filter(r => r.status === input.status);
    }
    if (input.search) {
      const q = input.search.toLowerCase();
      reservations = reservations.filter(r =>
        [r.reservationRef, r.hotelName, r.agentName, r.agentCompany, r.inquiryRef]
          .some(v => v?.toLowerCase().includes(q))
      );
    }

    return { reservations };
  },
});
