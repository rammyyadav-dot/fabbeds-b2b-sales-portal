import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const bannerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  desktopImageUrl: z.string(),
  mobileImageUrl: z.string().optional(),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  destination: z.string().optional(),
  hotelId: z.string().optional(),
  displayOrder: z.number(),
  altText: z.string().optional(),
  imageCredit: z.string().optional(),
});

export default createEndpoint({
  description: 'Returns active AED homepage campaign banners for the fabBeds marketplace',
  inputSchema: z.object({
    signedIn: z.boolean().optional(),
  }),
  outputSchema: z.object({
    banners: z.array(bannerSchema),
  }),
  execute: async ({ input }) => {
    const { records } = await zite.homepageCampaignBanners.findAll({ limit: 200 });
    const today = new Date().toISOString().slice(0, 10);
    const signedIn = !!input.signedIn;

    const banners = records
      .filter(b => {
        if (!b.isActive) return false;
        if (b.currency && b.currency !== 'AED') return false;
        if (b.startDate && b.startDate > today) return false;
        if (b.endDate && b.endDate < today) return false;
        if (b.audience === 'Signed In' && !signedIn) return false;
        if (b.audience === 'New Visitors' && signedIn) return false;
        return !!b.desktopImage?.[0]?.url;
      })
      .sort((a, b) => (Number(a.displayOrder || 0) - Number(b.displayOrder || 0)) || a.id.localeCompare(b.id))
      .map(b => ({
        id: b.id,
        name: b.bannerName || '',
        type: b.bannerType || 'Hotel Deal',
        desktopImageUrl: b.desktopImage?.[0]?.url || '',
        mobileImageUrl: b.mobileImage?.[0]?.url || undefined,
        headline: b.headline || undefined,
        subheadline: b.subheadline || undefined,
        ctaLabel: b.ctaLabel || undefined,
        ctaUrl: b.ctaUrl || undefined,
        destination: b.destination || undefined,
        hotelId: Array.isArray(b.hotel) ? b.hotel[0] : b.hotel || undefined,
        displayOrder: Number(b.displayOrder || 0),
        altText: b.altText || undefined,
        imageCredit: b.imageCredit || undefined,
      }));

    return { banners };
  },
});
