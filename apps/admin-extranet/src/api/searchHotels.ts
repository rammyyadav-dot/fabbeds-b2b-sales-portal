import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import {
  applyMarkup,
  isCanonicalMealPlan,
  isSupportedAedRate,
  linkedId,
  resolveEffectiveRate,
  resolveMarkupRule,
  resolveOccupancyBaseRate,
  resolveInventoryGovernance,
  safeNum,
  validateAllocation,
  validateStayRestrictions,
  type MarkupRuleLike,
} from '@project/pricing/hotelPricing';
import { inventoryKey, loadInventoryConsumption, remainingAllocation, type InventoryConsumption } from '@project/pricing/inventoryLedger';

// ── Helpers ───────────────────────────────────────────────────────────────────

const roundAED = (n: number) => Math.round(n);

/** Generate array of YYYY-MM-DD strings for [checkin, checkout) */
function getDatesInRange(checkin: string, checkout: string): string[] {
  const dates: string[] = [];
  const end = new Date(checkout);
  for (let d = new Date(checkin); d < end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

type DailyRateRec = {
  id: string;
  rateDate?: Date | string | null;
  roomType?: string | string[] | null;
  ratePlanId?: string | null;
  mealPlan?: string | null;
  adult1Rate?: number | null;
  adult2Rate?: number | null;
  adult3Rate?: number | null;
  childSupplement?: number | null;
  extraBedRate?: number | null;
  allocation?: number | null;
  minStay?: number | null;
  maxStay?: number | null;
  cta?: number | null;
  ctd?: number | null;
  leadDays?: number | null;
  allocationType?: string | null;
  releaseDay?: number | null;
  releaseHourUtc?: number | null;
  releaseAction?: string | null;
  overbookingAllowance?: number | null;
  currency?: string | null;
  status?: string | null;
  layer?: string | null;
  priority?: number | null;
  updatedAt?: string | Date | null;
};

const avg = (vals: (number | undefined | null)[]): number | undefined => {
  const v = vals.filter((x): x is number => x != null && x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
};

function getFrontDisplayPrice(args: {
  dates: string[];
  ratesByDate: Map<string, DailyRateRec>;
  adults: number;
  children: number;
  rooms: number;
  hotelId: string;
  markupRules: MarkupRuleLike[];
  ratePlanMinStay?: number | null;
  ratePlanMaxStay?: number | null;
  roomTypeId:string;
  ratePlanId:string;
  inventoryConsumption:Map<string,InventoryConsumption>;
}): { sellRate: number | undefined; availabilityStatus: string; ratedNights: number } {
  let sumSell = 0;
  let ratedNights = 0;
  let availabilityStatus = 'Free Sale';
  const requestedNights = args.dates.length;
  const checkIn = args.dates[0] || '';
  const checkOutDate = new Date((args.dates[args.dates.length - 1] || checkIn) + 'T00:00:00Z');
  checkOutDate.setUTCDate(checkOutDate.getUTCDate() + 1);
  const checkOut = checkOutDate.toISOString().slice(0, 10);
  const departureRate = args.ratesByDate.get(checkOut);
  if (departureRate?.ctd && safeNum(departureRate.ctd) > 0) {
    return { sellRate: undefined, availabilityStatus: 'Unavailable', ratedNights: 0 };
  }

  for (let i = 0; i < args.dates.length; i++) {
    const date = args.dates[i];
    const r = args.ratesByDate.get(date);
    if (!r) return { sellRate: undefined, availabilityStatus: 'No Rate', ratedNights };

    const governance=resolveInventoryGovernance({rate:r,stayDate:date,checkIn,checkOut});
    const restrictionErrors = validateStayRestrictions({
      requestedNights,
      checkIn,
      checkOut,
      ratePlanMinStay: args.ratePlanMinStay,
      ratePlanMaxStay: args.ratePlanMaxStay,
      dailyMinStay: r.minStay,
      dailyMaxStay: r.maxStay,
      cta: i === 0 && safeNum(r.cta) > 0,
      ctd: i === args.dates.length - 1 && safeNum(r.ctd) > 0,
      leadDays: r.leadDays,
      status: governance.effectiveStatus,
    });
    const remaining=remainingAllocation({
      allocation:governance.governedAllocation,status:governance.effectiveStatus,
      overbookingAllowance:governance.overbookingAllowance,
      consumed:args.inventoryConsumption.get(inventoryKey(args.hotelId,args.roomTypeId,args.ratePlanId,date)),
    });
    const allocationErrors = validateAllocation({
      status: governance.effectiveStatus,
      allocation: remaining,
      requestedRooms: args.rooms,
      allowOnRequest: false,
    });
    if (restrictionErrors.length || allocationErrors.length) {
      availabilityStatus = governance.effectiveStatus === 'On Request' ? 'On Request' : governance.effectiveStatus === 'Stop Sale' ? 'Stop Sale' : 'Unavailable';
      return { sellRate: undefined, availabilityStatus, ratedNights };
    }

    if (governance.effectiveStatus === 'Limited' && availabilityStatus === 'Free Sale') availabilityStatus = 'Limited';

    const occupancy = resolveOccupancyBaseRate({
      adults: args.adults,
      adult1Rate: r.adult1Rate,
      adult2Rate: r.adult2Rate,
      adult3Rate: r.adult3Rate,
      extraBedRate: r.extraBedRate,
    });
    if (occupancy.baseRate <= 0) return { sellRate: undefined, availabilityStatus: 'No Rate', ratedNights };

    const childCost = args.children > 0 ? safeNum(r.childSupplement) * args.children : 0;
    const netNight = occupancy.baseRate + occupancy.extraBedTotal + childCost;
    const dateRule = resolveMarkupRule(args.hotelId, args.markupRules, date);
    sumSell += applyMarkup(netNight, dateRule);
    ratedNights++;
  }

  return {
    sellRate: ratedNights === requestedNights && requestedNights > 0 ? roundAED(sumSell / requestedNights) : undefined,
    availabilityStatus,
    ratedNights,
  };
}

// ── Endpoint Execution ────────────────────────────────────────────────────────

export default createEndpoint({
  description: 'Search hotels with front display price decoupled by Rate Plan and Meal Basis',
  inputSchema: z.object({
    hotelName: z.string().optional(),
    area: z.string().optional(),
    starRating: z.string().optional(),
    mealPlan: z.string().optional(),
    adults: z.number().optional(),
    children: z.number().optional(),
    rooms: z.number().optional(),
    checkinDate: z.string().optional(),
    checkoutDate: z.string().optional(),
  }),
  outputSchema: z.object({
    hotels: z.array(z.object({
      id: z.string(),
      hotelName: z.string().optional(),
      emirate: z.string().optional(),
      location: z.string().optional(),
      starRating: z.string().optional(),
      description: z.string().optional(),
      hotelCode: z.string().optional(),
      roomTypes: z.array(z.object({
        id: z.string(),
        roomTypeId: z.string(),
        ratePlanId: z.string(),
        roomTypeName: z.string().optional(),
        mealPlan: z.string().optional(),
        maxOccupancy: z.number().optional(),
        maxAdults: z.number().optional(),
        maxChildren: z.number().optional(),
        childAllowed: z.boolean().optional(),
        extraBedAllowed: z.boolean().optional(),
        sellRate1: z.number().optional(),
        sellRate2: z.number().optional(),
        sellRate3: z.number().optional(),
        childSupplementSell: z.number().optional(),
        extraBedSell: z.number().optional(),
        sellRate: z.number().optional(),
        sellEnabled: z.boolean().optional(),
        onRequestOnly: z.boolean().optional(),
        availabilityStatus: z.string().optional(),
        hasMarkup: z.boolean().optional(),
        ratedNights: z.number().optional(),
      })),
    })),
  }),
  execute: async ({ input }) => {
    const getId = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;

    const hasDates = !!(input.checkinDate && input.checkoutDate);
    const dates = hasDates ? getDatesInRange(input.checkinDate!, input.checkoutDate!) : [];

    // Read all matching dates; a first-page cap can silently omit hotels.
    const loadRates = async () => {
      const records: Awaited<ReturnType<typeof zite.dailyRates.findAll>>['records'] = [];
      let offset = 0;
      while (true) {
        const page = await zite.dailyRates.findAll({
          filters: hasDates ? {
            rateDate: { gte: new Date(input.checkinDate!), lte: new Date(input.checkoutDate!) },
          } : {},
          limit: 2000, offset,
        });
        records.push(...page.records);
        if (!page.hasMore) break;
        offset += page.records.length;
      }
      return { records };
    };
    const [hotelsRes, roomTypesRes, dailyRatesRes, markupRes, ratePlansRes] = await Promise.all([
      zite.hotels.findAll({ limit: 500 }),
      zite.roomTypes.findAll({ limit: 500 }),
      loadRates(),
      zite.markupRules.findAll({ limit: 500 }),
      zite.ratePlans.findAll({ limit: 500 }),
    ]);
    const plansById = new Map(ratePlansRes.records.map(p => [p.id, p]));
    const inventoryConsumption=hasDates
      ? await loadInventoryConsumption({checkIn:input.checkinDate!,checkOut:input.checkoutDate!})
      : new Map<string,InventoryConsumption>();

    const A = input.adults ?? 2;
    const C = input.children ?? 0;

    let filtered = hotelsRes.records.filter(h => h.status === 'Active');
    if (input.hotelName) { const q = input.hotelName.toLowerCase(); filtered = filtered.filter(h => h.hotelName?.toLowerCase().includes(q)); }
    if (input.area) { const q = input.area.toLowerCase(); filtered = filtered.filter(h => h.emirate?.toLowerCase().includes(q) || h.location?.toLowerCase().includes(q)); }
    if (input.starRating) filtered = filtered.filter(h => h.starRating === input.starRating);

    const passesOccupancy = (rt: typeof roomTypesRes.records[0]) => {
      if (A === 0) return true;
      if (rt.sellEnabled === false) return false;
      if (A > (rt.maxAdults ?? 99)) return false;
      if (C > (rt.maxChildren ?? 99)) return false;
      if (C > 0 && A > (rt.maxAdultsWithChildren ?? rt.maxAdults ?? 99)) return false;
      if (A + C > (rt.maxOccupancy ?? 99)) return false;
      return true;
    };

    return {
      hotels: filtered.map(hotel => {
        const markupRules = markupRes.records;
        const fallbackMarkupRule = resolveMarkupRule(hotel.id, markupRules, dates[0] || new Date().toISOString().slice(0, 10));
        const hasMarkup = markupRules.some(r => r.isActive && !!r.markupValue);

        const rts = roomTypesRes.records.filter(rt => getId(rt.hotel) === hotel.id).filter(passesOccupancy);

        const roomTypeResults: any[] = [];

        for (const rt of rts) {
          const rtRates = dailyRatesRes.records.filter(r =>
            getId(r.roomType) === rt.id && getId(r.hotel) === hotel.id);

          // Only offer rates whose exact linked plan and hotel/room agree.
          const ratesByPlan = new Map<string, DailyRateRec[]>();
          for (const r of rtRates) {
            const linkedRatePlanId = getId(r.ratePlan);
            const plan = linkedRatePlanId ? plansById.get(linkedRatePlanId) : undefined;
            if (!plan || plan.status !== 'Active' || r.integrityStatus === 'Quarantined' ||
                (r.ratePlanId && r.ratePlanId !== linkedRatePlanId) ||
                getId(plan.hotel) !== hotel.id || getId(plan.roomType) !== rt.id ||
                !linkedId(plan.mealPlanMaster) || !isCanonicalMealPlan(plan.mealPlan) ||
                !isSupportedAedRate(r.currency, plan.sellCurrency)) continue;
            if (input.mealPlan && plan.mealPlan !== input.mealPlan) continue;
            if (!ratesByPlan.has(plan.id)) ratesByPlan.set(plan.id, []);
            ratesByPlan.get(plan.id)!.push({ ...r, mealPlan: plan.mealPlan });
          }

          // Compute prices for each distinct canonical Rate Plan on this room type.
          ratesByPlan.forEach((planRates, planId) => {
            const plan = plansById.get(planId);
            if (!plan) return;
            const effectiveMealPlan = plan.mealPlan || rt.mealPlan;

            const net1 = avg(planRates.map(r => r.adult1Rate));
            const net2 = avg(planRates.map(r => r.adult2Rate ?? r.adult1Rate));
            const net3 = avg(planRates.map(r => r.adult3Rate ?? r.adult2Rate ?? r.adult1Rate));
            const netChild = avg(planRates.map(r => r.childSupplement));
            const netExtra = avg(planRates.map(r => r.extraBedRate));

            const sell1 = net1 != null ? applyMarkup(net1, fallbackMarkupRule) : undefined;
            const sell2 = net2 != null ? applyMarkup(net2, fallbackMarkupRule) : undefined;
            const sell3 = net3 != null ? applyMarkup(net3, fallbackMarkupRule) : undefined;
            const sellChild = netChild != null ? applyMarkup(netChild, fallbackMarkupRule) : undefined;
            const sellExtra = netExtra != null ? applyMarkup(netExtra, fallbackMarkupRule) : undefined;

            let sellRate: number | undefined;
            let availabilityStatus = 'Free Sale';
            let ratedNights = 0;

            if (hasDates && dates.length > 0) {
              const ratesByDate = new Map<string, DailyRateRec>();
              for (const r of planRates) {
                const date = String(r.rateDate ?? '').split('T')[0];
                const existing = ratesByDate.get(date);
                const best = resolveEffectiveRate(existing ? [existing, r] : [r]);
                if (best) ratesByDate.set(date, best);
              }

              const result = getFrontDisplayPrice({
                dates,
                ratesByDate,
                adults: A,
                children: C,
                rooms: input.rooms ?? 1,
                hotelId: hotel.id,
                markupRules,
                ratePlanMinStay: plan.minStayNights,
                ratePlanMaxStay: plan.maxStayNights,
                roomTypeId:rt.id,
                ratePlanId:planId,
                inventoryConsumption,
              });
              sellRate = result.sellRate;
              availabilityStatus = result.availabilityStatus;
              ratedNights = result.ratedNights;
            } else {
              const baseRate = A <= 1 ? sell1 : A === 2 ? sell2 : sell3;
              const childTotal = C > 0 && sellChild != null ? sellChild * C : 0;
              sellRate = baseRate != null ? roundAED(baseRate + childTotal) : undefined;

              for (const r of planRates) {
                if (r.status === 'Stop Sale') { availabilityStatus = 'Stop Sale'; break; }
                if (r.status === 'On Request' && availabilityStatus === 'Free Sale') availabilityStatus = 'On Request';
                if (r.status === 'Limited' && availabilityStatus === 'Free Sale') availabilityStatus = 'Limited';
              }
            }

            roomTypeResults.push({
              id: `${rt.id}_${planId}`,
              roomTypeId: rt.id,
              ratePlanId: planId,
              roomTypeName: rt.roomTypeName,
              mealPlan: effectiveMealPlan,
              maxOccupancy: rt.maxOccupancy,
              maxAdults: rt.maxAdults,
              maxChildren: rt.maxChildren,
              childAllowed: rt.childAllowed,
              extraBedAllowed: rt.extraBedAllowed,
              sellRate1: sell1,
              sellRate2: sell2,
              sellRate3: sell3,
              childSupplementSell: sellChild,
              extraBedSell: sellExtra,
              sellRate,
              sellEnabled: rt.sellEnabled,
              onRequestOnly: rt.onRequestOnly,
              availabilityStatus,
              hasMarkup,
              ratedNights,
            });
          });
        }

        return {
          id: hotel.id,
          hotelName: hotel.hotelName,
          emirate: hotel.emirate,
          location: hotel.location,
          starRating: hotel.starRating,
          description: hotel.description,
          hotelCode: hotel.hotelCode,
          roomTypes: roomTypeResults,
        };
      }).filter(h => h.roomTypes.length > 0 || A === 0),
    };
  },
});