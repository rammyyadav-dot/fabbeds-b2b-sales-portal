import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { enrichCurrentUser } from '../lib/currentUser';

const inputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(['Hero Banner', 'Hotel Deal', 'Destination Banner', 'Promo Strip']),
  desktopImageUrl: z.string().url(),
  mobileImageUrl: z.string().url().optional(),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  destination: z.enum(['UAE','Dubai','Abu Dhabi','Sharjah','Ras Al Khaimah','Fujairah','Ajman','Umm Al Quwain']).optional(),
  hotelId: z.string().optional(),
  displayOrder: z.number().int().min(0).max(999).default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean(),
  audience: z.enum(['All','Signed In','New Visitors']).default('All'),
  altText: z.string().optional(),
  imageCredit: z.string().optional(),
});

export default createEndpoint({
  authenticated: true,
  description: 'Creates or updates a scheduled fabBeds homepage campaign banner',
  inputSchema,
  outputSchema: z.object({ success: z.boolean(), id: z.string() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'saveHomepageBanner');
    await enrichCurrentUser(context);

    if (input.startDate && input.endDate && input.endDate < input.startDate) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'End date must be on or after start date.' });
    }

    const record = {
      bannerName: input.name,
      bannerType: input.type,
      desktopImage: [{ url: input.desktopImageUrl, filename: `${input.name}-desktop` }],
      mobileImage: input.mobileImageUrl ? [{ url: input.mobileImageUrl, filename: `${input.name}-mobile` }] : null,
      headline: input.headline || null,
      subheadline: input.subheadline || null,
      ctaLabel: input.ctaLabel || null,
      ctaUrl: input.ctaUrl || null,
      destination: input.destination || null,
      hotel: input.hotelId ? input.hotelId : null,
      displayOrder: input.displayOrder,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      isActive: input.isActive,
      audience: input.audience,
      currency: 'AED',
      altText: input.altText || null,
      imageCredit: input.imageCredit || null,
    } as any;

    // Only one active hero is allowed at a time. Activating a hero
    // automatically retires any other active hero banner.
    if (input.type === 'Hero Banner' && input.isActive) {
      const { records } = await zite.homepageCampaignBanners.findAll({
        filters: { bannerType: 'Hero Banner', isActive: true },
        limit: 50,
      });
      for (const existing of records) {
        if (!input.id || existing.id !== input.id) {
          await zite.homepageCampaignBanners.update({
            id: existing.id,
            record: { isActive: false } as any,
          });
        }
      }
    }

    if (input.id) {
      await zite.homepageCampaignBanners.update({ id: input.id, record });
      return { success: true, id: input.id };
    }

    const created = await zite.homepageCampaignBanners.create({ record });
    return { success: true, id: created.id };
  },
});
