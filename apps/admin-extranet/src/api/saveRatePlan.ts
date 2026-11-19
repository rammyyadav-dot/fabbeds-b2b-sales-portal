import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const MEAL_CODE_TO_LABEL: Record<string, string> = {
  RO: 'Room Only',
  BB: 'Bed & Breakfast',
  HB: 'Half Board',
  FB: 'Full Board',
  AI: 'All Inclusive',
};

const CANCELLATION_LABELS: Record<string, string> = {
  flexible: 'FLEX',
  non_refundable: 'NR',
  special_conditions: 'SPEC',
};
const CANCELLATION_VALUES: Record<string, string> = {
  flexible: 'Flexible',
  non_refundable: 'Non-Refundable',
  special_conditions: 'Special Conditions',
};

export default createEndpoint({
  description: 'Create or update a rate plan with cascading selectors, duplicate check and meal plan master link',
  inputSchema: z.object({
    id: z.string().optional(),
    hotelId: z.string(),
    roomTypeId: z.string(),
    mealPlanMasterId: z.string(),
    cancellationType: z.enum(['flexible', 'non_refundable', 'special_conditions']),
    cancellationWindowDays: z.number().optional(),
    ratePlanName: z.string().optional(),
    ratePlanCode: z.string().optional(),
    rateType: z.string().optional(),
    noshowRule: z.string().optional(),
    minStayNights: z.number().optional(),
    maxStayNights: z.number().optional(),
    childPolicy: z.string().optional(),
    extraBedPolicy: z.string().optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
    layer: z.string().optional(),
    pmsCode: z.string().optional(),
    crsCode: z.string().optional(),
    otaCode: z.string().optional(),
    nationalityMarket: z.string().optional(),
    marketEligibilityType: z.enum(['Guest Nationality','Guest Residency','Agency Source Market']).optional(),
    marketApplicability: z.enum(['Worldwide','Selected Markets','Selected Countries']).optional(),
    sourceMarketIds: z.array(z.string()).optional(),
    includedCountryIds: z.array(z.string()).optional(),
    excludedCountryIds: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({ id: z.string(), ratePlanName: z.string(), ratePlanCode: z.string() }),
  execute: async ({ input }) => {
    // An edit must never silently move a plan to a different property.
    if (input.id) {
      const current = await zite.ratePlans.findOne({ id: input.id });
      if (!current) throw new Error('Rate Plan was not found');
      const currentHotel = Array.isArray(current.hotel) ? current.hotel[0] : current.hotel;
      if (currentHotel !== input.hotelId) throw new Error('Rate Plan does not belong to this property');
      const currentRoom = Array.isArray(current.roomType) ? current.roomType[0] : current.roomType;
      if (currentRoom !== input.roomTypeId) {
        const [linked, legacy, bookings] = await Promise.all([
          zite.dailyRates.findAll({ filters: { ratePlan: { contains: input.id } }, limit: 1 }),
          zite.dailyRates.findAll({ filters: { ratePlanId: input.id }, limit: 1 }),
          zite.bookings.findAll({ filters: { ratePlan: { contains: input.id } }, limit: 1 }),
        ]);
        if (linked.records.length || legacy.records.length || bookings.records.length) {
          throw new Error('This Rate Plan has rates or bookings. Create a new plan for another Room Type.');
        }
      }
    }

    // Validate room type belongs to this property
    const roomType = await zite.roomTypes.findOne({ id: input.roomTypeId });
    if (!roomType) throw new Error('Selected Room Type was not found');
    const roomHotelId = Array.isArray(roomType.hotel) ? roomType.hotel[0] : roomType.hotel;
    if (roomHotelId !== input.hotelId) {
      throw new Error('Selected Room Type does not belong to this property');
    }

    // Resolve meal plan master
    const mealPlan = await zite.mealPlans.findOne({ id: input.mealPlanMasterId });
    if (!mealPlan || mealPlan.status !== 'Active') throw new Error('Select an active Meal Plan');
    const mealCode = mealPlan.code ?? '';
    const mealLabel = MEAL_CODE_TO_LABEL[mealCode];
    if (!mealLabel) throw new Error('Select a standard Meal Plan (RO, BB, HB, FB or AI)');

    // Build generated name & code
    const roomCode = roomType.roomTypeCode || roomType.roomTypeName?.substring(0, 3).toUpperCase() || 'RM';
    const cancLabel = CANCELLATION_LABELS[input.cancellationType] ?? 'FLEX';
    const generatedCode = input.ratePlanCode || `${roomCode}-${mealCode}-${cancLabel}`;
    const generatedName = input.ratePlanName || `${roomType.roomTypeName} + ${mealCode} + ${input.cancellationType === 'flexible' ? 'Flexible' : input.cancellationType === 'non_refundable' ? 'Non-Refundable' : 'Special'}`;

    // Duplicate check (same room + meal + cancellation on this hotel, excluding self)
    const { records: existing } = await zite.ratePlans.findAll({
      filters: {
        hotel: { contains: input.hotelId },
        roomType: { contains: input.roomTypeId },
        mealPlan: mealLabel,
      },
      limit: 200,
    });
    const duplicate = existing.find(r => r.id !== input.id &&
      (r.cancellationType === CANCELLATION_VALUES[input.cancellationType] ||
       r.cancellationType === input.cancellationType));
    if (duplicate) {
      throw new Error(`A Rate Plan for this room + meal + cancellation already exists: "${duplicate.ratePlanName}"`);
    }

    const refundable = input.cancellationType === 'flexible';

    const record: Record<string, unknown> = {
      ratePlanName: generatedName,
      hotel: [input.hotelId],
      roomType: [input.roomTypeId],
      mealPlan: mealLabel,
      mealPlanMaster: [input.mealPlanMasterId],
      sellCurrency: 'AED',
      cancellationType: CANCELLATION_VALUES[input.cancellationType],
      refundable,
      ...(input.rateType !== undefined && { rateType: input.rateType }),
      ...(input.cancellationWindowDays !== undefined && { cancellationWindowDays: input.cancellationWindowDays }),
      ...(input.noshowRule !== undefined && { noshowRule: input.noshowRule }),
      minStayNights: input.minStayNights ?? 1,
      ...(input.maxStayNights !== undefined && { maxStayNights: input.maxStayNights }),
      ...(input.childPolicy !== undefined && { childPolicy: input.childPolicy }),
      ...(input.extraBedPolicy !== undefined && { extraBedPolicy: input.extraBedPolicy }),
      status: input.status ?? 'Active',
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.layer !== undefined && { layer: input.layer }),
      ratePlanCode: generatedCode,
      ...(input.pmsCode !== undefined && { pmsCode: input.pmsCode }),
      ...(input.crsCode !== undefined && { crsCode: input.crsCode }),
      ...(input.otaCode !== undefined && { otaCode: input.otaCode }),
      nationalityMarket: (input.nationalityMarket || 'ALL').toUpperCase().replace(/\s+/g, '').replace(/;+|\|+/g, ','),
      marketEligibilityType: input.marketEligibilityType ?? 'Guest Nationality',
      marketApplicability: input.marketApplicability ?? 'Worldwide',
      sourceMarkets: input.marketApplicability === 'Selected Markets' ? (input.sourceMarketIds ?? []) : [],
      includedCountries: input.marketApplicability === 'Selected Countries' ? (input.includedCountryIds ?? []) : [],
      excludedCountries: input.excludedCountryIds ?? [],
    };

    if (record.marketApplicability === 'Selected Markets' && (record.sourceMarkets as string[]).length === 0) {
      throw new Error('Select at least one Source Market');
    }
    if (record.marketApplicability === 'Selected Countries' && (record.includedCountries as string[]).length === 0) {
      throw new Error('Select at least one included country');
    }
    const included = new Set((record.includedCountries as string[]) || []);
    const conflict = ((record.excludedCountries as string[]) || []).find(id => included.has(id));
    if (conflict) throw new Error('A country cannot be both included and excluded');

    if (input.id) {
      await zite.ratePlans.update({ id: input.id, record });
      return { id: input.id, ratePlanName: generatedName, ratePlanCode: generatedCode };
    } else {
      const created = await zite.ratePlans.create({ record });
      return { id: created.id, ratePlanName: generatedName, ratePlanCode: generatedCode };
    }
  },
});
