import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Create or update a supplier response for a Group/MICE lead',
  inputSchema: z.object({
    id: z.string().optional(),
    leadId: z.string(),
    hotelName: z.string(),
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
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'saveSupplierResponse');
    const record = {
      hotelName: input.hotelName,
      groupLead: input.leadId,
      offeredNetRate: input.offeredNetRate,
      allocation: input.allocation,
      cutoffDate: input.cutoffDate,
      meetingPackageRate: input.meetingPackageRate,
      attritionTerms: input.attritionTerms,
      cancellationTerms: input.cancellationTerms,
      commission: input.commission,
      notes: input.notes,
      responseStatus: input.responseStatus ?? 'Pending',
      clientSelected: input.clientSelected ?? false,
    };
    if (input.id) {
      await zite.supplierResponses.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const created = await zite.supplierResponses.create({ record });
      return { id: created.id };
    }
  },
});
