import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { eventSupplementForNight, loadHotelEventRules, validateEventStayRules } from '../lib/hotelEventPricing';
import { loadMarketContext, resolveRatePlanEligibility } from '../lib/marketEligibility';
import {
  applyMarkup,
  isSupportedAedRate,
  linkedId as getLinkedId,
  markupAmountForNet,
  resolveEffectiveRate,
  resolveMarkupRule,
  safeNum,
  validateStayRestrictions,
  validateAllocation,
} from '@project/pricing/hotelPricing';
import { priceRoomOccupancy, validateRequestedRoom } from '@project/pricing/occupancyPricing';

const MEAL_PLANS = ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All Inclusive'] as const;

const roomConfigSchema = z.object({
  adults: z.number().int().min(1),
  children: z.number().int().min(0),
  childAges: z.array(z.number().int().min(0)).default([]),
});

const roomBreakdownSchema = z.object({
  roomNo: z.number(),
  adults: z.number(),
  children: z.number(),
  baseRate: z.number(),
  childTotal: z.number(),
  extraBedTotal: z.number(),
  mealPlanSupplement: z.number(),
  nightlyTotal: z.number(),
  roomTotal: z.number(),
  sellNightlyTotal: z.number(),
  sellRoomTotal: z.number(),
  isValidOccupancy: z.boolean(),
  occupancyError: z.string().optional(),
  payingChildren: z.number(),
  freeChildren: z.number(),
});

