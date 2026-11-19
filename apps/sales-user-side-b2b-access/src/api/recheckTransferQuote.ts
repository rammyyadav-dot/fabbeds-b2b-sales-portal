import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
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
import { verifyPartnerToken } from '../lib/partnerSecurity';

const transferTypeSchema = z.enum(['ARRIVAL', 'DEPARTURE', 'POINT_TO_POINT', 'INTERCITY']);

export default createEndpoint({
  description: 'Authoritatively recheck a UAE transfer quote before booking',
  inputSchema: z.object({
    partnerToken: z.string(),
    transferType: transferTypeSchema,
    rateId: z.string(),
    pickupDate: z.string(),
    pickupTime: z.string(),
    paxCount: z.number().int().min(1).max(50),
    luggageCount: z.number().int().min(0).max(30),
    meetAndGreet: z.boolean().optional(),
    childSeat: z.boolean().optional(),
    extras: z.array(z.object({ code: z.string(), quantity: z.number().int().min(0).max(10) })).optional(),
  }),
  outputSchema: z.object({
    canBook: z.boolean(),
    quoteStatus: z.enum(['RECHECKED', 'UNAVAILABLE']),
    reason: z.string().optional(),
    rateId: z.string(),
    routeLabel: z.string(),
    vehicleCategoryId: z.string(),
    originZoneId: z.string(),
    destinationZoneId: z.string(),
    basePrice: z.number(),
    nightSurcharge: z.number(),
    meetAndGreetPrice: z.number(),
    childSeatPrice: z.number(),
    extras: z.array(z.object({ code: z.string(), name: z.string(), quantity: z.number(), sell: z.number() })),
    extrasTotal: z.number(),
    totalPrice: z.number(),
    tollsIncluded: z.boolean(),
    waitingGraceMinutes: z.number(),
    quoteValidUntil: z.string(),
  }),
  execute: async ({ input }) => {
    if (!(await verifyPartnerToken(input.partnerToken))) throw new Error('Sign in with your agency account to see transfer rates.');
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
      throw new Error('Transfer route or vehicle is not active');
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
      throw new Error('Selected vehicle does not support the passenger count');
    }
    if ((vehicle.maxLuggage || 0) < input.luggageCount) {
      throw new Error('Selected vehicle does not support the luggage count');
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

    const originAirport = (origin.zoneType || '').toLowerCase() === 'airport';
    const destinationAirport = (destination.zoneType || '').toLowerCase() === 'airport';
    const waitingGraceMinutes = originAirport
      ? (origin.waitingGraceMinutes || 0)
      : destinationAirport
        ? (destination.waitingGraceMinutes || 0)
        : Math.max(origin.waitingGraceMinutes || 0, destination.waitingGraceMinutes || 0);

    return {
      canBook: true,
      quoteStatus: 'RECHECKED' as const,
      rateId: rate.id,
      routeLabel: rate.routeLabel || '',
      vehicleCategoryId,
      originZoneId,
      destinationZoneId,
      basePrice: price.basePrice,
      nightSurcharge: price.nightSurcharge,
      meetAndGreetPrice: extras.lines.find(l => l.code === 'MNG')?.sell ?? 0,
      childSeatPrice: extras.lines.find(l => l.code === 'CSEAT')?.sell ?? 0,
      extras: extras.lines.map(({ code, name, quantity, sell }) => ({ code, name, quantity, sell })),
      extrasTotal: extras.sell,
      totalPrice: price.total,
      tollsIncluded: rate.tollsIncluded ?? true,
      waitingGraceMinutes,
      quoteValidUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  },
});
