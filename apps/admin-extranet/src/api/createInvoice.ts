import { requireFinance } from '../lib/requireFinance';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Create an invoice for a confirmed reservation and advance to Invoiced status',
  inputSchema: z.object({
    reservationId: z.string(),
    invoiceNumber: z.string().trim().min(1).max(100),
    subtotalAmount: z.number().finite().positive().refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, 'Use at most two decimal places'),
    vatAmount: z.number().finite().nonnegative().refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, 'Use at most two decimal places').optional(),
    dueDate: z.string().optional(),
    invoiceNotes: z.string().optional(),
    reason: z.string().optional(),
  }),
  outputSchema: z.object({ invoiceId: z.string() }),
  execute: async ({ input, context }) => {
    await requireFinance(context);
    const res = await zite.reservations.findOne({ id: input.reservationId });
    if (!res) throw new ZiteError({ code: 'NOT_FOUND', message: 'Reservation not found' });
    if (res.status !== 'Confirmed') {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invoice can only be created for Confirmed reservations (current: ${res.status})` });
    }

    if (res.currencyCode && res.currencyCode !== 'AED') throw new ZiteError({code:'BAD_REQUEST',message:'This invoice workflow supports AED only'});
    const existing = await zite.sql({query:'SELECT id FROM "ReservationInvoices" WHERE "invoiceNumber"=$1 LIMIT 1',params:[input.invoiceNumber]});
    if(existing.rows.length) throw new ZiteError({code:'BAD_REQUEST',message:'Invoice number already exists'});
    const vat = input.vatAmount ?? 0;
    const total = (Math.round(input.subtotalAmount*100) + Math.round(vat*100))/100;

    const invoice = await zite.reservationInvoices.create({
      record: {
        invoiceNumber: input.invoiceNumber,
        reservation: input.reservationId,
        invoiceStatus: 'Issued',
        subtotalAmount: input.subtotalAmount,
        vatAmount: vat,
        totalAmount: total,
        issuedAt: new Date().toISOString(),
        dueDate: input.dueDate,
        invoiceNotes: input.invoiceNotes,
        createdAt: new Date().toISOString(),
      },
    });

    await zite.reservations.update({
      id: input.reservationId,
      record: { status: 'Invoiced', invoiceNumber: input.invoiceNumber, invoiceSentAt: new Date().toISOString() },
    });

    await zite.reservationStatusEvents.create({
      record: {
        eventSummary: `Invoice ${input.invoiceNumber} issued — status moved to Invoiced`,
        reservation: input.reservationId,
        fromStatus: 'Confirmed',
        toStatus: 'Invoiced',
        eventReason: input.reason || `Invoice ${input.invoiceNumber} created`,
        createdBy: context?.user?.email || 'System',
        createdAt: new Date().toISOString(),
      },
    });

    return { invoiceId: invoice.id };
  },
});
