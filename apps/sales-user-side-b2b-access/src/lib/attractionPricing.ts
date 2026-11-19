import {allAttractionRecords} from './allAttractionRecords';
import { zite } from 'zitejs/db';
import {commercialRates,commercialId} from './attractionCommercial';
import { loadMarkupRules, partnerTier, agentPrice } from './attractionMarkup';

export type AttractionQuote = {
  attractionId: string;
  attractionName: string;
  ticketOptionId: string;
  ticketOptionName: string;
  sku: string;
  date: string;
  slot: string;
  adultCount: number;
  childCount: number;
  rateId: string;
  ratePlanId: string;
  ratePlanName: string;
  inclusions: string;
  restrictions: string;
  netAdult: number;
  netChild: number;
  retailAdult: number;
  retailChild: number;
  netTotal: number;
  retailTotal: number;
  currency: 'AED';
  remaining: number | null;
  inventoryStatus: string;
  instantConfirmation: boolean;
  cancellation: string;
  expiresAt: string;
  offerId: string;
  // Server-only margin fields (never returned to agents):
  supplierAdult: number;
  supplierChild: number;
  supplierCostTotal: number;
  markupTotal: number;
  markupRuleId: string | null;
  markupRuleLabel: string;
};

function linkedId(v: unknown): string {
  return Array.isArray(v) ? String(v[0] || '') : String(v || '');
}

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dateOnly(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.slice(0, 10);
}

