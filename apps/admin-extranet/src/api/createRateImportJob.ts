import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const RateLineSchema = z.object({
  groupName: z.string().optional(),
  fromDate: z.string(),
  toDate: z.string(),
  season: z.string().optional(),
  rateCode: z.string().optional(),
  discountPct: z.number().optional(),
  roomLabel: z.string(),
  mealLabel: z.string(),
  occupancyKey: z.string(),
  amount: z.number(),
  minStay: z.number().optional(),
  stopSell: z.boolean().optional(),
});

export default createEndpoint({
  description: 'Create a new rate import job and bulk-insert parsed lines',
  inputSchema: z.object({
    hotelId: z.string(),
    fileName: z.string(),
    sourceType: z.enum(['CSV', 'PDF']),
    currency: z.string(),
    layer: z.enum(['BAR', 'WHOLESALE', 'PROMO']),
    importMode: z.enum(['SLAB', 'DAILY']),
    conflictMode: z.enum(['OVERRIDE', 'SKIP', 'STOP']),
    extractedTerms: z.string().optional(),
    bookingWindowStart: z.string().optional(),
    bookingWindowEnd: z.string().optional(),
    marketExclusion: z.string().optional(),
    lines: z.array(RateLineSchema),
  }),
  outputSchema: z.object({
    jobId: z.string(),
    linesCreated: z.number(),
  }),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const jobName = `${input.fileName} — ${new Date().toLocaleDateString('en-GB')}`;
    const job = await zite.rateImportJobs.create({
      record: {
        jobName,
        hotel: input.hotelId,
        sourceType: input.sourceType === 'CSV' ? 'CSV / Excel' : 'PDF',
        fileName: input.fileName,
        currency: input.currency,
        layer: input.layer,
        importMode: input.importMode === 'SLAB' ? 'Slab (Date Range)' : 'Daily',
        conflictMode: input.conflictMode === 'OVERRIDE' ? 'Override' : input.conflictMode === 'SKIP' ? 'Skip' : 'Stop on Conflict',
        status: 'Draft',
        extractedTerms: input.extractedTerms,
        bookingWindowStart: input.bookingWindowStart,
        bookingWindowEnd: input.bookingWindowEnd,
        marketExclusion: input.marketExclusion,
        totalLines: input.lines.length,
        createdBy: context?.user?.id ? [context.user.id] : [],
        createdAt: new Date().toISOString(),
      },
    });

    // Bulk insert lines in batches of 100
    const batchSize = 100;
    for (let i = 0; i < input.lines.length; i += batchSize) {
      const batch = input.lines.slice(i, i + batchSize);
      await zite.rateImportLines.bulkCreate({
        records: batch.map(l => ({
          importJob: job.id,
          groupName: l.groupName,
          fromDate: l.fromDate,
          toDate: l.toDate,
          season: l.season,
          rateCode: l.rateCode,
          discountPct: l.discountPct,
          roomLabel: l.roomLabel,
          mealLabel: l.mealLabel,
          occupancyKey: l.occupancyKey,
          amount: l.amount,
          minStay: l.minStay,
          stopSell: l.stopSell ?? false,
          validationStatus: 'Pending',
        })),
      });
    }

    return { jobId: job.id, linesCreated: input.lines.length };
  },
});
