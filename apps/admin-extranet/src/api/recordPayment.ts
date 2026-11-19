import { requireFinance } from '../lib/requireFinance';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Record a payment against an invoice and advance reservation to Paid/Completed',
  inputSchema: z.object({
    reservationId: z.string(),
    invoiceId: z.string(),
    paymentReference: z.string().trim().min(1).max(100),
    paymentMethod: z.string().refine(v=>['Bank Transfer','Card','Cash','Cheque'].includes(v), 'Unsupported payment method'),
    amount: z.number().finite().positive().refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, 'Use at most two decimal places'),
    receivedAt: z.string().optional(),
    paymentNotes: z.string().optional(),
  }),
  outputSchema: z.object({ paymentId: z.string(), newReservationStatus: z.string() }),
  execute: async ({ input, context }) => {
    await requireFinance(context);
    const res = await zite.reservations.findOne({ id: input.reservationId });
    if (!res) throw new ZiteError({ code: 'NOT_FOUND', message: 'Reservation not found' });
    if (!['Invoiced','Paid'].includes(res.status ?? '')) throw new ZiteError({code:'BAD_REQUEST',message:'Receipt requires an invoiced reservation; cancelled, disputed or completed reservations cannot be advanced'});
    const invoice = await zite.reservationInvoices.findOne({ id: input.invoiceId });
    if (!invoice) throw new ZiteError({ code: 'NOT_FOUND', message: 'Invoice not found' });

    const links = Array.isArray(invoice.reservation) ? invoice.reservation : [invoice.reservation];
    if (!links.includes(res.id)) throw new ZiteError({code:'BAD_REQUEST',message:'Invoice does not belong to this reservation'});
    if (!['Issued','Partially Paid'].includes(invoice.invoiceStatus ?? '')) throw new ZiteError({code:'BAD_REQUEST',message:'Only issued or partially paid invoices accept receipts'});
    if (res.currencyCode && res.currencyCode !== 'AED') throw new ZiteError({code:'BAD_REQUEST',message:'AED receipts only'});
    if (!Number.isFinite(invoice.totalAmount) || (invoice.totalAmount ?? 0) <= 0) throw new ZiteError({code:'BAD_REQUEST',message:'Invoice total is missing or invalid'});
    const duplicates=await zite.sql({query:'SELECT id FROM "ReservationPayments" WHERE "paymentReference"=$1 LIMIT 1',params:[input.paymentReference]});
    if(duplicates.rows.length) throw new ZiteError({code:'BAD_REQUEST',message:'Payment reference already recorded; review existing receipt'});
    const sums=await zite.sql({query:'SELECT COALESCE(SUM(ROUND(COALESCE(p."amount",0)*100)),0) AS paid FROM "ReservationPayments" p JOIN "ReservationInvoicesReservationPayments" l ON l."reservationPaymentsId"=p.id WHERE l."reservationInvoicesId"=$1 AND p."paymentStatus"=$2',params:[invoice.id,'Received']});
    const paidMinor=Number(sums.rows[0]?.paid ?? 0);
    const incomingMinor=Math.round(input.amount*100);
    const totalMinor=Math.round((invoice.totalAmount ?? 0)*100);
    if(paidMinor+incomingMinor>totalMinor) throw new ZiteError({code:'BAD_REQUEST',message:'Receipt exceeds invoice outstanding. Unallocated cash requires a separate workflow'});
    const payment = await zite.reservationPayments.create({
      record: {
        paymentReference: input.paymentReference,
        invoice: input.invoiceId,
        reservation: input.reservationId,
        paymentStatus: 'Received',
        paymentMethod: input.paymentMethod,
        amount: input.amount,
        receivedAt: input.receivedAt ?? new Date().toISOString(),
        paymentNotes: input.paymentNotes,
        createdAt: new Date().toISOString(),
      },
    });

    const isFullyPaid = paidMinor + incomingMinor >= totalMinor;
    const invoiceStatus = isFullyPaid ? 'Paid' : 'Partially Paid';
    await zite.reservationInvoices.update({ id: input.invoiceId, record: { invoiceStatus } });

    const newResStatus = isFullyPaid ? 'Paid' : 'Invoiced';
    await zite.reservations.update({ id: input.reservationId, record: { status: newResStatus } });

    await zite.reservationStatusEvents.create({
      record: {
        eventSummary: `Payment ${input.paymentReference} received — ${newResStatus}`,
        reservation: input.reservationId,
        fromStatus: res.status as string,
        toStatus: newResStatus,
        eventReason: `Payment of AED ${input.amount} via ${input.paymentMethod}`,
        createdBy: context?.user?.email || 'System',
        createdAt: new Date().toISOString(),
      },
    });

    return { paymentId: payment.id, newReservationStatus: newResStatus };
  },
});
