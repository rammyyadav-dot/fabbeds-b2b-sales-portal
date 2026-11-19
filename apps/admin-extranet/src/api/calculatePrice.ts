import { z } from 'zod';
import { zite } from 'zitejs/db';
import type { DailyRatesRecordType } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import {
  applyMarkupWithFloor,
  resolveEffectiveRate,
  resolveMarkupRule as resolveCanonicalMarkupRule,
  resolveOccupancyBaseRate,
  type MarkupRuleLike,
} from '@project/pricing/hotelPricing';

/**
 * UAEWB ONLY
 *
 * Pricing resolution:
 *
 * Hotel
 *   -> Room Type
 *   -> Rate Plan
 *   -> Meal Plan
 *   -> Daily Rate
 *   -> Allocation / availability
 *   -> Occupancy
 *   -> Child supplement
 *   -> Markup
 *   -> Sell price
 *
 * IMPORTANT:
 * Do not use this framework/schema/code for FBEDS.
 */

type AvailabilityStatus =
  | 'AVAILABLE'
  | 'LIMITED'
  | 'ON_REQUEST'
  | 'NO_INVENTORY'
  | 'NO_RATE'
  | 'RATE_PLAN_MISMATCH'
  | 'MEAL_PLAN_MISMATCH'
  | 'STOP_SALE'
  | 'BLACKOUT'
  | 'INVALID_DATE'
  | 'INVALID_OCCUPANCY'
  | 'PRICING_ERROR';

type MealPlan =
  | 'Room Only'
  | 'Bed & Breakfast'
  | 'Half Board'
  | 'Full Board'
  | 'All Inclusive'
  | string;

function roundAED(value: number): number {
  return Math.round(value);
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Parse YYYY-MM-DD without allowing browser/runtime timezone
 * conversion to change the date.
 */
function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDatesInRange(
  checkIn: string,
  checkOut: string,
): string[] {
  const start = parseDateOnly(checkIn);
  const end = parseDateOnly(checkOut);

  const dates: string[] = [];

  for (
    const current = new Date(start);
    current < end;
    current.setDate(current.getDate() + 1)
  ) {
    dates.push(formatDateOnly(current));
  }

  return dates;
}

function normalizeId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value.length ? String(value[0]) : undefined;
  }

  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).split('T')[0];
}

function normalizeMealPlan(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).trim();
}

function isSameId(value: unknown, id: string): boolean {
  return normalizeId(value) === id;
}

function bestRate(
  rates: DailyRatesRecordType[],
): DailyRatesRecordType | undefined {
  return resolveEffectiveRate(
    rates.map(rate => ({
      ...rate,
      updatedAt: (rate as any).updatedAt ?? (rate as any).updated_at ?? null,
    })),
  ) as DailyRatesRecordType | undefined;
}

function netByOccupancy(
  adults: number,
  adult1Rate?: number,
  adult2Rate?: number,
  adult3Rate?: number,
): number {
  return resolveOccupancyBaseRate({
    adults,
    adult1Rate,
    adult2Rate,
    adult3Rate,
  }).baseRate;
}

type MarkupRule = MarkupRuleLike;

function resolveMarkupRule(
  hotelId: string,
  rules: MarkupRule[],
  date: string,
): MarkupRule | undefined {
  return resolveCanonicalMarkupRule(hotelId, rules, date);
}

function applyMarkup(
  net: number,
  rule: MarkupRule | undefined,
  minimumFloor: number,
): {
  sell: number;
  markup: number;
  floorApplied: boolean;
} {
  return applyMarkupWithFloor(net, rule, minimumFloor);
}

function getStatusFromRate(
  rate?: DailyRatesRecordType,
): AvailabilityStatus {
  if (!rate) {
    return 'NO_RATE';
  }

  switch (rate.status) {
    case 'Stop Sale':
      return 'STOP_SALE';

    case 'On Request':
      return 'ON_REQUEST';

    case 'Limited':
      return 'LIMITED';

    default:
      return 'AVAILABLE';
  }
}

