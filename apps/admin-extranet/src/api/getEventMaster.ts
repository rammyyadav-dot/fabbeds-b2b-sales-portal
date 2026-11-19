import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const eventSchema = z.object({
  id: z.string(),
  eventName: z.string().optional(),
  hotel: z.union([z.array(z.string()), z.string()]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  supplementType: z.string().optional(),
  supplementAmount: z.number().optional(),
  scope: z.string().optional(),
  mlos: z.number().optional(),
  noCheckinOn31Dec: z.boolean().optional(),
  mandatoryGalaDinner: z.boolean().optional(),
  cancellationPolicy: z.string().optional(),
  releasePeriodDays: z.number().optional(),
  galaMandatory: z.boolean().optional(),
  galaAdultRate: z.number().optional(),
  galaChildRate: z.number().optional(),
  galaApplied: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  applicableRoomTypes: z.array(z.string()).optional(),
  applicableRatePlans: z.array(z.string()).optional(),
  applicableWeekdays: z.array(z.string()).optional(),
  stackRule: z.string().optional(),
  taxesIncluded: z.boolean().optional(),
});

export default createEndpoint({
  authenticated: true,
  description: 'Get event master records for a hotel',
  inputSchema: z.object({ hotelId: z.string().optional() }),
  outputSchema: z.object({ events: z.array(eventSchema) }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'getEventMaster');
    const filters: Record<string, string> = {};
    if (input.hotelId) filters.hotel = input.hotelId;
    const result = await zite.eventMaster.findAll({ filters, limit: 500 });
    return {
      events: result.records.map(e => ({
        id: e.id,
        eventName: e.eventName,
        hotel: e.hotel,
        startDate: e.startDate,
        endDate: e.endDate,
        supplementType: e.supplementType,
        supplementAmount: e.supplementAmount,
        scope: e.scope,
        mlos: e.mlos,
        noCheckinOn31Dec: e.noCheckinOn31Dec,
        mandatoryGalaDinner: e.mandatoryGalaDinner,
        cancellationPolicy: e.cancellationPolicy,
        releasePeriodDays: e.releasePeriodDays,
        galaMandatory: e.galaMandatory,
        galaAdultRate: e.galaAdultRate,
        galaChildRate: e.galaChildRate,
        galaApplied: e.galaApplied,
        notes: e.notes,
        status: e.status,
        applicableRoomTypes: Array.isArray((e as any).applicableRoomTypes) ? (e as any).applicableRoomTypes.map(String) : [],
        applicableRatePlans: Array.isArray((e as any).applicableRatePlans) ? (e as any).applicableRatePlans.map(String) : [],
        applicableWeekdays: Array.isArray((e as any).applicableWeekdays) ? (e as any).applicableWeekdays.map(String) : [],
        stackRule: (e as any).stackRule || 'Add All Matching Events',
        taxesIncluded: (e as any).taxesIncluded ?? true,
      })),
    };
  },
});