export async function buildAttractionQuote(input: {
  ticketOptionId: string;
  date: string;
  slot?: string;
  adultCount: number;
  childCount: number;
  excludeHoldId?: string;
  rateId?: string;
  market?: string;
  promoCode?: string;
  partnerId?: string;
}): Promise<AttractionQuote> {
  const ticket = await zite.ticketOptions.findOne({ id: input.ticketOptionId }) as any;
  if (!ticket || ticket.status === 'Inactive') throw new Error('Ticket option is not active.');

  const attractionId = linkedId(ticket.attraction);
  const attraction = attractionId ? await zite.attractions.findOne({ id: attractionId }) as any : null;
  if (!attraction || attraction.status !== 'Active') throw new Error('Attraction is not active.');

  const pax = Math.max(0, input.adultCount) + Math.max(0, input.childCount);
  const minPax = Math.max(1, safeNumber(ticket.minPax || 1));
  const maxPax = Math.max(minPax, safeNumber(ticket.maxPax || 99));
  if (pax < minPax || pax > maxPax) throw new Error(`Pax must be between ${minPax} and ${maxPax}.`);

  if (!input.date) throw new Error('Visit date is required.');
  if (ticket.requiresSlot && !input.slot) throw new Error('Time slot is required for this ticket.');

  const { records } = await allAttractionRecords(zite.attractionRates,{
    filters: { ticketOption: input.ticketOptionId, date:input.date },
    limit: 1000,
  });

  const published=await commercialRates(records,input);
  const candidates = published.filter((r: any) => {
    if(input.rateId&&r.id!==input.rateId)return false;
    if (dateOnly(r.date) !== input.date) return false;
    if (r.stopSale) return false;
    if (r.currency && r.currency !== 'AED') return false;
    if (r.inventoryStatus === 'Sold Out') return false;
    if (ticket.requiresSlot && String(r.slotTime || '') !== String(input.slot || '')) return false;
    return true;
  }) as any[];

  if (!candidates.length) throw new Error('No valid rate is available for the selected date/slot.');

  const layerRank: Record<string, number> = { OVERRIDE: 4, PROMO: 3, BASE: 2, FALLBACK: 1 };
  const rate = candidates
    .filter(r => safeNumber(r.netCostAdult) > 0 || safeNumber(r.netCostChild) > 0)
    .sort((a, b) => {
      const layerDiff = (layerRank[String(b.rateLayer || 'BASE')] || 0) - (layerRank[String(a.rateLayer || 'BASE')] || 0);
      if (layerDiff) return layerDiff;
      const priorityDiff = safeNumber(b.priority) - safeNumber(a.priority);
      if (priorityDiff) return priorityDiff;
      return safeNumber(b.rateId) - safeNumber(a.rateId);
    })[0];

  if (!rate) throw new Error('No positive AED rate is available.');

  const visitStart = new Date(input.date + 'T00:00:00Z').getTime();
  const cutoffHours = Math.max(0, safeNumber(rate.bookingCutoffHours));
  if (Date.now() > visitStart - cutoffHours * 3600000) throw new Error('Booking cutoff has passed.');

  const adultCount = Math.max(0, input.adultCount);
  const childCount = Math.max(0, input.childCount);
  // B4: rate Net Cost = supplier cost; agent net = cost + best-matching markup rule.
  const supplierAdult = safeNumber(rate.netCostAdult);
  const supplierChild = safeNumber(rate.netCostChild);
  const markup = agentPrice(await loadMarkupRules(), {
    partnerId: input.partnerId, tier: await partnerTier(input.partnerId),
    emirate: attraction.emirate || undefined, productCategory: attraction.productCategory || undefined,
    ticketOptionId: ticket.id, market: input.market, date: input.date,
  }, supplierAdult, supplierChild);
  const netAdult = markup.agentAdult;
  const netChild = markup.agentChild;
  const retailAdult = safeNumber(rate.retailAdult);
  const retailChild = safeNumber(rate.retailChild);

  if (adultCount > 0 && netAdult <= 0) throw new Error('Adult rate is unavailable.');
  if (childCount > 0 && netChild <= 0) throw new Error('Child rate is unavailable.');

  const totalCapacity = safeNumber(rate.totalCapacity);
  const soldCount = safeNumber(rate.soldCount);

  let activeHeldPax = 0;
  if (totalCapacity > 0) {
    const now = Date.now();
    const holds = await allAttractionRecords(zite.attractionInventoryHolds,{
      filters: { attractionRate: rate.id },
      limit: 1000,
    });
    for (const raw of holds.records as any[]) {
      const hold = raw as any;
      if (input.excludeHoldId && hold.id === input.excludeHoldId) continue;
      if (hold.status !== 'ACTIVE') continue;
      const expiry = new Date(hold.expiresAt || 0).getTime();
      if (expiry > now) activeHeldPax += Math.max(0, safeNumber(hold.heldPax));
    }
  }

  const remaining = totalCapacity > 0 ? Math.max(0, totalCapacity - soldCount - activeHeldPax) : null;
  if (remaining !== null && pax > remaining) throw new Error('Insufficient ticket allocation after active checkout holds.');

  const netTotal = Number((netAdult * adultCount + netChild * childCount).toFixed(2));
  const supplierCostTotal = Number((supplierAdult * adultCount + supplierChild * childCount).toFixed(2));
  const markupTotal = Number((netTotal - supplierCostTotal).toFixed(2));
  if (netTotal <= 0) throw new Error('Calculated B2B amount is invalid.');
  const retailTotal = Number(((retailAdult || netAdult) * adultCount + (retailChild || netChild) * childCount).toFixed(2));

  const plan=rate.commercialPlan;
  const mealId=linkedId(ticket.mealPlan);
  const meal=mealId?await zite.attractionMealPlans.findOne({id:mealId}):null;
  const mealInclusions=meal?.status==='Active'&&linkedId(meal.attraction)===attractionId?[meal.mealName,meal.inclusions].filter(Boolean).join(': '):'';
  const cancellation = plan?.cancellationPolicy || ticket.cancellationRule || attraction.cancellationPolicy || 'As per supplier policy';
  const instantConfirmation =
    !!attraction.instantConfirmation &&
    !!ticket.instantConfirmationEligible &&
    rate.inventoryStatus === 'Available' &&
    remaining !== 0;

  const inclusions=[plan?.inclusions||ticket.inclusions||'',mealInclusions].filter(Boolean).join(' · ');
  const terms=JSON.stringify({plan:commercialId(rate.ratePlan),cancellation,inclusions,restrictions:plan?.restrictions||''});
  const digest=(plan||mealId)?await crypto.subtle.digest('SHA-256',new TextEncoder().encode(terms)):null;
  const termsHash=digest?Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,16):'';
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const offerId = [
    'ATT',
    rate.id,
    input.date,
    String(input.slot || 'OPEN').replace(/[^A-Za-z0-9]/g, ''),
    adultCount,
    childCount,
    Math.round(netTotal * 100),
    ...(termsHash?[termsHash]:[]),
  ].join('-');

  return {
    attractionId,
    attractionName: attraction.title || '',
    ticketOptionId: ticket.id,
    ticketOptionName: ticket.name || '',
    sku: ticket.skuCode || '',
    date: input.date,
    slot: input.slot || '',
    adultCount,
    childCount,
    rateId: rate.id,
    ratePlanId:commercialId(rate.ratePlan),
    ratePlanName:plan?.planName||'Standard',
    inclusions,
    restrictions:plan?.restrictions||'',
    netAdult,
    netChild,
    retailAdult: retailAdult || netAdult,
    retailChild: retailChild || netChild,
    netTotal,
    retailTotal,
    currency: 'AED',
    remaining,
    inventoryStatus: rate.inventoryStatus || 'Available',
    instantConfirmation,
    cancellation,
    expiresAt,
    offerId,
    supplierAdult,
    supplierChild,
    supplierCostTotal,
    markupTotal,
    markupRuleId: markup.ruleId,
    markupRuleLabel: markup.ruleLabel,
  };
}
