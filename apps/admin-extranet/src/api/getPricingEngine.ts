import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import {
  applyMarkup,
  markupAmountForNet,
  resolveEffectiveRate,
  resolveMarkupRule,
  resolveOccupancyBaseRate,
  safeNum,
  isSupportedAedRate,
  linkedId,
  validateStayRestrictions,
} from '@project/pricing/hotelPricing';

const roundAED = (n: number) => Math.round(n);

function getDates(checkin: string, checkout: string): string[] {
  const dates: string[] = [];
  const start = new Date(checkin), end = new Date(checkout);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1))
    dates.push(d.toISOString().split('T')[0]);
  return dates;
}

const nightSchema = z.object({
  date: z.string(),
  netRate: z.number(),
  netSource: z.string(),
  rateLayer: z.string().optional(),
  markupRuleName: z.string().optional(),
  markupType: z.string().optional(),
  markupValue: z.number().optional(),
  markupAmount: z.number(),
  maxCapApplied: z.boolean(),
  floorApplied: z.boolean(),
  sellRate: z.number(),
  margin: z.number(),
  marginPct: z.number(),
  availabilityStatus: z.string(),
});

export default createEndpoint({
  authenticated: true,
  description: 'Transparent per-night pricing engine breakdown: net → markup → floor → sell',
  inputSchema: z.object({
    hotelId: z.string(),
    roomTypeId: z.string(),
    checkinDate: z.string(),
    checkoutDate: z.string(),
    adults: z.number(),
    children: z.number().optional(),
    ratePlanId: z.string().optional(),
    minimumMarginFloor: z.number().optional(),
  }),
  outputSchema: z.object({
    nights: z.number(),
    adults: z.number(),
    children: z.number(),
    availabilityStatus: z.string(),
    hasRates: z.boolean(),
    pricingErrors: z.array(z.string()),
    blockedDates: z.array(z.string()),
    perNightBreakdown: z.array(nightSchema),
    appliedRules: z.array(z.object({
      ruleName: z.string().optional(),
      markupType: z.string().optional(),
      markupValue: z.number().optional(),
      maxMarkupValue: z.number().optional(),
      appliesTo: z.string().optional(),
      ruleCategory: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      nightsApplied: z.number(),
    })),
    summary: z.object({
      totalNet: z.number(),
      totalSell: z.number(),
      totalMargin: z.number(),
      avgMarginPct: z.number(),
      avgNetPerNight: z.number(),
      avgSellPerNight: z.number(),
    }).optional(),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getPricingEngine');
    const dates = getDates(input.checkinDate, input.checkoutDate);
    const nights = dates.length;
    const adults = input.adults;
    const children = input.children ?? 0;
    const floor = input.minimumMarginFloor ?? 0;
    const pricingErrors: string[] = [];

    if (nights === 0) return { nights: 0, adults, children, availabilityStatus: 'Error', hasRates: false, pricingErrors: ['Invalid date range'], blockedDates: [], perNightBreakdown: [], appliedRules: [] };

    const [dailyRes, markupRes, blackoutRes, ratePlansRes] = await Promise.all([
      zite.dailyRates.findAll({ filters: { hotel: { contains: input.hotelId }, roomType: { contains: input.roomTypeId }, rateDate: { gte: new Date(input.checkinDate), lt: new Date(input.checkoutDate) } }, limit: 500 }),
      zite.markupRules.findAll({ filters: { isActive: true }, limit: 500 }),
      zite.blackoutDates.findAll({ filters: { hotel: { contains: input.hotelId } }, limit: 200 }),
      zite.ratePlans.findAll({ filters: { hotel: { contains: input.hotelId }, roomType: { contains: input.roomTypeId } }, limit: 500 }),
    ]);

    // Blackout detection
    const blockedDates: string[] = [];
    for (const b of blackoutRes.records) {
      const bRoom = Array.isArray(b.roomType) ? b.roomType[0] : b.roomType;
      if (bRoom && bRoom !== input.roomTypeId) continue;
      for (const date of dates) {
        if (b.startDate && date < b.startDate) continue;
        if (b.endDate && date > b.endDate) continue;
        if (!blockedDates.includes(date)) blockedDates.push(date);
      }
    }

    const activePlanById = new Map(
      ratePlansRes.records
        .filter(p => p.status === 'Active' && linkedId(p.hotel) === input.hotelId && linkedId(p.roomType) === input.roomTypeId)
        .map(p => [p.id, p])
    );

    // Group only valid, exact Daily Rates by date. Legacy NetRate fallback is deliberately excluded.
    const ratesByDate = new Map<string, typeof dailyRes.records>();
    for (const r of dailyRes.records) {
      if (r.integrityStatus === 'Quarantined') continue;
      const planId = linkedId(r.ratePlan);
      const plan = planId ? activePlanById.get(planId) : undefined;
      if (!plan) continue;
      if (input.ratePlanId && planId !== input.ratePlanId) continue;
      if (r.ratePlanId && r.ratePlanId !== planId) continue;
      if (!isSupportedAedRate(r.currency, plan.sellCurrency)) continue;
      const date = String(r.rateDate ?? '').split('T')[0];
      if (!date) continue;
      const bucket = ratesByDate.get(date) || [];
      bucket.push(r);
      ratesByDate.set(date, bucket);
    }

    if (!markupRes.records.length) pricingErrors.push('No active markup rules — rates are shown at net cost.');

    const perNightBreakdown: z.infer<typeof nightSchema>[] = [];
    const ruleUsageMap = new Map<string, number>();

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      if (blockedDates.includes(date)) continue;

      const best = resolveEffectiveRate(ratesByDate.get(date) ?? []);
      let netBase = 0, netSource = 'None', rateLayer: string | undefined;
      let availabilityStatus = 'No Rate';

      if (best) {
        const planId = linkedId(best.ratePlan);
        const plan = planId ? activePlanById.get(planId) : undefined;
        const restrictionErrors = validateStayRestrictions({
          requestedNights: nights,
          checkIn: input.checkinDate,
          checkOut: input.checkoutDate,
          ratePlanMinStay: plan?.minStayNights,
          ratePlanMaxStay: plan?.maxStayNights,
          dailyMinStay: best.minStay,
          dailyMaxStay: best.maxStay,
          cta: date === input.checkinDate && safeNum(best.cta) > 0,
          ctd: i === dates.length - 1 && safeNum(best.ctd) > 0,
          leadDays: best.leadDays,
          status: best.status,
        });
        if (!restrictionErrors.length && best.status !== 'Stop Sale' && safeNum(best.allocation) > 0) {
          const occupancy = resolveOccupancyBaseRate({
            adults,
            adult1Rate: best.adult1Rate,
            adult2Rate: best.adult2Rate,
            adult3Rate: best.adult3Rate,
            extraBedRate: best.extraBedRate,
          });
          netBase = occupancy.baseRate + occupancy.extraBedTotal;
          netSource = 'DailyRates';
          rateLayer = best.layer ?? undefined;
          availabilityStatus = best.status || 'Free Sale';
        } else {
          pricingErrors.push(`${date}: ${restrictionErrors.join(' | ') || 'Not sellable'}`);
        }
      }

      const childCost = children > 0 && best ? safeNum(best.childSupplement) * children : 0;
      const netNight = netBase + childCost;
      const rule = resolveMarkupRule(input.hotelId, markupRes.records, date);
      const ruleKey = rule?.ruleName ?? '__none__';
      ruleUsageMap.set(ruleKey, (ruleUsageMap.get(ruleKey) ?? 0) + 1);

      const markup = markupAmountForNet(netNight, rule);
      const uncappedMarkup = rule?.markupType === 'Percentage (%)'
        ? netNight * (Math.abs(safeNum(rule.markupValue)) / 100)
        : Math.abs(safeNum(rule?.markupValue));
      const maxCapApplied = safeNum(rule?.maxMarkupValue) > 0 && uncappedMarkup > safeNum(rule?.maxMarkupValue);

      let sell = applyMarkup(netNight, rule);
      let floorApplied = false;
      if (netNight > 0 && sell - netNight < floor) {
        sell = netNight + floor;
        floorApplied = true;
      }
      sell = roundAED(sell);
      const margin = sell - roundAED(netNight);
      const marginPct = netNight > 0 ? Math.round((margin / netNight) * 100 * 10) / 10 : 0;

      perNightBreakdown.push({
        date, netRate: roundAED(netNight), netSource, rateLayer,
        markupRuleName: rule?.ruleName, markupType: rule?.markupType, markupValue: rule?.markupValue,
        markupAmount: roundAED(markup), maxCapApplied, floorApplied, sellRate: sell, margin, marginPct,
        availabilityStatus,
      });
    }

    const validNights = perNightBreakdown.filter(n => n.netSource !== 'None');
    if (!validNights.length) return { nights, adults, children, availabilityStatus: 'No Rates', hasRates: false, pricingErrors, blockedDates, perNightBreakdown, appliedRules: [] };

    const totalNet = validNights.reduce((s, n) => s + n.netRate, 0);
    const totalSell = validNights.reduce((s, n) => s + n.sellRate, 0);
    const totalMargin = totalSell - totalNet;
    const avgMarginPct = Math.round((totalMargin / totalNet) * 100 * 10) / 10;

    const appliedRules = markupRes.records
      .filter(r => ruleUsageMap.has(r.ruleName ?? ''))
      .map(r => ({
        ruleName: r.ruleName, markupType: r.markupType, markupValue: r.markupValue,
        maxMarkupValue: r.maxMarkupValue, appliesTo: r.appliesTo, ruleCategory: r.ruleCategory,
        startDate: r.startDate, endDate: r.endDate,
        nightsApplied: ruleUsageMap.get(r.ruleName ?? '') ?? 0,
      }));

    let availabilityStatus = 'Free Sale';
    for (const n of perNightBreakdown) {
      if (n.availabilityStatus === 'Stop Sale') { availabilityStatus = 'Stop Sale'; break; }
      if (n.availabilityStatus === 'On Request' && availabilityStatus === 'Free Sale') availabilityStatus = 'On Request';
      if (n.availabilityStatus === 'Limited' && availabilityStatus === 'Free Sale') availabilityStatus = 'Limited';
    }

    return {
      nights, adults, children, availabilityStatus, hasRates: true, pricingErrors, blockedDates, perNightBreakdown, appliedRules,
      summary: {
        totalNet: roundAED(totalNet), totalSell: roundAED(totalSell), totalMargin: roundAED(totalMargin),
        avgMarginPct, avgNetPerNight: roundAED(totalNet / validNights.length), avgSellPerNight: roundAED(totalSell / validNights.length),
      },
    };
  },
});
