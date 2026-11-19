import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Scan all hotel, room type and rate plan links using current records',
  inputSchema: z.object({}),
  outputSchema: z.object({
    totalProperties: z.number(),
    healthy: z.number(),
    warnings: z.number(),
    needsRepair: z.number(),
    issues: z.array(z.object({
      code: z.string(),
      count: z.number(),
      severity: z.enum(['error', 'warning']),
      description: z.string(),
    })),
  }),
  execute: async () => {
    const count = async (query: string) => {
      const result = await zite.sql({ query });
      return Number(result.rows[0]?.cnt ?? 0);
    };

    const [
      totalProperties, healthy, emptyHotels, unassignedRooms, unassignedPlans, roomsWithoutPlans,
      missingMeal, missingMaster, mealMismatch, roomMismatch, orphanRates, unlinkedReferences,
    ] = await Promise.all([
      count('SELECT COUNT(*) AS cnt FROM "Hotels"'),
      count(`
        SELECT COUNT(*) AS cnt FROM "Hotels" h
        WHERE EXISTS (SELECT 1 FROM "HotelsRoomTypes" hr JOIN "RoomTypes" r ON r.id = hr."roomTypesId"
                      WHERE hr."hotelsId" = h.id AND r."status" = 'Active')
          AND EXISTS (SELECT 1 FROM "HotelsRatePlans" hp JOIN "RatePlans" p ON p.id = hp."ratePlansId"
                      WHERE hp."hotelsId" = h.id AND p."status" = 'Active')
          AND NOT EXISTS (
            SELECT 1 FROM "HotelsRoomTypes" hr JOIN "RoomTypes" r ON r.id = hr."roomTypesId"
            WHERE hr."hotelsId" = h.id AND r."status" = 'Active'
              AND NOT EXISTS (
                SELECT 1 FROM "RatePlansRoomTypes" pr
                JOIN "RatePlans" p ON p.id = pr."ratePlansId"
                JOIN "HotelsRatePlans" hp ON hp."ratePlansId" = p.id
                WHERE pr."roomTypesId" = r.id AND hp."hotelsId" = h.id AND p."status" = 'Active'
              )
          )
          AND NOT EXISTS (
            SELECT 1 FROM "HotelsRatePlans" hp
            JOIN "RatePlans" p ON p.id = hp."ratePlansId"
            LEFT JOIN "MealPlansRatePlans" pm ON pm."ratePlansId" = p.id
            WHERE hp."hotelsId" = h.id AND p."status" = 'Active'
              AND (pm."mealPlansId" IS NULL OR p."mealPlan" IS NULL)
          )
          AND NOT EXISTS (
            SELECT 1 FROM "DailyRatesHotels" dh
            JOIN "DailyRates" dr ON dr.id = dh."dailyRatesId"
            LEFT JOIN "DailyRatesRatePlans" dp ON dp."dailyRatesId" = dr.id
            WHERE dh."hotelsId" = h.id AND dp."ratePlansId" IS NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM "DailyRatesHotels" dh
            JOIN "DailyRatesRatePlans" dp ON dp."dailyRatesId" = dh."dailyRatesId"
            JOIN "RatePlansRoomTypes" pr ON pr."ratePlansId" = dp."ratePlansId"
            JOIN "DailyRatesRoomTypes" drt ON drt."dailyRatesId" = dh."dailyRatesId"
            WHERE dh."hotelsId" = h.id AND pr."roomTypesId" != drt."roomTypesId"
          )
      `),
      count(`
        SELECT COUNT(*) AS cnt FROM "Hotels" h
        WHERE NOT EXISTS (SELECT 1 FROM "HotelsRoomTypes" hr WHERE hr."hotelsId" = h.id)
      `),
      count(`SELECT COUNT(*) AS cnt FROM "RoomTypes" r LEFT JOIN "HotelsRoomTypes" hr ON hr."roomTypesId" = r.id WHERE hr."hotelsId" IS NULL`),
      count(`SELECT COUNT(*) AS cnt FROM "RatePlans" p LEFT JOIN "HotelsRatePlans" hp ON hp."ratePlansId" = p.id WHERE hp."hotelsId" IS NULL`),
      count(`
        SELECT COUNT(*) AS cnt FROM "RoomTypes" r JOIN "HotelsRoomTypes" hr ON hr."roomTypesId" = r.id
        WHERE r."status" = 'Active' AND NOT EXISTS (
          SELECT 1 FROM "RatePlansRoomTypes" pr
          JOIN "RatePlans" p ON p.id = pr."ratePlansId"
          JOIN "HotelsRatePlans" hp ON hp."ratePlansId" = p.id AND hp."hotelsId" = hr."hotelsId"
          WHERE pr."roomTypesId" = r.id AND p."status" = 'Active'
        )
      `),
      count(`SELECT COUNT(*) AS cnt FROM "RatePlans" p WHERE p."status" = 'Active' AND (p."mealPlan" IS NULL OR p."mealPlan" = '')`),
      count(`
        SELECT COUNT(*) AS cnt FROM "RatePlans" p
        LEFT JOIN "MealPlansRatePlans" pm ON pm."ratePlansId" = p.id
        WHERE p."status" = 'Active' AND pm."mealPlansId" IS NULL
      `),
      count(`
        SELECT COUNT(*) AS cnt FROM "RatePlans" p
        JOIN "MealPlansRatePlans" pm ON pm."ratePlansId" = p.id
        JOIN "MealPlans" m ON m.id = pm."mealPlansId"
        WHERE m."code" IN ('RO','BB','HB','FB','AI') AND p."mealPlan" != m."agentLabel"
      `),
      count(`
        SELECT COUNT(DISTINCT dr.id) AS cnt FROM "DailyRates" dr
        JOIN "DailyRatesRatePlans" dp ON dp."dailyRatesId" = dr.id
        JOIN "RatePlansRoomTypes" pr ON pr."ratePlansId" = dp."ratePlansId"
        JOIN "DailyRatesRoomTypes" drt ON drt."dailyRatesId" = dr.id
        WHERE pr."roomTypesId" != drt."roomTypesId"
      `),
      count(`
        SELECT COUNT(*) AS cnt FROM "DailyRates" dr
        LEFT JOIN "DailyRatesRatePlans" dp ON dp."dailyRatesId" = dr.id
        WHERE dp."ratePlansId" IS NULL AND (dr."ratePlanId" IS NULL OR dr."ratePlanId" = '')
      `),
      count(`
        SELECT COUNT(*) AS cnt FROM "DailyRates" dr
        LEFT JOIN "DailyRatesRatePlans" dp ON dp."dailyRatesId" = dr.id
        WHERE dp."ratePlansId" IS NULL AND dr."ratePlanId" IS NOT NULL AND dr."ratePlanId" != ''
      `),
    ]);

    const issues: { code: string; count: number; severity: 'error' | 'warning'; description: string }[] = [];
    const add = (code: string, n: number, severity: 'error' | 'warning', description: string) => {
      if (n > 0) issues.push({ code, count: n, severity, description });
    };
    add('HOTEL_WITHOUT_ROOM_TYPES', emptyHotels, 'error', 'Hotels with no linked Room Type');
    add('ROOM_WITHOUT_HOTEL', unassignedRooms, 'error', 'Room Types with no verified hotel link');
    add('RATE_PLAN_WITHOUT_HOTEL', unassignedPlans, 'error', 'Rate Plans with no verified hotel link');
    add('ROOM_WITHOUT_ACTIVE_RATE_PLAN', roomsWithoutPlans, 'error', 'Linked active Room Types with no active Rate Plan');
    add('RATE_PLAN_ROOM_MISMATCH', roomMismatch, 'error', 'Daily Rates assigned to a Rate Plan on another Room Type');
    add('DAILY_RATE_ORPHANED', orphanRates, 'error', 'Daily Rates without any Rate Plan identifier');
    add('RATE_PLAN_LINK_MISSING', unlinkedReferences, 'error', 'Daily Rates with an unverified Rate Plan ID but no link');
    add('MEAL_PLAN_MISSING', missingMeal, 'error', 'Active Rate Plans without a Meal Plan label');
    add('MEAL_PLAN_MASTER_MISSING', missingMaster, 'warning', 'Active Rate Plans without a linked Meal Plan master');
    add('MEAL_PLAN_MASTER_MISMATCH', mealMismatch, 'error', 'Rate Plans whose label disagrees with their Meal Plan master');

    return { totalProperties, healthy, warnings: 0, needsRepair: totalProperties - healthy, issues };
  },
});