const inputSchema = z.object({
  hotelId: z.string().min(1),
  roomTypeId: z.string().min(1),
  ratePlanId: z.string().min(1),
  mealPlan: z.enum(MEAL_PLANS).optional().nullable(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roomConfigs: z.array(roomConfigSchema).min(1),
  nationality: z.string().trim().min(2).max(3).optional(),
});

export default createEndpoint({
  description: 'fabBeds pricing engine with authoritative RatePlan → MealPlan matching',
  inputSchema,
  outputSchema: z.object({
    valid: z.boolean(),
    nights: z.number(),
    hotelId: z.string(),
    roomTypeId: z.string(),
    ratePlanId: z.string().nullable(),
    ratePlanName: z.string(),
    mealPlan: z.enum(MEAL_PLANS),
    roomBreakdown: z.array(roomBreakdownSchema),
    netTotal: z.number(),
    sellTotal: z.number(),
    markupLabel: z.string(),
    markupAmount: z.number(),
    margin: z.number(),
    marginPercent: z.number(),
    rateSource: z.enum(['daily', 'none']),
    ratesCoveredNights: z.number(),
    maxOccupancy: z.number().nullable(),
    maxAdults: z.number().nullable(),
    maxChildren: z.number().nullable(),
    freeChildAge: z.number(),
    pricingErrors: z.array(z.string()),
    pricingWarnings: z.array(z.string()),
    eventSupplementTotal: z.number(),
    appliedEvents: z.array(z.string()),
  }),

  execute: async ({ input }) => {
    const pricingErrors: string[] = [];
    const pricingWarnings: string[] = [];

    const parseDate = (value: string): Date => {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    };

    const startDate = parseDate(input.checkIn);
    const endDate = parseDate(input.checkOut);
    const nights = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);

    if (nights <= 0) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Check-out must be after check-in' });
    }

    // Build [checkIn, checkOut) date range
    const dates: string[] = [];
    for (let cursor = new Date(startDate); cursor < endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      dates.push(cursor.toISOString().slice(0, 10));
    }

    // ─── 1. ROOM TYPE ───
    const roomType = await zite.roomTypes.findOne({ id: input.roomTypeId });
    if (!roomType) throw new ZiteError({ code: 'NOT_FOUND', message: 'Room type not found' });

    const roomHotelId = getLinkedId(roomType.hotel);
    if (roomHotelId !== input.hotelId) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Room type does not belong to selected hotel' });
    }

    const maxOccupancy = roomType.maxOccupancy ?? null;
    const maxAdults = roomType.maxAdults ?? null;
    const maxChildren = roomType.maxChildren ?? null;
    const freeChildAge = roomType.childAgeFreeUpTo ?? roomType.childAgeFrom ?? 5;

    // ─── 2. RATE PLANS ───
    const ratePlansRes = await zite.ratePlans.findAll({ limit: 1000 });
    const matchingRatePlans = ratePlansRes.records.filter((rp) => {
      return getLinkedId(rp.hotel) === input.hotelId
        && getLinkedId(rp.roomType) === input.roomTypeId
        && rp.status !== 'Inactive';
    });

    const selectedRatePlan = matchingRatePlans.find(rp => rp.id === input.ratePlanId);
    if (!selectedRatePlan) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Selected rate plan does not belong to this hotel and room type.' });
    }
    if (input.mealPlan && input.mealPlan !== selectedRatePlan.mealPlan) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Selected meal plan does not match the rate plan.' });
    }
    const marketContext = await loadMarketContext(zite);
    const eligibility = resolveRatePlanEligibility(marketContext, {
      ratePlan: selectedRatePlan,
      requestedNationality: input.nationality?.toUpperCase(),
    });
    if (!eligibility.eligible) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: `RATE_NOT_VALID_FOR_SELECTED_NATIONALITY: ${eligibility.reason}`,
      });
    }

    const resolvedRatePlanId = selectedRatePlan.id;
    const resolvedMealPlan = selectedRatePlan.mealPlan;
    const eventRules = await loadHotelEventRules(input.hotelId);
    const eventRuleErrors = validateEventStayRules({
      events: eventRules,
      stayDates: dates,
      checkIn: input.checkIn,
      roomTypeId: input.roomTypeId,
      ratePlanId: resolvedRatePlanId,
    });
    pricingErrors.push(...eventRuleErrors);
    if (!resolvedMealPlan || !getLinkedId(selectedRatePlan.mealPlanMaster)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Rate plan has no verified meal plan.' });
    }

    if (!MEAL_PLANS.includes(resolvedMealPlan as (typeof MEAL_PLANS)[number])) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Unsupported meal plan: ${resolvedMealPlan}` });
    }
    if (!isSupportedAedRate(undefined, selectedRatePlan.sellCurrency)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Rate plan currency is not supported. UAE sales must be AED.' });
    }

    // ─── 3. DAILY RATES via SQL (no row cap) ───
    const dailyRatesSql = await zite.sql({
      query: `
        SELECT dr.id, dr."rateDate",
               dr."adult1Rate", dr."adult2Rate", dr."adult3Rate",
               dr."childSupplement", dr."childRate05", dr."childRate611", dr."extraBedRate",
               dr."status", dr."allocation", dr."layer", dr."priority",
               dr."ratePlanId", dr."currency", dr."minStay", dr."maxStay",
               dr."cta", dr."ctd", dr."leadDays", dr.updated_at AS "updatedAt",
               l_h."hotelsId"     AS "hotelId",
               l_rt."roomTypesId" AS "roomTypeId",
               l_rp."ratePlansId" AS "ratePlanLinkId"
        FROM "DailyRates" dr
        LEFT JOIN "DailyRatesHotels"    l_h  ON l_h."dailyRatesId"  = dr.id
        LEFT JOIN "DailyRatesRoomTypes" l_rt ON l_rt."dailyRatesId" = dr.id
        LEFT JOIN "DailyRatesRatePlans" l_rp ON l_rp."dailyRatesId" = dr.id
        WHERE l_h."hotelsId" = $1
          AND l_rt."roomTypesId" = $2
          AND dr."rateDate" >= $3
          AND dr."rateDate" <= $4
          AND (dr."integrityStatus" IS NULL OR dr."integrityStatus" != 'Quarantined')
      `,
      params: [input.hotelId, input.roomTypeId, input.checkIn, input.checkOut],
    });

    // Filter to the selected RatePlan and resolve the same deterministic
    // layer/priority winner used by Admin.
    const dailyRateByDate = new Map<string, {
      adult1Rate: number; adult2Rate: number; adult3Rate: number;
      childSupplement: number; childRate05: number; childRate611: number; extraBedRate: number; allocation: number | null; status: string;
      currency: string; minStay: number; maxStay: number; cta: boolean; ctd: boolean; leadDays: number;
    }>();

    const byDate = new Map<string, any[]>();
    for (const r of dailyRatesSql.rows) {
      if (!r.ratePlanLinkId || String(r.ratePlanLinkId) !== resolvedRatePlanId) continue;
      if (r.ratePlanId && String(r.ratePlanId) !== resolvedRatePlanId) continue;
      const rateDate = r.rateDate ? (typeof r.rateDate === 'string' ? r.rateDate.slice(0, 10) : new Date(r.rateDate as string | number).toISOString().split('T')[0]) : '';
      if (!rateDate) continue;
      const bucket = byDate.get(rateDate) ?? [];
      bucket.push(r);
      byDate.set(rateDate, bucket);
    }

    for (const [date, candidates] of byDate) {
      const best = resolveEffectiveRate(candidates.map(r => ({
        ...r,
        id: String(r.id),
        layer: r.layer || 'BASE',
        priority: safeNum(r.priority),
        updatedAt: r.updatedAt,
      })));
      if (!best) continue;

      if (date === input.checkOut) {
        if (safeNum(best.ctd) > 0) pricingErrors.push(`${date}: Closed to departure`);
        continue;
      }

      if (!isSupportedAedRate(best.currency || 'AED', selectedRatePlan.sellCurrency)) {
        pricingErrors.push(`Unsupported currency on ${date}. UAE sales must be AED.`);
        continue;
      }
      const restrictionErrors = validateStayRestrictions({
        requestedNights: nights,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        ratePlanMinStay: selectedRatePlan.minStayNights,
        ratePlanMaxStay: selectedRatePlan.maxStayNights,
        dailyMinStay: safeNum(best.minStay),
        dailyMaxStay: safeNum(best.maxStay),
        cta: date === input.checkIn && safeNum(best.cta) > 0,
        ctd: false,
        leadDays: safeNum(best.leadDays),
        status: best.status || 'Free Sale',
      });
      if (restrictionErrors.length) {
        restrictionErrors.forEach(message => pricingErrors.push(`${date}: ${message}`));
        continue;
      }
      dailyRateByDate.set(date, {
        adult1Rate: safeNum(best.adult1Rate),
        adult2Rate: safeNum(best.adult2Rate),
        adult3Rate: safeNum(best.adult3Rate),
        childSupplement: safeNum(best.childSupplement),
        childRate05: safeNum(best.childRate05),
        childRate611: safeNum(best.childRate611),
        extraBedRate: safeNum(best.extraBedRate),
        allocation: best.allocation == null ? null : safeNum(best.allocation),
        status: best.status || 'Free Sale',
        currency: best.currency || 'AED',
        minStay: safeNum(best.minStay),
        maxStay: safeNum(best.maxStay),
        cta: safeNum(best.cta) > 0,
        ctd: safeNum(best.ctd) > 0,
        leadDays: safeNum(best.leadDays),
      });
    }

    const missingDates = dates.filter(date => !dailyRateByDate.has(date));
    const hasCompleteDailyCoverage = missingDates.length === 0;
    const rateSource: 'daily' | 'none' = hasCompleteDailyCoverage ? 'daily' : 'none';
    if (missingDates.length > 0) pricingErrors.push(`Daily rate unavailable for ${missingDates.length} night(s): ${missingDates.join(', ')}.`);
    if (rateSource === 'none') pricingErrors.push(`No valid AED Daily Rate found for Rate Plan "${selectedRatePlan.ratePlanName ?? resolvedRatePlanId}" / ${resolvedMealPlan}.`);

    const unavailableDates = dates.filter(date => {
      const row = dailyRateByDate.get(date);
      if (!row) return true;
      return validateAllocation({
        status: row.status,
        allocation: row.allocation,
        requestedRooms: input.roomConfigs.length,
        allowOnRequest: false,
      }).length > 0;
    });
    const allocationAvailable = unavailableDates.length === 0;
    if (!allocationAvailable) pricingErrors.push(`Insufficient confirmed allocation for: ${unavailableDates.join(', ')}.`);

    // The selected Daily Rate already prices its meal-specific Rate Plan.
    // Never add a meal supplement to an already meal-specific Daily Rate.

    // ─── 6. MARKUP ───
    const markupRulesRes = await zite.markupRules.findAll({ filters: { isActive: true }, limit: 500 });
    const markupRuleByDate = new Map(dates.map(date => [date, resolveMarkupRule(input.hotelId, markupRulesRes.records, date)] as const));
    const firstRule = dates.map(date => markupRuleByDate.get(date)).find(Boolean) ?? null;
    if (!firstRule) pricingWarnings.push('No active date-valid markup rule configured. Selling at net cost.');
    const absMarkupVal = Math.abs(safeNum(firstRule?.markupValue));
    const markupLabel = firstRule
      ? firstRule.markupType === 'Percentage (%)' ? `+${absMarkupVal}%` : `+AED ${absMarkupVal}/room/night`
      : '';

    // ─── 7. PRICE EACH ROOM AUTHORITATIVELY ───
    const roomBreakdown = input.roomConfigs.map((config, index) => {
      const roomNo = index + 1;
      const requestErrors = validateRequestedRoom({ ...config, roomNo });
      let isValidOccupancy = requestErrors.length === 0;
      let occupancyError: string | undefined = requestErrors[0]
        ? `Room ${roomNo}: ${requestErrors[0]}`
        : undefined;

      let totalBaseRate = 0;
      let totalChildTotal = 0;
      let totalExtraBedTotal = 0;
      let totalMealPlanSupplement = 0;
      let sellRoomTotal = 0;
      let payingChildren = 0;
      let freeChildren = 0;

      for (const date of dates) {
        const dailyRate = dailyRateByDate.get(date);
        if (!dailyRate || !hasCompleteDailyCoverage) {
          isValidOccupancy = false;
          occupancyError = occupancyError || `Room ${roomNo}: DAILY_RATE_MISSING`;
          continue;
        }

        const occupancy = priceRoomOccupancy(
          { ...config, roomNo },
          roomType,
          {
            adult1Rate: dailyRate.adult1Rate,
            adult2Rate: dailyRate.adult2Rate,
            adult3Rate: dailyRate.adult3Rate,
            childSupplement: dailyRate.childSupplement,
            childRate05: dailyRate.childRate05,
            childRate611: dailyRate.childRate611,
            extraBedRate: dailyRate.extraBedRate,
          }
        );

        if (!occupancy.valid) {
          isValidOccupancy = false;
          occupancyError = occupancyError || `Room ${roomNo}: ${occupancy.errors.join(' | ')}`;
          continue;
        }

        totalBaseRate += occupancy.baseRate;
        totalChildTotal += occupancy.childCharges.reduce((sum, c) => sum + c.amount, 0);
        totalExtraBedTotal += occupancy.extraAdultCharge;
        const nightRule = markupRuleByDate.get(date);
        sellRoomTotal += applyMarkup(occupancy.net, nightRule);

        if (date === dates[0]) {
          payingChildren = occupancy.childCharges.filter(c => c.amount > 0).length;
          freeChildren = occupancy.childCharges.filter(c => c.amount === 0 && c.classification !== 'ADULT_EQUIVALENT').length;
        }
      }

      const roomTotal = totalBaseRate + totalChildTotal + totalExtraBedTotal;
      const nightlyTotal = nights > 0 ? roomTotal / nights : 0;
      sellRoomTotal = Math.max(roomTotal, sellRoomTotal);
      const sellNightlyTotal = nights > 0 ? sellRoomTotal / nights : 0;

      if (occupancyError) pricingErrors.push(occupancyError);

      return {
        roomNo,
        adults: config.adults,
        children: config.children,
        baseRate: Math.round(totalBaseRate * 100) / 100,
        childTotal: Math.round(totalChildTotal * 100) / 100,
        extraBedTotal: Math.round(totalExtraBedTotal * 100) / 100,
        mealPlanSupplement: Math.round(totalMealPlanSupplement * 100) / 100,
        nightlyTotal: Math.round(nightlyTotal * 100) / 100,
        roomTotal: Math.round(roomTotal * 100) / 100,
        sellNightlyTotal: Math.round(sellNightlyTotal * 100) / 100,
        sellRoomTotal: Math.round(sellRoomTotal * 100) / 100,
        isValidOccupancy,
        occupancyError,
        payingChildren,
        freeChildren,
      };
    });

    // ─── 8. TOTALS ───
    const validRooms = roomBreakdown.filter(room => room.isValidOccupancy);
    const baseNetTotal = Math.round(validRooms.reduce((sum, room) => sum + room.roomTotal, 0));
    const baseSellTotal = Math.max(baseNetTotal, Math.round(validRooms.reduce((sum, room) => sum + room.sellRoomTotal, 0)));

    let eventSupplementTotal = 0;
    let eventSellSupplement = 0;
    const appliedEventNames = new Set<string>();
    for (const date of dates) {
      const eventNight = eventSupplementForNight({
        events: eventRules,
        date,
        roomTypeId: input.roomTypeId,
        ratePlanId: resolvedRatePlanId,
        rooms: input.roomConfigs.map(r => ({ adults: r.adults, children: r.children })),
      });
      eventSupplementTotal += eventNight.amount;
      eventSellSupplement += applyMarkup(eventNight.amount, markupRuleByDate.get(date));
      eventNight.eventNames.forEach(name => appliedEventNames.add(name));
    }
    eventSupplementTotal = Math.round(eventSupplementTotal);
    eventSellSupplement = Math.round(eventSellSupplement);

    const netTotal = Math.round(baseNetTotal + eventSupplementTotal);
    const sellTotal = Math.max(netTotal, Math.round(baseSellTotal + eventSellSupplement));
    const markupAmount = Math.max(0, sellTotal - netTotal);
    const margin = sellTotal - netTotal;
    const marginPercent = netTotal > 0 ? Math.round((margin / netTotal) * 1000) / 10 : 0;

    if (sellTotal < netTotal) {
      pricingErrors.push(`Sell total AED ${sellTotal} is below net AED ${netTotal}.`);
    }

    const valid = pricingErrors.length === 0
      && allocationAvailable
      && hasCompleteDailyCoverage
      && sellTotal > 0
      && roomBreakdown.every(room => room.isValidOccupancy && room.sellRoomTotal > 0)
      && rateSource === 'daily';

    console.log('[fabBeds PRICING]', JSON.stringify({
      hotelId: input.hotelId, roomTypeId: input.roomTypeId,
      requestedRatePlanId: input.ratePlanId ?? null, resolvedRatePlanId,
      ratePlanName: selectedRatePlan.ratePlanName, resolvedMealPlan,
      rateSource, nights, coveredNights: dailyRateByDate.size, missingDates,
      allocationAvailable, netTotal, sellTotal, markupAmount,
      status: valid ? 'VALID' : 'INVALID',
    }));

    return {
      valid, nights,
      hotelId: input.hotelId, roomTypeId: input.roomTypeId,
      ratePlanId: resolvedRatePlanId,
      ratePlanName: selectedRatePlan.ratePlanName ?? resolvedRatePlanId,
      mealPlan: resolvedMealPlan as (typeof MEAL_PLANS)[number],
      roomBreakdown, netTotal, sellTotal,
      markupLabel, markupAmount, margin, marginPercent,
      rateSource, ratesCoveredNights: dailyRateByDate.size,
      maxOccupancy, maxAdults, maxChildren, freeChildAge,
      pricingErrors, pricingWarnings,
      eventSupplementTotal,
      appliedEvents: Array.from(appliedEventNames),
    };
  },
});
