import { z } from 'zod';
import { zite } from 'zitejs/db';
import type { RoomTypesRecordType } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { eventSupplementForNight, validateEventStayRules, type HotelEventRule } from '../lib/hotelEventPricing';
import { loadMarketContext, resolveRatePlanEligibility } from '../lib/marketEligibility';
import {
  applyMarkup as applyCanonicalMarkup,
  linkedId,
  resolveEffectiveRate,
  resolveMarkupRule,
  resolveOccupancyBaseRate,
  resolveInventoryGovernance,
  safeNum,
  validateStayRestrictions,
  isSupportedAedRate,
} from '@project/pricing/hotelPricing';
import { resolvePromotionPricing } from '@project/pricing/hotelPromotions';
import { priceRoomOccupancy, validateRequestedRoom, validateRoomRequestAgainstPolicy, type RoomOccupancyRequest } from '@project/pricing/occupancyPricing';
import { findBestRoomCombination, aggregateDisplayQuote, type RequestedRoomOffer } from '@project/pricing/multiRoomPricing';
import { inventoryKey, loadInventoryConsumption, remainingAllocation } from '@project/pricing/inventoryLedger';

const roomConfigSchema = z.object({
  adults: z.number(),
  children: z.number(),
  childAges: z.array(z.number()),
});

const rateSchema = z.object({
  roomTypeId: z.string(),
  roomTypeName: z.string(),
  ratePlanId: z.string(),
  ratePlanName: z.string(),
  mealPlan: z.string(),
  netRate: z.number(),
  sellRate: z.number(),
  displaySellRate: z.number(),
  stayNetTotal: z.number(),
  staySellTotal: z.number(),
  displayStaySellTotal: z.number(),
  markupLabel: z.string(),
  markupAmount: z.number(),
  rateSource: z.enum(['daily']),
  occupancyNote: z.string(),
  occupancyFit: z.boolean(),
  maxAdults: z.number().nullable(),
  maxChildren: z.number().nullable(),
  maxOccupancy: z.number().nullable(),
  status: z.string(),
  cancellationSummary: z.string(),
  eventSupplementTotal: z.number(),
  appliedEvents: z.array(z.string()),
  publicMarkupPct: z.number(),
  sourceMarketProfile: z.string(),
  promotionCode: z.string().optional(),
  promotionName: z.string().optional(),
  promotionType: z.string().optional(),
  promotionDiscountAmount: z.number().optional(),
  promotionFundingSource: z.string().optional(),
});

const bestValidOfferSchema = z.object({
  completeStayPricing: z.boolean(),
  finalDisplayQuote: z.number(),
  averagePerRoomNight: z.number(),
  nights: z.number(),
  rooms: z.number(),
  adults: z.number(),
  children: z.number(),
  mixedRoomTypes: z.boolean(),
  mixedRatePlans: z.boolean(),
  mixedCancellation: z.boolean(),
  childPricingIncluded: z.boolean(),
  extraBedIncluded: z.boolean(),
  eventSupplementIncluded: z.boolean(),
  promotionApplied: z.boolean(),
  status: z.string(),
  roomCombination: z.array(z.object({
    requestedRoomNo: z.number(),
    roomTypeId: z.string(),
    roomTypeName: z.string(),
    ratePlanId: z.string(),
    ratePlanName: z.string(),
    mealPlan: z.string(),
    cancellationPolicy: z.string(),
    roomStayDisplayPrice: z.number(),
    childSummary: z.string(),
    extraBedCount: z.number(),
  })),
}).nullable();

const hotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  emirate: z.string(),
  starRating: z.string(),
  status: z.string(),
  imageUrl: z.string().nullable(),
  guestRating: z.number().nullable(),
  reviewCount: z.number(),
  reviewLabel: z.string().nullable(),
  rates: z.array(rateSchema),
  bestValidOffer: bestValidOfferSchema,
  markupRule: z.object({ name: z.string(), type: z.string(), value: z.number() }).nullable(),
});

const markupRuleSchema = z.object({
  id: z.string(), name: z.string(), type: z.string(), value: z.number(), appliesTo: z.string(),
});

type RoomConfig = RoomOccupancyRequest;

function normalizeMarketCodes(raw: unknown): string[] {
  const text = String(raw || '').trim().toUpperCase();
  if (!text || text === 'ALL' || text === '*' || text === 'GLOBAL') return [];
  return Array.from(new Set(text.split(/[\s,;|/]+/).map(v => v.trim()).filter(Boolean)));
}

function marketEligible(raw: unknown, requestedMarket?: string) {
  const codes = normalizeMarketCodes(raw);
  if (codes.length === 0) return true;
  if (!requestedMarket) return false;
  return codes.includes(requestedMarket.toUpperCase());
}

