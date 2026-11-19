import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { eventSupplementForNight, loadHotelEventRules } from '../lib/hotelEventPricing';
import { loadMarketContext, resolveRatePlanEligibility } from '../lib/marketEligibility';
import {
  applyMarkup as applyCanonicalMarkup,
  isSupportedAedRate,
  linkedId,
  resolveEffectiveRate,
  resolveMarkupRule,
  resolveInventoryGovernance,
  safeNum,
  validateStayRestrictions,
} from '@project/pricing/hotelPricing';
import { inventoryKey, loadInventoryConsumption, remainingAllocation } from '@project/pricing/inventoryLedger';

const dailyRateSchema = z.object({
  date: z.string(),
  roomTypeId: z.string(),
  ratePlanId: z.string(),
  ratePlanName: z.string(),
  mealPlan: z.string(),
  baseRate: z.number(),
  childSupplement: z.number(),
  extraBedRate: z.number(),
  netRate: z.number(),
  displayRate: z.number(), // sell rate (markup applied)
  adult1Sell: z.number(),
  adult2Sell: z.number(),
  adult3Sell: z.number(),
  childSell: z.number(),
  status: z.string(),
  rateType: z.enum(['Contract', 'Supplement', 'Stop Sale']),
  allocation: z.number().nullable(),
  occupancyNote: z.string(),
  cancellationSummary: z.string(),
  eventSupplement: z.number(),
  eventNames: z.array(z.string()),
});

