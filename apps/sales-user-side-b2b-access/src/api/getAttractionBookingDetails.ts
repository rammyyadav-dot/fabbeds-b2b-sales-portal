import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { verifyPartnerToken } from '@/lib/partnerSecurity';

const linkedId = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');

export default createEndpoint({
  description: 'Returns one authenticated partner attraction reservation with document eligibility',
  inputSchema: z.object({
    token: z.string(),
    bookingId: z.string(),
  }),
  outputSchema: z.object({
    id: z.string(),
    bookingReference: z.string(),
    invoiceNumber: z.string(),
    voucherNumber: z.string(),
    status: z.string(),
    attractionName: z.string(),
    ticketOptionName: z.string(),
    sku: z.string(),
    targetDate: z.string(),
    targetSlot: z.string(),
    adultCount: z.number(),
    childCount: z.number(),
    guestName: z.string(),
    guestNationality: z.string().optional(),
    specialRequests: z.string().optional(),
    companyName: z.string(),
    contactEmail: z.string(),
    total: z.number(),
    adultUnitPrice: z.number(),
    childUnitPrice: z.number(),
    adultSubtotal: z.number(),
    childSubtotal: z.number(),
    retailTotal: z.number(),
    savingsVsRetail: z.number(),
    pricingBreakdownAvailable: z.boolean(),
    creditAvailableBefore: z.number().optional(),
    currency: z.literal('AED'),
    cancellation: z.string(),
    supplierConfirmationNo: z.string().optional(),
    confirmedAt: z.string().optional(),
    creditSettlementStatus: z.string().optional(),
    creditDueDate: z.string().optional(),
    voucherAvailable: z.boolean(),
    invoiceLabel: z.string(),
  }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.token);
    if (!partnerId) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Partner session expired.' });

    const b = await zite.attractionBookings.findOne({ id: input.bookingId }) as any;
    if (!b || linkedId(b.partnerAccount) !== partnerId) {
      throw new ZiteError({ code: 'NOT_FOUND', message: 'Reservation not found.' });
    }

    const status = b.reservationStatus || (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Vouchered' ? 'Confirmed' : b.bookingStatus || 'Awaiting Confirmation');
    const confirmed = status === 'Confirmed';

    let pricing: any = {};
    try {
      pricing = b.pricingSnapshotJson ? JSON.parse(String(b.pricingSnapshotJson)) : {};
    } catch {
      pricing = {};
    }

    const adultCount = Number(b.adultCount || 0);
    const childCount = Number(b.childCount || 0);
    const total = Number(b.totalSellPrice || 0);
    const adultUnitPrice = Number(pricing.netAdult || 0);
    const childUnitPrice = Number(pricing.netChild || 0);
    const adultSubtotal = adultUnitPrice * adultCount;
    const childSubtotal = childUnitPrice * childCount;
    const retailTotal = Number(pricing.retailTotal || total);
    const pricingBreakdownAvailable = Number(pricing.netTotal || 0) > 0
      && (adultCount === 0 || adultUnitPrice > 0)
      && (childCount === 0 || childUnitPrice > 0);

    return {
      id: b.id,
      bookingReference: b.bookingReference || '',
      invoiceNumber: b.invoiceNumber || '',
      voucherNumber: b.voucherNumber || '',
      status,
      attractionName: b.attractionName || '',
      ticketOptionName: b.ticketOptionName || '',
      sku: b.skuSnapshot || '',
      targetDate: b.targetDate ? String(b.targetDate).slice(0, 10) : '',
      targetSlot: b.targetSlot || '',
      adultCount,
      childCount,
      guestName: b.guestName || '',
      guestNationality: b.guestNationality || undefined,
      specialRequests: b.specialRequests || undefined,
      companyName: b.companyName || '',
      contactEmail: b.contactEmail || '',
      total,
      adultUnitPrice,
      childUnitPrice,
      adultSubtotal,
      childSubtotal,
      retailTotal,
      savingsVsRetail: Math.max(0, retailTotal - total),
      pricingBreakdownAvailable,
      creditAvailableBefore: pricing.creditAvailableBefore != null ? Number(pricing.creditAvailableBefore) : undefined,
      currency: 'AED',
      cancellation: b.cancellationSnapshot || 'As per supplier policy',
      supplierConfirmationNo: b.supplierConfirmationNo || undefined,
      confirmedAt: b.confirmedAt || undefined,
      creditSettlementStatus: b.creditSettlementStatus || undefined,
      creditDueDate: b.creditDueDate ? String(b.creditDueDate).slice(0, 10) : undefined,
      voucherAvailable: confirmed && !!b.supplierConfirmationNo,
      invoiceLabel: confirmed ? 'Credit Invoice' : 'Proforma Invoice',
    };
  },
});
