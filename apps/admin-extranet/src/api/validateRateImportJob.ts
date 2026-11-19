import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Validate all lines in a rate import job and update their validation status',
  inputSchema: z.object({ jobId: z.string() }),
  outputSchema: z.object({
    okCount: z.number(),
    warnCount: z.number(),
    errorCount: z.number(),
    canCommit: z.boolean(),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'validateRateImportJob');
    const job = await zite.rateImportJobs.findOne({ id: input.jobId });
    if (!job) throw new Error('Job not found');

    const allLines: any[] = [];
    let offset = 0;
    while (true) {
      const { records, hasMore } = await zite.rateImportLines.findAll({
        filters: { importJob: input.jobId },
        offset, limit: 500,
      });
      allLines.push(...records);
      if (!hasMore) break;
      offset += 500;
    }

    const hotelId = Array.isArray(job.hotel) ? job.hotel[0] : job.hotel;
    const validMeals = new Set(['RO', 'BB', 'HB', 'HB+', 'FB', 'AI']);
    let okCount = 0, warnCount = 0, errorCount = 0;

    for (const line of allLines) {
      let status = 'OK';
      const messages: string[] = [];

      // Hard blocks
      if (!line.mappedRoomTypeId) {
        status = 'Error';
        messages.push('Room type not mapped');
      }
      if (!line.mappedMealPlan || !validMeals.has(line.mappedMealPlan.trim().toUpperCase().replace(/\s+/g, ''))) {
        status = 'Error';
        messages.push('Meal plan must be mapped to RO, BB, HB, HB+, FB or AI');
      }
      if (line.mappedRoomTypeId) {
        const room = await zite.roomTypes.findOne({ id: line.mappedRoomTypeId });
        const roomHotel = Array.isArray(room?.hotel) ? room.hotel[0] : room?.hotel;
        if (!hotelId || roomHotel !== hotelId) {
          status = 'Error';
          messages.push('Mapped Room Type does not belong to the import hotel');
        }
      }
      if (!line.fromDate || !line.toDate) {
        status = 'Error';
        messages.push('Missing date range');
      } else if (new Date(line.fromDate) > new Date(line.toDate)) {
        status = 'Error';
        messages.push('From date is after To date');
      }
      if (line.amount == null || isNaN(line.amount) || line.amount < 0) {
        status = 'Error';
        messages.push('Invalid amount');
      }

      // Warnings (only if no errors)
      if (status !== 'Error') {
        if (!line.season) messages.push('No season label');
        if (line.amount === 0) messages.push('Amount is zero');
        if (messages.length > 0) status = 'Warning';
      }

      // Validate room type max occupancy if mapped
      if (status !== 'Error' && line.mappedRoomTypeId) {
        const rt = await zite.roomTypes.findOne({ id: line.mappedRoomTypeId, fields: ['maxOccupancy'] });
        if (rt && rt.maxOccupancy != null) {
          const occMap: Record<string, number> = { SGL: 1, DBL: 2, TPL: 3, QUAD: 4 };
          const occ = occMap[line.occupancyKey ?? ''] ?? 0;
          if (occ > rt.maxOccupancy) {
            messages.push(`Occupancy ${line.occupancyKey} exceeds room max (${rt.maxOccupancy})`);
            status = 'Warning';
          }
        }
      }

      if (status === 'OK') okCount++;
      else if (status === 'Warning') warnCount++;
      else errorCount++;

      await zite.rateImportLines.update({
        id: line.id,
        record: {
          validationStatus: status,
          validationMessage: messages.join('; ') || undefined,
        },
      });
    }

    await zite.rateImportJobs.update({
      id: input.jobId,
      record: {
        status: errorCount > 0 ? 'Draft' : 'Validated',
        errorCount,
      },
    });

    return { okCount, warnCount, errorCount, canCommit: errorCount === 0 };
  },
});
