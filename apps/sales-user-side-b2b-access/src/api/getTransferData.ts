import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

import { applyMarkup, classifyRoute, resolveMarkup, loadTransferExtras } from '../lib/transferBusiness';

export default createEndpoint({
  description: 'Get transfer zones, vehicle categories, and rates with B2B markup applied',
  inputSchema: z.object({
    originZoneId: z.string().optional(),
    destinationZoneId: z.string().optional(),
    pax: z.number().optional(),
    luggage: z.number().optional(),
  }),
  outputSchema: z.object({
    zones: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      emirate: z.string(),
      waitingGrace: z.number(),
      code: z.string(),
      iataCode: z.string(),
      districts: z.string(),
      pickupPoint: z.string(),
    })),
    vehicles: z.array(z.object({
      id: z.string(),
      name: z.string(),
      models: z.string(),
      maxPax: z.number(),
      maxLuggage: z.number(),
      tier: z.string(),
      wheelchair: z.boolean(),
      imageUrl: z.string().optional(),
    })),
    rates: z.array(z.object({
      id: z.string(),
      routeLabel: z.string(),
      originZoneId: z.string(),
      destinationZoneId: z.string(),
      vehicleCategoryId: z.string(),
      sellingPrice: z.number(),
      midnightSurcharge: z.number(),
      tollsIncluded: z.boolean(),
      distanceKm: z.number(),
      durationMinutes: z.number(),
    })),
    extras: z.array(z.object({ code: z.string(), name: z.string(), unit: z.string(), sellPrice: z.number(), maxQuantity: z.number(), airportOnly: z.boolean() })),
  }),
  execute: async ({ input }) => {
    const [zonesRes, vehiclesRes, ratesRes, markupRes] = await Promise.all([
      zite.transferZones.findAll({ filters: { active: true }, limit: 500 }),
      zite.vehicleCategories.findAll({ filters: { active: true }, limit: 500 }),
      zite.transferRates.findAll({
        filters: {
          active: true,
          ...(input.originZoneId ? { originZone: input.originZoneId } : {}),
          ...(input.destinationZoneId ? { destinationZone: input.destinationZoneId } : {}),
        },
        limit: 2000,
      }),
      zite.transferMarkupRules.findAll({ filters: { isActive: true }, limit: 100 }),
    ]);

    // Prepare markup rules for lookup
    const markupRules = markupRes.records.map(r => ({
      markupType: r.markupType || 'Flat',
      markupValue: r.markupValue || 0,
      appliesTo: r.appliesTo || 'Global (All Transfers)',
      specificRouteId: (Array.isArray(r.specificRoute) ? r.specificRoute[0] : r.specificRoute) || '',
      maxCap: r.maxMarkupCap || 0,
      priority: r.priority || 10,
    }));

    const pax = input.pax || 1;
    const luggage = input.luggage || 1;

    const vehicles = vehiclesRes.records
      .filter(v => (v.maxPassengers || 0) >= pax && (v.maxLuggage || 0) >= luggage)
      .map(v => ({
        id: v.id,
        name: v.categoryName || '',
        models: v.exampleModels || '',
        maxPax: v.maxPassengers || 0,
        maxLuggage: v.maxLuggage || 0,
        tier: v.tier || 'Standard',
        wheelchair: v.wheelchairAccessible || false,
        imageUrl: v.vehicleImage?.[0]?.url,
      }));

    const vehicleIds = new Set(vehicles.map(v => v.id));
    const zoneById = new Map(zonesRes.records.map(z => [z.id, z]));

    const rates = ratesRes.records
      .filter(r => {
        const vid = Array.isArray(r.vehicleCategory) ? r.vehicleCategory[0] : r.vehicleCategory;
        return vid && vehicleIds.has(vid);
      })
      .map(r => {
        const netCost = r.netCost || 0;
        const o: any = zoneById.get((Array.isArray(r.originZone) ? r.originZone[0] : r.originZone) || '');
        const d: any = zoneById.get((Array.isArray(r.destinationZone) ? r.destinationZone[0] : r.destinationZone) || '');
        const routeClass = classifyRoute({ type: o?.zoneType || '', emirate: o?.emirate || '' }, { type: d?.zoneType || '', emirate: d?.emirate || '' });
        const rule = resolveMarkup(r.id, routeClass, markupRules);
        const percentRule = rule && !(rule.markupType === 'Flat' || rule.markupType === 'Flat Amount (AED)');

        // Apply markup to net cost to derive the B2B selling price
        // If no rule, fall back to the stored selling price
        const sellingPrice = rule ? applyMarkup(netCost, rule) : (r.sellingPrice || netCost);

        // Also apply markup to midnight surcharge if present
        const netMidnight = r.midnightSurcharge || 0;
        // A flat markup is charged once per trip (in sellingPrice); only a % markup scales the night surcharge.
        const markedUpMidnight = percentRule && netMidnight > 0 ? applyMarkup(netMidnight, rule!) : netMidnight;

        return {
          id: r.id,
          routeLabel: r.routeLabel || '',
          originZoneId: (Array.isArray(r.originZone) ? r.originZone[0] : r.originZone) || '',
          destinationZoneId: (Array.isArray(r.destinationZone) ? r.destinationZone[0] : r.destinationZone) || '',
          vehicleCategoryId: (Array.isArray(r.vehicleCategory) ? r.vehicleCategory[0] : r.vehicleCategory) || '',
          sellingPrice,
          midnightSurcharge: markedUpMidnight,
          tollsIncluded: r.tollsIncluded ?? true,
          distanceKm: Number((r as any).distanceKm || 0),
          durationMinutes: Number((r as any).durationMinutes || 0),
        };
      });

    return {
      zones: zonesRes.records.map(z => ({
        id: z.id,
        name: z.zoneName || '',
        type: z.zoneType || '',
        emirate: z.emirate || '',
        waitingGrace: z.waitingGraceMinutes || 30,
        code: (z as any).zoneCode || '',
        iataCode: (z as any).iataCode || '',
        districts: (z as any).districtsCovered || '',
        pickupPoint: (z as any).pickupPoint || '',
      })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'Airport' ? -1 : b.type === 'Airport' ? 1 : a.type.localeCompare(b.type))),
      vehicles,
      rates,
      extras: (await loadTransferExtras(zite)).map(({ code, name, unit, sellPrice, maxQuantity, airportOnly }) => ({ code, name, unit, sellPrice, maxQuantity, airportOnly })),
    };
  },
});
