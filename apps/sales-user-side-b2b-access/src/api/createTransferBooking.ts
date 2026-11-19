import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { verifyPartnerToken } from '../lib/partnerSecurity';
import { getPartnerCreditPosition, assertCreditFor, creditDueDate } from '../lib/partnerCredit';
import {
  calculateTransferPrice,
  classifyRoute,
  legacyExtras,
  loadTransferExtras,
  priceExtras,
  resolveMarkup,
  validatePickupDateTime,
  validateTransferType,
} from '../lib/transferBusiness';

export default createEndpoint({
  description: 'Create an authoritatively rechecked B2B transfer booking',
  inputSchema: z.object({
    partnerToken: z.string(),
    transferType: z.enum(['ARRIVAL', 'DEPARTURE', 'POINT_TO_POINT', 'INTERCITY']),
    rateId: z.string(),
    pickupAddress: z.string().trim().min(3).max(200),
    dropoffAddress: z.string().trim().min(3).max(200),
    pickupDate: z.string(),
    pickupTime: z.string(),
    flightNumber: z.string().trim().max(30).optional(),
    leadPassengerName: z.string().trim().min(2).max(120),
    passengerPhone: z.string().trim().min(7).max(30),
    paxCount: z.number().int().min(1).max(50),
    luggageCount: z.number().int().min(0).max(30),
    meetAndGreet: z.boolean().optional(),
    childSeat: z.boolean().optional(),
    extras: z.array(z.object({ code: z.string(), quantity: z.number().int().min(0).max(10) })).optional(),
    specialNotes: z.string().trim().max(1000).optional(),
    expectedTotalPrice: z.number().nonnegative().optional(),
  }),
  outputSchema: z.object({
    bookingId: z.string(),
    bookingReference: z.string(),
    totalPrice: z.number(),
    bookingStatus: z.string(),
    creditAvailableAfter: z.number(),
  }),
  execute: async ({ input, context }) => {
    // Same agency session as hotels and attractions (was a separate staff login).
    const partnerId = await verifyPartnerToken(input.partnerToken);
    if (!partnerId) throw new Error('Your agency session has expired. Please sign in again to book transfers.');

    validatePickupDateTime(input.pickupDate, input.pickupTime);

    const [rate, markupRes] = await Promise.all([
      zite.transferRates.findOne({ id: input.rateId }),
      zite.transferMarkupRules.findAll({ filters: { isActive: true }, limit: 100 }),
    ]);
    if (!rate || !rate.active) throw new Error('Transfer rate is no longer available');

    const originZoneId = (Array.isArray(rate.originZone) ? rate.originZone[0] : rate.originZone) || '';
    const destinationZoneId = (Array.isArray(rate.destinationZone) ? rate.destinationZone[0] : rate.destinationZone) || '';
    const vehicleCategoryId = (Array.isArray(rate.vehicleCategory) ? rate.vehicleCategory[0] : rate.vehicleCategory) || '';
    if (!originZoneId || !destinationZoneId || !vehicleCategoryId) {
      throw new Error('Transfer rate is not fully mapped');
    }

    const [origin, destination, vehicle] = await Promise.all([
      zite.transferZones.findOne({ id: originZoneId }),
      zite.transferZones.findOne({ id: destinationZoneId }),
      zite.vehicleCategories.findOne({ id: vehicleCategoryId }),
    ]);
    if (!origin?.active || !destination?.active || !vehicle?.active) {
      throw new Error('Transfer route or vehicle is no longer active');
    }

    validateTransferType(
      input.transferType,
      {
        id: origin.id,
        type: origin.zoneType || '',
        emirate: origin.emirate || '',
        waitingGrace: origin.waitingGraceMinutes || 0,
      },
      {
        id: destination.id,
        type: destination.zoneType || '',
        emirate: destination.emirate || '',
        waitingGrace: destination.waitingGraceMinutes || 0,
      },
    );

    if ((vehicle.maxPassengers || 0) < input.paxCount) {
      throw new Error('Passenger count exceeds the selected vehicle capacity');
    }
    if ((vehicle.maxLuggage || 0) < input.luggageCount) {
      throw new Error('Luggage count exceeds the selected vehicle capacity');
    }

    const requiresFlight = input.transferType === 'ARRIVAL' || input.transferType === 'DEPARTURE';
    if (requiresFlight && !input.flightNumber) {
      throw new Error('Flight number is required for airport transfers');
    }

    const markupRules = markupRes.records.map(r => ({
      markupType: r.markupType || 'Flat',
      markupValue: r.markupValue || 0,
      appliesTo: r.appliesTo || 'Global (All Transfers)',
      specificRouteId: (Array.isArray(r.specificRoute) ? r.specificRoute[0] : r.specificRoute) || '',
      maxCap: r.maxMarkupCap || 0,
      priority: r.priority || 10,
    }));

    // Route class from the zones themselves; extras priced from the Transfer Extras table.
    const routeClass = classifyRoute({ type: origin.zoneType || '', emirate: origin.emirate || '' }, { type: destination.zoneType || '', emirate: destination.emirate || '' });
    const rule = resolveMarkup(rate.id, routeClass, markupRules);
    const extras = priceExtras(legacyExtras(input.meetAndGreet, input.childSeat, input.extras), await loadTransferExtras(zite), routeClass);
    const price = calculateTransferPrice({
      netCost: rate.netCost || 0,
      storedSellingPrice: rate.sellingPrice || 0,
      midnightSurcharge: rate.midnightSurcharge || 0,
      pickupTime: input.pickupTime,
      rule,
      extras,
    });

    if (
      input.expectedTotalPrice !== undefined &&
      Math.abs(input.expectedTotalPrice - price.total) > 0.01
    ) {
      throw new Error('Transfer price changed during recheck. Please review the updated fare and submit again.');
    }

    // Shared credit ledger (hotels + attractions + transfers): suspended, unapproved, overdue or over-limit agencies are refused.
    const creditBefore = await getPartnerCreditPosition(partnerId);
    assertCreditFor(creditBefore, price.total);

    const ref = `FB-TRF-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const typeMap: Record<string, string> = {
      ARRIVAL: 'Arrival',
      DEPARTURE: 'Departure',
      POINT_TO_POINT: 'Point to Point',
      INTERCITY: 'Intercity',
    };

    const booking = await zite.transferBookings.create({
      record: {
        bookingReference: ref,
        transferType: typeMap[input.transferType] || input.transferType,
        originZone: originZoneId,
        destinationZone: destinationZoneId,
        vehicleCategory: vehicleCategoryId,
        pickupAddress: input.pickupAddress,
        dropoffAddress: input.dropoffAddress,
        pickupDate: input.pickupDate,
        pickupTime: input.pickupTime,
        flightNumber: input.flightNumber || '',
        leadPassengerName: input.leadPassengerName,
        passengerPhone: input.passengerPhone,
        paxCount: input.paxCount,
        luggageCount: input.luggageCount,
        meetAndGreet: extras.lines.some(l => l.code === 'MNG'),
        childSeat: extras.lines.some(l => l.code === 'CSEAT' || l.code === 'BOOST'),
        totalPrice: price.total,
        netCostTotal: price.netTotal,
        extrasSummary: extras.lines.map(l => `${l.quantity}× ${l.name} (AED ${l.sell})`).join(' · '),
        bookingStatus: 'Confirmed',
        specialNotes: input.specialNotes || '',
        ...(context.user?.id ? { bookedBy: context.user.id } : {}),
        partnerAccount: partnerId,
        creditSettlementStatus: 'Open',
        creditDueDate: creditDueDate(creditBefore.termsDays),
      },
    });

    // Concurrency guard: if parallel bookings pushed the agency over its limit, release this one.
    const creditAfter = await getPartnerCreditPosition(partnerId);
    if (creditAfter.used > creditAfter.creditLimit + 0.001) {
      await zite.transferBookings.update({ id: booking.id, record: { bookingStatus: 'Cancelled', creditSettlementStatus: 'Released', specialNotes: `${input.specialNotes || ''}\n[System] Released: agency credit limit exceeded by a concurrent booking.`.trim() } as any });
      throw new Error('Credit availability changed while booking. Please try again.');
    }

    return {
      bookingId: booking.id,
      bookingReference: ref,
      totalPrice: price.total,
      bookingStatus: 'Confirmed',
      creditAvailableAfter: creditAfter.available,
    };
  },
});
