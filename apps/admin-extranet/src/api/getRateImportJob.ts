import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Get a rate import job with its lines',
  inputSchema: z.object({
    jobId: z.string(),
  }),
  outputSchema: z.object({
    job: z.object({
      id: z.string(),
      jobName: z.string().optional(),
      hotelId: z.string().optional(),
      sourceType: z.string().optional(),
      fileName: z.string().optional(),
      currency: z.string().optional(),
      layer: z.string().optional(),
      importMode: z.string().optional(),
      conflictMode: z.string().optional(),
      status: z.string().optional(),
      extractedTerms: z.string().optional(),
      bookingWindowStart: z.string().optional(),
      bookingWindowEnd: z.string().optional(),
      marketExclusion: z.string().optional(),
      totalLines: z.number().optional(),
      committedCount: z.number().optional(),
      skippedCount: z.number().optional(),
      errorCount: z.number().optional(),
    }),
    lines: z.array(z.object({
      id: z.string(),
      groupName: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      season: z.string().optional(),
      rateCode: z.string().optional(),
      discountPct: z.number().optional(),
      roomLabel: z.string().optional(),
      mealLabel: z.string().optional(),
      occupancyKey: z.string().optional(),
      amount: z.number().optional(),
      mappedRoomTypeId: z.string().optional(),
      mappedRoomTypeName: z.string().optional(),
      mappedMealPlan: z.string().optional(),
      mappedRatePlanId: z.string().optional(),
      minStay: z.number().optional(),
      stopSell: z.boolean().optional(),
      validationStatus: z.string().optional(),
      validationMessage: z.string().optional(),
    })),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getRateImportJob');
    const job = await zite.rateImportJobs.findOne({ id: input.jobId });
    if (!job) throw new Error('Job not found');

    const hotelId = Array.isArray(job.hotel) ? job.hotel[0] : job.hotel;

    const allLines: any[] = [];
    let offset = 0;
    while (true) {
      const { records, hasMore } = await zite.rateImportLines.findAll({
        filters: { importJob: job.id },
        offset,
        limit: 500,
      });
      allLines.push(...records);
      if (!hasMore) break;
      offset += 500;
    }

    return {
      job: {
        id: job.id,
        jobName: job.jobName,
        hotelId,
        sourceType: job.sourceType,
        fileName: job.fileName,
        currency: job.currency,
        layer: job.layer,
        importMode: job.importMode,
        conflictMode: job.conflictMode,
        status: job.status,
        extractedTerms: job.extractedTerms,
        bookingWindowStart: job.bookingWindowStart,
        bookingWindowEnd: job.bookingWindowEnd,
        marketExclusion: job.marketExclusion,
        totalLines: job.totalLines,
        committedCount: job.committedCount,
        skippedCount: job.skippedCount,
        errorCount: job.errorCount,
      },
      lines: allLines.map(l => ({
        id: l.id,
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
        mappedRoomTypeId: l.mappedRoomTypeId,
        mappedRoomTypeName: l.mappedRoomTypeName,
        mappedMealPlan: l.mappedMealPlan,
        mappedRatePlanId: l.mappedRatePlanId,
        minStay: l.minStay,
        stopSell: l.stopSell,
        validationStatus: l.validationStatus,
        validationMessage: l.validationMessage,
      })),
    };
  },
});
