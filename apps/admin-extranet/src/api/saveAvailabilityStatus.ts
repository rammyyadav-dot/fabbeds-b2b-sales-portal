import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Change availability only on existing rate plans for this hotel and room',
  inputSchema: z.object({
    hotelId: z.string(),
    changes: z.array(z.object({
      roomTypeId: z.string(),
      date: z.string(),
      status: z.string(),
    })),
  }),
  outputSchema: z.object({ saved: z.number() }),
  execute: async ({ input }) => {
    const roomIds = [...new Set(input.changes.map(c => c.roomTypeId))];
    const allowedRooms = new Set<string>();
    for (const id of roomIds) {
      const room = await zite.roomTypes.findOne({ id });
      const roomHotel = Array.isArray(room?.hotel) ? room.hotel[0] : room?.hotel;
      if (roomHotel !== input.hotelId) throw new Error('Room Type does not belong to this hotel');
      allowedRooms.add(id);
    }

    // Resolve every change before writing so a missing rate never creates
    // a sellable date without a meal plan or leaves a partial status update.
    const updates: Array<{ id: string; status: string }> = [];
    const verifiedPlans = new Map<string, boolean>();
    for (const change of input.changes) {
      if (!allowedRooms.has(change.roomTypeId)) throw new Error('Invalid Room Type');
      const { records } = await zite.dailyRates.findAll({
        filters: {
          hotel: { contains: input.hotelId },
          roomType: { contains: change.roomTypeId },
          rateDate: change.date,
        },
        limit: 200,
      });
      if (!records.length) throw new Error(`No rate plan rate exists for ${change.date}; create the rate first`);
      for (const rate of records) {
        const planId = Array.isArray(rate.ratePlan) ? rate.ratePlan[0] : rate.ratePlan;
        if (!rate.ratePlanId || planId !== rate.ratePlanId || rate.integrityStatus === 'Quarantined') {
          throw new Error(`Unverified Rate Plan on ${change.date}; repair this rate before changing availability`);
        }
        if (!verifiedPlans.has(planId)) {
          const plan = await zite.ratePlans.findOne({ id: planId });
          const planHotel = Array.isArray(plan?.hotel) ? plan.hotel[0] : plan?.hotel;
          const planRoom = Array.isArray(plan?.roomType) ? plan.roomType[0] : plan?.roomType;
          verifiedPlans.set(planId, planHotel === input.hotelId && planRoom === change.roomTypeId);
        }
        if (!verifiedPlans.get(planId)) throw new Error('Rate Plan does not match the hotel and room');
        updates.push({ id: rate.id, status: change.status });
      }
    }

    for (const update of updates) {
      await zite.dailyRates.update({ id: update.id, record: { status: update.status } });
    }
    return { saved: updates.length };
  },
});
