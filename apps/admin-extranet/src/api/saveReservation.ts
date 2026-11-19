import { requireStaff } from '../lib/requireStaff';
import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';

// Allowed status transitions (state machine)
const TRANSITIONS: Record<string, string[]> = {
  'Inquiry Received':               ['Rate Validated', 'Cancelled by Agent', 'Cancelled by Supplier'],
  'Rate Validated':                 ['Awaiting Supplier Confirmation', 'Inquiry Received', 'Cancelled by Agent'],
  'Awaiting Supplier Confirmation': ['Supplier Confirmed', 'Rate Dispute', 'Cancelled by Supplier'],
  'Rate Dispute':                   ['Awaiting Supplier Confirmation', 'Rate Validated', 'Cancelled by Agent', 'Cancelled by Supplier'],
  'Supplier Confirmed':             ['Confirmed', 'Rate Dispute'],
  'Confirmed':                      ['Invoiced', 'Cancelled by Agent', 'Cancelled by Supplier', 'No Show'],
  'Invoiced':                       ['Paid', 'Cancelled by Agent'],
  'Paid':                           ['Completed'],
  'Completed':                      [],
  'Cancelled by Agent':             [],
  'Cancelled by Supplier':          [],
  'No Show':                        [],
};

export default createEndpoint({
  authenticated: true,
  description: 'Create or update a reservation with state-machine status transitions',
  inputSchema: z.object({
    id: z.string().optional(),
    reservationRef: z.string().optional(),
    status: z.string().optional(),
    hotelName: z.string().optional(),
    destination: z.string().optional(),
    checkinDate: z.string().optional(),
    checkoutDate: z.string().optional(),
    rooms: z.number().optional(),
    adults: z.number().optional(),
    children: z.number().optional(),
    roomType: z.string().optional(),
    boardBasis: z.string().optional(),
    agentName: z.string().optional(),
    agentCompany: z.string().optional(),
    agentEmail: z.string().optional(),
    agentWhatsApp: z.string().optional(),
    netRateAed: z.number().optional(),
    sellingRateAed: z.number().optional(),
    vatAmountAed: z.number().optional(),
    agentReference: z.string().optional(),
    supplierReference: z.string().optional(),
    hotelConfirmationNumber: z.string().optional(),
    hotelConfirmedAt: z.string().optional(),
    voucherSentAt: z.string().optional(),
    invoiceNumber: z.string().optional(),
    inquiryRef: z.string().optional(),
    specialRequests: z.string().optional(),
    internalNotes: z.string().optional(),
    notesToSupplier: z.string().optional(),
    notesToAgent: z.string().optional(),
    currencyCode: z.string().optional(),
    reason: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'saveReservation');
    await enrichCurrentUser(context);
    const { id, reason, ...fields } = input;

    // Auto-calculate profit
    if (fields.sellingRateAed != null && fields.netRateAed != null) {
      (fields as any).profitAed = fields.sellingRateAed - fields.netRateAed;
      if (fields.sellingRateAed > 0) {
        (fields as any).profitMargin = Math.round(((fields as any).profitAed / fields.sellingRateAed) * 100);
      }
    }

    if (id) {
      const existing = await zite.reservations.findOne({ id });
      if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Reservation not found' });
      if (existing.isLocked) throw new ZiteError({ code: 'FORBIDDEN', message: 'Reservation is locked' });

      // Validate status transition if status is changing
      if (fields.status && fields.status !== existing.status) {
        const fromStatus = existing.status ?? 'Inquiry Received';
        const allowed = TRANSITIONS[fromStatus] ?? [];
        if (!allowed.includes(fields.status)) {
          throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid transition: ${fromStatus} → ${fields.status}` });
        }

        // Log the status change
        await zite.reservationStatusEvents.create({
          record: {
            eventSummary: `Status changed: ${fromStatus} → ${fields.status}`,
            reservation: id,
            fromStatus,
            toStatus: fields.status,
            eventReason: reason || `Manual status update`,
            createdBy: context?.user?.email || 'System',
            createdAt: new Date().toISOString(),
          },
        });
      }

      await zite.reservations.update({ id, record: fields });
      return { id };
    } else {
      const ref = `RS-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
      const record = await zite.reservations.create({
        record: {
          ...fields,
          reservationRef: fields.reservationRef || ref,
          status: fields.status || 'Inquiry Received',
          currencyCode: fields.currencyCode || 'AED',
          createdAt: new Date().toISOString(),
        },
      });

      // Log initial creation
      await zite.reservationStatusEvents.create({
        record: {
          eventSummary: `Reservation created — ${fields.status || 'Inquiry Received'}`,
          reservation: record.id,
          toStatus: fields.status || 'Inquiry Received',
          eventReason: 'Reservation created',
          createdBy: context?.user?.email || 'System',
          createdAt: new Date().toISOString(),
        },
      });

      return { id: record.id };
    }
  },
});
