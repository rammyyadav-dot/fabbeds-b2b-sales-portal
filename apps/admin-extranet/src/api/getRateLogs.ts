import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Fetch rate change audit logs with optional filtering',
  inputSchema: z.object({
    hotelId: z.string().optional(),
    roomTypeId: z.string().optional(),
    rateDate: z.string().optional(),
    source: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }),
  outputSchema: z.object({
    logs: z.array(z.object({
      id: z.string(),
      changedAt: z.string().optional(),
      roomTypeId: z.string().optional(),
      hotelId: z.string().optional(),
      rateDate: z.string().optional(),
      source: z.string().optional(),
      prevAdult2Rate: z.number().optional(),
      prevAllocation: z.number().optional(),
      prevStatus: z.string().optional(),
      newAdult1Rate: z.number().optional(),
      newAdult2Rate: z.number().optional(),
      newAdult3Rate: z.number().optional(),
      newAllocation: z.number().optional(),
      newStatus: z.string().optional(),
      changedByUserId: z.string().optional(),
      fieldsChanged: z.string().optional(),
      dailyRateRecordId: z.string().optional(),
    })),
    hasMore: z.boolean(),
    total: z.number(),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getRateLogs');
    const limit = input.limit ?? 100;
    const offset = input.offset ?? 0;

    const result = await zite.rateLogs.findAll({ limit, offset });

    // Filter in-code since linked record filters may not work directly
    let logs = result.records;
    if (input.hotelId) logs = logs.filter(l => l.hotelId === input.hotelId);
    if (input.roomTypeId) logs = logs.filter(l => l.roomTypeId === input.roomTypeId);
    if (input.rateDate) logs = logs.filter(l => l.rateDate && l.rateDate.startsWith(input.rateDate!));
    if (input.source) logs = logs.filter(l => l.source === input.source);

    // Sort by changedAt descending (most recent first)
    logs.sort((a, b) => {
      const ta = a.changedAt ? new Date(a.changedAt).getTime() : 0;
      const tb = b.changedAt ? new Date(b.changedAt).getTime() : 0;
      return tb - ta;
    });

    return {
      logs: logs.map(l => ({
        id: l.id,
        changedAt: l.changedAt,
        roomTypeId: l.roomTypeId,
        hotelId: l.hotelId,
        rateDate: l.rateDate,
        source: l.source,
        prevAdult2Rate: l.prevAdult2Rate,
        prevAllocation: l.prevAllocation,
        prevStatus: l.prevStatus,
        newAdult1Rate: l.newAdult1Rate,
        newAdult2Rate: l.newAdult2Rate,
        newAdult3Rate: l.newAdult3Rate,
        newAllocation: l.newAllocation,
        newStatus: l.newStatus,
        changedByUserId: l.changedByUserId,
        fieldsChanged: l.fieldsChanged,
        dailyRateRecordId: l.dailyRateRecordId,
      })),
      hasMore: result.hasMore,
      total: logs.length,
    };
  },
});
