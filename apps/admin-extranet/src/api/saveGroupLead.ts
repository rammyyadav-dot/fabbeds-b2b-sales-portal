import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

/** Generate a sequential unique lead ID: GRP-YYYY-NNNN */
async function generateLeadId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GRP-${year}-`;
  const res = await zite.groupLeads.findAll({ fields: ['leadId'], limit: 2000 });
  let max = 0;
  for (const r of res.records) {
    const ref = String(r.leadId ?? '');
    if (ref.startsWith(prefix)) {
      const n = parseInt(ref.replace(prefix, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export default createEndpoint({
  description: 'Create or update a Group/MICE lead',
  inputSchema: z.object({
    id: z.string().optional(),
    companyName: z.string(),
    contactName: z.string(),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    city: z.string().optional(),
    checkinDate: z.string().optional(),
    checkoutDate: z.string().optional(),
    roomsRequired: z.number().optional(),
    delegates: z.number().optional(),
    budget: z.number().optional(),
    status: z.string().optional(),
    assignedAgent: z.string().optional(),
    meetingSpaceRequired: z.boolean().optional(),
    flexDates: z.boolean().optional(),
    notes: z.string().optional(),
    clarificationsRequested: z.string().optional(),
    bookingReference: z.string().optional(),
    sellingPrice: z.number().optional(),
    netCost: z.number().optional(),
  }),
  outputSchema: z.object({ id: z.string(), leadId: z.string().optional() }),
  execute: async ({ input }) => {
    const now = new Date().toISOString();
    if (input.id) {
      await zite.groupLeads.update({
        id: input.id,
        record: { ...input, lastActivity: now },
      });
      return { id: input.id };
    } else {
      const leadId = await generateLeadId();
      const slaDeadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const created = await zite.groupLeads.create({
        record: {
          ...input,
          leadId,
          status: input.status ?? 'New Group Lead',
          slaDeadline,
          createdAt: now,
          lastActivity: now,
        },
      });
      return { id: created.id, leadId };
    }
  },
});
