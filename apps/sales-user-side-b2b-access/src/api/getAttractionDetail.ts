import {allAttractionRecords} from '../lib/allAttractionRecords';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import {commercialRates,commercialId} from '../lib/attractionCommercial';
import { resolveAttractionImage } from '@/lib/attractionImages';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { loadMarkupRules, partnerTier, agentPrice } from '@/lib/attractionMarkup';

export default createEndpoint({
  description: 'Get attraction detail with ticket options and rates for a date',
  inputSchema: z.object({
    attractionId: z.string(),
    partnerToken: z.string().optional(),
    date: z.string().optional(),
    market:z.string().optional(),promoCode:z.string().optional(),
  }),
  outputSchema: z.object({
    pricesVisible: z.boolean(),
    attraction: z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string(),
      description: z.string(),
      shortDescription: z.string(),
      city: z.string(),
      category: z.string(),
      coverImage: z.string().optional(),
      imageCredit: z.string().optional(),
      imageSourceUrl: z.string().optional(),
      gallery: z.array(z.string()),
      rating: z.number(),
      reviewCount: z.number(),
      cancellationPolicy: z.string(),
      instantConfirmation: z.boolean(),
      address: z.string(),
    }),
    ticketOptions: z.array(z.object({
      id: z.string(),
      name: z.string(),
      skuCode: z.string(),
      ticketType: z.string(),
      requiresSlot: z.boolean(),
      minPax: z.number(),
      maxPax: z.number(),
      validityDays: z.number(),
      inclusions: z.string(),
      highlights: z.string(),
      status: z.string(),
      packageName: z.string(),
      packageDescription: z.string(),
      packageBadge: z.string(),
      rates: z.array(z.object({
        id: z.string(),
        ratePlanId:z.string(),ratePlanName:z.string(),cancellation:z.string(),inclusions:z.string(),restrictions:z.string(),
        date: z.string(),
        slotTime: z.string(),
        netCostAdult: z.number(),
        netCostChild: z.number(),
        retailAdult: z.number(),
        retailChild: z.number(),
        totalCapacity: z.number(),
        soldCount: z.number(),
        inventoryStatus: z.string(),
        remaining: z.number().nullable(),
      })),
    })),
  }),
  execute: async ({ input }) => {
    const partnerId = input.partnerToken ? await verifyPartnerToken(input.partnerToken) : null;
    const pricesVisible = !!partnerId;
    const markupRules = pricesVisible ? await loadMarkupRules() : [];
    const tier = pricesVisible ? await partnerTier(partnerId) : undefined;
    const attr = await zite.attractions.findOne({ id: input.attractionId });
    if (!attr) throw new Error('Attraction not found');

    const { records: ticketOpts } = await allAttractionRecords(zite.ticketOptions,{
      filters: { attraction: input.attractionId, status: 'Active' },
      limit: 50,
    });

    const ticketOptionIds = ticketOpts.map(t => t.id);

    const { records: packageRecords } = await allAttractionRecords(zite.attractionPackages,{
      filters: { attraction: input.attractionId, status: 'Active' },
      limit: 50,
    });
    const packageByTicket = new Map<string, any>();
    for (const raw of packageRecords as any[]) {
      const pkg = raw as any;
      const linked = Array.isArray(pkg.ticketOptions) ? pkg.ticketOptions : [];
      for (const ticketId of linked) packageByTicket.set(String(ticketId), pkg);
    }

    let rates: any[] = [];
    if (ticketOptionIds.length > 0) {
      const rateFilters: Record<string, any> = {
        ticketOption: { in: ticketOptionIds },
      };
      if (input.date) {
        rateFilters.date = input.date;
      }
      const { records: rateRecords } = await allAttractionRecords(zite.attractionRates,{
        filters: rateFilters,
        limit: 500,
      });
      rates = await commercialRates(rateRecords,input);
    }

    const ticketOptions = ticketOpts.map(t => {
      const optRates = rates
        .filter((r: any) => {
          const linked = r.ticketOption;
          const linkedId = Array.isArray(linked) ? linked[0] : linked;
          if (linkedId !== t.id) return false;
          if (r.stopSale||r.inventoryStatus==='Sold Out') return false;
          if (r.currency && r.currency !== 'AED') return false;

          const rateDate = String(r.date || '').slice(0, 10);
          if (rateDate) {
            const cutoffHours = Math.max(0, Number(r.bookingCutoffHours || 0));
            const cutoffAt = new Date(rateDate + 'T00:00:00Z').getTime() - cutoffHours * 3600000;
            if (Date.now() > cutoffAt) return false;
          }
          return true;
        })
        .map(r => ({
          id: r.id,
          ratePlanId:commercialId(r.ratePlan),ratePlanName:r.commercialPlan?.planName||'Standard',cancellation:r.commercialPlan?.cancellationPolicy||t.cancellationRule||attr.cancellationPolicy||'',inclusions:r.commercialPlan?.inclusions||t.inclusions||'',restrictions:r.commercialPlan?.restrictions||'',
          date: r.date || '',
          slotTime: r.slotTime || '',
          ...(() => { const m = agentPrice(markupRules, { partnerId: partnerId || undefined, tier, emirate: (attr as any).emirate || undefined, productCategory: (attr as any).productCategory || undefined, ticketOptionId: t.id, market: input.market, date: String(r.date || '').slice(0, 10) }, Number(r.netCostAdult || 0), Number(r.netCostChild || 0)); return { netCostAdult: m.agentAdult, netCostChild: m.agentChild }; })(),
          retailAdult: r.retailAdult || 0,
          retailChild: r.retailChild || 0,
          totalCapacity: r.totalCapacity || 0,
          soldCount: r.soldCount || 0,
          inventoryStatus: r.inventoryStatus || 'Available',
          remaining: r.totalCapacity>0?Math.max(0, (r.totalCapacity || 0) - (r.soldCount || 0)):null,
        }));

      const pkg = packageByTicket.get(t.id);
      return {
        id: t.id,
        name: t.name || '',
        skuCode: t.skuCode || '',
        ticketType: t.ticketType || 'Open Date',
        requiresSlot: t.requiresSlot || false,
        minPax: t.minPax || 1,
        maxPax: t.maxPax || 10,
        validityDays: t.validityDays || 1,
        inclusions: t.inclusions || '',
        highlights: t.highlights || '',
        status: t.status || 'Active',
        packageName: pkg?.packageName || '',
        packageDescription: pkg?.description || '',
        packageBadge: pkg?.badge || '',
        rates: optRates,
      };
    });

    const resolvedCover = resolveAttractionImage({
      title: attr.title || '',
      city: attr.city || '',
      category: attr.category || '',
      coverImage: Array.isArray(attr.coverImage) && attr.coverImage.length > 0 ? attr.coverImage[0].url : undefined,
      coverImageUrl: (attr as any).coverImageUrl || undefined,
    });
    const hasOwnImage = (Array.isArray(attr.coverImage) && attr.coverImage.length > 0) || !!(attr as any).coverImageUrl;
    const gallery = Array.isArray(attr.gallery) ? attr.gallery.map(g => g.url).filter(Boolean) : [];
    if (!gallery.length && resolvedCover) gallery.push(resolvedCover);

    return {
      attraction: {
        id: attr.id,
        title: attr.title || '',
        slug: attr.slug || '',
        description: attr.description || '',
        shortDescription: attr.shortDescription || '',
        city: attr.city || '',
        category: attr.category || '',
        coverImage: resolvedCover,
        ...(hasOwnImage && (attr as any).imageCredit ? { imageCredit: String((attr as any).imageCredit), imageSourceUrl: (attr as any).imageSourceUrl ? String((attr as any).imageSourceUrl) : undefined } : {}),
        gallery,
        rating: attr.rating || 0,
        reviewCount: attr.reviewCount || 0,
        cancellationPolicy: attr.cancellationPolicy || '',
        instantConfirmation: attr.instantConfirmation || false,
        address: attr.address || '',
      },
      pricesVisible,
      // B2: availability stays visible; agency net and RRP only for a signed-in partner.
      ticketOptions: pricesVisible ? ticketOptions : ticketOptions.map(t => ({ ...t, rates: t.rates.map(r => ({ ...r, netCostAdult: 0, netCostChild: 0, retailAdult: 0, retailChild: 0, remaining: null })) })),
    };
  },
});
