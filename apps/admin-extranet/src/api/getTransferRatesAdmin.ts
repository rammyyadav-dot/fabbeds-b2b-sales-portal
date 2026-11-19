import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';
import { allAttractionRecords as allRecords } from '../lib/allAttractionRecords';

const lid = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');

export default createEndpoint({
  authenticated: true,
  description: 'Filtered, paged transfer route fares for the admin fare manager',
  inputSchema: z.object({
    actingUserId: z.string().optional(),
    originId: z.string().optional(), destinationId: z.string().optional(), vehicleId: z.string().optional(),
    emirate: z.string().optional(), status: z.enum(['all', 'active', 'inactive', 'issues']).default('all'),
    fareStatus: z.enum(['all', 'Indicative', 'Contracted']).default('all'), q: z.string().optional(),
    offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(200).default(50),
  }),
  outputSchema: z.object({
    total: z.number(),
    items: z.array(z.object({
      id: z.string(), label: z.string(), routeCode: z.string(), originId: z.string(), originName: z.string(), originCode: z.string(),
      destinationId: z.string(), destinationName: z.string(), destinationCode: z.string(), vehicleId: z.string(), vehicleName: z.string(),
      netCost: z.number(), sellingPrice: z.number(), midnightSurcharge: z.number(), tollsIncluded: z.boolean(), active: z.boolean(),
      fareStatus: z.string(), distanceKm: z.number(), durationMinutes: z.number(), issues: z.array(z.string()),
    })),
  }),
  execute: async ({ input, context }) => {
    await requireAdminSessionVerified(context, input.actingUserId, 'view transfer fares');
    const filters: any = {};
    if (input.originId) filters.originZone = input.originId;
    if (input.destinationId) filters.destinationZone = input.destinationId;
    if (input.vehicleId) filters.vehicleCategory = input.vehicleId;
    if (input.status === 'active' || input.status === 'issues') filters.active = true;
    if (input.status === 'inactive') filters.active = false;
    if (input.fareStatus !== 'all') filters.fareStatus = input.fareStatus;
    const [{ records: rates }, zr, vr] = await Promise.all([
      allRecords(zite.transferRates, { filters }),
      zite.transferZones.findAll({ limit: 1000 }),
      zite.vehicleCategories.findAll({ limit: 500 }),
    ]);
    const zones = new Map(zr.records.map((x: any) => [x.id, x])), vehicles = new Map(vr.records.map((x: any) => [x.id, x]));
    const q = (input.q || '').trim().toLowerCase();
    const items = (rates as any[]).map(r => {
      const o: any = zones.get(lid(r.originZone)), d: any = zones.get(lid(r.destinationZone)), v: any = vehicles.get(lid(r.vehicleCategory));
      const issues: string[] = [];
      if (!o || !d) issues.push('Zone missing'); else if (!o.active || !d.active) issues.push('Zone inactive');
      if (!v) issues.push('Vehicle missing'); else if (!v.active) issues.push('Vehicle inactive');
      if (Number(r.netCost || 0) <= 0) issues.push('Net cost must be positive');
      if (r.active && r.fareStatus !== 'Contracted') issues.push('Live but not contracted');
      if (Number(r.sellingPrice || 0) > 0 && Number(r.sellingPrice) < Number(r.netCost || 0)) issues.push('Sell below net');
      return {
        id: r.id, label: String(r.routeLabel || ''), routeCode: String(r.routeCode || ''),
        originId: lid(r.originZone), originName: o?.zoneName || 'Unmapped', originCode: o?.zoneCode || '',
        destinationId: lid(r.destinationZone), destinationName: d?.zoneName || 'Unmapped', destinationCode: d?.zoneCode || '',
        vehicleId: lid(r.vehicleCategory), vehicleName: v?.categoryName || 'Unmapped',
        netCost: Number(r.netCost || 0), sellingPrice: Number(r.sellingPrice || 0), midnightSurcharge: Number(r.midnightSurcharge || 0),
        tollsIncluded: r.tollsIncluded ?? true, active: !!r.active, fareStatus: String(r.fareStatus || 'Indicative'),
        distanceKm: Number(r.distanceKm || 0), durationMinutes: Number(r.durationMinutes || 0), issues,
        _emirates: [o?.emirate, d?.emirate],
      };
    }).filter(x => (!input.emirate || x._emirates.includes(input.emirate)) && (input.status !== 'issues' || x.issues.length > 0) &&
      (!q || [x.label, x.routeCode, x.vehicleName, x.originName, x.destinationName].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => a.label.localeCompare(b.label) || a.netCost - b.netCost);
    return { total: items.length, items: items.slice(input.offset, input.offset + input.limit).map(({ _emirates, ...x }) => x) };
  },
});
