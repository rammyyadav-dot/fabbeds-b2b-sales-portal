import { requireStaff } from '../lib/requireStaff';
import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Create an LPO record and advance reservation to Awaiting Supplier Confirmation',
  inputSchema: z.object({
    reservationId: z.string(),
    lpoNumber: z.string(),
    supplierEmail: z.string().optional(),
    lpoNotes: z.string().optional(),
    reason: z.string().optional(),
  }),
  outputSchema: z.object({ lpoId: z.string() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'createLpo');
    await enrichCurrentUser(context);
    const res = await zite.reservations.findOne({ id: input.reservationId });
    if (!res) throw new ZiteError({ code: 'NOT_FOUND', message: 'Reservation not found' });
    if (res.isLocked) throw new ZiteError({ code: 'FORBIDDEN', message: 'Reservation is locked' });

    const allowed = ['Rate Validated'];
    if (!allowed.includes(res.status ?? '')) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Cannot create LPO from status: ${res.status}` });
    }

    const lpo = await zite.reservationLpOs.create({
      record: {
        lpoNumber: input.lpoNumber,
        reservation: input.reservationId,
        supplierEmail: input.supplierEmail,
        sentAt: new Date().toISOString(),
        lpoStatus: 'Sent',
        lpoNotes: input.lpoNotes,
        createdAt: new Date().toISOString(),
      },
    });

    const fromStatus = res.status as string;
    const toStatus = 'Awaiting Supplier Confirmation';
    await zite.reservations.update({ id: input.reservationId, record: { status: toStatus, lpoNumber: input.lpoNumber, lpoSentAt: new Date().toISOString() } });
    await zite.reservationStatusEvents.create({
      record: {
        eventSummary: `LPO ${input.lpoNumber} sent — status moved to ${toStatus}`,
        reservation: input.reservationId,
        fromStatus,
        toStatus,
        eventReason: input.reason || `LPO ${input.lpoNumber} created and sent`,
        createdBy: context?.user?.email || 'System',
        createdAt: new Date().toISOString(),
      },
    });

    return { lpoId: lpo.id };
  },
});
