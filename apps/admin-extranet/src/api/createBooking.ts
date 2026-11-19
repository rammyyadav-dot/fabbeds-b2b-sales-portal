import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import {
  applyMarkup,
  isCanonicalMealPlan,
  isSupportedAedRate,
  linkedId,
  resolveEffectiveRate,
  resolveMarkupRule,
  resolveOccupancyBaseRate,
  safeNum,
  validateAllocation,
  validateCommercialChain,
  validateStayRestrictions,
} from '@project/pricing/hotelPricing';
import {
  eventSupplementForNight,
  normalizeEventRule,
  validateEventStayRules,
  type HotelEventRule,
} from '@project/pricing/hotelEvents';

const roundAED = (n: number) => Math.round(n);

function getDatesInRange(checkin: string, checkout: string): string[] {
  const dates: string[] = [];
  const start = new Date(checkin + 'T00:00:00Z');
  const end = new Date(checkout + 'T00:00:00Z');
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default createEndpoint({
  description: 'Create a hotel booking only after authoritative rate-plan, inventory and pricing recheck',
  inputSchema: z.object({
    companyName: z.string(),
    guestName: z.string(),
    checkinDate: z.string(),
    checkoutDate: z.string(),
    rooms: z.number().int().min(1),
    adults: z.number().int().min(1),
    children: z.number().int().min(0).optional(),
    contactEmail: z.string(),
    whatsAppNumber: z.string().optional(),
    hotelId: z.string(),
    roomTypeId: z.string(),
    ratePlanId: z.string(),
    specialRequests: z.string().optional(),
    expectedSellTotal: z.number().nonnegative().optional(),
  }),
  outputSchema: z.object({
    id: z.string(),
    bookingRef: z.string(),
    totalSell: z.number().optional(),
    totalNet: z.number().optional(),
    nights: z.number(),
    pricingStatus: z.enum(['Rechecked', 'Price Changed']),
  }),
  execute: async ({ input }) => {
    const dates = getDatesInRange(input.checkinDate, input.checkoutDate);
    const nights = dates.length;
    if (!dates.length) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid stay dates' });
    }

    const [plan, room, ratesRes, markupRes, eventsRes] = await Promise.all([
      zite.ratePlans.findOne({ id: input.ratePlanId }),
      zite.roomTypes.findOne({ id: input.roomTypeId }),
      zite.dailyRates.findAll({
        filters: {
          hotel: { contains: input.hotelId },
          roomType: { contains: input.roomTypeId },
          rateDate: { gte: new Date(input.checkinDate), lte: new Date(input.checkoutDate) },
        },
        limit: 2000,
      }),
      zite.markupRules.findAll({ filters: { isActive: true }, limit: 500 }),
      zite.eventMaster.findAll({ filters: { hotel: { contains: input.hotelId } }, limit: 500 }),
    ]);

    if (!plan || !room || plan.status !== 'Active') {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Selected Rate Plan or Room Type is not active' });
    }

    const chainErrors = validateCommercialChain({
      hotelId: input.hotelId,
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId,
      roomHotelId: linkedId(room.hotel),
      ratePlanHotelId: linkedId(plan.hotel),
      ratePlanRoomTypeId: linkedId(plan.roomType),
      mealPlan: plan.mealPlan,
      mealPlanMasterId: linkedId(plan.mealPlanMaster),
      sellCurrency: plan.sellCurrency,
    });
    if (chainErrors.length || !isCanonicalMealPlan(plan.mealPlan)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Commercial integrity error: ${chainErrors.join(', ') || 'MEAL_PLAN_INVALID'}` });
    }

    const events: HotelEventRule[] = (eventsRes.records as any[])
      .map(normalizeEventRule)
      .filter((rule): rule is HotelEventRule => !!rule);
    const eventStayErrors = validateEventStayRules({
      events,
      stayDates: dates,
      checkIn: input.checkinDate,
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId,
    });
    if (eventStayErrors.length) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: eventStayErrors.join(' ') });
    }

    const candidatesByDate = new Map<string, typeof ratesRes.records>();
    for (const rate of ratesRes.records) {
      const linkedPlanId = linkedId(rate.ratePlan);
      if (rate.integrityStatus === 'Quarantined') continue;
      if (linkedPlanId !== input.ratePlanId) continue;
      if (rate.ratePlanId && rate.ratePlanId !== linkedPlanId) continue;
      if (linkedId(rate.hotel) !== input.hotelId || linkedId(rate.roomType) !== input.roomTypeId) continue;
      if (!isSupportedAedRate(rate.currency, plan.sellCurrency)) continue;
      const date = String(rate.rateDate ?? '').slice(0, 10);
      if (!dates.includes(date)) continue;
      const bucket = candidatesByDate.get(date) || [];
      bucket.push(rate);
      candidatesByDate.set(date, bucket);
    }

    const departureRate = resolveEffectiveRate(candidatesByDate.get(input.checkoutDate) || []);
    if (departureRate && safeNum(departureRate.ctd) > 0) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `${input.checkoutDate}: Closed to departure` });
    }

    const authoritativeRates: typeof ratesRes.records = [];
    const nightlyRates: Array<{
      date: string;
      dailyRateId: string;
      layer: string;
      baseNet: number;
      child: number;
      extraBed: number;
      event: number;
      net: number;
      sell: number;
      eventNames: string[];
      markupRuleId: string | null;
    }> = [];

    let sumNet = 0;
    let sumSell = 0;
    const children = input.children ?? 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const rate = resolveEffectiveRate(candidatesByDate.get(date) || []);
      if (!rate) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: `No exact Daily Rate for selected Rate Plan on ${date}` });
      }

      const restrictionErrors = validateStayRestrictions({
        requestedNights: nights,
        checkIn: input.checkinDate,
        checkOut: input.checkoutDate,
        ratePlanMinStay: plan.minStayNights,
        ratePlanMaxStay: plan.maxStayNights,
        dailyMinStay: rate.minStay,
        dailyMaxStay: rate.maxStay,
        cta: i === 0 && safeNum(rate.cta) > 0,
        ctd: false,
        leadDays: rate.leadDays,
        status: rate.status,
      });
      const allocationErrors = validateAllocation({
        status: rate.status,
        allocation: rate.allocation,
        requestedRooms: input.rooms,
        allowOnRequest: false,
      });
      if (restrictionErrors.length || allocationErrors.length) {
        throw new ZiteError({
          code: 'BAD_REQUEST',
          message: `${date}: ${[...restrictionErrors, ...allocationErrors].join(' | ')}`,
        });
      }

      const occupancy = resolveOccupancyBaseRate({
        adults: input.adults,
        adult1Rate: rate.adult1Rate,
        adult2Rate: rate.adult2Rate,
        adult3Rate: rate.adult3Rate,
        extraBedRate: rate.extraBedRate,
      });
      if (occupancy.baseRate <= 0) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: `No valid occupancy rate on ${date}` });
      }

      const childTotalPerRoom = children * safeNum(rate.childSupplement);
      const baseNetAllRooms = (occupancy.baseRate + occupancy.extraBedTotal + childTotalPerRoom) * input.rooms;
      const event = eventSupplementForNight({
        events,
        date,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
        rooms: Array.from({ length: input.rooms }, () => ({ adults: input.adults, children })),
      });
      const nightNet = baseNetAllRooms + event.amount;
      const rule = resolveMarkupRule(input.hotelId, markupRes.records, date);
      const nightSell = applyMarkup(nightNet, rule);

      sumNet += nightNet;
      sumSell += nightSell;
      authoritativeRates.push(rate);
      nightlyRates.push({
        date,
        dailyRateId: rate.id,
        layer: rate.layer || 'BASE',
        baseNet: occupancy.baseRate * input.rooms,
        child: childTotalPerRoom * input.rooms,
        extraBed: occupancy.extraBedTotal * input.rooms,
        event: event.amount,
        net: nightNet,
        sell: nightSell,
        eventNames: event.eventNames,
        markupRuleId: rule?.id || null,
      });
    }

    const totalNet = roundAED(sumNet);
    const totalSell = roundAED(sumSell);
    const pricingStatus: 'Rechecked' | 'Price Changed' =
      input.expectedSellTotal !== undefined && Math.abs(input.expectedSellTotal - totalSell) > 0.01
        ? 'Price Changed'
        : 'Rechecked';

    if (pricingStatus === 'Price Changed') {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: `PRICE_CHANGED: authoritative total is AED ${totalSell}. Review and submit again.`,
      });
    }

    const snapshot = {
      hotelId: input.hotelId,
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId,
      mealPlan: plan.mealPlan,
      ratePlanCode: plan.ratePlanCode || '',
      checkIn: input.checkinDate,
      checkOut: input.checkoutDate,
      roomConfigs: Array.from({ length: input.rooms }, () => ({ adults: input.adults, children })),
      nightlyRates,
      eventSupplements: nightlyRates.flatMap(n => n.eventNames.map(name => ({ date: n.date, name, amount: n.event }))),
      netTotal: totalNet,
      sellTotal: totalSell,
      currency: 'AED',
      pricingRecheckedAt: new Date().toISOString(),
    };

    const created = await zite.bookings.create({
      record: {
        companyName: input.companyName,
        guestName: input.guestName,
        checkinDate: input.checkinDate,
        checkoutDate: input.checkoutDate,
        rooms: input.rooms,
        adults: input.adults,
        children,
        contactEmail: input.contactEmail,
        whatsAppNumber: input.whatsAppNumber,
        hotel: input.hotelId,
        roomType: input.roomTypeId,
        ratePlan: [input.ratePlanId],
        mealPlan: plan.mealPlan,
        status: 'Pending',
        specialRequests: input.specialRequests,
        createdAt: new Date().toISOString(),
        netTotal: totalNet,
        sellTotal: totalSell,
        snapshotJson: JSON.stringify(snapshot),
        pricingStatus,
        priceRecheckedAt: new Date().toISOString(),
      },
    });

    for (const rate of authoritativeRates) {
      if (rate.status !== 'Free Sale' && rate.allocation != null) {
        await zite.dailyRates.update({
          id: rate.id,
          record: { allocation: Math.max(0, safeNum(rate.allocation) - input.rooms) },
        });
      }
    }

    await zite.bookingActivities.create({
      record: {
        eventType: 'Booking created',
        booking: created.id,
        notes: `Authoritative recheck passed — AED ${totalSell}; Rate Plan ${plan.ratePlanName || plan.id}`,
        createdAt: new Date().toISOString(),
        createdBy: input.contactEmail,
      },
    });

    return {
      id: created.id,
      bookingRef: String(created.bookingRef ?? created.id.slice(0, 8).toUpperCase()),
      totalSell,
      totalNet,
      nights,
      pricingStatus,
    };
  },
});
