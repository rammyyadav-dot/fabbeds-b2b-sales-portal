import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
  authenticated: true,
  description: 'Create or update a transfer extra (meet & greet, child seat, waiting, stops)',
  inputSchema: z.object({
    actingUserId: z.string().optional(), id: z.string().optional(),
    name: z.string().trim().min(2).max(120), code: z.string().trim().regex(/^[A-Z0-9]{2,10}$/, 'Code: 2–10 capital letters/digits'),
    unit: z.enum(['Per booking', 'Per item', 'Per 30 minutes']), netCost: z.number().min(0), sellPrice: z.number().min(0),
    maxQuantity: z.number().int().min(1).max(20), airportOnly: z.boolean(), description: z.string().max(500).optional(),
    sortOrder: z.number().int().min(0).max(999).default(0), active: z.boolean(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    await requireAdminSessionVerified(context, input.actingUserId, 'manage transfer extras');
    if (input.sellPrice < input.netCost) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Sell price cannot be below net cost.' });
    const dup = (await (zite as any).transferExtras.findAll({ filters: { extraCode: input.code }, limit: 5 })).records.find((r: any) => r.id !== input.id);
    if (dup) throw new ZiteError({ code: 'CONFLICT', message: `Code ${input.code} is already used.` });
    const record = { extraName: input.name, extraCode: input.code, pricingUnit: input.unit, netCost: input.netCost, sellPrice: input.sellPrice, maxQuantity: input.unit === 'Per booking' ? 1 : input.maxQuantity, airportOnly: input.airportOnly, description: input.description || '', sortOrder: input.sortOrder, active: input.active };
    const t: any = (zite as any).transferExtras;
    if (input.id) { await t.update({ id: input.id, record }); return { id: input.id }; }
    return { id: (await t.create({ record })).id };
  },
});
