import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'List all rate import jobs, optionally filtered by hotel',
  inputSchema: z.object({
    hotelId: z.string().optional(),
  }),
  outputSchema: z.object({
    jobs: z.array(z.object({
      id: z.string(),
      jobName: z.string().optional(),
      fileName: z.string().optional(),
      sourceType: z.string().optional(),
      layer: z.string().optional(),
      status: z.string().optional(),
      totalLines: z.number().optional(),
      committedCount: z.number().optional(),
      errorCount: z.number().optional(),
      createdAt: z.string().optional(),
      currency: z.string().optional(),
    })),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getRateImportJobs');
    const filters: any = {};
    if (input.hotelId) filters.hotel = input.hotelId;

    const { records } = await zite.rateImportJobs.findAll({
      filters,
      limit: 100,
    });

    return {
      jobs: records.map(j => ({
        id: j.id,
        jobName: j.jobName,
        fileName: j.fileName,
        sourceType: j.sourceType,
        layer: j.layer,
        status: j.status,
        totalLines: j.totalLines,
        committedCount: j.committedCount,
        errorCount: j.errorCount,
        createdAt: j.createdAt,
        currency: j.currency,
      })),
    };
  },
});
