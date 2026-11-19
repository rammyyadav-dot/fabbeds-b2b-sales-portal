import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'List active source-market profiles and their country membership',
  inputSchema: z.object({}),
  outputSchema: z.object({
    markets: z.array(z.object({
      id: z.string(),
      name: z.string(),
      code: z.string(),
      description: z.string().optional(),
      priority: z.number(),
      countries: z.array(z.object({
        id: z.string(),
        name: z.string(),
        iso2: z.string(),
        iso3: z.string(),
      })),
    })),
  }),
  execute: async ({ context }) => {
    await requireStaff(context, 'getSourceMarkets');
    const [marketsRes, membershipsRes, countriesRes] = await Promise.all([
      zite.sourceMarketProfiles.findAll({ filters: { status: 'Active' }, limit: 200 }),
      zite.sourceMarketCountries.findAll({ limit: 1000 }),
      zite.countryMaster.findAll({ filters: { active: true }, limit: 500 }),
    ]);

    const countryById = new Map(countriesRes.records.map(c => [c.id, c]));
    const memberships = new Map<string, string[]>();

    for (const m of membershipsRes.records) {
      const marketId = Array.isArray(m.sourceMarket) ? m.sourceMarket[0] : m.sourceMarket;
      const countryId = Array.isArray(m.country) ? m.country[0] : m.country;
      if (!marketId || !countryId) continue;
      const list = memberships.get(marketId) ?? [];
      list.push(countryId);
      memberships.set(marketId, list);
    }

    return {
      markets: marketsRes.records
        .map(m => ({
          id: m.id,
          name: m.marketName || '',
          code: m.marketCode || '',
          description: m.description || undefined,
          priority: Number(m.priority || 0),
          countries: (memberships.get(m.id) ?? [])
            .map(id => countryById.get(id))
            .filter(Boolean)
            .map(c => ({
              id: c!.id,
              name: c!.countryName || '',
              iso2: c!.iso2Code || '',
              iso3: c!.iso3Code || '',
            })),
        }))
        .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name)),
    };
  },
});
