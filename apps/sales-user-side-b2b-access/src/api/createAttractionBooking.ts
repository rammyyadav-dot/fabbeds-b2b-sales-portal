import { z } from 'zod';
import { zite } from 'zitejs/db';
import { getPartnerCreditPosition } from '@/lib/partnerCredit';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { buildAttractionQuote } from '@/lib/attractionPricing';

async function getCreditExposure(partnerId: string) {
  // Shared ledger: hotels + attractions + transfers.
  const p = await getPartnerCreditPosition(partnerId);
  return { used: p.used, overdue: p.overdue };
}

export default createEndpoint({
  description: 'Creates a B2B attraction reservation from an authoritative AED recheck and agency credit account',
  inputSchema: z.object({
    partnerToken: z.string(),
    offerId: z.string(),
    holdId: z.string(),
    ticketOptionId: z.string(),
    rateId:z.string().optional(),
    market:z.string().optional(),
    promoCode:z.string().optional(),
    targetDate: z.string(),
    targetSlot: z.string().optional(),
    adultCount: z.number().int().min(0),
    childCount: z.number().int().min(0),
    guestName: z.string().min(1),
    guestNationality: z.string().optional(),
    specialRequests: z.string().optional(),
  }),
  outputSchema: z.object({
    bookingId: z.string(),
    bookingReference: z.string(),
    reservationStatus: z.string(),
    creditAvailableAfter: z.number(),
  }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.partnerToken);
    if (!partnerId) {
      throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Partner session expired. Please sign in again.' });
    }

    const partner = await zite.partnerAccounts.findOne({ id: partnerId }) as any;
    if (!partner || partner.accountStatus === 'Suspended') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Partner account is not active.' });
    }

    const hold = await zite.attractionInventoryHolds.findOne({ id: input.holdId }) as any;
    if (!hold) throw new ZiteError({ code: 'CONFLICT', message: 'Inventory hold was not found. Please reselect the ticket.' });

    const holdPartnerId = Array.isArray(hold.partnerAccount) ? String(hold.partnerAccount[0] || '') : String(hold.partnerAccount || '');
    if (holdPartnerId !== partnerId) throw new ZiteError({ code: 'FORBIDDEN', message: 'This inventory hold belongs to another agency session.' });
    if (hold.status !== 'ACTIVE') throw new ZiteError({ code: 'CONFLICT', message: 'Inventory hold is no longer active.' });
    if (new Date(hold.expiresAt || 0).getTime() <= Date.now()) {
      await zite.attractionInventoryHolds.update({ id: hold.id, record: { status: 'EXPIRED' } as any });
      throw new ZiteError({ code: 'CONFLICT', message: 'Inventory hold expired. Please recheck and try again.' });
    }
    if (String(hold.offerId || '') !== input.offerId) {
      throw new ZiteError({ code: 'CONFLICT', message: 'Inventory hold does not match the selected offer.' });
    }

    let quote;
    try {
      quote = await buildAttractionQuote({
        ticketOptionId: input.ticketOptionId,
        rateId:input.rateId,market:input.market,promoCode:input.promoCode,
        date: input.targetDate,
        slot: input.targetSlot,
        adultCount: input.adultCount,
        childCount: input.childCount,
        excludeHoldId: input.holdId,
        partnerId,
      });
    } catch (err: any) {
      throw new ZiteError({ code: 'CONFLICT', message: err?.message || 'Attraction offer is no longer available.' });
    }

    if (quote.offerId !== input.offerId) {
      throw new ZiteError({ code: 'CONFLICT', message: 'Attraction offer changed. Please recheck before booking.' });
    }

    const creditLimit = Math.max(0, Number(partner.creditLimitAed || 0));
    const creditStatus = partner.creditStatus || 'Pending Review';
    const creditTermsDays = Math.max(0, Number(partner.creditTermsDays || 0));

    if (creditStatus !== 'Approved' || creditLimit <= 0) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Agency credit is not approved for booking.' });
    }

    const exposureBefore = await getCreditExposure(partnerId);
    if (exposureBefore.overdue > 0) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'New bookings are blocked because the agency has overdue credit exposure.' });
    }

    const availableBefore = Math.max(0, creditLimit - exposureBefore.used);
    if (quote.netTotal > availableBefore) {
      throw new ZiteError({
        code: 'FORBIDDEN',
        message: `Insufficient agency credit. Available AED ${availableBefore.toFixed(2)}; booking requires AED ${quote.netTotal.toFixed(2)}.`,
      });
    }

    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + creditTermsDays);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const booking = await zite.attractionBookings.create({
      record: {
        bookingReference: `TMP-${crypto.randomUUID()}`,
        channel: 'B2B Portal',
        attractionName: quote.attractionName,
        ticketOptionName: quote.ticketOptionName,
        targetDate: quote.date,
        targetSlot: quote.slot,
        adultCount: quote.adultCount,
        childCount: quote.childCount,
        totalNetCost: quote.supplierCostTotal,
        totalSellPrice: quote.netTotal,
        markupAmount: quote.markupTotal,
        markupRuleSnapshot: quote.markupRuleLabel,
        companyName: partner.agencyName || '',
        registeredCountry: partner.country || '',
        agentName: partner.agencyName || '',
        contactEmail: partner.agencyEmail || '',
        whatsAppNumber: partner.agencyMobile || '',
        guestName: input.guestName,
        guestNationality: input.guestNationality || '',
        specialRequests: input.specialRequests || '',
        paymentStatus: 'Pending',
        bookingStatus: 'Initiated',
        partnerAccount: partnerId,
        reservationStatus: 'Awaiting Confirmation',
        offerId: quote.offerId,
        skuSnapshot: quote.sku,
        attractionIdSnapshot: quote.attractionId,
        currency: 'AED',
        cancellationSnapshot: quote.cancellation,
        pricingSnapshotJson: JSON.stringify({
          ...quote,
          agencyId: partnerId,
          agencyName: partner.agencyName || '',
          creditLimitAtRequest: creditLimit,
          creditAvailableBefore: availableBefore,
          recheckedAt: new Date().toISOString(),
        }),
        creditSettlementStatus: 'Open',
        creditDueDate: dueDateStr,
        supplierConfirmationNo: null,
        confirmedAt: null,
      } as any,
    });

    const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = booking.id.slice(0, 8).toUpperCase();
    const bookingReference = `UAEWB-ATT-${dateKey}-${suffix}`;
    const invoiceNumber = `INV-ATT-${dateKey}-${suffix}`;
    const voucherNumber = `VCH-ATT-${dateKey}-${suffix}`;

    await zite.attractionBookings.update({
      id: booking.id,
      record: {
        bookingReference,
        invoiceNumber,
        voucherNumber,
      } as any,
    });

    await zite.attractionBookingLines.create({
      record: {
        booking: booking.id,
        ticketOption: quote.ticketOptionId,
        targetDate: quote.date,
        targetSlot: quote.slot,
        adultCount: quote.adultCount,
        childCount: quote.childCount,
        lineNetCost: quote.supplierCostTotal,
        lineSellPrice: quote.netTotal,
        lineMarkup: quote.markupTotal,
        voucherIssued: false,
      },
    });

    await zite.attractionBookingEvents.create({
      record: {
        eventName: 'ATTRACTION_BOOKING_CREATED',
        booking: booking.id,
        details: `Offer ${quote.offerId}; hold ${hold.holdReference || hold.id}; AED ${quote.netTotal.toFixed(2)}; status Awaiting Confirmation`,
      },
    });

    await zite.attractionInventoryHolds.update({
      id: input.holdId,
      record: {
        status: 'CONSUMED',
        consumedBookingId: booking.id,
      } as any,
    });

    const exposureAfter = await getCreditExposure(partnerId);
    if (exposureAfter.used > creditLimit) {
      await zite.attractionBookings.update({
        id: booking.id,
        record: {
          reservationStatus: 'Rejected',
          bookingStatus: 'Cancelled',
          creditSettlementStatus: 'Released',
        } as any,
      });
      throw new ZiteError({ code: 'CONFLICT', message: 'Credit availability changed during booking. Please try again.' });
    }

    return {
      bookingId: booking.id,
      bookingReference,
      reservationStatus: 'Awaiting Confirmation',
      creditAvailableAfter: Math.max(0, creditLimit - exposureAfter.used),
    };
  },
});
