import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

const lid = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');
const r5 = (n: number) => Math.round(n / 5) * 5;

export default createEndpoint({
  authenticated: true,
  description: 'Bulk actions on transfer fares: go live / pause / mark contracted or indicative / adjust net %',
  inputSchema: z.object({
    actingUserId: z.string().optional(),
    ids: z.array(z.string()).min(1).max(500),
    action: z.enum(['activate', 'deactivate', 'markContracted', 'markIndicative', 'adjustNetPercent']),
    percent: z.number().min(-50).max(100).optional(),
  }),
  outputSchema: z.object({ updated: z.number(), skipped: z.array(z.object({ id: z.string(), reason: z.string() })) }),
  execute: async ({ input, context }) => {
    await requireAdminSessionVerified(context, input.actingUserId, 'bulk-update transfer fares');
    if (input.action === 'adjustNetPercent' && input.percent === undefined) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Enter the % change.' });
    const [zr, vr] = await Promise.all([zite.transferZones.findAll({ limit: 1000 }), zite.vehicleCategories.findAll({ limit: 500 })]);
    const zones = new Map(zr.records.map((x: any) => [x.id, x])), vehicles = new Map(vr.records.map((x: any) => [x.id, x]));
    let updated = 0; const skipped: { id: string; reason: string }[] = [];
    for (let i = 0; i < input.ids.length; i += 15) {
      await Promise.all(input.ids.slice(i, i + 15).map(async id => {
        const r: any = await zite.transferRates.findOne({ id });
        if (!r) return skipped.push({ id, reason: 'Not found' });
        let record: any;
        if (input.action === 'activate') {
          // Business rule: only contracted fares with active zones and vehicle may be sold.
          const o: any = zones.get(lid(r.originZone)), d: any = zones.get(lid(r.destinationZone)), v: any = vehicles.get(lid(r.vehicleCategory));
          if (r.fareStatus !== 'Contracted') return skipped.push({ id, reason: 'Mark as Contracted before going live' });
          if (Number(r.netCost || 0) <= 0) return skipped.push({ id, reason: 'Net cost missing' });
          if (!o?.active || !d?.active || !v?.active) return skipped.push({ id, reason: 'Zone or vehicle inactive' });
          record = { active: true };
        } else if (input.action === 'deactivate') record = { active: false };
        else if (input.action === 'markContracted') record = { fareStatus: 'Contracted' };
        else if (input.action === 'markIndicative') record = { fareStatus: 'Indicative', active: false };
        else {
          const f = 1 + (input.percent as number) / 100;
          record = { netCost: Math.max(5, r5(Number(r.netCost || 0) * f)), midnightSurcharge: Math.max(0, r5(Number(r.midnightSurcharge || 0) * f)) };
        }
        await zite.transferRates.update({ id, record }); updated++;
      }));
    }
    return { updated, skipped };
  },
});
