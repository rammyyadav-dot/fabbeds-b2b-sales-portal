// Attraction margin engine (CTO audit B4). Pure functions shared by storefront pricing and the admin preview.
// Rate "Net Cost" = SUPPLIER COST. Agent price = supplier cost + markup from the single best-matching active rule.
export type MarkupRule = {
  id: string;
  ruleName?: string | null;
  status?: string | null;
  markupType?: string | null;      // 'Percent' | 'Fixed AED per pax'
  markupValue?: number | null;
  agencyTier?: string | null;
  partnerAccount?: unknown;        // linked id (string | string[])
  emirate?: string | null;
  productCategory?: string | null;
  ticketOption?: unknown;          // linked id (string | string[])
  market?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  priority?: number | null;
  updatedAt?: string | null;
};
export type MarkupContext = {
  partnerId?: string; tier?: string; emirate?: string; productCategory?: string;
  ticketOptionId?: string; market?: string; date?: string; // date = visit date (YYYY-MM-DD)
};
export type AppliedMarkup = {
  ruleId: string | null; ruleLabel: string; type: string; value: number;
  agentAdult: number; agentChild: number; markupAdult: number; markupChild: number;
};

const lid = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');
const money = (n: number) => Math.round(n * 100) / 100;
const MAX_PERCENT = 200;

/** Every scope field set on a rule must match; more specific matches win, then Priority, then the latest edit. */
export function selectMarkupRule(rules: MarkupRule[], ctx: MarkupContext): MarkupRule | null {
  const day = String(ctx.date || '').slice(0, 10);
  let best: { r: MarkupRule; score: number } | null = null;
  for (const r of rules) {
    if (r.status !== 'Active') continue;
    let score = 0;
    const partner = lid(r.partnerAccount), ticket = lid(r.ticketOption);
    if (partner) { if (partner !== ctx.partnerId) continue; score += 32; }
    if (ticket) { if (ticket !== ctx.ticketOptionId) continue; score += 16; }
    if (r.agencyTier) { if (r.agencyTier !== (ctx.tier || 'Standard')) continue; score += 8; }
    if (r.productCategory) { if (r.productCategory !== ctx.productCategory) continue; score += 4; }
    if (r.emirate) { if (r.emirate !== ctx.emirate) continue; score += 2; }
    if (r.market) { if (String(r.market).toUpperCase() !== String(ctx.market || '').toUpperCase()) continue; score += 1; }
    if (r.validFrom && day && day < String(r.validFrom).slice(0, 10)) continue;
    if (r.validTo && day && day > String(r.validTo).slice(0, 10)) continue;
    if (!best || score > best.score ||
        (score === best.score && Number(r.priority || 0) > Number(best.r.priority || 0)) ||
        (score === best.score && Number(r.priority || 0) === Number(best.r.priority || 0) && String(r.updatedAt || '') > String(best.r.updatedAt || ''))) {
      best = { r, score };
    }
  }
  return best?.r ?? null;
}

export function validateMarkup(type: string, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error('Markup must be zero or positive (agent price can never be below supplier cost).');
  if (type === 'Percent' && value > MAX_PERCENT) throw new Error(`Percent markup cannot exceed ${MAX_PERCENT}%.`);
  if (type !== 'Percent' && type !== 'Fixed AED per pax') throw new Error('Markup type must be Percent or Fixed AED per pax.');
}

/** Applies a rule per pax. A band with zero cost (not sold) stays zero. */
export function applyMarkup(costAdult: number, costChild: number, rule: MarkupRule | null): AppliedMarkup {
  const type = rule?.markupType === 'Fixed AED per pax' ? 'Fixed AED per pax' : 'Percent';
  const value = Math.max(0, Number(rule?.markupValue || 0));
  const add = (cost: number) => cost <= 0 ? 0 : money(type === 'Percent' ? cost * Math.min(value, MAX_PERCENT) / 100 : value);
  const markupAdult = add(costAdult), markupChild = add(costChild);
  return {
    ruleId: rule?.id || null,
    ruleLabel: rule ? `${rule.ruleName || 'Markup rule'} (${type === 'Percent' ? value + '%' : 'AED ' + value + '/pax'})` : 'No rule (0%)',
    type, value,
    agentAdult: money(costAdult + markupAdult), agentChild: money(costChild + markupChild),
    markupAdult, markupChild,
  };
}
