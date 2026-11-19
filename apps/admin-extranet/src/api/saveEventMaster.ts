import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Create or update an event master record',
  inputSchema: z.object({
    id: z.string().optional(),
    hotelId: z.string(),
    eventName: z.string(),
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
    applicableRoomTypeIds: z.array(z.string()).optional(),
    applicableRatePlanIds: z.array(z.string()).optional(),
    applicableWeekdays: z.array(z.enum(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])).optional(),
    stackRule: z.enum(['Add All Matching Events','Highest Matching Event Only']).optional(),
    taxesIncluded: z.boolean().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'saveEventMaster');
    const hotel = await zite.hotels.findOne({ id: input.hotelId });
    if (!hotel) throw new Error('Selected hotel was not found.');
    if (!input.startDate || !input.endDate || input.endDate < input.startDate) {
      throw new Error('Event start/end dates are required and end date must be on or after start date.');
    }
    if ((input.status || 'Active') === 'Active' && (!input.supplementAmount || input.supplementAmount <= 0)) {
      throw new Error('Active event supplements require a positive AED supplement amount.');
    }

    if (input.applicableRoomTypeIds?.length) {
      const rooms = await zite.roomTypes.findAll({ filters: { id: { in: input.applicableRoomTypeIds } } as any, limit: 500 });
      if (rooms.records.length !== input.applicableRoomTypeIds.length) throw new Error('One or more applicable room types were not found.');
      const invalid = rooms.records.find(r => (Array.isArray(r.hotel) ? r.hotel[0] : r.hotel) !== input.hotelId);
      if (invalid) throw new Error('Applicable room types must belong to the selected hotel.');
    }

    if (input.applicableRatePlanIds?.length) {
      const plans = await zite.ratePlans.findAll({ filters: { id: { in: input.applicableRatePlanIds } } as any, limit: 500 });
      if (plans.records.length !== input.applicableRatePlanIds.length) throw new Error('One or more applicable rate plans were not found.');
      const invalid = plans.records.find(r => (Array.isArray(r.hotel) ? r.hotel[0] : r.hotel) !== input.hotelId);
      if (invalid) throw new Error('Applicable rate plans must belong to the selected hotel.');
    }

    const record = {
      eventName: input.eventName,
      hotel: input.hotelId,
      startDate: input.startDate,
      endDate: input.endDate,
      supplementType: input.supplementType,
      supplementAmount: input.supplementAmount,
      scope: input.scope || 'Entire Property',
      mlos: input.mlos,
      noCheckinOn31Dec: input.noCheckinOn31Dec,
      mandatoryGalaDinner: input.mandatoryGalaDinner,
      cancellationPolicy: input.cancellationPolicy,
      releasePeriodDays: input.releasePeriodDays,
      galaMandatory: input.galaMandatory,
      galaAdultRate: input.galaAdultRate,
      galaChildRate: input.galaChildRate,
      galaApplied: input.galaApplied,
      notes: input.notes,
      status: input.status || 'Active',
      applicableRoomTypes: input.applicableRoomTypeIds || [],
      applicableRatePlans: input.applicableRatePlanIds || [],
      applicableWeekdays: input.applicableWeekdays || [],
      stackRule: input.stackRule || 'Add All Matching Events',
      taxesIncluded: input.taxesIncluded ?? true,
    };
    if (input.id) {
      await zite.eventMaster.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const created = await zite.eventMaster.create({ record });
      return { id: created.id };
    }
  },
});