export default createEndpoint({
  description: 'Fetches active hotels with sell rates (net + markup), priced by dates/pax/rooms',
  inputSchema: z.object({
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    adults: z.number().optional(),
    children: z.number().optional(),
    childAges: z.array(z.number()).optional(),
    roomConfigs: z.array(roomConfigSchema).optional(),
    nationality: z.string().trim().min(2).max(3).optional(),
    extraMarkupPct: z.number().min(0).max(50).optional(),
  }),
  outputSchema: z.object({ hotels: z.array(hotelSchema), markupRules: z.array(markupRuleSchema), searchErrors: z.array(z.string()) }),
  execute: async ({ input }) => {
    const { checkIn, checkOut } = input;
    const hasDates = !!(checkIn && checkOut);

    const roomConfigs: RoomConfig[] = input.roomConfigs?.length
      ? input.roomConfigs
      : [{ adults: input.adults ?? 2, children: input.children ?? 0, childAges: input.childAges ?? [] }];

    const nights = hasDates
      ? Math.max(0, Math.round((new Date(checkOut!).getTime() - new Date(checkIn!).getTime()) / 86400000))
      : 0;

    // Build the list of chargeable dates [checkIn, checkOut)
    const stayDates: string[] = [];
    if (hasDates && nights > 0) {
      const d = new Date(checkIn! + 'T00:00:00Z');
      for (let i = 0; i < nights; i++) {
        stayDates.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }

    // Fetch core reference data — all within the 2000 limit
    const [hotelsRes, roomTypesRes, ratePlansRes, rulesRes, eventsRes, promotionsRes, promotionRulesRes] = await Promise.all([
      zite.hotels.findAll({ limit: 500 }),
      zite.roomTypes.findAll({ limit: 500 }),
      zite.ratePlans.findAll({ limit: 1000 }),
      zite.markupRules.findAll({ filters: { isActive: true }, limit: 200 }),
      zite.eventMaster.findAll({ filters: { status: 'Active' }, limit: 1000 }),
      zite.promotions.findAll({ filters: { status: 'Active' }, limit: 1000 }),
      zite.promotionCommercialRules.findAll({ limit: 1000 }),
    ]);

    const UAE_EMIRATES = new Set(['Dubai','Abu Dhabi','Sharjah','Ras Al Khaimah','Fujairah','Ajman','Umm Al Quwain']);
    const activeHotels = hotelsRes.records.filter(h =>
      (!h.status || h.status === 'Active') &&
      !!h.emirate &&
      UAE_EMIRATES.has(h.emirate)
    );

    // Build markup rule lookup
    const rules = rulesRes.records.map((r) => ({
      id: r.id,
      name: r.ruleName || '',
      type: r.markupType || '',
      value: safeNum(r.markupValue),
      appliesTo: r.appliesTo || '',
      specificHotelId: Array.isArray(r.specificHotel) ? r.specificHotel[0] : r.specificHotel,
      startDate: r.startDate ? String(r.startDate).slice(0, 10) : null,
      endDate: r.endDate ? String(r.endDate).slice(0, 10) : null,
      maxMarkupValue: r.maxMarkupValue == null ? null : safeNum(r.maxMarkupValue),
    }));

    // Rate plan maps
    const requestedMarket = input.nationality?.toUpperCase();
    const publicMarkupPct = Math.min(50, Math.max(0, input.extraMarkupPct || 0));
    const marketContext = await loadMarketContext(zite);

    const activeRatePlans = ratePlansRes.records.filter(rp => {
      if (rp.status === 'Inactive' || (rp.sellCurrency && rp.sellCurrency !== 'AED')) return false;
      const eligibility = resolveRatePlanEligibility(marketContext, {
        ratePlan: rp,
        requestedNationality: requestedMarket,
      });
      return eligibility.eligible;
    });
    const ratePlanById = new Map(activeRatePlans.map(rp => [rp.id, rp]));
    const getLinkedId = linkedId;
    const getLinkedIds = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : (v ? [String(v)] : []);
    const dateOnly = (v: unknown): string => !v ? '' : (typeof v === 'string' ? v.slice(0,10) : new Date(v as any).toISOString().slice(0,10));

    const promotionRuleById = new Map(promotionRulesRes.records.map(r => [r.promotionId, r]));
    const promotionsByHotel = new Map<string, { promotion: any; rule: any }[]>();
    for (const promotion of promotionsRes.records) {
      const hotelId = getLinkedId(promotion.hotel);
      if (!hotelId) continue;
      const list = promotionsByHotel.get(hotelId) || [];
      list.push({ promotion, rule: promotionRuleById.get(promotion.id) || {} });
      promotionsByHotel.set(hotelId, list);
    }

    const eventsByHotel = new Map<string, HotelEventRule[]>();
    for (const raw of eventsRes.records as any[]) {
      const hotelId = getLinkedId(raw.hotel);
      if (!hotelId) continue;
      const rule: HotelEventRule = {
        id: raw.id,
        name: raw.eventName || 'Event supplement',
        startDate: dateOnly(raw.startDate),
        endDate: dateOnly(raw.endDate),
        supplementType: raw.supplementType || 'Per Room Per Night',
        supplementAmount: Math.max(0, safeNum(raw.supplementAmount)),
        applicableRoomTypes: getLinkedIds(raw.applicableRoomTypes),
        applicableRatePlans: getLinkedIds(raw.applicableRatePlans),
        applicableWeekdays: Array.isArray(raw.applicableWeekdays) ? raw.applicableWeekdays.map(String) : [],
        stackRule: raw.stackRule || 'Add All Matching Events',
        mlos: Math.max(0, safeNum(raw.mlos)),
        noCheckinOn31Dec: !!raw.noCheckinOn31Dec,
        status: raw.status || 'Active',
      };
      if (!rule.startDate || !rule.endDate || rule.supplementAmount <= 0) continue;
      const list = eventsByHotel.get(hotelId) || [];
      list.push(rule);
      eventsByHotel.set(hotelId, list);
    }

    // Room type map for child-age lookups
    const roomTypeMap = new Map(roomTypesRes.records.map(rt => [rt.id, rt]));

    // ─── Fetch daily rates via SQL (no row cap) ───
    // Only fetch when we have dates to price against
    type DailyRateRow = {
      id: string; rateDate: string; hotelId: string; roomTypeId: string;
      ratePlanLinkId: string | null; ratePlanId: string | null;
      adult1Rate: number; adult2Rate: number; adult3Rate: number;
      childSupplement: number; childRate05: number; childRate611: number; extraBedRate: number;
      status: string; layer: string; priority: number; allocation: number | null;
      currency: string; minStay: number; maxStay: number; cta: boolean; ctd: boolean; leadDays: number;
      allocationType?: string; releaseDay?: number; releaseHourUtc?: number; releaseAction?: string;
      overbookingAllowance?: number; contractPoolCode?: string; stopSaleReason?: string; governanceNote?: string;
      updatedAt?: string;
    };

    let dailyRateRows: DailyRateRow[] = [];

    if (hasDates && nights > 0) {
      const sqlResult = await zite.sql({
        query: `
          SELECT dr.id,
                 dr."rateDate",
                 l_h."hotelsId"     AS "hotelId",
                 l_rt."roomTypesId" AS "roomTypeId",
                 l_rp."ratePlansId" AS "ratePlanLinkId",
                 dr."ratePlanId",
                 dr."adult1Rate", dr."adult2Rate", dr."adult3Rate",
                 dr."childSupplement", dr."childRate05", dr."childRate611", dr."extraBedRate",
                 dr."status", dr."allocation", dr."layer", dr."priority",
                 dr."currency", dr."minStay", dr."maxStay", dr."cta", dr."ctd", dr."leadDays",
                 dr."allocationType", dr."releaseDay", dr."releaseHourUtc", dr."releaseAction",
                 dr."overbookingAllowance", dr."contractPoolCode", dr."stopSaleReason", dr."governanceNote",
                 dr.updated_at AS "updatedAt"
          FROM "DailyRates" dr
          LEFT JOIN "DailyRatesHotels"    l_h  ON l_h."dailyRatesId"  = dr.id
          LEFT JOIN "DailyRatesRoomTypes" l_rt ON l_rt."dailyRatesId" = dr.id
          LEFT JOIN "DailyRatesRatePlans" l_rp ON l_rp."dailyRatesId" = dr.id
          WHERE dr."rateDate" >= $1
            AND dr."rateDate" <= $2
            AND (dr."integrityStatus" IS NULL OR dr."integrityStatus" != 'Quarantined')
        `,
        params: [checkIn, checkOut],
      });

      dailyRateRows = sqlResult.rows.map((r: any) => ({
        id: String(r.id),
        rateDate: r.rateDate ? (typeof r.rateDate === 'string' ? r.rateDate.slice(0, 10) : new Date(r.rateDate).toISOString().split('T')[0]) : '',
        hotelId: r.hotelId ? String(r.hotelId) : '',
        roomTypeId: r.roomTypeId ? String(r.roomTypeId) : '',
        ratePlanLinkId: r.ratePlanLinkId ? String(r.ratePlanLinkId) : null,
        ratePlanId: r.ratePlanId ? String(r.ratePlanId) : null,
        adult1Rate: safeNum(r.adult1Rate),
        adult2Rate: safeNum(r.adult2Rate),
        adult3Rate: safeNum(r.adult3Rate),
        childSupplement: safeNum(r.childSupplement),
        childRate05: safeNum(r.childRate05),
        childRate611: safeNum(r.childRate611),
        extraBedRate: safeNum(r.extraBedRate),
        status: r.status || 'Free Sale',
        layer: r.layer || 'BASE',
        priority: safeNum(r.priority),
        allocation: r.allocation == null ? null : safeNum(r.allocation),
        currency: r.currency || 'AED',
        minStay: safeNum(r.minStay),
        maxStay: safeNum(r.maxStay),
        cta: safeNum(r.cta) > 0,
        ctd: safeNum(r.ctd) > 0,
        leadDays: safeNum(r.leadDays),
        allocationType: r.allocationType ? String(r.allocationType) : '',
        releaseDay: r.releaseDay == null ? undefined : safeNum(r.releaseDay),
        releaseHourUtc: r.releaseHourUtc == null ? undefined : safeNum(r.releaseHourUtc),
        releaseAction: r.releaseAction ? String(r.releaseAction) : '',
        overbookingAllowance: safeNum(r.overbookingAllowance),
        contractPoolCode: r.contractPoolCode ? String(r.contractPoolCode) : '',
        stopSaleReason: r.stopSaleReason ? String(r.stopSaleReason) : '',
        governanceNote: r.governanceNote ? String(r.governanceNote) : '',
        updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
      }));
    }

    // ─── Build effective daily rates per hotel/room/ratePlan/date ───
    // Group by hotel|roomType|ratePlan|date, keeping only records that pass integrity checks
    const grouped = new Map<string, DailyRateRow[]>();
    for (const dr of dailyRateRows) {
      if (!dr.rateDate) continue;
      if (!dr.hotelId || !dr.roomTypeId) continue;

      const rpId = dr.ratePlanLinkId;
      if (!rpId) {
        console.warn(`[PRICING_INTEGRITY] hotelId=${dr.hotelId} roomTypeId=${dr.roomTypeId} date=${dr.rateDate} reason=MISSING_RATE_PLAN`);
        continue;
      }

      // Validate rate plan belongs to this hotel + room type
      const rp = ratePlanById.get(rpId);
      if (!rp || (dr.ratePlanId && dr.ratePlanId !== rpId)) {
        console.warn(`[PRICING_INTEGRITY] hotelId=${dr.hotelId} ratePlanId=${rpId} reason=RATE_PLAN_NOT_FOUND`);
        continue;
      }
      const rpHotelId = getLinkedId(rp.hotel);
      const rpRoomTypeId = getLinkedId(rp.roomType);
      if (rpHotelId !== dr.hotelId) {
        console.warn(`[PRICING_INTEGRITY] hotelId=${dr.hotelId} ratePlanId=${rpId} reason=RATE_PLAN_HOTEL_MISMATCH`);
        continue;
      }
      const room = roomTypeMap.get(dr.roomTypeId);
      if (rpRoomTypeId !== dr.roomTypeId || getLinkedId(room?.hotel) !== dr.hotelId || !getLinkedId(rp.mealPlanMaster) || !rp.mealPlan) {
        console.warn(`[PRICING_INTEGRITY] hotelId=${dr.hotelId} roomTypeId=${dr.roomTypeId} ratePlanId=${rpId} reason=RATE_PLAN_ROOM_MISMATCH`);
        continue;
      }

      const key = `${dr.hotelId}|${dr.roomTypeId}|${rpId}|${dr.rateDate}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(dr);
      grouped.set(key, bucket);
    }

    // Resolve one effective rate per key with the shared layer/priority/tie-break engine.
    const effectiveByKey = new Map<string, DailyRateRow>();
    for (const [key, candidates] of grouped) {
      const effective = resolveEffectiveRate(candidates);
      if (effective) effectiveByKey.set(key, effective);
    }

    const inventoryConsumption = hasDates && nights > 0
      ? await loadInventoryConsumption({ checkIn: checkIn!, checkOut: checkOut! })
      : new Map();

    // ─── Build search rates per rate plan ───
    type SearchRate = {
      roomTypeId: string; ratePlanId: string; ratePlanName: string;
      mealPlan: string; netRate: number; stayNetTotal: number; staySellTotal: number; note: string;
      markupLabel: string; markupAmount: number;
      status: string; cancellationSummary: string;
      eventSupplementTotal: number; appliedEvents: string[]; sourceMarketProfile: string;
      promotionCode?: string; promotionName?: string; promotionType?: string;
      promotionDiscountAmount?: number; promotionFundingSource?: string;
    };

    const searchRatesByHotel = new Map<string, SearchRate[]>();
    const unitOffersByHotel = new Map<string, RequestedRoomOffer[][]>();

    const requestedRoomErrors = roomConfigs.flatMap((room, index) =>
      validateRequestedRoom({ ...room, roomNo: index + 1 }).map(code => `ROOM_${index + 1}_${code}`)
    );

    if (hasDates && nights > 0 && requestedRoomErrors.length === 0) {
      for (const rp of activeRatePlans) {
        const hotelId = getLinkedId(rp.hotel);
        const rtId = getLinkedId(rp.roomType);
        if (!hotelId || !rtId || !rp.mealPlan || !getLinkedId(rp.mealPlanMaster) || getLinkedId(roomTypeMap.get(rtId)?.hotel) !== hotelId) continue;

        const rt = roomTypeMap.get(rtId);
        if (!rt || rt.status === 'Inactive' || rt.sellEnabled === false) continue;

        const nightlyRecords: (DailyRateRow | undefined)[] = stayDates.map(date =>
          effectiveByKey.get(`${hotelId}|${rtId}|${rp.id}|${date}`)
        );
        const departureRecord = checkOut
          ? effectiveByKey.get(`${hotelId}|${rtId}|${rp.id}|${checkOut}`)
          : undefined;

        if (nightlyRecords.some(r => !r || !isSupportedAedRate(r.currency, rp.sellCurrency))) continue;
        const governedNightly=nightlyRecords.map((dr,index)=>dr?resolveInventoryGovernance({
          rate:dr,stayDate:stayDates[index],checkIn:checkIn!,checkOut:checkOut!,
        }):null);
        if(governedNightly.some(g=>g?.effectiveStatus==='Stop Sale')) continue;

        let restricted = !!departureRecord?.ctd;
        for (let i = 0; i < nightlyRecords.length && !restricted; i++) {
          const dr = nightlyRecords[i]!;
          const governance=governedNightly[i]!;
          const restrictionErrors = validateStayRestrictions({
            requestedNights: nights,
            checkIn: checkIn!,
            checkOut: checkOut!,
            ratePlanMinStay: rp.minStayNights,
            ratePlanMaxStay: rp.maxStayNights,
            dailyMinStay: dr.minStay,
            dailyMaxStay: dr.maxStay,
            cta: stayDates[i] === checkIn && dr.cta,
            ctd: false,
            leadDays: dr.leadDays,
            status: governance.effectiveStatus,
          });
          if (restrictionErrors.length) restricted = true;
        }
        if (restricted) continue;

        const hotelEvents = eventsByHotel.get(hotelId) || [];
        const eventRuleErrors = validateEventStayRules({
          events: hotelEvents,
          stayDates,
          checkIn: checkIn!,
          roomTypeId: rtId,
          ratePlanId: rp.id,
        });
        if (eventRuleErrors.length) continue;

        const minimumAllocation = nightlyRecords.reduce((lowest, row, index) => {
          const r = row!;
          const governance=governedNightly[index]!;
          const remaining = remainingAllocation({
            allocation: governance.governedAllocation,
            status: governance.effectiveStatus,
            overbookingAllowance: governance.overbookingAllowance,
            consumed: inventoryConsumption.get(inventoryKey(hotelId, rtId, rp.id, stayDates[index])),
          });
          const capacity = remaining == null ? 999 : remaining;
          return Math.min(lowest, capacity);
        }, 999);
        if (minimumAllocation < 1) continue;

        const statuses = governedNightly.map(g => g!.effectiveStatus || 'Free Sale');
        const dominantStatus = statuses.includes('On Request') ? 'On Request' :
          statuses.includes('Limited') ? 'Limited' : 'Free Sale';

        let cancellationSummary = '';
        if (rp.refundable === false) {
          cancellationSummary = 'Non-refundable';
        } else if (rp.cancellationWindowDays != null && Number(rp.cancellationWindowDays) > 0) {
          const ciDate = new Date(stayDates[0] + 'T00:00:00');
          ciDate.setDate(ciDate.getDate() - Number(rp.cancellationWindowDays));
          cancellationSummary = `Free cancellation until ${ciDate.toLocaleDateString('en-AE', { day:'2-digit', month:'short' })}`;
        } else if (rp.refundable) {
          cancellationSummary = 'Free cancellation';
        }

        const planRoomOffers: RequestedRoomOffer[] = [];

        for (let roomIndex = 0; roomIndex < roomConfigs.length; roomIndex++) {
          const request = { ...roomConfigs[roomIndex], roomNo: roomIndex + 1 };
          let roomStayNet = 0;
          let contractedRoomSell = 0;
          let roomEventTotal = 0;
          let valid = true;
          const nightly: RequestedRoomOffer['nightly'] = [];
          const roomEventNames = new Set<string>();

          for (let nightIndex = 0; nightIndex < stayDates.length; nightIndex++) {
            const date = stayDates[nightIndex];
            const dr = nightlyRecords[nightIndex]!;
            const occupancy = priceRoomOccupancy(request, rt, {
              adult1Rate: dr.adult1Rate,
              adult2Rate: dr.adult2Rate,
              adult3Rate: dr.adult3Rate,
              extraBedRate: dr.extraBedRate,
              childSupplement: dr.childSupplement,
              childRate05: dr.childRate05,
              childRate611: dr.childRate611,
            });

            if (!occupancy.valid) {
              valid = false;
              console.warn(`[OCCUPANCY_REJECT] hotelId=${hotelId} roomTypeId=${rtId} ratePlanId=${rp.id} requestedRoom=${roomIndex + 1} reason=${occupancy.errors.join('|')}`);
              break;
            }

            const eventNight = eventSupplementForNight({
              events: hotelEvents,
              date,
              roomTypeId: rtId,
              ratePlanId: rp.id,
              rooms: [{ adults: request.adults, children: request.children }],
            });
            eventNight.eventNames.forEach(name => roomEventNames.add(name));
            roomEventTotal += eventNight.amount;

            const nightNet = occupancy.net + eventNight.amount;
            const markupRule = resolveMarkupRule(hotelId, rulesRes.records, date);
            const nightSell = applyCanonicalMarkup(nightNet, markupRule);
            if (nightSell < nightNet || nightNet <= 0) { valid = false; break; }

            roomStayNet += nightNet;
            contractedRoomSell += nightSell;
            nightly.push({
              date,
              occupancyBasis: occupancy.occupancyBasis,
              baseNet: occupancy.baseRate,
              childCharges: occupancy.childCharges,
              extraAdultCharge: occupancy.extraAdultCharge,
              extraBedCount: occupancy.extraBedCount,
              eventSupplement: eventNight.amount,
              net: nightNet,
              markup: Math.max(0, nightSell - nightNet),
              sell: nightSell,
            });
          }

          if (!valid || nightly.length !== stayDates.length) continue;

          const promoResolution = resolvePromotionPricing(promotionsByHotel.get(hotelId) || [], {
            bookingDate: new Date().toISOString().slice(0,10),
            checkIn: checkIn!,
            checkOut: checkOut!,
            stayDates,
            roomTypeId: rtId,
            ratePlanId: rp.id,
            mealPlan: rp.mealPlan,
            sourceMarket: requestedMarket,
            isMember: false,
            channel: 'Bedbank',
            baseNet: roomStayNet,
            baseSell: contractedRoomSell,
          });
          const appliedPromo = promoResolution.applied[0];
          const promotedRoomSell = promoResolution.applied.length ? promoResolution.finalSell : contractedRoomSell;
          const promotionDiscountAmount = Math.max(0, contractedRoomSell - promotedRoomSell);

          const offer: RequestedRoomOffer = {
            requestedRoomNo: roomIndex + 1,
            request,
            offerKey: `${rtId}|${rp.id}`,
            roomTypeId: rtId,
            roomTypeName: rt.roomTypeName || rtId,
            ratePlanId: rp.id,
            ratePlanName: rp.ratePlanName || rp.id,
            mealPlan: rp.mealPlan,
            market: String(rp.nationalityMarket || 'ALL').trim() || 'ALL',
            cancellationPolicy: cancellationSummary,
            status: dominantStatus,
            minimumAllocation,
            nightly,
            roomStayNet,
            roomStaySell: promotedRoomSell,
            promotionCode: appliedPromo?.code,
            promotionName: appliedPromo?.name,
            promotionDiscountAmount,
            promotionFundingSource: appliedPromo?.fundingSource,
          };
          planRoomOffers.push(offer);

          const hotelLists = unitOffersByHotel.get(hotelId) || roomConfigs.map(() => []);
          hotelLists[roomIndex].push(offer);
          unitOffersByHotel.set(hotelId, hotelLists);
        }

        // Preserve OTA-style same-room/rate-plan offers when one product can satisfy
        // the whole request, but calculate every requested room independently first.
        if (planRoomOffers.length === roomConfigs.length && minimumAllocation >= roomConfigs.length) {
          const stayNetTotal = planRoomOffers.reduce((s,o)=>s+o.roomStayNet,0);
          const promotedStaySellTotal = planRoomOffers.reduce((s,o)=>s+o.roomStaySell,0);
          const promotionDiscount = planRoomOffers.reduce((s,o)=>s+Math.max(0,o.promotionDiscountAmount||0),0);
          const contractedStaySell = promotedStaySellTotal + promotionDiscount;
          const eventSupplementTotal = planRoomOffers.reduce((s,o)=>s+o.nightly.reduce((n,x)=>n+x.eventSupplement,0),0);
          const appliedEvents = Array.from(new Set(planRoomOffers.flatMap(o => o.nightly.filter(n=>n.eventSupplement>0).map(n=>n.date))));
          const note = roomConfigs.map((rc, i) => {
            let t = `${rc.adults}A`;
            if (rc.children > 0) t += `+${rc.children}C`;
            return roomConfigs.length > 1 ? `Room ${i + 1}: ${t}` : t;
          }).join(' · ');

          const firstStayRule = resolveMarkupRule(hotelId, rulesRes.records, stayDates[0]);
          const ruleValue = Math.abs(safeNum(firstStayRule?.markupValue));
          const markupLabel = firstStayRule
            ? firstStayRule.markupType === 'Percentage (%)' ? `+${ruleValue}%` : `+AED ${ruleValue}/room/night`
            : '';

          const appliedPromo = planRoomOffers.find(o => o.promotionCode);
          const item: SearchRate = {
            roomTypeId: rtId,
            ratePlanId: rp.id,
            ratePlanName: rp.ratePlanName || rp.id,
            mealPlan: rp.mealPlan,
            netRate: stayNetTotal / (nights * roomConfigs.length),
            stayNetTotal,
            staySellTotal: promotedStaySellTotal,
            markupLabel,
            markupAmount: Math.max(0, contractedStaySell - stayNetTotal),
            note,
            status: dominantStatus,
            cancellationSummary,
            eventSupplementTotal,
            appliedEvents,
            sourceMarketProfile: String(rp.nationalityMarket || 'ALL').trim() || 'ALL',
            promotionCode: appliedPromo?.promotionCode,
            promotionName: appliedPromo?.promotionName,
            promotionType: undefined,
            promotionDiscountAmount: promotionDiscount || undefined,
            promotionFundingSource: appliedPromo?.promotionFundingSource,
          };
          const list = searchRatesByHotel.get(hotelId) ?? [];
          list.push(item);
          searchRatesByHotel.set(hotelId, list);
        }
      }
    }

    const bestCombinationByHotel = new Map<string, ReturnType<typeof findBestRoomCombination>>();
    if (requestedRoomErrors.length === 0) {
      for (const hotel of activeHotels) {
        const lists = unitOffersByHotel.get(hotel.id) || roomConfigs.map(() => []);
        bestCombinationByHotel.set(hotel.id, findBestRoomCombination(roomConfigs, lists));
      }
    }

    // ─── On Request fallback: valid rate plan/room combos without daily rates ───
    if (hasDates && nights > 0) {
      for (const rp of activeRatePlans) {
        const hotelId = getLinkedId(rp.hotel);
        const rtId = getLinkedId(rp.roomType);
        if (!hotelId || !rtId || !rp.mealPlan || !getLinkedId(rp.mealPlanMaster) || getLinkedId(roomTypeMap.get(rtId)?.hotel) !== hotelId) continue;
        const rt = roomTypeMap.get(rtId);
        if (!rt) continue;

        if (roomConfigs.some(rc => rc.children !== rc.childAges.length)) continue;
        // Skip if we already have a priced rate for this hotel/room/plan
        const existing = searchRatesByHotel.get(hotelId) ?? [];
        if (existing.some(sr => sr.roomTypeId === rtId && sr.ratePlanId === rp.id)) continue;
        if (stayDates.some(date => effectiveByKey.get(`${hotelId}|${rtId}|${rp.id}|${date}`)?.status === 'Stop Sale')) continue;

        // Only show On Request for hotels that are active
        if (!activeHotels.some(h => h.id === hotelId)) continue;

        const item: SearchRate = {
          roomTypeId: rtId,
          ratePlanId: rp.id,
          ratePlanName: rp.ratePlanName || rp.id,
          mealPlan: rp.mealPlan,
          netRate: 0,
          stayNetTotal: 0,
          staySellTotal: 0,
          markupLabel: '',
          markupAmount: 0,
          note: 'Contact for rate',
          status: 'On Request',
          cancellationSummary: rp.refundable === false ? 'Non-refundable' : '',
          eventSupplementTotal: 0,
          appliedEvents: [],
          sourceMarketProfile: String(rp.nationalityMarket || 'ALL').trim() || 'ALL',
        };
        existing.push(item);
        searchRatesByHotel.set(hotelId, existing);
      }
    }

    // ─── Build hotel output ───
    const hotels = activeHotels.map((hotel) => {
      try {
        const displayRule = stayDates[0] ? resolveMarkupRule(hotel.id, rulesRes.records, stayDates[0]) : undefined;
        const hotelRoomTypes = roomTypesRes.records.filter((rt) => {
          const linked = getLinkedId(rt.hotel);
          return linked === hotel.id;
        });

        const hotelSearchRates = searchRatesByHotel.get(hotel.id) ?? [];

        const rates = hotelRoomTypes.flatMap((rt) => {
          const occupancyFit = roomConfigs.every(rc => validateRoomRequestAgainstPolicy(rc, rt).length === 0);
          const options = hotelSearchRates.filter(sr => sr.roomTypeId === rt.id);

          return options.map((rateInfo) => {
            const hasPricedInventory = rateInfo.netRate > 0 && rateInfo.stayNetTotal > 0;
            const staySellTotal = hasPricedInventory ? rateInfo.staySellTotal : 0;
            const sellRate = hasPricedInventory && nights > 0 && roomConfigs.length > 0
              ? staySellTotal / (nights * roomConfigs.length)
              : 0;
            // Public hotel quotes are always shown as whole AED amounts.
            // Apply the optional customer markup first, then round the final display
            // amount to the nearest AED. Contracted net/sell values stay unchanged.
            const displayStaySellTotal = staySellTotal > 0
              ? Math.round(staySellTotal * (1 + publicMarkupPct / 100))
              : 0;
            const displaySellRate = sellRate > 0
              ? Math.round(sellRate * (1 + publicMarkupPct / 100))
              : 0;

            return {
              roomTypeId: rt.id,
              roomTypeName: rt.roomTypeName || '',
              ratePlanId: rateInfo.ratePlanId,
              ratePlanName: rateInfo.ratePlanName,
              mealPlan: rateInfo.mealPlan,
              netRate: rateInfo.netRate,
              sellRate,
              displaySellRate,
              stayNetTotal: rateInfo.stayNetTotal,
              staySellTotal,
              displayStaySellTotal,
              markupLabel: rateInfo.markupLabel,
              markupAmount: rateInfo.markupAmount,
              rateSource: 'daily' as const,
              occupancyNote: rateInfo.note,
              occupancyFit,
              maxAdults: rt.maxAdults ?? null,
              maxChildren: rt.maxChildren ?? null,
              maxOccupancy: rt.maxOccupancy ?? null,
              status: rateInfo.status,
              cancellationSummary: rateInfo.cancellationSummary,
              eventSupplementTotal: rateInfo.eventSupplementTotal,
              appliedEvents: rateInfo.appliedEvents,
              publicMarkupPct,
              sourceMarketProfile: rateInfo.sourceMarketProfile,
              promotionCode: rateInfo.promotionCode,
              promotionName: rateInfo.promotionName,
              promotionType: rateInfo.promotionType,
              promotionDiscountAmount: rateInfo.promotionDiscountAmount,
              promotionFundingSource: rateInfo.promotionFundingSource,
            };
          });
        });

        const combination = bestCombinationByHotel.get(hotel.id);
        const displayQuote = combination?.complete ? aggregateDisplayQuote(combination, publicMarkupPct) : null;
        const bestValidOffer = combination?.complete && displayQuote ? {
          completeStayPricing: true,
          finalDisplayQuote: displayQuote.finalDisplayQuote,
          averagePerRoomNight: nights > 0 && roomConfigs.length > 0
            ? Math.round(displayQuote.finalDisplayQuote / (nights * roomConfigs.length))
            : 0,
          nights,
          rooms: roomConfigs.length,
          adults: roomConfigs.reduce((s,r)=>s+r.adults,0),
          children: roomConfigs.reduce((s,r)=>s+r.children,0),
          mixedRoomTypes: combination.mixedRoomTypes,
          mixedRatePlans: combination.mixedRatePlans,
          mixedCancellation: combination.mixedCancellation,
          childPricingIncluded: combination.assignments.some(a => a.nightly.some(n => n.childCharges.length > 0)),
          extraBedIncluded: combination.assignments.some(a => a.nightly.some(n => n.extraBedCount > 0)),
          eventSupplementIncluded: combination.assignments.some(a => a.nightly.some(n => n.eventSupplement > 0)),
          promotionApplied: combination.assignments.some(a => !!a.promotionCode),
          status: combination.assignments.some(a => a.status === 'On Request') ? 'On Request'
            : combination.assignments.some(a => a.status === 'Limited') ? 'Limited' : 'Free Sale',
          roomCombination: combination.assignments.map(a => ({
            requestedRoomNo: a.requestedRoomNo,
            roomTypeId: a.roomTypeId,
            roomTypeName: a.roomTypeName,
            ratePlanId: a.ratePlanId,
            ratePlanName: a.ratePlanName,
            mealPlan: a.mealPlan,
            cancellationPolicy: a.cancellationPolicy,
            roomStayDisplayPrice: Math.round(a.roomStaySell * (1 + publicMarkupPct / 100)),
            childSummary: a.nightly[0]?.childCharges?.map(c => `${c.age}y ${c.classification.replaceAll('_',' ')}${c.amount > 0 ? ` AED ${Math.round(c.amount)}/night` : ''}`).join(' · ') || '',
            extraBedCount: Math.max(0, ...a.nightly.map(n => n.extraBedCount)),
          })),
        } : null;

        const imageUrl = hotel.hotelImage?.length ? hotel.hotelImage[0].url : null;
        return {
          id: hotel.id, name: hotel.hotelName || '', location: hotel.location || '',
          emirate: hotel.emirate || '', starRating: hotel.starRating || '',
          status: hotel.status || '', imageUrl,
          guestRating: (hotel as any).guestRating == null ? null : safeNum((hotel as any).guestRating),
          reviewCount: Math.max(0, safeNum((hotel as any).reviewCount)),
          reviewLabel: (hotel as any).reviewLabel || null,
          rates,
          bestValidOffer,
          markupRule: displayRule ? {
            name: displayRule.ruleName || '',
            type: displayRule.markupType || '',
            value: Math.abs(safeNum(displayRule.markupValue)),
          } : null,
        };
      } catch (err) {
        // Per-hotel tolerance: log and return hotel with empty rates
        console.error(`[PRICING_INTEGRITY] hotelId=${hotel.id} reason=HOTEL_PROCESSING_ERROR error=${err}`);
        const imageUrl = hotel.hotelImage?.length ? hotel.hotelImage[0].url : null;
        return {
          id: hotel.id, name: hotel.hotelName || '', location: hotel.location || '',
          emirate: hotel.emirate || '', starRating: hotel.starRating || '',
          status: hotel.status || '', imageUrl,
          guestRating: (hotel as any).guestRating == null ? null : safeNum((hotel as any).guestRating),
          reviewCount: Math.max(0, safeNum((hotel as any).reviewCount)),
          reviewLabel: (hotel as any).reviewLabel || null,
          rates: [],
          bestValidOffer: null,
          markupRule: null,
        };
      }
    });

    return {
      hotels,
      markupRules: rules
        .filter((r) => r.type && r.appliesTo)
        .map(({ id, name, type, value, appliesTo }) => ({
          id, name, type, value: Math.abs(value), appliesTo
        })),
      searchErrors: requestedRoomErrors,
    };
  },
});
