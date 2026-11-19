import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import {
  CANONICAL_MEAL_PLANS,
  isSupportedAedRate,
  linkedId,
  safeNum,
} from '@project/pricing/hotelPricing';

const issueSchema = z.object({
  code: z.string(),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
});

export default createEndpoint({
  description: 'Validate a property\'s full commercial graph — profile, rooms, plans, tariff, availability — and return readiness steps and issues',
  inputSchema: z.object({ hotelId: z.string() }),
  outputSchema: z.object({
    steps: z.array(z.object({
      label: z.string(),
      complete: z.boolean(),
    })),
    issues: z.array(issueSchema),
    completedCount: z.number(),
    totalSteps: z.number(),
  }),
  execute: async ({ input }) => {
    const hotel = await zite.hotels.findOne({ id: input.hotelId });
    if (!hotel) throw new Error('Hotel not found');

    const issues: z.infer<typeof issueSchema>[] = [];

    // Step 1: Profile
    const profileOk = !!hotel.hotelName && !!hotel.starRating && !!hotel.emirate;
    if (!profileOk) issues.push({ code: 'PROFILE_INCOMPLETE', severity: 'error', message: 'Hotel profile is missing name, star rating, or emirate' });

    // Step 2: Room Types
    const { records: roomTypes } = await zite.roomTypes.findAll({
      filters: { hotel: { contains: input.hotelId } },
      limit: 100,
    });
    const activeRooms = roomTypes.filter(rt => rt.status !== 'Inactive');
    const roomsOk = activeRooms.length > 0;
    if (!roomsOk) issues.push({ code: 'NO_ACTIVE_ROOM_TYPES', severity: 'error', message: 'No active Room Types configured' });

    // Step 3: Rate Plans
    const { records: ratePlans } = await zite.ratePlans.findAll({
      filters: { hotel: { contains: input.hotelId } },
      limit: 200,
    });
    const activeRPs = ratePlans.filter(rp => rp.status === 'Active');
    const activeRoomIds = new Set(activeRooms.map(rt => rt.id));
    for (const rp of activeRPs) {
      const masterId = linkedId(rp.mealPlanMaster);
      const rpHotelId = linkedId(rp.hotel);
      const rpRoomId = linkedId(rp.roomType);

      if (rpHotelId !== input.hotelId) {
        issues.push({
          code: 'RATE_PLAN_HOTEL_MISMATCH', severity: 'error',
          message: `${rp.ratePlanName ?? 'Rate Plan'} does not belong to this property`,
          entityType: 'ratePlan', entityId: rp.id, entityName: rp.ratePlanName ?? undefined,
        });
      }
      if (!rpRoomId || !activeRoomIds.has(rpRoomId)) {
        issues.push({
          code: 'RATE_PLAN_ROOM_MISMATCH', severity: 'error',
          message: `${rp.ratePlanName ?? 'Rate Plan'} has no valid active Room Type`,
          entityType: 'ratePlan', entityId: rp.id, entityName: rp.ratePlanName ?? undefined,
        });
      }
      if (!rp.mealPlan || !CANONICAL_MEAL_PLANS.includes(rp.mealPlan as any) || !masterId) {
        issues.push({
          code: 'RATE_PLAN_MEAL_INCOMPLETE', severity: 'error',
          message: `${rp.ratePlanName ?? 'Rate Plan'} needs a canonical RO/BB/HB/FB/AI Meal Plan master`,
          entityType: 'ratePlan', entityId: rp.id, entityName: rp.ratePlanName ?? undefined,
        });
      }
      if (!isSupportedAedRate(undefined, rp.sellCurrency)) {
        issues.push({
          code: 'RATE_PLAN_CURRENCY_INVALID', severity: 'error',
          message: `${rp.ratePlanName ?? 'Rate Plan'} is not configured for AED selling`,
          entityType: 'ratePlan', entityId: rp.id, entityName: rp.ratePlanName ?? undefined,
        });
      }
      if (rp.mealPlan === 'Room Only' && /bed\s*(?:&|and)\s*breakfast|\bBB\b/i.test(rp.ratePlanName ?? '')) {
        issues.push({
          code: 'RATE_PLAN_NAME_MEAL_CONFLICT', severity: 'warning',
          message: `${rp.ratePlanName} says breakfast, but the assigned Meal Plan is Room Only`,
          entityType: 'ratePlan', entityId: rp.id, entityName: rp.ratePlanName ?? undefined,
        });
      }
    }
    const plansOk = activeRPs.length > 0;
    if (!plansOk) issues.push({ code: 'NO_ACTIVE_RATE_PLANS', severity: 'error', message: 'No active Rate Plans configured' });

    // Check rooms without rate plans
    for (const rt of activeRooms) {
      const roomRPs = activeRPs.filter(rp => {
        const rpRoomId = Array.isArray(rp.roomType) ? rp.roomType[0] : rp.roomType;
        return rpRoomId === rt.id;
      });
      if (roomRPs.length === 0) {
        issues.push({
          code: 'RATE_PLAN_NOT_FOUND',
          severity: 'error',
          message: `${rt.roomTypeName} has no active Rate Plan`,
          entityType: 'roomType',
          entityId: rt.id,
          entityName: rt.roomTypeName ?? undefined,
        });
      }
    }

    // Step 4: Tariff — check daily rates exist for next 90 days
    const today = new Date().toISOString().split('T')[0];
    const d90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

    const tariffResult = await zite.sql({
      query: `
        SELECT COUNT(DISTINCT dr."rateDate") AS "coveredDays"
        FROM "DailyRates" dr
        JOIN "DailyRatesHotels" dh ON dh."dailyRatesId" = dr.id
        JOIN "DailyRatesRoomTypes" drt ON drt."dailyRatesId" = dr.id
        JOIN "DailyRatesRatePlans" drp ON drp."dailyRatesId" = dr.id
        JOIN "RatePlans" rp ON rp.id = drp."ratePlansId"
        JOIN "RatePlansRoomTypes" rprt ON rprt."ratePlansId" = rp.id
        JOIN "HotelsRatePlans" hrp ON hrp."ratePlansId" = rp.id
        JOIN "MealPlansRatePlans" mprp ON mprp."ratePlansId" = rp.id
        WHERE dh."hotelsId" = $1
          AND hrp."hotelsId" = $1
          AND rprt."roomTypesId" = drt."roomTypesId"
          AND dr."rateDate" >= $2::date
          AND dr."rateDate" <= $3::date
          AND (dr."integrityStatus" IS NULL OR dr."integrityStatus" != 'Quarantined')
          AND (dr."currency" IS NULL OR dr."currency" = 'AED')
          AND (rp."sellCurrency" IS NULL OR rp."sellCurrency" = 'AED')
          AND rp."status" = 'Active'
          AND rp."mealPlan" IN ('Room Only','Bed & Breakfast','Half Board','Full Board','All Inclusive')
          AND dr."status" IN ('Free Sale','Limited')
          AND COALESCE(dr."allocation", 0) > 0
          AND (COALESCE(dr."adult1Rate",0) > 0 OR COALESCE(dr."adult2Rate",0) > 0 OR COALESCE(dr."adult3Rate",0) > 0)
      `,
      params: [input.hotelId, today, d90],
    });
    const coveredDays = Number(tariffResult.rows[0]?.coveredDays ?? 0);
    const tariffOk = coveredDays > 0;
    if (!tariffOk) issues.push({ code: 'NO_TARIFF_COVERAGE', severity: 'error', message: 'No daily rates for the next 90 days' });

    // Check for rate plan / room mismatches
    const mismatchResult = await zite.sql({
      query: `
        SELECT dr.id, dr."rateDate", dr."ratePlanId"
        FROM "DailyRates" dr
        JOIN "DailyRatesHotels" dh ON dh."dailyRatesId" = dr.id
        JOIN "DailyRatesRoomTypes" drt ON drt."dailyRatesId" = dr.id
        JOIN "DailyRatesRatePlans" drp ON drp."dailyRatesId" = dr.id
        JOIN "RatePlans" rp ON rp.id = drp."ratePlansId"
        JOIN "RatePlansRoomTypes" rprt ON rprt."ratePlansId" = rp.id
        WHERE dh."hotelsId" = $1
          AND rprt."roomTypesId" != drt."roomTypesId"
        LIMIT 20
      `,
      params: [input.hotelId],
    });
    if (mismatchResult.rows.length > 0) {
      issues.push({
        code: 'RATE_PLAN_ROOM_MISMATCH',
        severity: 'error',
        message: `${mismatchResult.rows.length} Daily Rate(s) reference a Rate Plan on another room type`,
      });
    }

    // Check for orphan daily rates (no rate plan link)
    const orphanResult = await zite.sql({
      query: `
        SELECT COUNT(*) AS "orphanCount"
        FROM "DailyRates" dr
        JOIN "DailyRatesHotels" dh ON dh."dailyRatesId" = dr.id
        LEFT JOIN "DailyRatesRatePlans" drp ON drp."dailyRatesId" = dr.id
        WHERE dh."hotelsId" = $1
          AND drp."ratePlansId" IS NULL
      `,
      params: [input.hotelId],
    });
    const orphanCount = Number(orphanResult.rows[0]?.orphanCount ?? 0);
    if (orphanCount > 0) {
      issues.push({
        code: 'DAILY_RATE_ORPHANED',
        severity: 'warning',
        message: `${orphanCount} Daily Rate(s) lack a verified Rate Plan link`,
      });
    }

    // Step 5: Availability uses the same exact commercial validity gate as Tariff.
    // This prevents Admin from appearing sellable while Sales correctly fails closed.
    const availOk = tariffOk;
    if (!availOk) {
      issues.push({ code: 'NO_AVAILABILITY', severity: 'warning', message: 'No verified Free Sale or Limited AED inventory in the next 90 days' });
    }

    // Step 6: Validation = no hard errors
    const hardErrors = issues.filter(i => i.severity === 'error');
    const validationOk = hardErrors.length === 0;

    // Step 7: Published
    const isPublished = (hotel as any).lifecycleStatus === 'published' || (hotel as any).lifecycleStatus === 'Published';
    const publishedOk = isPublished && validationOk;
    if (isPublished && !validationOk) {
      issues.push({
        code: 'PUBLISHED_WITH_INTEGRITY_ERRORS',
        severity: 'error',
        message: 'Property is published but fails current commercial integrity validation',
      });
    }

    const steps = [
      { label: '01 Profile', complete: profileOk },
      { label: '02 Room Types', complete: roomsOk },
      { label: '03 Rate Plans', complete: plansOk },
      { label: '04 Tariff', complete: tariffOk },
      { label: '05 Availability', complete: availOk },
      { label: '06 Validation', complete: validationOk },
      { label: '07 Publish', complete: publishedOk },
    ];

    // Update hotel integrity fields
    await zite.hotels.update({
      id: input.hotelId,
      record: {
        lastValidatedAt: new Date().toISOString(),
        openIntegrityIssues: issues.length,
      },
    });

    return {
      steps,
      issues,
      completedCount: steps.filter(s => s.complete).length,
      totalSteps: steps.length,
    };
  },
});
