import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';

const lid = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');
const opt = z.string().nullable();

export default createEndpoint({
  authenticated: true,
  description: 'Markup rules, agency tiers, SKU list and margin summary for the attraction margin workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({
    rules: z.array(z.object({
      id: z.string(), ruleName: z.string(), status: z.string(), markupType: z.string(), markupValue: z.number(),
      agencyTier: opt, partnerAccountId: opt, emirate: opt, productCategory: opt, ticketOptionId: opt,
      market: opt, validFrom: opt, validTo: opt, priority: z.number(), notes: z.string(), updatedBy: z.string(), updatedAt: opt,
    })),
    partners: z.array(z.object({ id: z.string(), agencyName: z.string(), agencyEmail: z.string(), agencyTier: z.string(), accountStatus: z.string() })),
    tickets: z.array(z.object({ id: z.string(), label: z.string(), skuCode: z.string() })),
    margin: z.object({
      bookings: z.number(), supplierCost: z.number(), sell: z.number(), markup: z.number(), marginPct: z.number().nullable(),
      recent: z.array(z.object({ reference: z.string(), attraction: z.string(), date: z.string(), cost: z.number(), sell: z.number(), markup: z.number(), rule: z.string(), status: z.string() })),
    }),
  }),
  execute: async ({ context }) => {
    await requireAdmin(context, 'view markup rules');
    const z_: any = zite;
    const [rules, partners, tickets, attractions, bookings] = await Promise.all([
      z_.attractionMarkupRules.findAll({ limit: 1000 }),
      zite.partnerAccounts.findAll({ limit: 1000 }),
      zite.ticketOptions.findAll({ limit: 2000 }),
      zite.attractions.findAll({ limit: 1000 }),
      zite.attractionBookings.findAll({ limit: 2000 }),
    ]);
    const titleOf = new Map((attractions.records as any[]).map(a => [a.id, String(a.title || '')]));
    const live = (bookings.records as any[]).filter(b => !['Cancelled', 'Rejected'].includes(String(b.reservationStatus || b.bookingStatus || '')));
    const sum = (f: (b: any) => number) => Math.round(live.reduce((s, b) => s + f(b), 0) * 100) / 100;
    const cost = sum(b => Number(b.totalNetCost || 0)), sell = sum(b => Number(b.totalSellPrice || 0));
    const markup = Math.round((sell - cost) * 100) / 100;
    return {
      rules: (rules.records as any[]).map(r => ({
        id: r.id, ruleName: String(r.ruleName || ''), status: String(r.status || 'Inactive'), markupType: String(r.markupType || 'Percent'),
        markupValue: Number(r.markupValue || 0), agencyTier: r.agencyTier || null, partnerAccountId: lid(r.partnerAccount) || null,
        emirate: r.emirate || null, productCategory: r.productCategory || null, ticketOptionId: lid(r.ticketOption) || null,
        market: r.market || null, validFrom: r.validFrom ? String(r.validFrom).slice(0, 10) : null, validTo: r.validTo ? String(r.validTo).slice(0, 10) : null,
        priority: Number(r.priority || 0), notes: String(r.notes || ''), updatedBy: String(r.updatedBy || ''), updatedAt: r.updatedAt ? String(r.updatedAt) : null,
      })).sort((a, b) => (a.status === b.status ? b.priority - a.priority : a.status === 'Active' ? -1 : 1)),
      partners: (partners.records as any[]).map(p => ({ id: p.id, agencyName: String(p.agencyName || p.agencyEmail || ''), agencyEmail: String(p.agencyEmail || ''), agencyTier: String(p.agencyTier || 'Standard'), accountStatus: String(p.accountStatus || '') })),
      tickets: (tickets.records as any[]).filter(t => t.status === 'Active').map(t => ({ id: t.id, skuCode: String(t.skuCode || ''), label: `${titleOf.get(lid(t.attraction)) || 'Attraction'} — ${t.name || ''}` })).sort((a, b) => a.label.localeCompare(b.label)),
      margin: {
        bookings: live.length, supplierCost: cost, sell, markup, marginPct: sell > 0 ? Math.round(markup / sell * 1000) / 10 : null,
        recent: live.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 10).map(b => ({
          reference: String(b.bookingReference || ''), attraction: String(b.attractionName || ''), date: String(b.targetDate || '').slice(0, 10),
          cost: Number(b.totalNetCost || 0), sell: Number(b.totalSellPrice || 0), markup: Math.round((Number(b.totalSellPrice || 0) - Number(b.totalNetCost || 0)) * 100) / 100,
          rule: String(b.markupRuleSnapshot || 'Before margin engine'), status: String(b.reservationStatus || b.bookingStatus || ''),
        })),
      },
    };
  },
});
