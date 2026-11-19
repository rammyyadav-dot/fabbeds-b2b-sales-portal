import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const LAYER_PRIORITY: Record<string, number> = {
  OVERRIDE: 400, PROMO: 300, BASE: 200, FALLBACK: 100,
};

export default createEndpoint({
  authenticated: true,
  description: 'Save (upsert by date+roomType+hotel+layer) a single daily rate with audit trail',
  inputSchema: z.object({
    id: z.string().optional(),
    roomTypeId: z.string(),
    hotelId: z.string(),
    ratePlanId: z.string(),
    rateDate: z.string(),
    adult1Rate: z.number().optional(),
    adult2Rate: z.number().optional(),
    adult3Rate: z.number().optional(),
    childSupplement: z.number().optional(),
    extraBedRate: z.number().optional(),
    currency: z.string().optional(),
    minStay: z.number().optional(),
    allocation: z.number().optional(),
    status: z.string().optional(),
    layer: z.enum(['OVERRIDE', 'PROMO', 'BASE', 'FALLBACK']).optional(),
    source: z.enum(['Cell Edit', 'Quick Update', 'Bulk Loader']).optional(),
    userId: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'saveDailyRate');
    const room = await zite.roomTypes.findOne({ id: input.roomTypeId });
    const plan = await zite.ratePlans.findOne({ id: input.ratePlanId });
    const idOf = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
    if (idOf(room?.hotel) !== input.hotelId ||
        idOf(plan?.hotel) !== input.hotelId ||
        idOf(plan?.roomType) !== input.roomTypeId ||
        plan?.status !== 'Active') {
      throw new Error('Select an active Rate Plan belonging to this hotel and Room Type');
    }
    if (!idOf(plan?.mealPlanMaster) || !plan?.mealPlan) {
      throw new Error('Rate Plan must have a verified Meal Plan Master before rates can be loaded');
    }
    if (plan?.sellCurrency && plan.sellCurrency !== 'AED') {
      throw new Error('UAE hotel Daily Rates must use an AED Rate Plan');
    }
    if (input.currency && input.currency !== 'AED') {
      throw new Error('UAE hotel Daily Rates must be loaded in AED');
    }
    const layer = input.layer ?? 'BASE';
    const priority = LAYER_PRIORITY[layer] ?? 200;
    const source = input.source ?? 'Cell Edit';
    const changedAt = new Date().toISOString();

    const deriveStatus = (alloc?: number, s?: string) => {
      if (alloc != null) {
        if (alloc === 0) return 'Stop Sale';
        else if (alloc <= 3) return 'Limited';
        else if (s === 'Stop Sale') return 'Free Sale';
      }
      return s ?? 'Free Sale';
    };

    // Resolve record ID: use provided id, or find existing by date+roomType+hotel+layer
    let recordId = input.id;
    if (!recordId) {
      const dateKey = input.rateDate.split('T')[0];
      const rateDateObj = new Date(dateKey + 'T00:00:00Z');
      const allRes = await zite.dailyRates.findAll({
        filters: {
          hotel: { contains: input.hotelId },
          roomType: { contains: input.roomTypeId },
          rateDate: { gte: rateDateObj, lte: rateDateObj },
        },
        limit: 50,
      });
      const existing = allRes.records.find(r =>
        r.rateDate?.split('T')[0] === dateKey &&
        (r.layer ?? 'BASE') === layer && r.ratePlanId === input.ratePlanId
      );
      if (existing) recordId = existing.id;
    }

    if (recordId) {
      const prev = await zite.dailyRates.findOne({ id: recordId });
      if (!prev || idOf(prev.hotel) !== input.hotelId ||
          idOf(prev.roomType) !== input.roomTypeId || prev.ratePlanId !== input.ratePlanId) {
        throw new Error('Daily Rate does not belong to the selected Rate Plan and Room Type');
      }
      const mergeRecord: Record<string, unknown> = {
        rateDate: input.rateDate, roomType: input.roomTypeId, hotel: input.hotelId, layer, priority,
        ratePlanId: input.ratePlanId, ratePlan: [input.ratePlanId],
        currency: 'AED',
        integrityStatus: 'Valid', integrityCode: null, integrityCheckedAt: changedAt,
      };
      if (input.adult1Rate !== undefined) mergeRecord.adult1Rate = input.adult1Rate;
      if (input.adult2Rate !== undefined) mergeRecord.adult2Rate = input.adult2Rate;
      if (input.adult3Rate !== undefined) mergeRecord.adult3Rate = input.adult3Rate;
      if (input.childSupplement !== undefined) mergeRecord.childSupplement = input.childSupplement;
      if (input.extraBedRate !== undefined) mergeRecord.extraBedRate = input.extraBedRate;
      mergeRecord.currency = 'AED';
      if (input.minStay !== undefined) mergeRecord.minStay = input.minStay;
      if (input.allocation !== undefined) {
        mergeRecord.allocation = input.allocation;
        mergeRecord.status = deriveStatus(input.allocation, input.status);
      } else if (input.status !== undefined) {
        mergeRecord.status = input.status;
      }

      await zite.dailyRates.update({ id: recordId, record: mergeRecord });

      const changed: string[] = [];
      if (input.adult1Rate !== undefined) changed.push('adult1Rate');
      if (input.adult2Rate !== undefined) changed.push('adult2Rate');
      if (input.adult3Rate !== undefined) changed.push('adult3Rate');
      if (input.allocation !== undefined) changed.push('allocation');
      if (input.status !== undefined) changed.push('status');
      if (input.minStay !== undefined) changed.push('minStay');
      if (input.childSupplement !== undefined) changed.push('childSupplement');
      if (input.extraBedRate !== undefined) changed.push('extraBedRate');

      await zite.rateLogs.create({
        record: {
          changedAt, roomTypeId: input.roomTypeId, hotelId: input.hotelId,
          rateDate: input.rateDate, source,
          prevAdult2Rate: prev?.adult2Rate, prevAllocation: prev?.allocation, prevStatus: prev?.status,
          newAdult1Rate: input.adult1Rate, newAdult2Rate: input.adult2Rate, newAdult3Rate: input.adult3Rate,
          newAllocation: input.allocation, newStatus: mergeRecord.status as string | undefined,
          changedByUserId: input.userId,
          fieldsChanged: `[${layer}] ${changed.join(', ')}`,
          dailyRateRecordId: recordId,
        },
      });

      return { id: recordId };
    } else {
      const status = deriveStatus(input.allocation, input.status);
      const created = await zite.dailyRates.create({
        record: {
          rateDate: input.rateDate, roomType: input.roomTypeId, hotel: input.hotelId,
          ratePlanId: input.ratePlanId, ratePlan: [input.ratePlanId],
          integrityStatus: 'Valid', integrityCode: null,
          adult1Rate: input.adult1Rate, adult2Rate: input.adult2Rate, adult3Rate: input.adult3Rate,
          childSupplement: input.childSupplement, extraBedRate: input.extraBedRate,
          currency: input.currency ?? 'AED', minStay: input.minStay ?? 1,
          allocation: input.allocation ?? 10, status, layer, priority,
        },
      });

      await zite.rateLogs.create({
        record: {
          changedAt, roomTypeId: input.roomTypeId, hotelId: input.hotelId,
          rateDate: input.rateDate, source,
          newAdult1Rate: input.adult1Rate, newAdult2Rate: input.adult2Rate, newAdult3Rate: input.adult3Rate,
          newAllocation: input.allocation, newStatus: status,
          changedByUserId: input.userId,
          fieldsChanged: `[${layer}] new record`,
          dailyRateRecordId: created.id,
        },
      });

      return { id: created.id };
    }
  },
});
