import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'List active holiday packages with optional category filter',
  inputSchema: z.object({
    category: z.string().optional(),
    destination: z.string().optional(),
  }),
  outputSchema: z.object({
    packages: z.array(z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string(),
      totalDays: z.number(),
      totalNights: z.number(),
      destinations: z.array(z.string()),
      hotelStarRating: z.string(),
      transferType: z.string(),
      category: z.string(),
      coverImageUrl: z.string().nullable(),
      startingPrice: z.number(),
      lowestSeasonPrice: z.number().nullable(),
      inclusions: z.string(),
    })),
  }),
  execute: async ({ input }) => {
    const filters: any = { isActive: true };
    if (input.category) filters.packageCategory = input.category;

    const { records } = await zite.packageMasters.findAll({ filters, limit: 100 });

    // Get lowest season prices for all packages
    const pkgIds = records.map(r => r.id);
    const { records: seasonPrices } = await zite.packageSeasonPrices.findAll({
      filters: { _package: { in: pkgIds } },
      limit: 500,
    });

    const lowestByPkg = new Map<string, number>();
    for (const sp of seasonPrices) {
      const pkgId = Array.isArray(sp._package) ? sp._package[0] : sp._package;
      if (!pkgId) continue;
      const price = sp.retailAdultTwin || 0;
      if (price > 0) {
        const current = lowestByPkg.get(pkgId);
        if (!current || price < current) lowestByPkg.set(pkgId, price);
      }
    }

    let packages = records
      .filter(r => {
        if (input.destination) {
          return r.destinations?.some(d => d.toLowerCase().includes(input.destination!.toLowerCase()));
        }
        return true;
      })
      .map(r => ({
        id: r.id,
        title: r.packageTitle || '',
        slug: r.slug || '',
        totalDays: r.totalDays || 0,
        totalNights: r.totalNights || 0,
        destinations: r.destinations || [],
        hotelStarRating: r.hotelStarRating || '',
        transferType: r.transferType || '',
        category: r.packageCategory || '',
        coverImageUrl: r.coverImage?.[0]?.url || null,
        startingPrice: r.startingPrice || 0,
        lowestSeasonPrice: lowestByPkg.get(r.id) || null,
        inclusions: r.inclusions || '',
      }));

    return { packages };
  },
});
