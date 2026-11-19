import { z } from 'zod';
import { zite } from 'zitejs/db';
import { getPartnerCreditPosition } from '@/lib/partnerCredit';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { eventSupplementForNight, loadHotelEventRules, validateEventStayRules } from '../lib/hotelEventPricing';
import {
  applyMarkup,
  isSupportedAedRate,
  resolveEffectiveRate,
  resolveMarkupRule,
  resolveInventoryGovernance,
  safeNum,
  validateStayRestrictions,
  validateAllocation,
} from '@project/pricing/hotelPricing';
import { priceRoomOccupancy, validateRequestedRoom } from '@project/pricing/occupancyPricing';
import { appendBookingMovements, ensureDirectBookedInventoryLedger, inventoryKey, loadInventoryConsumption, remainingAllocation } from '@project/pricing/inventoryLedger';

const roomConfigSchema = z.object({
  adults: z.number().int().min(1),
  children: z.number().int().min(0),
  childAges: z.array(z.number().int().min(0)),
});

const roomBreakdownItemSchema = z.object({
  roomNo: z.number(),
  adults: z.number(),
  children: z.number(),
  baseRate: z.number(),
  childTotal: z.number(),
  extraBedTotal: z.number(),
  nightlyTotal: z.number(),
  roomTotal: z.number(),
  isValidOccupancy: z.boolean(),
  occupancyError: z.string().optional(),
  payingChildren: z.number(),
  freeChildren: z.number(),
});

const pricingSnapshotSchema = z.object({
  nights: z.number(),
  rooms: z.number(),
  netTotal: z.number(),
  sellTotal: z.number(),
  markupLabel: z.string(),
  markupAmount: z.number(),
  margin: z.number(),
  marginPercent: z.number(),
  rateSource: z.string(),
  ratesCoveredNights: z.number(),
  roomBreakdown: z.array(roomBreakdownItemSchema),
  eventSupplementTotal: z.number().default(0),
  appliedEvents: z.array(z.string()).default([]),
  calculatedAt: z.string(),
}).optional();

async function getOpenExposure(partnerId: string): Promise<number> {
  // Shared ledger: hotels + attractions + transfers (previously hotels only).
  return (await getPartnerCreditPosition(partnerId)).used;
}

async function getOverdueCount(partnerId: string): Promise<number> {
  return (await getPartnerCreditPosition(partnerId)).overdue;
}

