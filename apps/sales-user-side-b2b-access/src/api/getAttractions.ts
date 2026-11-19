import {allAttractionRecords} from '../lib/allAttractionRecords';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import {commercialRates} from '../lib/attractionCommercial';
import { resolveAttractionImage } from '@/lib/attractionImages';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { loadMarkupRules, partnerTier, agentPrice } from '@/lib/attractionMarkup';

const linkedId = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');

export default createEndpoint({
  description: 'B2B attraction SKU marketplace search by destination, date, pax and commercial filters',
  inputSchema: z.object({
    city: z.string().optional(),
    emirate: z.string().optional(),
    partnerToken: z.string().optional(),
    category: z.string().optional(),
    search: z.string().optional(),
    visitDate: z.string().optional(),
    market:z.string().optional(),promoCode:z.string().optional(),
    adults: z.number().int().min(1).max(20).default(1),
    children: z.number().int().min(0).max(20).default(0),
    fastConfirmationOnly: z.boolean().default(false),
    freeCancellationOnly: z.boolean().default(false),
    availableOnly: z.boolean().default(false),
  }),
  outputSchema: z.object({
    attractions: z.array(z.object({
      id: z.string(),
      ticketOptionId: z.string(),
      ticketOptionName: z.string(),
      title: z.string(),
      slug: z.string(),
      shortDescription: z.string(),
      city: z.string(),
      category: z.string(),
      skuCode: z.string(),
      coverImage: z.string().optional(),
      imageCredit: z.string().optional(),
      imageSourceUrl: z.string().optional(),
      rating: z.number(),
      reviewCount: z.number(),
      cancellationPolicy: z.string(),
      instantConfirmation: z.boolean(),
      status: z.string(),
      bookedCount: z.number(),
      retailPrice: z.number().nullable(),
      netPrice: z.number().nullable(),
      discountPct: z.number(),
      rrpSet: z.boolean(),
      availableOnDate: z.boolean(),
      matchingTicketCount: z.number(),
      remaining: z.number().nullable(),
    })),
    meta: z.object({
      visitDate: z.string().optional(),
    market:z.string().optional(),promoCode:z.string().optional(),
      adults: z.number(),
      children: z.number(),
      searched: z.number(),
      returned: z.number(),
      pricesVisible: z.boolean(),
      facets: z.object({
        emirates: z.array(z.object({ value: z.string(), count: z.number() })),
        categories: z.array(z.object({ value: z.string(), count: z.number() })),
      }),
    }),
  }),
  execute: async ({ input }) => {
    // B2: agency net rates only for a valid partner session.
    const partnerId = input.partnerToken ? await verifyPartnerToken(input.partnerToken) : null;
    const pricesVisible = !!partnerId;
    const markupRules = pricesVisible ? await loadMarkupRules() : [];
    const tier = pricesVisible ? await partnerTier(partnerId) : undefined;
    // F1/F2: filter on Emirate + Product Category (B6 taxonomy); facets come from live data.
    const emirateFilter = input.emirate || input.city || '';
    const [{ records: allActive }, ticketRes] = await Promise.all([
      allAttractionRecords(zite.attractions,{ filters: { status: 'Active' }, limit: 500 }),
      allAttractionRecords(zite.ticketOptions,{ filters: { status: 'Active' }, limit: 1000 }),
    ]);

    const tally = (vals: string[]) => Object.entries(vals.reduce((m: Record<string, number>, v) => { if (v) m[v] = (m[v] || 0) + 1; return m; }, {}))
      .map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
    const facets = {
      emirates: tally((allActive as any[]).map(r => String(r.emirate || ''))),
      categories: tally((allActive as any[]).map(r => String(r.productCategory || ''))),
    };
    const records = (allActive as any[]).filter(r =>
      (!emirateFilter || r.emirate === emirateFilter || r.city === emirateFilter) &&
      (!input.category || r.productCategory === input.category || r.category === input.category));

    const attractionById = new Map(records.map((r:any) => [r.id, r]));
    const tickets = (ticketRes.records as any[]).filter((t:any) => {
      const attractionId = linkedId(t.attraction);
      return !!attractionId && attractionById.has(attractionId);
    });

    const ticketIds = tickets.map((t:any)=>t.id);
    const ratesRes = ticketIds.length
      ? await allAttractionRecords(zite.attractionRates,{ filters: { ticketOption: { in: ticketIds }, ...(input.visitDate?{date:input.visitDate}:{date:{gte:new Date().toISOString().slice(0,10)}}) }, limit: 2000 })
      : { records: [] as any[] };

    const ratesByTicket = new Map<string, any[]>();
    for (const r of await commercialRates(ratesRes.records as any[],input)) {
      const ticketId = linkedId(r.ticketOption);
      const list = ratesByTicket.get(ticketId) || [];
      list.push(r);
      ratesByTicket.set(ticketId, list);
    }

    const activeHoldsByRate = new Map<string, number>();
    const now = Date.now();
    if (ratesRes.records.length) {
      const rateIds = (ratesRes.records as any[]).map(r=>r.id);
      const holds = await allAttractionRecords(zite.attractionInventoryHolds,{ filters: { attractionRate: { in: rateIds } }, limit: 2000 });
      for (const hold of holds.records as any[]) {
        if (hold.status !== 'ACTIVE') continue;
        if (new Date(hold.expiresAt || 0).getTime() <= now) continue;
        const rateId = linkedId(hold.attractionRate);
        activeHoldsByRate.set(rateId, (activeHoldsByRate.get(rateId) || 0) + Math.max(0, Number(hold.heldPax || 0)));
      }
    }

    const pax = input.adults + input.children;
    const targetDate = input.visitDate || undefined;
    const today = new Date().toISOString().slice(0,10);
    const search = (input.search || '').trim().toLowerCase();
    const out:any[] = [];

    for (const ticket of tickets) {
      const attractionId = linkedId(ticket.attraction);
      const attraction = attractionById.get(attractionId) as any;
      if (!attraction) continue;

      if (pax < Number(ticket.minPax || 1) || pax > Number(ticket.maxPax || 99)) continue;
      if (input.fastConfirmationOnly && !ticket.instantConfirmationEligible && !attraction.instantConfirmation) continue;

      if (search) {
        const haystack = [
          attraction.title, attraction.shortDescription, attraction.city, attraction.category,
          ticket.name, ticket.skuCode,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search)) continue;
      }

      if (input.freeCancellationOnly &&
          attraction.cancellationPolicy !== 'Free Cancellation' &&
          !String(ticket.cancellationRule || '').toLowerCase().includes('free')) continue;

      const rates = ratesByTicket.get(ticket.id) || [];
      let selectedDateNet = Infinity;
      let selectedDateRetail: number | null = Infinity;
      let selectedDateRemaining:number|null = null;
      let futureNet = Infinity;
      let futureRetail: number | null = Infinity;
      let futureRemaining:number|null = null;
      let availableOnDate = false;
      let bookedCount = 0;

      const priceRate = (r:any) => {
        const rateDate = String(r.date || '').slice(0,10);
        if (!rateDate || rateDate < today) return null;
        if (r.stopSale || r.inventoryStatus === 'Sold Out' || (r.currency && r.currency !== 'AED')) return null;

        const cutoffHours = Math.max(0, Number(r.bookingCutoffHours || 0));
        const cutoffAt = new Date(rateDate + 'T00:00:00Z').getTime() - cutoffHours * 3600000;
        if (Date.now() > cutoffAt) return null;

        const capacity = Math.max(0, Number(r.totalCapacity || 0));
        const sold = Math.max(0, Number(r.soldCount || 0));
        const held = activeHoldsByRate.get(r.id) || 0;
        const remaining = capacity > 0 ? Math.max(0, capacity - sold - held) : null;
        if (remaining !== null && remaining < pax) return null;

        const m = agentPrice(markupRules, { partnerId: partnerId || undefined, tier, emirate: attraction.emirate || undefined, productCategory: attraction.productCategory || undefined, ticketOptionId: ticket.id, market: input.market, date: rateDate }, Number(r.netCostAdult || 0), Number(r.netCostChild || 0));
        const adult = m.agentAdult;
        const child = m.agentChild;
        if (adult <= 0 && child <= 0) return null;
        if (input.adults > 0 && adult <= 0) return null;
        if (input.children > 0 && child <= 0) return null;

        const net = adult * input.adults + child * input.children;
        // B5: never present net as RRP. Missing retail stays null and is shown as "RRP not set".
        const retailAdult = Number(r.retailAdult || 0);
        const retailChild = Number(r.retailChild || 0);
        const rrpOk = (input.adults === 0 || retailAdult > 0) && (input.children === 0 || retailChild > 0);
        const retail: number | null = rrpOk ? retailAdult * input.adults + retailChild * input.children : null;
        return { rateDate, net, retail, remaining };
      };

      for (const r of rates) {
        bookedCount += Number(r.soldCount || 0);
        const priced = priceRate(r);
        if (!priced) continue;

        if (priced.net < futureNet) {
          futureNet = priced.net;
          futureRetail = priced.retail;
          futureRemaining = priced.remaining;
        }

        if (targetDate && priced.rateDate === targetDate && priced.net < selectedDateNet) {
          selectedDateNet = priced.net;
          selectedDateRetail = priced.retail;
          selectedDateRemaining = priced.remaining;
          availableOnDate = true;
        }
      }

      if (input.availableOnly && !availableOnDate) continue;

      // Always display active SKU products, even when no rate has been loaded.
      // When selected-date pricing is unavailable, the card may show the best future contracted rate.
      const chosenNet = selectedDateNet < Infinity ? selectedDateNet : futureNet;
      const chosenRetail = selectedDateNet < Infinity ? selectedDateRetail : futureRetail;
      const netPrice = chosenNet < Infinity ? chosenNet : null;
      const retailPrice = chosenRetail === null || chosenRetail === Infinity ? null : chosenRetail;
      const remaining = selectedDateNet < Infinity ? selectedDateRemaining : futureRemaining;
      const discountPct = retailPrice && netPrice && retailPrice > netPrice
        ? Math.round(((retailPrice - netPrice) / retailPrice) * 100)
        : 0;

      out.push({
        id: attraction.id,
        ticketOptionId: ticket.id,
        ticketOptionName: ticket.name || '',
        title: attraction.title || '',
        slug: attraction.slug || '',
        shortDescription: ticket.highlights || ticket.inclusions || attraction.shortDescription || '',
        city: attraction.city || '',
        category: attraction.productCategory || attraction.category || '',
        skuCode: ticket.skuCode || '',
        coverImage: resolveAttractionImage({
          title: attraction.title || '',
          city: attraction.city || '',
          category: attraction.category || '',
          coverImage: Array.isArray(attraction.coverImage) && attraction.coverImage[0]?.url ? attraction.coverImage[0].url : undefined,
          coverImageUrl: attraction.coverImageUrl || undefined,
        }),
        ...(((Array.isArray(attraction.coverImage) && attraction.coverImage[0]?.url) || attraction.coverImageUrl) && attraction.imageCredit
          ? { imageCredit: String(attraction.imageCredit), imageSourceUrl: attraction.imageSourceUrl ? String(attraction.imageSourceUrl) : undefined }
          : {}),
        rating: Number(attraction.rating || 0),
        reviewCount: Number(attraction.reviewCount || 0),
        cancellationPolicy: ticket.cancellationRule || attraction.cancellationPolicy || '',
        instantConfirmation: !!ticket.instantConfirmationEligible || !!attraction.instantConfirmation,
        status: ticket.status || 'Active',
        bookedCount,
        retailPrice: pricesVisible ? retailPrice : null,
        netPrice: pricesVisible ? netPrice : null,
        discountPct: pricesVisible ? discountPct : 0,
        rrpSet: retailPrice !== null,
        availableOnDate,
        matchingTicketCount: 1,
        remaining: pricesVisible ? remaining : null,
      });
    }

    try {
      await zite.attractionSearchEvents.create({
        record: {
          searchLabel: (input.search || input.city || input.category || 'UAE Attraction SKUs') + ' · ' + (targetDate || 'Any Date'),
          query: input.search || '',
          visitDate: targetDate || null,
          adults: input.adults,
          children: input.children,
          city: input.city || '',
          category: input.category || '',
          fastConfirmationOnly: input.fastConfirmationOnly,
          freeCancellationOnly: input.freeCancellationOnly,
          availableOnly: input.availableOnly,
          resultCount: out.length,
        } as any,
      });
    } catch {
      // Search analytics must never block availability results.
    }

    return {
      attractions: out,
      meta: {
        visitDate: targetDate,
        adults: input.adults,
        children: input.children,
        searched: tickets.length,
        returned: out.length,
        pricesVisible,
        facets,
      },
    };
  },
});
