import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get full package detail with itinerary and season pricing',
  inputSchema: z.object({ packageId: z.string() }),
  outputSchema: z.object({
    package: z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string(),
      totalDays: z.number(),
      totalNights: z.number(),
      destinations: z.array(z.string()),
      hotelStarRating: z.string(),
      transferType: z.string(),
      category: z.string(),
      inclusions: z.string(),
      exclusions: z.string(),
      termsAndConditions: z.string(),
      coverImageUrl: z.string().nullable(),
      galleryUrls: z.array(z.string()),
      startingPrice: z.number(),
    }),
    itinerary: z.array(z.object({
      id: z.string(),
      dayNumber: z.number(),
      dayTitle: z.string(),
      dayDescription: z.string(),
      morningActivity: z.string(),
      afternoonActivity: z.string(),
      eveningActivity: z.string(),
      mealsIncluded: z.string(),
      overnightLocation: z.string(),
    })),
    seasonPrices: z.array(z.object({
      id: z.string(),
      seasonName: z.string(),
      validFrom: z.string(),
      validTo: z.string(),
      netCostAdultTwin: z.number(),
      netCostAdultSingle: z.number(),
      netCostChildWithBed: z.number(),
      netCostChildNoBed: z.number(),
      retailAdultTwin: z.number(),
      retailAdultSingle: z.number(),
      retailChildWithBed: z.number(),
      retailChildNoBed: z.number(),
      allotmentCap: z.number().nullable(),
    })),
  }),
  execute: async ({ input }) => {
    const pkg = await zite.packageMasters.findOne({ id: input.packageId });
    if (!pkg) throw new Error('Package not found');

    const [itinResult, priceResult] = await Promise.all([
      zite.packageItineraryDays.findAll({ filters: { _package: input.packageId }, limit: 30 }),
      zite.packageSeasonPrices.findAll({ filters: { _package: input.packageId }, limit: 50 }),
    ]);

    const itinerary = itinResult.records
      .sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0))
      .map(d => ({
        id: d.id,
        dayNumber: d.dayNumber || 0,
        dayTitle: d.dayTitle || '',
        dayDescription: d.dayDescription || '',
        morningActivity: d.morningActivity || '',
        afternoonActivity: d.afternoonActivity || '',
        eveningActivity: d.eveningActivity || '',
        mealsIncluded: d.mealsIncluded || '',
        overnightLocation: d.overnightLocation || '',
      }));

    const seasonPrices = priceResult.records.map(sp => ({
      id: sp.id,
      seasonName: sp.seasonName || '',
      validFrom: sp.validFrom || '',
      validTo: sp.validTo || '',
      netCostAdultTwin: sp.netCostAdultTwin || 0,
      netCostAdultSingle: sp.netCostAdultSingle || 0,
      netCostChildWithBed: sp.netCostChildWithBed || 0,
      netCostChildNoBed: sp.netCostChildNoBed || 0,
      retailAdultTwin: sp.retailAdultTwin || 0,
      retailAdultSingle: sp.retailAdultSingle || 0,
      retailChildWithBed: sp.retailChildWithBed || 0,
      retailChildNoBed: sp.retailChildNoBed || 0,
      allotmentCap: sp.allotmentCap ?? null,
    }));

    return {
      package: {
        id: pkg.id,
        title: pkg.packageTitle || '',
        slug: pkg.slug || '',
        totalDays: pkg.totalDays || 0,
        totalNights: pkg.totalNights || 0,
        destinations: pkg.destinations || [],
        hotelStarRating: pkg.hotelStarRating || '',
        transferType: pkg.transferType || '',
        category: pkg.packageCategory || '',
        inclusions: pkg.inclusions || '',
        exclusions: pkg.exclusions || '',
        termsAndConditions: pkg.termsAndConditions || '',
        coverImageUrl: pkg.coverImage?.[0]?.url || null,
        galleryUrls: (pkg.galleryImages || []).map(g => g.url),
        startingPrice: pkg.startingPrice || 0,
      },
      itinerary,
      seasonPrices,
    };
  },
});
