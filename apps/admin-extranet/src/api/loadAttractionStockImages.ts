import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';

// Unsplash API guidelines: hotlink images.unsplash.com URLs (no re-hosting), trigger the
// download_location endpoint when a photo is used, and credit photographer + Unsplash.
const EMIRATE: Array<[RegExp, string]> = [
  [/yas|saadiyat|al maryah|abu dhabi|liwa|corniche|al ain|reem|hudayriat|al wathba/i, 'Abu Dhabi'],
  [/sharjah|khor fakkan|kalba|al heerah|al dhaid|mleiha/i, 'Sharjah'],
  [/dibba|east coast|fujairah|masafi|wadi wurayah|sandy beach|bull butting|wadi hail/i, 'Fujairah'],
  [/jebel jais|jabal jais|wadi shawka|al marjan|rak|dhayah|jazirat|mangroves|al hamra|al qawasim|pearl beach/i, 'Ras Al Khaimah'],
  [/ajman|manama|al zorah/i, 'Ajman'],
  [/uaq/i, 'Umm Al Quwain'],
];
const emirateOf = (city: string) => EMIRATE.find(([re]) => re.test(city))?.[1] || 'Dubai';
const headOf = (title: string) => title.split(/\s+[—–]\s+/)[0].replace(/\(.*?\)/g, '').replace(/\b(1-Day Pass|Day Pass|Full Day|Entry|Rental|\d+\s*(mins|hrs?|hours?))\b/gi, '').replace(/\s+/g, ' ').trim();

export default createEndpoint({
  authenticated: true,
  description: 'Loads hotlinked Unsplash cover images (with photographer credit) for attractions that have no cover image yet',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).default(40),
    attractionIds: z.array(z.string()).optional(),
    overwrite: z.boolean().default(false),
  }),
  outputSchema: z.object({
    loaded: z.array(z.object({ id: z.string(), title: z.string(), query: z.string(), credit: z.string() })),
    skipped: z.array(z.object({ id: z.string(), title: z.string(), reason: z.string() })),
    remainingWithoutImage: z.number(),
    rateLimitRemaining: z.number().nullable(),
  }),
  execute: async ({ input, context }) => {
    await requireAdmin(context, 'load attraction images');
    const key = process.env.ZITE_UNSPLASH_ACCESS_KEY;
    if (!key) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Add ZITE_UNSPLASH_ACCESS_KEY under Settings → Secrets first.' });
    const headers = { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' };

    const { records } = await zite.attractions.findAll({ limit: 1000 });
    const usedPhotoIds = new Set(records.map((r: any) => String(r.imageSourceUrl || '').match(/unsplash\.com\/photos\/([^?/]+)/)?.[1]).filter(Boolean) as string[]);
    const needs = (r: any) => input.overwrite || (!(Array.isArray(r.coverImage) && r.coverImage.length) && !r.coverImageUrl);
    let queue = records.filter((r: any) => r.status !== 'Archived' && needs(r));
    if (input.attractionIds?.length) queue = queue.filter((r: any) => input.attractionIds!.includes(r.id));
    queue = queue.slice(0, input.limit);

    const loaded: any[] = []; const skipped: any[] = []; let rateLimitRemaining: number | null = null;
    for (const a of queue as any[]) {
      if (rateLimitRemaining !== null && rateLimitRemaining < 3) { skipped.push({ id: a.id, title: a.title, reason: 'Hourly Unsplash limit reached — run again later' }); continue; }
      const head = headOf(String(a.title || ''));
      const queries = [`${head} ${emirateOf(String(a.city || ''))}`, head, `${a.category || ''} UAE`.trim()];
      let photo: any = null; let usedQuery = '';
      for (const q of queries) {
        const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&content_filter=high&per_page=15`, { headers });
        rateLimitRemaining = Number(res.headers.get('x-ratelimit-remaining') ?? NaN);
        if (Number.isNaN(rateLimitRemaining)) rateLimitRemaining = null;
        if (res.status === 401) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Unsplash rejected the access key.' });
        if (res.status === 403 || res.status === 429) { rateLimitRemaining = 0; break; }
        if (!res.ok) continue;
        const data: any = await res.json();
        photo = (data.results || []).find((p: any) => !usedPhotoIds.has(p.id) && p.width >= 1920 && p.width > p.height);
        if (photo) { usedQuery = q; break; }
      }
      if (!photo) { skipped.push({ id: a.id, title: a.title, reason: rateLimitRemaining === 0 ? 'Hourly Unsplash limit reached — run again later' : 'No suitable landscape photo found' }); continue; }
      usedPhotoIds.add(photo.id);
      // Required by Unsplash API guidelines when a photo is used.
      await fetch(photo.links.download_location, { headers }).catch(() => undefined);
      const credit = `Photo: ${photo.user?.name || 'Unknown'} on Unsplash`;
      await zite.attractions.update({ id: a.id, record: {
        coverImageUrl: `${photo.urls.raw}&w=1920&q=80&fm=jpg&fit=crop&ar=16:9`,
        imageCredit: credit,
        imageSourceUrl: `${photo.links.html}?utm_source=jobready_dmc&utm_medium=referral`,
      } as any });
      loaded.push({ id: a.id, title: a.title, query: usedQuery, credit });
    }
    const after = await zite.attractions.findAll({ limit: 1000 });
    const remainingWithoutImage = after.records.filter((r: any) => r.status !== 'Archived' && !(Array.isArray(r.coverImage) && r.coverImage.length) && !r.coverImageUrl).length;
    return { loaded, skipped, remainingWithoutImage, rateLimitRemaining };
  },
});
