import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const leadSchema = z.object({
  id: z.string(),
  leadId: z.string().optional(),
  companyName: z.string().optional(),
  contactName: z.string().optional(),
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
  slaDeadline: z.string().optional(),
  meetingSpaceRequired: z.boolean().optional(),
  flexDates: z.boolean().optional(),
  notes: z.string().optional(),
  clarificationsRequested: z.string().optional(),
  bookingReference: z.string().optional(),
  sellingPrice: z.number().optional(),
  netCost: z.number().optional(),
  lastActivity: z.string().optional(),
  createdAt: z.string().optional(),
});

export default createEndpoint({
  authenticated: true,
  description: 'Get all Group/MICE leads with optional status filter',
  inputSchema: z.object({
    status: z.string().optional(),
  }),
  outputSchema: z.object({ leads: z.array(leadSchema) }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getGroupLeads');
    const result = await zite.groupLeads.findAll({ limit: 500 });
    const leads = result.records
      .filter(r => !input.status || r.status === input.status)
      .map(r => ({
        id: r.id,
        leadId: r.leadId,
        companyName: r.companyName,
        contactName: r.contactName,
        contactEmail: r.contactEmail,
        contactPhone: r.contactPhone,
        city: r.city,
        checkinDate: r.checkinDate,
        checkoutDate: r.checkoutDate,
        roomsRequired: r.roomsRequired,
        delegates: r.delegates,
        budget: r.budget,
        status: r.status,
        assignedAgent: r.assignedAgent,
        slaDeadline: r.slaDeadline,
        meetingSpaceRequired: r.meetingSpaceRequired,
        flexDates: r.flexDates,
        notes: r.notes,
        clarificationsRequested: r.clarificationsRequested,
        bookingReference: r.bookingReference,
        sellingPrice: r.sellingPrice,
        netCost: r.netCost,
        lastActivity: r.lastActivity,
        createdAt: r.createdAt,
      }));
    return { leads };
  },
});
