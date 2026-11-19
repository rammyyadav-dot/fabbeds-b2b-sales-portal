import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { enrichCurrentUser } from '../lib/currentUser';

export default createEndpoint({
  description: 'Lists homepage campaign banners for fabBeds admin',
  inputSchema: z.object({}),
  outputSchema: z.object({
    banners: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      desktopImageUrl: z.string().optional(),
      mobileImageUrl: z.string().optional(),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      ctaLabel: z.string().optional(),
      ctaUrl: z.string().optional(),
      destination: z.string().optional(),
      hotelId: z.string().optional(),
      displayOrder: z.number(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isActive: z.boolean(),
      audience: z.string(),
      altText: z.string().optional(),
      imageCredit: z.string().optional(),
    })),
  }),
  execute: async ({ context }) => {
    await enrichCurrentUser(context);
    const { records } = await zite.homepageCampaignBanners.findAll({ limit: 500 });
    return {
      banners: records
        .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
        .map(b => ({
          id: b.id,
          name: b.bannerName || '',
          type: b.bannerType || 'Hotel Deal',
          desktopImageUrl: b.desktopImage?.[0]?.url || undefined,
          mobileImageUrl: b.mobileImage?.[0]?.url || undefined,
          headline: b.headline || undefined,
          subheadline: b.subheadline || undefined,
          ctaLabel: b.ctaLabel || undefined,
          ctaUrl: b.ctaUrl || undefined,
          destination: b.destination || undefined,
          hotelId: Array.isArray(b.hotel) ? b.hotel[0] : b.hotel || undefined,
          displayOrder: Number(b.displayOrder || 0),
          startDate: b.startDate || undefined,
          endDate: b.endDate || undefined,
          isActive: !!b.isActive,
          audience: b.audience || 'All',
          altText: b.altText || undefined,
          imageCredit: b.imageCredit || undefined,
        })),
    };
  },
});
