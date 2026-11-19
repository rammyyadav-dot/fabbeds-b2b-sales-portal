import { requireStaff } from '../lib/requireStaff';
import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';

const ALLOWED_FROM = ['Awaiting Supplier Confirmation', 'Rate Dispute'];

export default createEndpoint({
  authenticated: true,
  description: 'Record supplier confirmation and advance reservation status',
  inputSchema: z.object({
    reservationId: z.string(),
    supplierReference: z.string(),
    confirmedNetRate: z.number().optional(),
    hasDiscrepancy: z.boolean().optional(),
    discrepancyNotes: z.string().optional(),
    reason: z.string().optional(),
  }),
  outputSchema: z.object({ status: z.string() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'recordSupplierConfirmation');
    await enrichCurrentUser(context);
    const res = await zite.reservations.findOne({ id: input.reservationId });
    if (!res) throw new ZiteError({ code: 'NOT_FOUND', message: 'Reservation not found' });
    if (!ALLOWED_FROM.includes(res.status ?? '')) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Cannot confirm from status: ${res.status}` });
    }

    const fromStatus = res.status as string;
    const toStatus = input.hasDiscrepancy ? 'Rate Dispute' : 'Supplier Confirmed';

    await zite.reservations.update({
      id: input.reservationId,
      record: {
        status: toStatus,
        supplierReference: input.supplierReference,
        hotelConfirmationNumber: input.supplierReference,
        hotelConfirmedAt: new Date().toISOString(),
        ...(input.confirmedNetRate != null && { netRateAed: input.confirmedNetRate }),
      },
    });

    await zite.reservationStatusEvents.create({
      record: {
        eventSummary: `Supplier ref ${input.supplierReference} recorded — ${toStatus}`,
        reservation: input.reservationId,
        fromStatus,
        toStatus,
        eventReason: input.discrepancyNotes || input.reason || `Supplier confirmed ref: ${input.supplierReference}`,
        createdBy: context?.user?.email || 'System',
        createdAt: new Date().toISOString(),
      },
    });

    return { status: toStatus };
  },
});
