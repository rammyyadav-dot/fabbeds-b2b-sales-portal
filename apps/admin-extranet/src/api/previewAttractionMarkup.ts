import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';
import { selectMarkupRule, applyMarkup } from '../../../../shared/attractionMarkup';

const lid = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');
const layerRank: Record<string, number> = { OVERRIDE: 4, PROMO: 3, BASE: 2, FALLBACK: 1 };

export default createEndpoint({
  authenticated: true,
  description: 'Shows supplier cost, winning markup rule, agent price, RRP and both margins for one SKU / agency / date',
  inputSchema: z.object({
    ticketOptionId: z.string(), partnerAccountId: z.string().optional(), agencyTier: z.string().optional(),
    date: z.string(), market: z.string().optional(),
    costAdult: z.number().min(0).optional(), costChild: z.number().min(0).optional(),
  }),
  outputSchema: z.object({
    rateFound: z.boolean(), costAdult: z.number(), costChild: z.number(), retailAdult: z.number(), retailChild: z.number(),
    ruleId: z.string().nullable(), ruleLabel: z.string(), agentAdult: z.number(), agentChild: z.number(),
    markupAdult: z.number(), markupChild: z.number(), ourMarginPct: z.number().nullable(), agentMarginAdult: z.number().nullable(),
    warnings: z.array(z.string()),
  }),
  execute: async ({ input, context }) => {
    await requireAdmin(context, 'preview markup');
    const ticket: any = await zite.ticketOptions.findOne({ id: input.ticketOptionId });
    if (!ticket) throw new ZiteError({ code: 'NOT_FOUND', message: 'SKU not found.' });
    const attraction: any = await zite.attractions.findOne({ id: lid(ticket.attraction) });
    const { records } = await zite.attractionRates.findAll({ filters: { ticketOption: input.ticketOptionId, date: input.date }, limit: 200 });
    const rate: any = (records as any[]).filter(r => !r.stopSale && (Number(r.netCostAdult) > 0 || Number(r.netCostChild) > 0))
      .sort((a, b) => (layerRank[b.rateLayer || 'BASE'] || 0) - (layerRank[a.rateLayer || 'BASE'] || 0) || Number(b.priority || 0) - Number(a.priority || 0))[0];
    const costAdult = input.costAdult ?? Number(rate?.netCostAdult || 0), costChild = input.costChild ?? Number(rate?.netCostChild || 0);
    const retailAdult = Number(rate?.retailAdult || 0), retailChild = Number(rate?.retailChild || 0);
    let tier = input.agencyTier;
    if (input.partnerAccountId) { const p: any = await zite.partnerAccounts.findOne({ id: input.partnerAccountId }); tier = p?.agencyTier || 'Standard'; }
    const z_: any = zite;
    const rules = (await z_.attractionMarkupRules.findAll({ filters: { status: 'Active' }, limit: 1000 })).records;
    const rule = selectMarkupRule(rules, { partnerId: input.partnerAccountId, tier: tier || 'Standard', emirate: attraction?.emirate, productCategory: attraction?.productCategory, ticketOptionId: ticket.id, market: input.market, date: input.date });
    const m = applyMarkup(costAdult, costChild, rule);
    const warnings: string[] = [];
    if (!rate && input.costAdult === undefined) warnings.push('No published rate on this date — enter a cost to simulate.');
    if (retailAdult > 0 && m.agentAdult > retailAdult) warnings.push(`Agent adult price AED ${m.agentAdult} is above RRP AED ${retailAdult}: agents would sell at a loss.`);
    if (retailAdult <= 0 && costAdult > 0) warnings.push('RRP not set on this rate.');
    if (!rule) warnings.push('No active rule matches — agent price equals supplier cost.');
    return {
      rateFound: !!rate, costAdult, costChild, retailAdult, retailChild, ruleId: m.ruleId, ruleLabel: m.ruleLabel,
      agentAdult: m.agentAdult, agentChild: m.agentChild, markupAdult: m.markupAdult, markupChild: m.markupChild,
      ourMarginPct: m.agentAdult > 0 ? Math.round(m.markupAdult / m.agentAdult * 1000) / 10 : null,
      agentMarginAdult: retailAdult > 0 ? Math.round((retailAdult - m.agentAdult) * 100) / 100 : null,
      warnings,
    };
  },
});
