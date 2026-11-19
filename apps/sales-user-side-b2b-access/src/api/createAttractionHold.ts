import {allAttractionRecords} from '../lib/allAttractionRecords';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { buildAttractionQuote } from '@/lib/attractionPricing';

const linkedId = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');

export default createEndpoint({
  description: 'Creates a short-lived B2B attraction inventory hold after authoritative recheck',
  inputSchema: z.object({
    partnerToken: z.string(),
    offerId: z.string(),
    ticketOptionId: z.string(),
    rateId:z.string().optional(),
    market:z.string().optional(),
    promoCode:z.string().optional(),
    date: z.string(),
    slot: z.string().optional(),
    adultCount: z.number().int().min(0),
    childCount: z.number().int().min(0),
  }),
  outputSchema: z.object({
    holdId: z.string(),
    holdReference: z.string(),
    expiresAt: z.string(),
    heldPax: z.number(),
    netTotal: z.number(),
    offerId: z.string(),
  }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.partnerToken);
    if (!partnerId) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Partner session expired.' });

    let quote;
    try {
      quote = await buildAttractionQuote({
        ticketOptionId: input.ticketOptionId,
        rateId:input.rateId,market:input.market,promoCode:input.promoCode,
        date: input.date,
        slot: input.slot,
        adultCount: input.adultCount,
        childCount: input.childCount,
        partnerId,
      });
    } catch (err: any) {
      throw new ZiteError({ code: 'CONFLICT', message: err?.message || 'Ticket inventory is no longer available.' });
    }

    if (quote.offerId !== input.offerId) {
      throw new ZiteError({ code: 'CONFLICT', message: 'The offer changed. Please accept the latest price before continuing.' });
    }

    const now = Date.now();
    const all = await allAttractionRecords(zite.attractionInventoryHolds,{
      filters: { attractionRate: quote.rateId },
      limit: 1000,
    });

    let activeHeld = 0;
    for (const raw of all.records as any[]) {
      const h = raw as any;
      if (h.status !== 'ACTIVE') continue;
      const expiry = new Date(h.expiresAt || 0).getTime();
      if (!expiry || expiry <= now) {
        await zite.attractionInventoryHolds.update({ id: h.id, record: { status: 'EXPIRED' } as any });
        continue;
      }

      const holdPartnerId = linkedId(h.partnerAccount);
      if (holdPartnerId === partnerId && String(h.offerId || '') === quote.offerId) {
        return {
          holdId: h.id,
          holdReference: h.holdReference || h.id,
          expiresAt: new Date(expiry).toISOString(),
          heldPax: Math.max(0, Number(h.heldPax || 0)),
          netTotal: Number(h.heldAmountAed || quote.netTotal),
          offerId: quote.offerId,
        };
      }

      activeHeld += Math.max(0, Number(h.heldPax || 0));
    }

    const rate = await zite.attractionRates.findOne({ id: quote.rateId }) as any;
    if (!rate) throw new ZiteError({ code: 'CONFLICT', message: 'Rate inventory no longer exists.' });

    const capacity = Math.max(0, Number(rate.totalCapacity || 0));
    const sold = Math.max(0, Number(rate.soldCount || 0));
    const requestedPax = quote.adultCount + quote.childCount;
    if (capacity > 0 && sold + activeHeld + requestedPax > capacity) {
      throw new ZiteError({ code: 'CONFLICT', message: 'Insufficient remaining allocation after active checkout holds.' });
    }

    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();
    const holdReference = `HLD-ATT-${crypto.randomUUID().slice(0,8).toUpperCase()}`;

    const created = await zite.attractionInventoryHolds.create({
      record: {
        holdReference,
        partnerAccount: partnerId,
        ticketOption: quote.ticketOptionId,
        attractionRate: quote.rateId,
        offerId: quote.offerId,
        visitDate: quote.date,
        timeSlot: quote.slot,
        adultCount: quote.adultCount,
        childCount: quote.childCount,
        heldPax: requestedPax,
        heldAmountAed: quote.netTotal,
        status: 'ACTIVE',
        expiresAt,
      } as any,
    });

    return {
      holdId: created.id,
      holdReference,
      expiresAt,
      heldPax: requestedPax,
      netTotal: quote.netTotal,
      offerId: quote.offerId,
    };
  },
});
