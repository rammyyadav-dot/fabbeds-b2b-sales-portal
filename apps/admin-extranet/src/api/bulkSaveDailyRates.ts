import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

// Layer priority: OVERRIDE(400) > PROMO(300) > BASE(200) > FALLBACK(100)
// Each layer is a separate record — upsert matches on date+roomType+hotel+layer.
// Effective rate in getTariffCalendar picks highest-priority layer per date.

const LAYER_PRIORITY: Record<string, number> = {
  OVERRIDE: 400, PROMO: 300, BASE: 200, FALLBACK: 100,
};

export default createEndpoint({
  description: 'Bulk upsert daily rates per layer with merge semantics and full audit trail',
  inputSchema: z.object({
    roomTypeId: z.string(),
    hotelId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    adult1Rate: z.number().optional(),
    adult2Rate: z.number().optional(),
    adult3Rate: z.number().optional(),
    childSupplement: z.number().optional(),
    extraBedRate: z.number().optional(),
    currency: z.string().optional(),
    minStay: z.number().optional(),
    allocation: z.number().optional(),
    status: z.string().optional(),
    upliftType: z.enum(['none', 'percentage', 'fixed']).optional(),
    upliftValue: z.number().optional(),
    daysOfWeek: z.array(z.number()).optional(),
    skipExisting: z.boolean().optional(),
    layer: z.enum(['OVERRIDE', 'PROMO', 'BASE', 'FALLBACK']).optional(),
    source: z.enum(['Quick Update', 'Bulk Loader', 'Cell Edit']).optional(),
    userId: z.string().optional(),
    ratePlanId: z.string().optional(),
    sourceMarketProfile: z.string().trim().max(100).optional(),
  }),
  outputSchema: z.object({ count: z.number(), created: z.number(), updated: z.number() }),
  execute: async ({ input }) => {
    if (!input.ratePlanId) {
      throw new Error('Rate Plan is required when saving Daily Rates');
    }

    const ratePlan = await zite.ratePlans.findOne({ id: input.ratePlanId });
    const room = await zite.roomTypes.findOne({ id: input.roomTypeId });
    if (!ratePlan || !room) throw new Error('Selected Rate Plan or Room Type was not found');
    const roomHotelId = Array.isArray(room.hotel) ? room.hotel[0] : room.hotel;
    if (roomHotelId !== input.hotelId) throw new Error('Room Type does not belong to this property');
    const rpHotelId = Array.isArray(ratePlan.hotel) ? ratePlan.hotel[0] : ratePlan.hotel;
    const rpRoomTypeId = Array.isArray(ratePlan.roomType) ? ratePlan.roomType[0] : ratePlan.roomType;
    if (rpHotelId !== input.hotelId) throw new Error('Rate Plan does not belong to this property');
    if (rpRoomTypeId !== input.roomTypeId) throw new Error('Rate Plan does not belong to the selected Room Type');
    if (ratePlan.status !== 'Active') throw new Error('Only an Active Rate Plan can receive new Daily Rates');
    const mealMasterId = Array.isArray(ratePlan.mealPlanMaster) ? ratePlan.mealPlanMaster[0] : ratePlan.mealPlanMaster;
    if (!mealMasterId || !ratePlan.mealPlan) throw new Error('Rate Plan must have a verified Meal Plan Master before rates can be loaded');
    if (ratePlan.sellCurrency && ratePlan.sellCurrency !== 'AED') throw new Error('UAE hotel Daily Rates require an AED Rate Plan');
    if (input.currency && input.currency !== 'AED') throw new Error('UAE hotel Daily Rates must be loaded in AED');

    // Market eligibility is owned by the Rate Plan. Daily Rates inherit it and
    // cannot override nationality / residency / agency-source eligibility.
    const applicability = String(ratePlan.marketApplicability || 'Worldwide');
    const sourceMarkets = Array.isArray(ratePlan.sourceMarkets) ? ratePlan.sourceMarkets : ratePlan.sourceMarkets ? [ratePlan.sourceMarkets] : [];
    const includedCountries = Array.isArray(ratePlan.includedCountries) ? ratePlan.includedCountries : ratePlan.includedCountries ? [ratePlan.includedCountries] : [];
    if (applicability === 'Selected Markets' && sourceMarkets.length === 0) {
      throw new Error('Rate Plan is configured for Selected Markets but has no Source Market profile');
    }
    if (applicability === 'Selected Countries' && includedCountries.length === 0) {
      throw new Error('Rate Plan is configured for Selected Countries but has no included countries');
    }

    const layer = input.layer ?? 'BASE';
    const priority = LAYER_PRIORITY[layer] ?? 200;

    // Build date list filtered by DOW
    const dates: string[] = [];
    const start = new Date(input.startDate + 'T00:00:00Z');
    const end = new Date(input.endDate + 'T00:00:00Z');
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getUTCDay();
      if (!input.daysOfWeek || input.daysOfWeek.length === 0 || input.daysOfWeek.includes(dow)) {
        dates.push(cur.toISOString().split('T')[0]);
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const getId = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
    const normalizeDate = (d: string | undefined) => d ? d.split('T')[0] : undefined;

    const allRecords = await zite.dailyRates.findAll({
      filters: {
        hotel: { contains: input.hotelId },
        roomType: { contains: input.roomTypeId },
        rateDate: { gte: new Date(input.startDate), lte: new Date(input.endDate) },
      },
      limit: 2000,
    });
    // Match existing records for this hotel+roomType+layer+ratePlanId
    const existing = allRecords.records.filter(r =>
      (r.layer ?? 'BASE') === layer &&
      (input.ratePlanId ? r.ratePlanId === input.ratePlanId : true)
    );
    const existingMap = new Map(existing.map(r => [normalizeDate(r.rateDate), r]));

    const applyUplift = (base?: number) => {
      if (base == null) return base;
      if (input.upliftType === 'percentage' && input.upliftValue) return Math.round(base * (1 + input.upliftValue / 100) * 100) / 100;
      if (input.upliftType === 'fixed' && input.upliftValue) return base + input.upliftValue;
      return base;
    };

    const deriveStatus = (alloc?: number, s?: string) => {
      if (alloc != null) {
        if (alloc === 0) return 'Stop Sale';
        if (alloc <= 3) return 'Limited';
      }
      return s ?? 'Free Sale';
    };

    const toCreate: object[] = [];
    const toUpdate: Array<{ id: string; record: object; prev: typeof existing[0] }> = [];

    for (const date of dates) {
      const ex = existingMap.get(date);
      if (ex && input.skipExisting) continue;

      if (ex) {
        const mergeRecord: Record<string, unknown> = {
          rateDate: date, roomType: input.roomTypeId, hotel: input.hotelId, layer, priority,
          ratePlanId: input.ratePlanId,
          ratePlan: [input.ratePlanId],
        };
        if (input.adult1Rate !== undefined) mergeRecord.adult1Rate = applyUplift(input.adult1Rate);
        if (input.adult2Rate !== undefined) mergeRecord.adult2Rate = applyUplift(input.adult2Rate);
        if (input.adult3Rate !== undefined) mergeRecord.adult3Rate = applyUplift(input.adult3Rate);
        if (input.childSupplement !== undefined) mergeRecord.childSupplement = input.childSupplement;
        if (input.extraBedRate !== undefined) mergeRecord.extraBedRate = input.extraBedRate;
        mergeRecord.currency = 'AED';
        mergeRecord.integrityStatus = 'Valid';
        mergeRecord.integrityCode = null;
        mergeRecord.integrityCheckedAt = new Date().toISOString();
        if (input.minStay !== undefined) mergeRecord.minStay = input.minStay;
        if (input.allocation !== undefined) {
          mergeRecord.allocation = input.allocation;
          mergeRecord.status = deriveStatus(input.allocation, input.status);
        } else if (input.status !== undefined) {
          mergeRecord.status = input.status;
        }
        toUpdate.push({ id: ex.id, record: mergeRecord, prev: ex });
      } else {
        toCreate.push({
          rateDate: date, roomType: input.roomTypeId, hotel: input.hotelId,
          adult1Rate: applyUplift(input.adult1Rate), adult2Rate: applyUplift(input.adult2Rate),
          adult3Rate: applyUplift(input.adult3Rate), childSupplement: input.childSupplement,
          extraBedRate: input.extraBedRate, currency: 'AED',
          minStay: input.minStay ?? 1, allocation: input.allocation ?? 10,
          status: deriveStatus(input.allocation, input.status), layer, priority,
          ratePlanId: input.ratePlanId,
          ratePlan: [input.ratePlanId],
          integrityStatus: 'Valid',
          integrityCode: null,
          integrityCheckedAt: new Date().toISOString(),
        });
      }
    }

    for (let i = 0; i < toCreate.length; i += 50) {
      await zite.dailyRates.bulkCreate({ records: toCreate.slice(i, i + 50) });
    }
    for (const { id, record } of toUpdate) {
      await zite.dailyRates.update({ id, record });
    }

    // Audit log
    const source = input.source ?? 'Bulk Loader';
    const changedAt = new Date().toISOString();
    const logEntries = toUpdate.map(({ id, record, prev }) => {
      const r = record as Record<string, unknown>;
      const changed: string[] = [];
      if (r.adult1Rate !== undefined) changed.push('adult1Rate');
      if (r.adult2Rate !== undefined) changed.push('adult2Rate');
      if (r.adult3Rate !== undefined) changed.push('adult3Rate');
      if (r.allocation !== undefined) changed.push('allocation');
      if (r.status !== undefined) changed.push('status');
      if (r.minStay !== undefined) changed.push('minStay');
      if (r.childSupplement !== undefined) changed.push('childSupplement');
      if (r.extraBedRate !== undefined) changed.push('extraBedRate');
      return {
        changedAt, roomTypeId: input.roomTypeId, hotelId: input.hotelId,
        rateDate: r.rateDate as string, source,
        prevAdult2Rate: prev.adult2Rate, prevAllocation: prev.allocation, prevStatus: prev.status,
        newAdult1Rate: r.adult1Rate as number | undefined, newAdult2Rate: r.adult2Rate as number | undefined,
        newAdult3Rate: r.adult3Rate as number | undefined, newAllocation: r.allocation as number | undefined,
        newStatus: r.status as string | undefined, changedByUserId: input.userId,
        fieldsChanged: `[${layer}] ${changed.join(', ')}`,
        dailyRateRecordId: id,
      };
    });

    for (let i = 0; i < logEntries.length; i += 50) {
      await zite.rateLogs.bulkCreate({ records: logEntries.slice(i, i + 50) });
    }

    const count = toCreate.length + toUpdate.length;
    console.log(`[${source}][${layer}] bulkSaveDailyRates: created=${toCreate.length}, updated=${toUpdate.length}`);
    return { count, created: toCreate.length, updated: toUpdate.length };
  },
});