export default createEndpoint({
  description:
    'UAEWB OTA/Bedbank pricing engine with explicit RatePlan, MealPlan, date, rate, allocation and markup resolution.',

  inputSchema: z.object({
    hotelId: z.string(),
    roomTypeId: z.string(),

    /**
     * Explicit RatePlan is strongly recommended.
     * Search results should pass this value into pricing.
     */
    ratePlanId: z.string().optional(),

    /**
     * Explicit meal plan.
     *
     * Example:
     * Room Only
     * Bed & Breakfast
     * Half Board
     * Full Board
     * All Inclusive
     */
    mealPlan: z.string().optional(),

    checkinDate: z.string(),
    checkoutDate: z.string(),

    /**
     * Adults PER ROOM.
     */
    adults: z.number().int().min(1),

    children: z.number().int().min(0).optional(),

    rooms: z.number().int().min(1),

    minimumMarginFloor: z.number().min(0).optional(),
  }),

  outputSchema: z.object({
    nights: z.number(),
    rooms: z.number(),
    adults: z.number(),
    children: z.number(),

    ratePlanId: z.string().optional(),
    ratePlanName: z.string().optional(),
    mealPlan: z.string().optional(),

    avgNetPerNight: z.number().optional(),
    avgSellPerNight: z.number().optional(),

    totalNet: z.number().optional(),
    totalSell: z.number().optional(),

    totalMarkup: z.number().optional(),

    markupType: z.string().optional(),
    markupValue: z.number().optional(),

    pricingErrors: z.array(z.string()),

    availabilityStatus: z.string(),

    hasRates: z.boolean(),

    ratedNights: z.number(),
    missingNights: z.number(),
  }),

  execute: async ({ input }) => {
    const dates = getDatesInRange(
      input.checkinDate,
      input.checkoutDate,
    );

    const nights = dates.length;
    const rooms = input.rooms;
    const adults = input.adults;
    const children = input.children ?? 0;
    const floor =
      input.minimumMarginFloor ?? 0;

    const pricingErrors: string[] = [];

    /*
     * ------------------------------------------------------------
     * 1. VALIDATE DATES
     * ------------------------------------------------------------
     */

    if (
      !input.checkinDate ||
      !input.checkoutDate ||
      nights <= 0
    ) {
      return {
        nights: 0,
        rooms,
        adults,
        children,
        pricingErrors: [
          'Invalid check-in/check-out date range',
        ],
        availabilityStatus: 'INVALID_DATE',
        hasRates: false,
        ratedNights: 0,
        missingNights: 0,
      };
    }

    /*
     * ------------------------------------------------------------
     * 2. LOAD DATA
     * ------------------------------------------------------------
     */

    const [
      dailyRes,
      markupRes,
      netRatesRes,
      seasonsRes,
      blackoutRes,
      ratePlansRes,
    ] = await Promise.all([
      zite.dailyRates.findAll({
        filters: {
          hotel: {
            contains: input.hotelId,
          },
          roomType: {
            contains: input.roomTypeId,
          },
          rateDate: {
            gte: parseDateOnly(
              input.checkinDate,
            ),
            lt: parseDateOnly(
              input.checkoutDate,
            ),
          },
        },
        limit: 1000,
      }),

      zite.markupRules.findAll({
        filters: {
          isActive: true,
        },
        limit: 500,
      }),

      zite.netRates.findAll({
        filters: {
          hotel: input.hotelId,
          roomType: input.roomTypeId,
        },
        limit: 500,
      }),

      zite.seasons.findAll({
        limit: 500,
      }),

      zite.blackoutDates.findAll({
        filters: {
          hotel: {
            contains: input.hotelId,
          },
        },
        limit: 500,
      }),

      zite.ratePlans.findAll({
        filters: {
          hotel: input.hotelId,
          roomType: input.roomTypeId,
        },
        limit: 200,
      }),
    ]);

    /*
     * ------------------------------------------------------------
     * 3. RESOLVE RATE PLAN
     * ------------------------------------------------------------
     */

    let selectedRatePlan: any | undefined;

    if (input.ratePlanId) {
      selectedRatePlan =
        ratePlansRes.records.find(
          (rp: any) =>
            String(rp.id) ===
            input.ratePlanId,
        );

      if (!selectedRatePlan) {
        return {
          nights,
          rooms,
          adults,
          children,
          pricingErrors: [
            `Rate plan ${input.ratePlanId} does not belong to hotel ${input.hotelId} / room ${input.roomTypeId}`,
          ],
          availabilityStatus:
            'RATE_PLAN_MISMATCH',
          hasRates: false,
          ratedNights: 0,
          missingNights: nights,
        };
      }
    } else if (input.mealPlan) {
      selectedRatePlan =
        ratePlansRes.records.find(
          (rp: any) =>
            normalizeMealPlan(rp.mealPlan) ===
            normalizeMealPlan(input.mealPlan) &&
            (!rp.status ||
              rp.status === 'Active'),
        );
    } else {
      /*
       * No explicit RatePlan:
       * Do NOT arbitrarily select a DailyRate.
       *
       * Search should normally supply ratePlanId.
       */
      return {
        nights,
        rooms,
        adults,
        children,
        pricingErrors: [
          'ratePlanId is required for deterministic pricing. Search result must provide a selected RatePlan.',
        ],
        availabilityStatus:
          'RATE_PLAN_MISMATCH',
        hasRates: false,
        ratedNights: 0,
        missingNights: nights,
      };
    }

    if (!selectedRatePlan) {
      return {
        nights,
        rooms,
        adults,
        children,
        pricingErrors: [
          input.mealPlan
            ? `No active RatePlan found for meal plan "${input.mealPlan}"`
            : 'Selected RatePlan could not be resolved',
        ],
        availabilityStatus:
          input.mealPlan
            ? 'MEAL_PLAN_MISMATCH'
            : 'RATE_PLAN_MISMATCH',
        hasRates: false,
        ratedNights: 0,
        missingNights: nights,
      };
    }

    const resolvedRatePlanId =
      String(selectedRatePlan.id);

    const resolvedMealPlan =
      normalizeMealPlan(
        selectedRatePlan.mealPlan,
      );

    const resolvedRatePlanName =
      selectedRatePlan.ratePlanName
        ? String(selectedRatePlan.ratePlanName)
        : undefined;

    /*
     * Explicit requested meal plan must agree
     * with the RatePlan.
     */
    if (
      input.mealPlan &&
      resolvedMealPlan &&
      resolvedMealPlan !== input.mealPlan
    ) {
      return {
        nights,
        rooms,
        adults,
        children,
        ratePlanId: resolvedRatePlanId,
        ratePlanName: resolvedRatePlanName,
        mealPlan: resolvedMealPlan,
        pricingErrors: [
          `Meal plan mismatch: requested "${input.mealPlan}", RatePlan provides "${resolvedMealPlan}"`,
        ],
        availabilityStatus:
          'MEAL_PLAN_MISMATCH',
        hasRates: false,
        ratedNights: 0,
        missingNights: nights,
      };
    }

    /*
     * ------------------------------------------------------------
     * 4. BLACKOUT CHECK
     * ------------------------------------------------------------
     */

    const blockedDates = new Set<string>();

    for (const blackout of blackoutRes.records) {
      const blackoutRoom =
        normalizeId(
          (blackout as any).roomType,
        );

      if (
        blackoutRoom &&
        blackoutRoom !== input.roomTypeId
      ) {
        continue;
      }

      for (const date of dates) {
        const start =
          normalizeDate(
            (blackout as any).startDate,
          );

        const end =
          normalizeDate(
            (blackout as any).endDate,
          );

        if (start && date < start) continue;
        if (end && date > end) continue;

        blockedDates.add(date);
      }
    }

    if (blockedDates.size > 0) {
      const blocked = [
        ...blockedDates,
      ];

      return {
        nights,
        rooms,
        adults,
        children,
        ratePlanId: resolvedRatePlanId,
        ratePlanName: resolvedRatePlanName,
        mealPlan: resolvedMealPlan,
        pricingErrors: [
          `Blackout dates block this stay: ${blocked
            .slice(0, 5)
            .join(', ')}`,
        ],
        availabilityStatus: 'BLACKOUT',
        hasRates: false,
        ratedNights: 0,
        missingNights: nights,
      };
    }

    /*
     * ------------------------------------------------------------
     * 5. FILTER DAILY RATES TO THE EXACT RATE PLAN
     * ------------------------------------------------------------
     *
     * This is the most important correction.
     *
     * NEVER:
     *   pick first DailyRate for room
     *
     * ALWAYS:
     *   room + ratePlan + date
     */

    const exactDailyRates =
      dailyRes.records.filter(
        (rate) =>
          normalizeId(
            (rate as any).ratePlanId,
          ) === resolvedRatePlanId &&
          normalizeId((rate as any).ratePlan) === resolvedRatePlanId &&
          (rate as any).integrityStatus !== 'Quarantined',
      );

    /*
     * If DailyRates exist for the room but none
     * belong to selected RatePlan, expose the
     * actual reason instead of Price on Request.
     */

    if (
      dailyRes.records.length > 0 &&
      exactDailyRates.length === 0
    ) {
      pricingErrors.push(
        `DailyRates exist for room ${input.roomTypeId}, but none are linked to RatePlan ${resolvedRatePlanId}`,
      );
    }

    /*
     * ------------------------------------------------------------
     * 6. GROUP EXACT RATES BY DATE
     * ------------------------------------------------------------
     */

    const ratesByDate =
      new Map<
        string,
        DailyRatesRecordType[]
      >();

    for (const rate of exactDailyRates) {
      const date =
        normalizeDate(
          rate.rateDate,
        );

      if (!date) continue;

      if (!ratesByDate.has(date)) {
        ratesByDate.set(date, []);
      }

      ratesByDate
        .get(date)!
        .push(rate);
    }

    /*
     * ------------------------------------------------------------
     * 7. RATE RESOLUTION + AVAILABILITY
     * ------------------------------------------------------------
     */

    let ratedNights = 0;
    let missingNights = 0;

    const missingDates: string[] = [];

    let hasStopSale = false;
    let hasOnRequest = false;
    let hasLimited = false;

    for (const date of dates) {
      const candidates =
        ratesByDate.get(date) ?? [];

      const selected =
        bestRate(candidates);

      if (!selected) {
        missingNights++;
        missingDates.push(date);
        continue;
      }

      const status =
        getStatusFromRate(selected);

      if (status === 'STOP_SALE') {
        hasStopSale = true;
      }

      if (status === 'ON_REQUEST') {
        hasOnRequest = true;
      }

      if (status === 'LIMITED') {
        hasLimited = true;
      }

      const net =
        netByOccupancy(
          adults,
          selected.adult1Rate,
          selected.adult2Rate,
          selected.adult3Rate,
        );

      if (net <= 0) {
        missingNights++;
        missingDates.push(date);
        continue;
      }

      ratedNights++;
    }

    /*
     * STOP SALE has highest priority.
     */

    if (hasStopSale) {
      return {
        nights,
        rooms,
        adults,
        children,
        ratePlanId: resolvedRatePlanId,
        ratePlanName: resolvedRatePlanName,
        mealPlan: resolvedMealPlan,
        pricingErrors: [
          'Stop Sale is active for the selected RatePlan/date range.',
        ],
        availabilityStatus: 'STOP_SALE',
        hasRates: false,
        ratedNights,
        missingNights,
      };
    }

    /*
     * IMPORTANT:
     * Partial date coverage is NOT sellable.
     *
     * Previously this endpoint could price the
     * available nights and still return hasRates=true.
     */

    if (missingNights > 0) {
      pricingErrors.push(
        `No valid rate for ${missingNights} of ${nights} night(s): ${missingDates
          .slice(0, 5)
          .join(', ')}`,
      );

      return {
        nights,
        rooms,
        adults,
        children,
        ratePlanId: resolvedRatePlanId,
        ratePlanName: resolvedRatePlanName,
        mealPlan: resolvedMealPlan,
        pricingErrors:
          pricingErrors.slice(0, 5),
        availabilityStatus:
          'NO_RATE',
        hasRates: false,
        ratedNights,
        missingNights,
      };
    }

    /*
     * ------------------------------------------------------------
     * 8. CALCULATE NIGHT-BY-NIGHT
     * ------------------------------------------------------------
     */

    let totalNetPerRoom = 0;
    let totalSellPerRoom = 0;
    let totalMarkupPerRoom = 0;

    let lastRule:
      | MarkupRule
      | undefined;

    for (const date of dates) {
      const selected =
        bestRate(
          ratesByDate.get(date) ?? [],
        );

      if (!selected) {
        continue;
      }

      const netBase =
        netByOccupancy(
          adults,
          selected.adult1Rate,
          selected.adult2Rate,
          selected.adult3Rate,
        );

      /*
       * Child supplement.
       *
       * This retains the current schema's childSupplement
       * behavior. If UAEWB child-age rules are required,
       * this should be replaced with the dedicated
       * child-age/occupancy resolver.
       */
      const childCost =
        children > 0
          ? (selected.childSupplement ?? 0) *
            children
          : 0;

      const netNight =
        money(netBase + childCost);

      const rule =
        resolveMarkupRule(
          input.hotelId,
          markupRes.records as MarkupRule[],
          date,
        );

      lastRule = rule;

      const pricing =
        applyMarkup(
          netNight,
          rule,
          floor,
        );

      totalNetPerRoom += netNight;
      totalSellPerRoom += pricing.sell;
      totalMarkupPerRoom +=
        pricing.markup;
    }

    /*
     * ------------------------------------------------------------
     * 9. FINAL STATUS
     * ------------------------------------------------------------
     */

    let availabilityStatus:
      AvailabilityStatus = 'AVAILABLE';

    if (hasOnRequest) {
      availabilityStatus = 'ON_REQUEST';
    } else if (hasLimited) {
      availabilityStatus = 'LIMITED';
    }

    /*
     * No active markup is NOT a pricing failure.
     *
     * It means selling at net, unless business rules
     * require a mandatory margin.
     */

    if (!markupRes.records.length) {
      pricingErrors.push(
        'No active markup rule found. Selling at net cost.',
      );
    }

    /*
     * ------------------------------------------------------------
     * 10. FINAL MONEY
     * ------------------------------------------------------------
     */

    const totalNet =
      money(totalNetPerRoom * rooms);

    const totalSell =
      money(totalSellPerRoom * rooms);

    const totalMarkup =
      money(totalMarkupPerRoom * rooms);

    const avgNetPerNight =
      roundAED(
        totalNetPerRoom / nights,
      );

    const avgSellPerNight =
      roundAED(
        totalSellPerRoom / nights,
      );

    /*
     * ------------------------------------------------------------
     * 11. RETURN DETERMINISTIC RESULT
     * ------------------------------------------------------------
     */

    return {
      nights,
      rooms,
      adults,
      children,

      ratePlanId:
        resolvedRatePlanId,

      ratePlanName:
        resolvedRatePlanName,

      mealPlan:
        resolvedMealPlan,

      avgNetPerNight,
      avgSellPerNight,

      totalNet:
        roundAED(totalNet),

      totalSell:
        roundAED(totalSell),

      totalMarkup:
        roundAED(totalMarkup),

      markupType:
        lastRule?.markupType,

      markupValue:
        lastRule?.markupValue,

      pricingErrors:
        pricingErrors.slice(0, 5),

      availabilityStatus,

      hasRates:
        availabilityStatus ===
          'AVAILABLE' ||
        availabilityStatus ===
          'LIMITED' ||
        availabilityStatus ===
          'ON_REQUEST',

      ratedNights,
      missingNights,
    };
  },
});