import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Get supplier responses for a Group/MICE lead',
  inputSchema: z.object({ leadId: z.string() }),
  outputSchema: z.object({
    responses: z.array(z.object({
      id: z.string(),
      hotelName: z.string().optional(),
      offeredNetRate: z.number().optional(),
      allocation: z.number().optional(),
      cutoffDate: z.string().optional(),
      meetingPackageRate: z.number().optional(),
      attritionTerms: z.string().optional(),
      cancellationTerms: z.string().optional(),
      commission: z.number().optional(),
      notes: z.string().optional(),
      responseStatus: z.string().optional(),
      clientSelected: z.boolean().optional(),
    })),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getSupplierResponses');
    const result = await zite.supplierResponses.findAll({ limit: 200 });
    const responses = result.records
      .filter(r => {
        const lid = Array.isArray(r.groupLead) ? r.groupLead[0] : r.groupLead;
        return lid === input.leadId;
      })
      .map(r => ({
        id: r.id,
        hotelName: r.hotelName,
        offeredNetRate: r.offeredNetRate,
        allocation: r.allocation,
        cutoffDate: r.cutoffDate,
        meetingPackageRate: r.meetingPackageRate,
        attritionTerms: r.attritionTerms,
        cancellationTerms: r.cancellationTerms,
        commission: r.commission,
        notes: r.notes,
        responseStatus: r.responseStatus,
        clientSelected: r.clientSelected,
      }));
    return { responses };
  },
});
