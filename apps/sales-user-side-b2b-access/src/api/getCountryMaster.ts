import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Return active canonical countries for Guest Nationality selectors',
  inputSchema: z.object({}),
  outputSchema: z.object({
    countries: z.array(z.object({
      id: z.string(),
      name: z.string(),
      iso2: z.string(),
      iso3: z.string(),
      region: z.string().optional(),
      subregion: z.string().optional(),
    })),
  }),
  execute: async () => {
    const res = await zite.countryMaster.findAll({ filters: { active: true }, limit: 500 });
    return {
      countries: res.records
        .map(c => ({
          id: c.id,
          name: c.countryName || '',
          iso2: String(c.iso2Code || '').toUpperCase(),
          iso3: String(c.iso3Code || '').toUpperCase(),
          region: c.region || undefined,
          subregion: c.subregion || undefined,
        }))
        .filter(c => c.name && c.iso2)
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});
