import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { auditMarkupRule, auditRatePlan } from '@project/pricing/ratePlanAudit';

const statusSchema = z.enum(['PASS','WARN','FAIL']);

export default createEndpoint({
  authenticated: true,
  description: 'Read-only authoritative Rate Plan, Daily Rate and markup certification audit',
  inputSchema: z.object({
    horizonDays: z.number().int().min(1).max(365).default(90),
    hotelId: z.string().optional(),
  }),
  outputSchema: z.object({
    checkedAt: z.string(),
    horizonDays: z.number(),
    verdict: z.enum(['PASS','PASS WITH WARNINGS','NOT PASS']),
    summary: z.object({
      hotels: z.number(),
      ratePlans: z.number(),
      activeRatePlans: z.number(),
      pass: z.number(),
      warn: z.number(),
      fail: z.number(),
      dailyRates: z.number(),
      quarantinedDailyRates: z.number(),
      orphanedDailyRates: z.number(),
      duplicateCommercialKeys: z.number(),
      malformedActiveMarkupRules: z.number(),
    }),
    ratePlans: z.array(z.object({
      ratePlanId: z.string(),
      hotelId: z.string().optional(),
      hotelName: z.string().optional(),
      roomTypeId: z.string().optional(),
      roomTypeName: z.string().optional(),
      code: z.string().optional(),
      name: z.string(),
      mealPlan: z.string().optional(),
      sourceMarket: z.string().optional(),
      currency: z.string().optional(),
      status: z.string(),
      certificationStatus: statusSchema,
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
      dailyRateCount: z.number(),
      usableDailyRates: z.number(),
      sellableDateCount: z.number(),
      quarantinedRows: z.number(),
      stopSaleRows: z.number(),
      duplicateKeys: z.number(),
      nullLayerRows: z.number(),
      zeroRateRows: z.number(),
      invalidCurrencyRows: z.number(),
    })),
    markupIssues: z.array(z.object({
      ruleId: z.string(),
      ruleName: z.string().optional(),
      errors: z.array(z.string()),
    })),
    p0: z.array(z.object({ code: z.string(), count: z.number(), description: z.string() })),
    p1: z.array(z.object({ code: z.string(), count: z.number(), description: z.string() })),
    p2: z.array(z.object({ code: z.string(), count: z.number(), description: z.string() })),
  }),
  execute: async ({ input }) => {
    const checkedAt = new Date().toISOString();
    const start = checkedAt.slice(0,10);
    const endDate = new Date(start + 'T00:00:00Z');
    endDate.setUTCDate(endDate.getUTCDate() + input.horizonDays);
    const end = endDate.toISOString().slice(0,10);

    const planResult = await zite.sql({
      query: `
        WITH plan_links AS (
          SELECT rp.id,
                 rp."ratePlanName", rp."ratePlanCode", rp."status", rp."mealPlan",
                 rp."sellCurrency", rp."nationalityMarket", rp."minStayNights", rp."maxStayNights",
                 rp."cancellationType", rp."notes",
                 hp."hotelsId" AS "hotelId",
                 h."hotelName" AS "hotelName",
                 rr."roomTypesId" AS "roomTypeId",
                 rt."roomTypeName" AS "roomTypeName",
                 hr."hotelsId" AS "roomHotelId",
                 mr."mealPlansId" AS "mealPlanMasterId"
          FROM "RatePlans" rp
          LEFT JOIN "HotelsRatePlans" hp ON hp."ratePlansId" = rp.id
          LEFT JOIN "Hotels" h ON h.id = hp."hotelsId"
          LEFT JOIN "RatePlansRoomTypes" rr ON rr."ratePlansId" = rp.id
          LEFT JOIN "RoomTypes" rt ON rt.id = rr."roomTypesId"
          LEFT JOIN "HotelsRoomTypes" hr ON hr."roomTypesId" = rr."roomTypesId"
          LEFT JOIN "MealPlansRatePlans" mr ON mr."ratePlansId" = rp.id
          WHERE ($1::text IS NULL OR hp."hotelsId" = $1::uuid)
        ),
        code_counts AS (
          SELECT hp."hotelsId" AS "hotelId", UPPER(TRIM(rp."ratePlanCode")) AS code, COUNT(*) AS cnt
          FROM "RatePlans" rp
          LEFT JOIN "HotelsRatePlans" hp ON hp."ratePlansId" = rp.id
          WHERE COALESCE(TRIM(rp."ratePlanCode"), '') <> ''
          GROUP BY hp."hotelsId", UPPER(TRIM(rp."ratePlanCode"))
        ),
        rate_stats AS (
          SELECT drp."ratePlansId" AS "ratePlanId",
                 COUNT(*) AS "dailyRateCount",
                 COUNT(*) FILTER (WHERE COALESCE(dr."integrityStatus",'Valid') <> 'Quarantined'
                                  AND (COALESCE(dr."adult1Rate",0)>0 OR COALESCE(dr."adult2Rate",0)>0 OR COALESCE(dr."adult3Rate",0)>0)
                                  AND COALESCE(dr."currency",'AED')='AED') AS "usableDailyRates",
                 COUNT(*) FILTER (WHERE dr."integrityStatus"='Quarantined') AS "quarantinedRows",
                 COUNT(*) FILTER (WHERE dr."status"='Stop Sale') AS "stopSaleRows",
                 COUNT(*) FILTER (WHERE dr."layer" IS NULL OR dr."layer"='') AS "nullLayerRows",
                 COUNT(*) FILTER (WHERE COALESCE(dr."adult1Rate",0)<=0 AND COALESCE(dr."adult2Rate",0)<=0 AND COALESCE(dr."adult3Rate",0)<=0) AS "zeroRateRows",
                 COUNT(*) FILTER (WHERE COALESCE(dr."currency",'')<>'AED') AS "invalidCurrencyRows",
                 COUNT(DISTINCT dr."rateDate") FILTER (
                   WHERE dr."rateDate" >= $2::date AND dr."rateDate" < $3::date
                     AND COALESCE(dr."integrityStatus",'Valid') <> 'Quarantined'
                     AND COALESCE(dr."status",'') NOT IN ('Stop Sale','On Request')
                     AND COALESCE(dr."allocation",0) > 0
                     AND COALESCE(dr."currency",'AED')='AED'
                     AND (COALESCE(dr."adult1Rate",0)>0 OR COALESCE(dr."adult2Rate",0)>0 OR COALESCE(dr."adult3Rate",0)>0)
                 ) AS "sellableDateCount"
          FROM "DailyRatesRatePlans" drp
          JOIN "DailyRates" dr ON dr.id = drp."dailyRatesId"
          GROUP BY drp."ratePlansId"
        ),
        duplicate_stats AS (
          SELECT "ratePlanId", COUNT(*) AS "duplicateKeys"
          FROM (
            SELECT drp."ratePlansId" AS "ratePlanId", dh."hotelsId", drt."roomTypesId", dr."rateDate", COUNT(*) AS c
            FROM "DailyRates" dr
            JOIN "DailyRatesRatePlans" drp ON drp."dailyRatesId"=dr.id
            LEFT JOIN "DailyRatesHotels" dh ON dh."dailyRatesId"=dr.id
            LEFT JOIN "DailyRatesRoomTypes" drt ON drt."dailyRatesId"=dr.id
            GROUP BY drp."ratePlansId", dh."hotelsId", drt."roomTypesId", dr."rateDate"
            HAVING COUNT(*) > 1
          ) x
          GROUP BY "ratePlanId"
        )
        SELECT pl.*,
               COALESCE(cc.cnt,0) AS "codeDuplicateCount",
               COALESCE(rs."dailyRateCount",0) AS "dailyRateCount",
               COALESCE(rs."usableDailyRates",0) AS "usableDailyRates",
               COALESCE(rs."quarantinedRows",0) AS "quarantinedRows",
               COALESCE(rs."stopSaleRows",0) AS "stopSaleRows",
               COALESCE(rs."nullLayerRows",0) AS "nullLayerRows",
               COALESCE(rs."zeroRateRows",0) AS "zeroRateRows",
               COALESCE(rs."invalidCurrencyRows",0) AS "invalidCurrencyRows",
               COALESCE(rs."sellableDateCount",0) AS "sellableDateCount",
               COALESCE(ds."duplicateKeys",0) AS "duplicateKeys"
        FROM plan_links pl
        LEFT JOIN code_counts cc ON cc."hotelId" = pl."hotelId" AND cc.code = UPPER(TRIM(pl."ratePlanCode"))
        LEFT JOIN rate_stats rs ON rs."ratePlanId" = pl.id
        LEFT JOIN duplicate_stats ds ON ds."ratePlanId" = pl.id
        ORDER BY pl."hotelName" NULLS LAST, pl."roomTypeName" NULLS LAST, pl."ratePlanName"
      `,
      params: [input.hotelId || null, start, end],
    });

    const estate = await zite.sql({
      query: `
        SELECT
          (SELECT COUNT(*) FROM "Hotels") AS hotels,
          (SELECT COUNT(*) FROM "RatePlans") AS "ratePlans",
          (SELECT COUNT(*) FROM "RatePlans" WHERE "status"='Active') AS "activeRatePlans",
          (SELECT COUNT(*) FROM "DailyRates") AS "dailyRates",
          (SELECT COUNT(*) FROM "DailyRates" WHERE "integrityStatus"='Quarantined') AS "quarantinedDailyRates",
          (SELECT COUNT(*) FROM "DailyRates" dr
             LEFT JOIN "DailyRatesRatePlans" rp ON rp."dailyRatesId"=dr.id
             LEFT JOIN "DailyRatesHotels" dh ON dh."dailyRatesId"=dr.id
             LEFT JOIN "DailyRatesRoomTypes" rt ON rt."dailyRatesId"=dr.id
             WHERE rp."ratePlansId" IS NULL OR dh."hotelsId" IS NULL OR rt."roomTypesId" IS NULL
          ) AS "orphanedDailyRates",
          (SELECT COUNT(*) FROM (
             SELECT dh."hotelsId", rt."roomTypesId", rp."ratePlansId", dr."rateDate"
             FROM "DailyRates" dr
             LEFT JOIN "DailyRatesHotels" dh ON dh."dailyRatesId"=dr.id
             LEFT JOIN "DailyRatesRoomTypes" rt ON rt."dailyRatesId"=dr.id
             LEFT JOIN "DailyRatesRatePlans" rp ON rp."dailyRatesId"=dr.id
             GROUP BY dh."hotelsId", rt."roomTypesId", rp."ratePlansId", dr."rateDate"
             HAVING COUNT(*)>1
          ) d) AS "duplicateCommercialKeys"
      `,
    });

    const markupRes = await zite.markupRules.findAll({ filters: { isActive: true }, limit: 500 });
    const markupIssues = markupRes.records
      .map(rule => ({ ruleId: rule.id, ruleName: rule.ruleName, errors: auditMarkupRule(rule) }))
      .filter(x => x.errors.length > 0);

    const ratePlans = (planResult.rows as any[]).map(row => {
      const audit = auditRatePlan({
        ratePlanId: row.id,
        hotelId: row.hotelId,
        roomTypeId: row.roomTypeId,
        roomHotelId: row.roomHotelId,
        code: row.ratePlanCode,
        name: row.ratePlanName,
        status: row.status,
        mealPlan: row.mealPlan,
        mealPlanMasterId: row.mealPlanMasterId,
        sellCurrency: row.sellCurrency,
        sourceMarket: row.nationalityMarket,
        minStay: Number(row.minStayNights || 0),
        maxStay: Number(row.maxStayNights || 0),
        cancellationType: row.cancellationType,
        notes: row.notes,
        codeDuplicateCount: Number(row.codeDuplicateCount || 0),
        dailyRateCount: Number(row.dailyRateCount || 0),
        usableDailyRateCount: Number(row.usableDailyRates || 0),
        quarantinedRows: Number(row.quarantinedRows || 0),
        stopSaleRows: Number(row.stopSaleRows || 0),
        zeroRateRows: Number(row.zeroRateRows || 0),
        invalidCurrencyRows: Number(row.invalidCurrencyRows || 0),
        nullLayerRows: Number(row.nullLayerRows || 0),
        duplicateKeys: Number(row.duplicateKeys || 0),
        sellableDateCount: Number(row.sellableDateCount || 0),
        coverageDays: input.horizonDays,
      });
      return {
        ...audit,
        hotelName: row.hotelName || undefined,
        roomTypeName: row.roomTypeName || undefined,
        mealPlan: row.mealPlan || undefined,
        sourceMarket: row.nationalityMarket || undefined,
        currency: row.sellCurrency || undefined,
        dailyRateCount: Number(row.dailyRateCount || 0),
        usableDailyRates: Number(row.usableDailyRates || 0),
        sellableDateCount: Number(row.sellableDateCount || 0),
        quarantinedRows: Number(row.quarantinedRows || 0),
        stopSaleRows: Number(row.stopSaleRows || 0),
        duplicateKeys: Number(row.duplicateKeys || 0),
        nullLayerRows: Number(row.nullLayerRows || 0),
        zeroRateRows: Number(row.zeroRateRows || 0),
        invalidCurrencyRows: Number(row.invalidCurrencyRows || 0),
      };
    });

    const fail = ratePlans.filter(x => x.certificationStatus === 'FAIL').length;
    const warn = ratePlans.filter(x => x.certificationStatus === 'WARN').length;
    const pass = ratePlans.filter(x => x.certificationStatus === 'PASS').length;
    const e:any = estate.rows[0] || {};

    const countError = (code:string) => ratePlans.filter(r => r.errors.includes(code)).length;
    const countWarn = (code:string) => ratePlans.filter(r => r.warnings.includes(code)).length;
    const p0 = [
      { code:'RATE_PLAN_HOTEL_MISSING', count:countError('RATE_PLAN_HOTEL_MISSING'), description:'Rate Plans without a Hotel link' },
      { code:'RATE_PLAN_ROOM_MISSING', count:countError('RATE_PLAN_ROOM_MISSING'), description:'Rate Plans without a Room Type link' },
      { code:'ACTIVE_PLAN_NO_USABLE_DAILY_RATES', count:countError('ACTIVE_PLAN_NO_USABLE_DAILY_RATES'), description:'Active Rate Plans without usable Daily Rates' },
      { code:'ACTIVE_PLAN_QUARANTINED_ONLY', count:countError('ACTIVE_PLAN_QUARANTINED_ONLY'), description:'Active Rate Plans whose Daily Rates are all quarantined' },
      { code:'ORPHANED_DAILY_RATES', count:Number(e.orphanedDailyRates || 0), description:'Daily Rates missing Hotel, Room Type or Rate Plan link' },
      { code:'MALFORMED_ACTIVE_MARKUP_RULE', count:markupIssues.length, description:'Active markup rules that fail commercial validation' },
    ].filter(x => x.count > 0);

    const p1 = [
      { code:'RATE_PLAN_CODE_MISSING', count:countError('RATE_PLAN_CODE_MISSING'), description:'Rate Plans missing authoritative codes' },
      { code:'SOURCE_MARKET_MISSING', count:countError('SOURCE_MARKET_MISSING'), description:'Rate Plans with blank Nationality / Market' },
      { code:'DAILY_RATE_LAYER_MISSING', count:countWarn('DAILY_RATE_LAYER_MISSING'), description:'Rate Plans containing Daily Rates with no Layer' },
      { code:'ZERO_OR_NEGATIVE_RATE_ROWS', count:countWarn('ZERO_OR_NEGATIVE_RATE_ROWS'), description:'Rate Plans containing non-positive occupancy rates' },
      { code:'INCOMPLETE_FUTURE_COVERAGE', count:countWarn('INCOMPLETE_FUTURE_COVERAGE'), description:'Rate Plans without full requested-horizon coverage' },
    ].filter(x => x.count > 0);

    const p2 = [
      { code:'CANCELLATION_METADATA_INCOMPLETE', count:countWarn('CANCELLATION_METADATA_INCOMPLETE'), description:'Rate Plans missing cancellation metadata' },
      { code:'RATE_PLAN_CODE_NONSTANDARD', count:countWarn('RATE_PLAN_CODE_NONSTANDARD'), description:'Rate Plan code naming does not match recommended standard' },
      { code:'DUPLICATE_COMMERCIAL_KEYS', count:countWarn('DUPLICATE_COMMERCIAL_KEYS'), description:'Rate Plans with duplicate Hotel + Room + Plan + Date keys' },
    ].filter(x => x.count > 0);

    const verdict = p0.length ? 'NOT PASS' : fail ? 'NOT PASS' : warn || markupIssues.length ? 'PASS WITH WARNINGS' : 'PASS';

    return {
      checkedAt,
      horizonDays: input.horizonDays,
      verdict,
      summary: {
        hotels: Number(e.hotels || 0),
        ratePlans: Number(e.ratePlans || 0),
        activeRatePlans: Number(e.activeRatePlans || 0),
        pass, warn, fail,
        dailyRates: Number(e.dailyRates || 0),
        quarantinedDailyRates: Number(e.quarantinedDailyRates || 0),
        orphanedDailyRates: Number(e.orphanedDailyRates || 0),
        duplicateCommercialKeys: Number(e.duplicateCommercialKeys || 0),
        malformedActiveMarkupRules: markupIssues.length,
      },
      ratePlans,
      markupIssues,
      p0, p1, p2,
    };
  },
});
