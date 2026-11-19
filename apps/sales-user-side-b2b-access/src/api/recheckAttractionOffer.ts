import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { buildAttractionQuote } from '@/lib/attractionPricing';
import { verifyPartnerToken } from '@/lib/partnerSecurity';

export default createEndpoint({
  description: 'Authoritatively rechecks one attraction SKU/date/slot/pax offer in AED',
  inputSchema: z.object({
    ticketOptionId: z.string(),
    partnerToken: z.string().optional(),
    rateId:z.string().optional(),
    market:z.string().optional(),
    promoCode:z.string().optional(),
    date: z.string(),
    slot: z.string().optional(),
    adultCount: z.number().int().min(0),
    childCount: z.number().int().min(0),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    offerId: z.string(),
    rateId:z.string(),ratePlanId:z.string(),ratePlanName:z.string(),inclusions:z.string(),restrictions:z.string(),
    attractionId: z.string(),
    attractionName: z.string(),
    ticketOptionId: z.string(),
    ticketOptionName: z.string(),
    sku: z.string(),
    date: z.string(),
    slot: z.string(),
    adultCount: z.number(),
    childCount: z.number(),
    netAdult: z.number(),
    netChild: z.number(),
    retailAdult: z.number(),
    retailChild: z.number(),
    netTotal: z.number(),
    retailTotal: z.number(),
    currency: z.literal('AED'),
    remaining: z.number().nullable(),
    inventoryStatus: z.string(),
    instantConfirmation: z.boolean(),
    cancellation: z.string(),
    expiresAt: z.string(),
  }),
  execute: async ({ input }) => {
    // B2: an offer recheck exposes agency net prices, so it requires a partner session.
    const partnerId = input.partnerToken ? await verifyPartnerToken(input.partnerToken) : null;
    if (!partnerId) {
      throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Sign in with your agency account to see rates.' });
    }
    const { partnerToken: _token, ...quoteInput } = input;
    try {
      const { supplierAdult: _sa, supplierChild: _sc, supplierCostTotal: _st, markupTotal: _mt, markupRuleId: _mr, markupRuleLabel: _ml, ...quote } = await buildAttractionQuote({ ...quoteInput, partnerId });
      return { valid: true, ...quote };
    } catch (err: any) {
      throw new ZiteError({ code: 'CONFLICT', message: err?.message || 'Attraction offer is no longer available.' });
    }
  },
});