export default createEndpoint({
  description: 'Creates an authenticated partner booking request against approved credit availability',
  inputSchema: z.object({
    partnerToken: z.string(),
    hotelId: z.string(),
    roomTypeId: z.string(),
    ratePlanId: z.string(),
    roomTypeName: z.string().optional(),
    mealPlan: z.string().optional(),
    sellRateSnapshot: z.number(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    rooms: z.number().optional(),
    adults: z.number().optional(),
    children: z.number().optional(),
    roomConfigs: z.array(roomConfigSchema).min(1),
    guestName: z.string(),
    nationality: z.string().optional(),
    specialRequests: z.string().optional(),
    arrivalTime: z.string().optional(),
    pricingSnapshot: pricingSnapshotSchema,
  }),
  outputSchema: z.object({
    success: z.boolean(),
    bookingId: z.string().optional(),
    bookingReference: z.string().optional(),
    creditAvailableAfter: z.number().optional(),
  }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.partnerToken);
    if (!partnerId) {
      throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Your partner session has expired. Please sign in again.' });
    }

    const partner = await zite.partnerAccounts.findOne({ id: partnerId }) as any;
    if (!partner || partner.accountStatus === 'Suspended') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'This partner account is not active.' });
    }

    const [room, plan] = await Promise.all([
      zite.roomTypes.findOne({ id: input.roomTypeId }),
      zite.ratePlans.findOne({ id: input.ratePlanId }),
    ]);
    const linkedId = (v: string | string[] | null | undefined) => Array.isArray(v) ? v[0] : v;

    if (!room || !plan || linkedId(room.hotel) !== input.hotelId ||
        linkedId(plan.hotel) !== input.hotelId || linkedId(plan.roomType) !== input.roomTypeId ||
        plan.status !== 'Active' || !linkedId(plan.mealPlanMaster) || plan.mealPlan !== input.mealPlan ||
        !isSupportedAedRate(undefined, plan.sellCurrency) ||
        !input.pricingSnapshot || input.pricingSnapshot.rateSource !== 'daily' ||
        input.pricingSnapshot.ratesCoveredNights !== input.pricingSnapshot.nights ||
        input.pricingSnapshot.sellTotal <= 0 ||
        input.pricingSnapshot.sellTotal !== input.sellRateSnapshot ||
        input.roomConfigs.length !== input.pricingSnapshot.rooms ||
        input.roomConfigs.length !== input.pricingSnapshot.roomBreakdown.length) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Verified rate plan and complete per-room pricing are required.' });
    }

    const marketCodes = String(plan.nationalityMarket || '').trim().toUpperCase().split(/[\s,;|/]+/).filter(Boolean);
    const requestedMarket = input.nationality?.toUpperCase();
    if (marketCodes.length && !marketCodes.includes('ALL') && !marketCodes.includes('*') && !marketCodes.includes('GLOBAL') &&
        (!requestedMarket || !marketCodes.includes(requestedMarket))) {
      throw new ZiteError({ code: 'CONFLICT', message: 'The selected Rate Plan is no longer eligible for the guest source market.' });
    }
    for (let i = 0; i < input.roomConfigs.length; i++) {
      const errors = validateRequestedRoom({ ...input.roomConfigs[i], roomNo: i + 1 });
      if (errors.length) throw new ZiteError({ code: 'BAD_REQUEST', message: `Room ${i + 1}: ${errors.join(' ')}` });
    }

    const p = input.pricingSnapshot;

    if (!input.checkIn || !input.checkOut) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Check-in and check-out are required for authoritative event pricing.' });
    }
    const stayDates: string[] = [];
    const cursor = new Date(input.checkIn + 'T00:00:00Z');
    const end = new Date(input.checkOut + 'T00:00:00Z');
    while (cursor < end) {
      stayDates.push(cursor.toISOString().slice(0,10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const eventRules = await loadHotelEventRules(input.hotelId);
    const eventRuleErrors = validateEventStayRules({
      events: eventRules,
      stayDates,
      checkIn: input.checkIn,
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId,
    });
    if (eventRuleErrors.length) {
      throw new ZiteError({ code: 'CONFLICT', message: eventRuleErrors.join(' ') });
    }
    let expectedEventSupplement = 0;
    const expectedEvents = new Set<string>();
    for (const date of stayDates) {
      const ev = eventSupplementForNight({
        events: eventRules,
        date,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
        rooms: p.roomBreakdown.map(r => ({ adults: r.adults, children: r.children })),
      });
      expectedEventSupplement += ev.amount;
      ev.eventNames.forEach(name => expectedEvents.add(name));
    }
    if (Math.round(expectedEventSupplement) !== Math.round(p.eventSupplementTotal || 0)) {
      throw new ZiteError({
        code: 'CONFLICT',
        message: 'Event/exhibition supplement changed or is missing. Please recheck the rate before submitting.',
      });
    }

    // Authoritative booking-time recheck. Do not trust the browser's pricing
    // snapshot as the source of truth: re-read the exact RatePlan Daily Rates,
    // restrictions, allocation and markup immediately before credit exposure.
    const [dailySql, markupRes] = await Promise.all([
      zite.sql({
        query: `
          SELECT dr.id, dr."rateDate", dr."adult1Rate", dr."adult2Rate", dr."adult3Rate",
                 dr."childSupplement", dr."childRate05", dr."childRate611", dr."extraBedRate", dr."allocation", dr."status",
                 dr."layer", dr."priority", dr."currency", dr."minStay", dr."maxStay",
                 dr."cta", dr."ctd", dr."leadDays", dr."ratePlanId", dr.updated_at AS "updatedAt",
                 l_h."hotelsId" AS "hotelId",
                 l_rt."roomTypesId" AS "roomTypeId",
                 l_rp."ratePlansId" AS "ratePlanLinkId"
          FROM "DailyRates" dr
          LEFT JOIN "DailyRatesHotels" l_h ON l_h."dailyRatesId" = dr.id
          LEFT JOIN "DailyRatesRoomTypes" l_rt ON l_rt."dailyRatesId" = dr.id
          LEFT JOIN "DailyRatesRatePlans" l_rp ON l_rp."dailyRatesId" = dr.id
          WHERE l_h."hotelsId" = $1
            AND l_rt."roomTypesId" = $2
            AND l_rp."ratePlansId" = $3
            AND dr."rateDate" >= $4
            AND dr."rateDate" < $5
            AND (dr."integrityStatus" IS NULL OR dr."integrityStatus" != 'Quarantined')
        `,
        params: [input.hotelId, input.roomTypeId, input.ratePlanId, input.checkIn, input.checkOut],
      }),
      zite.markupRules.findAll({ filters: { isActive: true }, limit: 500 }),
    ]);

    const byDate = new Map<string, any[]>();
    for (const raw of dailySql.rows as any[]) {
      if (!raw.ratePlanLinkId || String(raw.ratePlanLinkId) !== input.ratePlanId) continue;
      if (raw.ratePlanId && String(raw.ratePlanId) !== input.ratePlanId) continue;
      const date = raw.rateDate
        ? (typeof raw.rateDate === 'string' ? raw.rateDate.slice(0, 10) : new Date(raw.rateDate).toISOString().slice(0, 10))
        : '';
      if (!date) continue;
      const list = byDate.get(date) || [];
      list.push({
        ...raw,
        id: String(raw.id),
        layer: raw.layer || 'BASE',
        priority: safeNum(raw.priority),
        updatedAt: raw.updatedAt,
      });
      byDate.set(date, list);
    }

    const inventoryConsumption=await loadInventoryConsumption({
      checkIn:input.checkIn,
      checkOut:input.checkOut,
      hotelId:input.hotelId,
    });

    let authoritativeNet = 0;
    let authoritativeSell = 0;
    for (let i = 0; i < stayDates.length; i++) {
      const date = stayDates[i];
      const rate = resolveEffectiveRate(byDate.get(date) || []);
      if (!rate) {
        throw new ZiteError({ code: 'CONFLICT', message: `Rate is no longer available for ${date}. Please recheck.` });
      }
      if (!isSupportedAedRate(rate.currency || 'AED', plan.sellCurrency)) {
        throw new ZiteError({ code: 'CONFLICT', message: 'The selected tariff is no longer a valid AED rate.' });
      }

      const governance=resolveInventoryGovernance({
        rate,stayDate:date,checkIn:input.checkIn,checkOut:input.checkOut,
      });
      const restrictionErrors = validateStayRestrictions({
        requestedNights: stayDates.length,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        ratePlanMinStay: plan.minStayNights,
        ratePlanMaxStay: plan.maxStayNights,
        dailyMinStay: safeNum(rate.minStay),
        dailyMaxStay: safeNum(rate.maxStay),
        cta: date === input.checkIn && safeNum(rate.cta) > 0,
        ctd: i === stayDates.length - 1 && safeNum(rate.ctd) > 0,
        leadDays: safeNum(rate.leadDays),
        status: governance.effectiveStatus,
      });
      if (restrictionErrors.length) {
        throw new ZiteError({ code: 'CONFLICT', message: `${date}: ${restrictionErrors.join(' ')}` });
      }
      const remaining=remainingAllocation({
        allocation:governance.governedAllocation,
        status:governance.effectiveStatus,
        overbookingAllowance:governance.overbookingAllowance,
        consumed:inventoryConsumption.get(inventoryKey(input.hotelId,input.roomTypeId,input.ratePlanId,date)),
      });
      const allocationErrors = validateAllocation({
        status: governance.effectiveStatus,
        allocation: remaining,
        requestedRooms: p.rooms,
        allowOnRequest: false,
      });
      if (allocationErrors.length) {
        throw new ZiteError({ code: 'CONFLICT', message: `Confirmed allocation is no longer available for ${date}: ${allocationErrors.join(' ')}` });
      }

      const rule = resolveMarkupRule(input.hotelId, markupRes.records, date);
      for (let roomIndex = 0; roomIndex < input.roomConfigs.length; roomIndex++) {
        const rc = input.roomConfigs[roomIndex];
        const occupancy = priceRoomOccupancy(
          { ...rc, roomNo: roomIndex + 1 },
          room,
          {
            adult1Rate: safeNum(rate.adult1Rate),
            adult2Rate: safeNum(rate.adult2Rate),
            adult3Rate: safeNum(rate.adult3Rate),
            extraBedRate: safeNum(rate.extraBedRate),
            childSupplement: safeNum(rate.childSupplement),
            childRate05: safeNum(rate.childRate05),
            childRate611: safeNum(rate.childRate611),
          }
        );
        if (!occupancy.valid || occupancy.net <= 0) {
          throw new ZiteError({
            code: 'CONFLICT',
            message: `Room ${roomIndex + 1} child/occupancy policy changed for ${date}: ${occupancy.errors.join(' ')}`,
          });
        }
        authoritativeNet += occupancy.net;
        authoritativeSell += applyMarkup(occupancy.net, rule);
      }

      const ev = eventSupplementForNight({
        events: eventRules,
        date,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
        rooms: p.roomBreakdown.map(r => ({ adults: r.adults, children: r.children })),
      });
      authoritativeNet += ev.amount;
      authoritativeSell += Math.round(applyMarkup(ev.amount, rule));
    }

    authoritativeNet = Math.round(authoritativeNet);
    authoritativeSell = Math.max(authoritativeNet, Math.round(authoritativeSell));
    if (authoritativeNet !== Math.round(p.netTotal) || authoritativeSell !== Math.round(p.sellTotal)) {
      throw new ZiteError({
        code: 'CONFLICT',
        message: `Price changed during authoritative recheck. Updated total is AED ${authoritativeSell}. Please review and submit again.`,
      });
    }

    const creditLimit = Math.max(0, Number(partner.creditLimitAed || 0));
    const creditStatus = partner.creditStatus || 'Pending Review';
    const creditTermsDays = Math.max(0, Number(partner.creditTermsDays || 0));
    const overdueCount = await getOverdueCount(partnerId);

    if (creditStatus !== 'Approved') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Your agency credit account is not approved for booking. Contact operations.' });
    }
    if (creditLimit <= 0) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'No credit limit is assigned to this agency. Contact operations.' });
    }
    if (overdueCount > 0) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Booking is on hold because the agency has overdue credit exposure. Contact finance.' });
    }

    const exposureBefore = await getOpenExposure(partnerId);
    const availableBefore = Math.max(0, creditLimit - exposureBefore);
    if (p.sellTotal > availableBefore) {
      throw new ZiteError({
        code: 'FORBIDDEN',
        message: `Insufficient agency credit. Available AED ${availableBefore.toFixed(2)}; booking requires AED ${p.sellTotal.toFixed(2)}.`,
      });
    }

    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + creditTermsDays);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const snapshotJson = JSON.stringify({
      partnerId,
      agencyName: partner.agencyName || '',
      agencyEmail: partner.agencyEmail || '',
      creditLimitAtRequest: creditLimit,
      creditAvailableBefore: availableBefore,
      creditTermsDays,
      pricing: p,
      requestedRoomConfigs: input.roomConfigs,
      pricingVersion: 'multi-room-v1',
      eventPricing: {
        supplementTotal: Math.round(expectedEventSupplement),
        events: Array.from(expectedEvents),
      },
      nationality: input.nationality,
      arrivalTime: input.arrivalTime,
      requestTimestamp: new Date().toISOString(),
    });

    const mealPlanMap: Record<string, string> = {
      'RO': 'Room Only', 'BB': 'Bed & Breakfast',
      'HB': 'Half Board', 'FB': 'Full Board', 'AI': 'All Inclusive',
    };
    const mealPlanValue = input.mealPlan
      ? (mealPlanMap[input.mealPlan] || input.mealPlan)
      : undefined;

    const booking = await zite.bookings.create({
      record: {
        companyName: partner.agencyName || '',
        guestName: input.guestName,
        checkinDate: input.checkIn,
        checkoutDate: input.checkOut,
        rooms: input.rooms,
        adults: input.adults,
        children: input.children,
        contactEmail: partner.agencyEmail || '',
        whatsAppNumber: partner.agencyMobile,
        hotel: input.hotelId,
        roomType: input.roomTypeId,
        ratePlan: input.ratePlanId,
        partnerAccount: partnerId,
        bookingSource: 'Partner Account',
        businessType: partner.businessType,
        contactCountry: partner.country,
        contactCity: partner.city,
        status: 'Awaiting Hotel',
        pricingStatus: 'Rechecked',
        specialRequests: input.specialRequests,
        adminNotes: snapshotJson,
        mealPlan: mealPlanValue as any,
        netTotal: p.netTotal,
        sellTotal: p.sellTotal,
        snapshotJson,
        creditSettlementStatus: 'Open',
        creditDueDate: dueDateStr,
      } as any,
    });

    // Assign human-readable commercial references after creation so the
    // autogenerated Booking Ref can be incorporated without race-prone counters.
    const bookingSequence = String((booking as any).bookingRef || '').padStart(6, '0');
    const refDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const bookingReference = `UAEWB-${refDate}-${bookingSequence || booking.id.slice(0, 6).toUpperCase()}`;
    const invoiceNumber = `INV-${refDate}-${bookingSequence || booking.id.slice(0, 6).toUpperCase()}`;

    await zite.bookings.update({
      id: booking.id,
      record: {
        bookingReference,
        invoiceNumber,
      } as any,
    });

    if (p.roomBreakdown?.length) {
      await zite.bookingRooms.bulkCreate({
        records: p.roomBreakdown.map(r => ({
          booking: booking.id,
          roomNo: r.roomNo,
          roomType: input.roomTypeId,
          ratePlan: input.ratePlanId,
          mealPlan: mealPlanValue as any,
          adults: r.adults,
          children: r.children,
          nights: p.nights,
          baseRate: r.baseRate,
          childTotal: r.childTotal,
          extraBedTotal: r.extraBedTotal,
          nightlyTotal: r.nightlyTotal,
          roomTotal: r.roomTotal,
          isValidOccupancy: r.isValidOccupancy,
          invalidReason: r.occupancyError,
          payingChildren: r.payingChildren,
          freeChildren: r.freeChildren,
        })),
      });
    }

    // Post-create fail-closed recheck protects against concurrent requests
    // that both passed the pre-create availability check.
    const exposureAfter = await getOpenExposure(partnerId);
    if (exposureAfter > creditLimit) {
      await zite.bookings.update({
        id: booking.id,
        record: {
          status: 'Rejected',
          creditSettlementStatus: 'Released',
          adminNotes: snapshotJson + '\nCREDIT_GUARD: rejected after concurrent exposure recheck',
        } as any,
      });
      throw new ZiteError({
        code: 'CONFLICT',
        message: 'Credit availability changed while this request was being submitted. Please review your wallet and try again.',
      });
    }

    const inventoryLedger=await ensureDirectBookedInventoryLedger({
      bookingId:booking.id,
      bookingReference,
      hotelId:input.hotelId,
      roomTypeId:input.roomTypeId,
      ratePlanId:input.ratePlanId,
      checkIn:input.checkIn,
      checkOut:input.checkOut,
      quantity:p.rooms,
      pricingVersion:'multi-room-v1',
    });
    const movementRows=await appendBookingMovements({
      bookingId:booking.id,bookingReference,source:'direct_booking',
      actor:partner.agencyEmail||'Partner',directDelta:1,
      notes:'Direct booking consumed authoritative allocation without a prior hold',
    });

    await zite.bookingEvents.create({
      record: {
        eventName: 'partner_credit_booking_requested',
        booking: booking.id,
        details: `Credit exposure AED ${p.sellTotal.toFixed(2)}; booked inventory ledger ${inventoryLedger.created}/${inventoryLedger.total}; inventory movements ${movementRows}; event supplement AED ${Math.round(expectedEventSupplement).toFixed(2)}; events ${Array.from(expectedEvents).join(', ') || 'none'}; available after AED ${Math.max(0, creditLimit - exposureAfter).toFixed(2)}`,
      },
    });

    return {
      success: true,
      bookingId: booking.id,
      bookingReference,
      creditAvailableAfter: Math.max(0, creditLimit - exposureAfter),
    };
  },
});