export default createEndpoint({
  description: 'Fetches hotel profile with room types and 6-month daily rate calendar (occupancy-aware, markup-applied, child-age-aware)',
  inputSchema: z.object({
    hotelId: z.string(),
    adults: z.number().optional(),
    children: z.number().optional(),
    rooms: z.number().optional(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    childAges: z.array(z.number()).optional(), // ages of children per booking (used for supplement logic)
    nationality: z.string().trim().min(2).max(3).optional(),
    extraMarkupPct: z.number().min(0).max(50).optional(),
  }),
  outputSchema: z.object({
    hotel: z.object({
      id: z.string(),
      name: z.string(),
      location: z.string(),
      emirate: z.string(),
      starRating: z.string(),
      description: z.string(),
      imageUrl: z.string().nullable(),
    }),
    roomTypes: z.array(z.object({
      id: z.string(),
      name: z.string(),
      mealPlan: z.string(),
      maxAdults: z.number().nullable(),
      maxChildren: z.number().nullable(),
      maxOccupancy: z.number().nullable(),
      beddingType: z.string(),
      views: z.string(),
      inclusions: z.string(),
      childAllowed: z.boolean(),
      extraBedAllowed: z.boolean(),
      occupancyWarning: z.string().nullable(),
    })),
    dailyRates: z.array(dailyRateSchema),
    markupLabel: z.string(),
  }),
  execute: async ({ input }) => {
    const { hotelId, adults = 2, children = 0, rooms = 1, checkIn, checkOut, childAges } = input;
    const requestedMarket = input.nationality?.toUpperCase();
    const publicMarkupPct = Math.min(50, Math.max(0, input.extraMarkupPct || 0));
    const marketContext = await loadMarketContext(zite);
    const adultsPerRoom = rooms > 0 ? Math.max(1, Math.round(adults / rooms)) : adults;
    const childrenPerRoom = rooms > 0 ? Math.round(children / rooms) : children;
    const requestedNights = checkIn && checkOut
      ? Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
      : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const windowStart = checkIn && checkIn < todayStr ? checkIn : todayStr;
    const windowEndDate = new Date(today);
    windowEndDate.setDate(windowEndDate.getDate() + 183); // 6 months
    const windowEnd = checkOut && checkOut > windowEndDate.toISOString().split('T')[0] ? checkOut : windowEndDate.toISOString().split('T')[0];

    const [hotelRes, roomTypesRes, ratePlansRes, markupRulesRes, dailyRatesSql, eventRules] = await Promise.all([
      zite.hotels.findOne({ id: hotelId }),
      zite.roomTypes.findAll({ filters: { hotel: hotelId as any }, limit: 500 }),
      zite.ratePlans.findAll({ filters: { hotel: hotelId as any }, limit: 1000 }),
      zite.markupRules.findAll({ filters: { isActive: true }, limit: 200 }),
      zite.sql({
        query: `
          SELECT dr.id, dr."rateDate", dr."adult1Rate", dr."adult2Rate", dr."adult3Rate",
                 dr."childSupplement", dr."extraBedRate", dr."allocation", dr."status",
                 dr."layer", dr."priority", dr."ratePlanId", dr."occupancyKey", dr."childRate05",
                 dr."childRate611", dr."rateSource", dr."minStay", dr."maxStay",
                 dr."cta", dr."ctd", dr."leadDays", dr."currency", dr.updated_at AS "updatedAt",
                 l_h."hotelsId" AS "hotelId",
                 l_rt."roomTypesId" AS "roomTypeId",
                 l_rp."ratePlansId" AS "ratePlanLinkId"
          FROM "DailyRates" dr
          LEFT JOIN "DailyRatesHotels" l_h ON l_h."dailyRatesId" = dr.id
          LEFT JOIN "DailyRatesRoomTypes" l_rt ON l_rt."dailyRatesId" = dr.id
          LEFT JOIN "DailyRatesRatePlans" l_rp ON l_rp."dailyRatesId" = dr.id
          WHERE l_h."hotelsId" = $1
            AND dr."rateDate" >= $2
            AND dr."rateDate" <= $3
            AND (dr."integrityStatus" IS NULL OR dr."integrityStatus" != 'Quarantined')
          ORDER BY dr."rateDate" ASC
        `,
        params: [hotelId, windowStart, windowEnd],
      }),
      loadHotelEventRules(hotelId),
    ]);

    if (!hotelRes) throw new Error('Hotel not found');

    const inventoryEndDate=new Date(windowEnd+'T00:00:00Z');
    inventoryEndDate.setUTCDate(inventoryEndDate.getUTCDate()+1);
    const inventoryConsumption=await loadInventoryConsumption({
      checkIn:windowStart,
      checkOut:inventoryEndDate.toISOString().slice(0,10),
      hotelId,
    });

    const activeRules = markupRulesRes.records;
    const labelRule = resolveMarkupRule(hotelId, activeRules, checkIn || todayStr);
    const absMarkupValue = Math.abs(safeNum(labelRule?.markupValue));
    const markupLabel = labelRule
      ? labelRule.markupType === 'Percentage (%)'
        ? `+${absMarkupValue}%`
        : `+AED ${absMarkupValue}/room/night`
      : '';

    const hotelRoomTypes = roomTypesRes.records.filter((rt) => {
      const linked = Array.isArray(rt.hotel) ? rt.hotel[0] : rt.hotel;
      return linked === hotelId;
    });

    const hotelDailyRates = dailyRatesSql.rows.map((r: any) => ({
      id: String(r.id),
      rateDate: r.rateDate ? (typeof r.rateDate === 'string' ? r.rateDate.slice(0, 10) : new Date(r.rateDate).toISOString().split('T')[0]) : null,
      hotel: r.hotelId ? [String(r.hotelId)] : [],
      roomType: r.roomTypeId ? [String(r.roomTypeId)] : [],
      ratePlan: r.ratePlanLinkId ? [String(r.ratePlanLinkId)] : [],
      ratePlanId: r.ratePlanLinkId ? String(r.ratePlanLinkId) : null,
      scalarRatePlanId: r.ratePlanId ? String(r.ratePlanId) : null,
      priority: Number(r.priority) || 0,
      adult1Rate: Number(r.adult1Rate) || 0,
      adult2Rate: Number(r.adult2Rate) || 0,
      adult3Rate: Number(r.adult3Rate) || 0,
      childSupplement: Number(r.childSupplement) || 0,
      extraBedRate: Number(r.extraBedRate) || 0,
      allocation: r.allocation != null ? Number(r.allocation) : null,
      status: r.status || 'Free Sale',
      layer: r.layer || 'BASE',
      occupancyKey: r.occupancyKey || null,
      childRate05: Number(r.childRate05) || 0,
      childRate611: Number(r.childRate611) || 0,
      rateSource: r.rateSource || null,
      minStay: Number(r.minStay) || 0,
      maxStay: Number(r.maxStay) || 0,
      cta: Number(r.cta) > 0,
      ctd: Number(r.ctd) > 0,
      leadDays: Number(r.leadDays) || 0,
      currency: r.currency || 'AED',
      updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
    }));

    // RatePlan is authoritative. A DailyRate without a valid RatePlan
    // belonging to this same hotel + room type is not exposed to agents.
    const ratePlanById = new Map(
      ratePlansRes.records
        .filter(rp => {
          if (rp.status === 'Inactive') return false;
          const eligibility = resolveRatePlanEligibility(marketContext, {
            ratePlan: rp,
            requestedNationality: requestedMarket,
          });
          return eligibility.eligible;
        })
        .map(rp => [rp.id, rp])
    );

    // Room type map for policy lookups
    const roomTypeMap = new Map<string, typeof hotelRoomTypes[0]>();
    hotelRoomTypes.forEach(rt => roomTypeMap.set(rt.id, rt));

    // Child ages per room (slice total ages down to per-room count)
    const childAgesPerRoom = (childAges || []).slice(0, childrenPerRoom);

    /**
     * Per room type: compute effective adults (some children count as adults)
     * and paying children (those who incur a supplement).
     * - age <= childAgeFreeUpTo → free (no supplement)
     * - age >= childAgeAdultFrom → treated as adult (uses adult rate)
     * - otherwise → child supplement applies
     */
    const getRtChildBreakdown = (rtId: string): { effectiveAdults: number; payingChildren: number } => {
      const rt = roomTypeMap.get(rtId);
      if (!rt || childAgesPerRoom.length === 0) {
        return { effectiveAdults: adultsPerRoom, payingChildren: childrenPerRoom };
      }
      let effectiveAdults = adultsPerRoom;
      let payingChildren = 0;
      for (const age of childAgesPerRoom) {
        if (age >= (rt.childAgeFreeUpTo ?? rt.childAgeFrom ?? 5)) payingChildren++;
      }
      return { effectiveAdults, payingChildren };
    };

    // Base rate selection by effective adults count
    const getBaseRate = (dr: typeof hotelDailyRates[0], effectiveAdults: number): number => {
      const a1 = safeNum(dr.adult1Rate);
      const a2 = safeNum(dr.adult2Rate) || a1;
      const a3 = safeNum(dr.adult3Rate);
      const eb = safeNum(dr.extraBedRate);
      if (effectiveAdults >= 3) {
        if (a3 > 0) return a3;
        return a2 + eb * (effectiveAdults - 2);
      }
      if (effectiveAdults >= 2) return a2;
      return a1;
    };

    // Build occupancy note (generic, for display)
    let occupancyNote = `${adultsPerRoom} adult${adultsPerRoom !== 1 ? 's' : ''}`;
    if (childrenPerRoom > 0) occupancyNote += ` + ${childrenPerRoom} child${childrenPerRoom !== 1 ? 'ren' : ''}`;

    const calendarEntries: z.infer<typeof dailyRateSchema>[] = [];
    const candidateMap = new Map<string, Array<{
      entry: z.infer<typeof dailyRateSchema>;
      id: string;
      layer: string;
      priority: number;
      updatedAt?: string;
    }>>();

    for (const dr of hotelDailyRates) {
      const rtId = Array.isArray(dr.roomType) ? dr.roomType[0] : dr.roomType;
      const drHotelId = Array.isArray(dr.hotel) ? dr.hotel[0] : dr.hotel;
      const ratePlanId = dr.ratePlanId || (Array.isArray(dr.ratePlan) ? dr.ratePlan[0] : dr.ratePlan);
      if (!rtId || !dr.rateDate || !ratePlanId || (dr.scalarRatePlanId && dr.scalarRatePlanId !== ratePlanId)) continue;

      const ratePlan = ratePlanById.get(ratePlanId);
      const rpHotelId = ratePlan ? linkedId(ratePlan.hotel) : undefined;
      const rpRoomTypeId = ratePlan ? linkedId(ratePlan.roomType) : undefined;
      if (!ratePlan || drHotelId !== hotelId || rpHotelId !== hotelId || rpRoomTypeId !== rtId || !roomTypeMap.has(rtId) || !ratePlan.mealPlan || !linkedId(ratePlan.mealPlanMaster)) continue;
      if (!isSupportedAedRate(dr.currency, ratePlan.sellCurrency)) continue;

      const governance=resolveInventoryGovernance({
        rate:dr,stayDate:String(dr.rateDate||'').slice(0,10),checkIn:input.checkIn||windowStart,checkOut:input.checkOut||windowEnd,
      });
      const status = governance.effectiveStatus;
      const remaining=remainingAllocation({
        allocation:governance.governedAllocation,
        status,
        overbookingAllowance:governance.overbookingAllowance,
        consumed:inventoryConsumption.get(inventoryKey(hotelId,rtId,ratePlanId,String(dr.rateDate||'').slice(0,10))),
      });
      if ((remaining !== null && remaining < rooms) || status === 'Stop Sale' || status === 'On Request') continue;
      if (requestedNights > 0 && checkIn && checkOut) {
        const restrictionErrors = validateStayRestrictions({
          requestedNights,
          checkIn,
          checkOut,
          ratePlanMinStay: ratePlan.minStayNights,
          ratePlanMaxStay: ratePlan.maxStayNights,
          dailyMinStay: dr.minStay,
          dailyMaxStay: dr.maxStay,
          cta: dr.rateDate === checkIn && dr.cta,
          ctd: dr.rateDate === checkOut && dr.ctd,
          leadDays: dr.leadDays,
          status,
        });
        if (restrictionErrors.length) continue;
      }
      const { effectiveAdults, payingChildren } = getRtChildBreakdown(rtId);
      const baseRate = getBaseRate(dr, effectiveAdults);
      const childSupp = safeNum(dr.childSupplement);
      const extraBed = safeNum(dr.extraBedRate);
      const eventNight = eventSupplementForNight({
        events: eventRules,
        date: dr.rateDate,
        roomTypeId: rtId,
        ratePlanId,
        rooms: [{ adults: adultsPerRoom, children: childrenPerRoom }],
      });
      const eventSupplement = eventNight.amount;
      const dateRule = resolveMarkupRule(hotelId, activeRules, dr.rateDate);

      // Net rate = authoritative DailyRate + child supplement + matching event supplement.
      const netRate = baseRate > 0 && (childrenPerRoom === childAgesPerRoom.length || childrenPerRoom === 0)
        ? baseRate + childSupp * payingChildren + eventSupplement : 0;
      const displayRate = netRate > 0 ? Math.round(applyCanonicalMarkup(netRate, dateRule) * (1 + publicMarkupPct / 100)) : 0;

      const a1 = safeNum(dr.adult1Rate);
      const a2 = safeNum(dr.adult2Rate) || a1;
      const a3 = safeNum(dr.adult3Rate);
      const eventA1 = eventSupplementForNight({ events: eventRules, date: dr.rateDate, roomTypeId: rtId, ratePlanId, rooms: [{ adults: 1, children: 0 }] }).amount;
      const eventA2 = eventSupplementForNight({ events: eventRules, date: dr.rateDate, roomTypeId: rtId, ratePlanId, rooms: [{ adults: 2, children: 0 }] }).amount;
      const eventA3 = eventSupplementForNight({ events: eventRules, date: dr.rateDate, roomTypeId: rtId, ratePlanId, rooms: [{ adults: 3, children: 0 }] }).amount;
      const adult1Sell = a1 > 0 ? Math.round(applyCanonicalMarkup(a1 + eventA1, dateRule)) : 0;
      const adult2Sell = a2 > 0 ? Math.round(applyCanonicalMarkup(a2 + eventA2, dateRule)) : 0;
      const adult3Sell = a3 > 0 ? Math.round(applyCanonicalMarkup(a3 + eventA3, dateRule)) : 0;
      const childSell = childSupp > 0 ? Math.round(applyCanonicalMarkup(childSupp, dateRule)) : 0;

      let rateType: 'Contract' | 'Supplement' | 'Stop Sale';
      if (status === 'Stop Sale') {
        rateType = 'Stop Sale';
      } else if (payingChildren > 0 && childSupp > 0) {
        rateType = 'Supplement';
      } else {
        rateType = 'Contract';
      }

      // Build cancellation summary from rate plan data
      let cancellationSummary = '';
      if (ratePlan.refundable === false) {
        cancellationSummary = 'Non-refundable';
      } else if (ratePlan.cancellationWindowDays != null && Number(ratePlan.cancellationWindowDays) > 0) {
        const windowDays = Number(ratePlan.cancellationWindowDays);
        const cancDate = new Date(dr.rateDate + 'T00:00:00');
        cancDate.setDate(cancDate.getDate() - windowDays);
        const cancDateStr = cancDate.toLocaleDateString('en-AE', { day: '2-digit', month: 'short' });
        cancellationSummary = `Free cancellation until ${cancDateStr}`;
      } else if (ratePlan.refundable) {
        cancellationSummary = 'Free cancellation';
      }

      const entry: z.infer<typeof dailyRateSchema> = {
        date: dr.rateDate,
        roomTypeId: rtId,
        ratePlanId,
        ratePlanName: ratePlan.ratePlanName || ratePlanId,
        mealPlan: ratePlan.mealPlan || 'Room Only',
        baseRate,
        childSupplement: childSupp,
        extraBedRate: extraBed,
        netRate,
        displayRate,
        adult1Sell,
        adult2Sell,
        adult3Sell,
        childSell,
        status,
        rateType,
        allocation: remaining,
        occupancyNote,
        cancellationSummary,
        eventSupplement,
        eventNames: eventNight.eventNames,
      };

      // Preserve separate commercial products. The key includes RatePlan so
      // BB/HB/refundable/non-refundable plans can never overwrite each other.
      const key = `${dr.rateDate}|${rtId}|${ratePlanId}`;
      const list = candidateMap.get(key) || [];
      list.push({
        entry,
        id: dr.id,
        layer: dr.layer || 'BASE',
        priority: dr.priority || 0,
        updatedAt: dr.updatedAt,
      });
      candidateMap.set(key, list);
    }

    for (const candidates of candidateMap.values()) {
      const effective = resolveEffectiveRate(candidates);
      if (effective) calendarEntries.push(effective.entry);
    }

    // No generic NetRate fallback is exposed here. A tariff calendar cell
    // without an exact Room Type + Rate Plan + Daily Rate relationship stays
    // empty/on-request rather than inheriting another commercial product.

    // Occupancy warning per room type
    // Rules: (adults+children)/rooms <= maxOccupancy, adults/rooms <= maxAdults, children/rooms <= maxChildren
    const getOccupancyWarning = (rt: typeof hotelRoomTypes[0]): string | null => {
      const { effectiveAdults } = getRtChildBreakdown(rt.id);
      const maxA = rt.maxAdults ?? null;
      const maxC = rt.maxChildren ?? null;
      const maxOcc = rt.maxOccupancy ?? null;
      const totalPerRoom = adultsPerRoom + childrenPerRoom;
      // Total guests per room vs max occupancy
      if (maxOcc !== null && totalPerRoom > maxOcc) {
        return `Max ${maxOcc} guest${maxOcc !== 1 ? 's' : ''} per room (${totalPerRoom} requested)`;
      }
      // Adults per room check
      if (maxA !== null && effectiveAdults > maxA) {
        return `Max ${maxA} adult${maxA !== 1 ? 's' : ''} per room (${effectiveAdults} requested)`;
      }
      // Children policy
      if (childrenPerRoom > 0 && !rt.childAllowed) return 'Children not allowed in this room type';
      if (maxC !== null && childrenPerRoom > maxC) {
        return `Max ${maxC} child${maxC !== 1 ? 'ren' : ''} per room (${childrenPerRoom} requested)`;
      }
      return null;
    };

    return {
      hotel: {
        id: hotelRes.id,
        name: hotelRes.hotelName || '',
        location: hotelRes.location || '',
        emirate: hotelRes.emirate || '',
        starRating: hotelRes.starRating || '',
        description: hotelRes.description || '',
        imageUrl: hotelRes.hotelImage?.[0]?.url || null,
      },
      roomTypes: hotelRoomTypes.map((rt) => ({
        id: rt.id,
        name: rt.roomTypeName || '',
        mealPlan: rt.mealPlan || 'Room Only',
        maxAdults: rt.maxAdults ?? null,
        maxChildren: rt.maxChildren ?? null,
        maxOccupancy: rt.maxOccupancy ?? null,
        beddingType: rt.beddingType || '',
        views: rt.views || '',
        inclusions: rt.inclusions || '',
        childAllowed: rt.childAllowed ?? false,
        extraBedAllowed: rt.extraBedAllowed ?? false,
        occupancyWarning: getOccupancyWarning(rt),
      })),
      dailyRates: calendarEntries,
      markupLabel,
    };
  },
});
