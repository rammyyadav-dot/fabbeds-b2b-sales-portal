import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a room type with full occupancy configuration',
  inputSchema: z.object({
    id: z.string().optional(),
    hotelId: z.string(),
    roomTypeName: z.string(),
    internalCode: z.string().optional(),
    maxOccupancy: z.number().optional(),
    mealPlan: z.string().optional(),
    description: z.string().optional(),
    beddingType: z.string().optional(),
    views: z.string().optional(),
    inclusions: z.string().optional(),
    sellEnabled: z.boolean().optional(),
    onRequestOnly: z.boolean().optional(),
    // Occupancy rules
    maxAdults: z.number().optional(),
    maxChildren: z.number().optional(),
    maxAdultsWithChildren: z.number().optional(),
    minTotalOccupancy: z.number().optional(),
    minAdultsRequired: z.number().optional(),
    // Extra bed
    extraBedCountsTowardTotal: z.boolean().optional(),
    maxExtraBeds: z.number().optional(),
    eventMaxOccupancy: z.number().optional(),
    lockAfterBooking: z.boolean().optional(),
    // Child policy
    childAllowed: z.boolean().optional(),
    childAgeFrom: z.number().optional(),
    childAgeTo: z.number().optional(),
    childAgeFreeUpTo: z.number().optional(),
    childAgeAdultFrom: z.number().optional(),
    extraBedAllowed: z.boolean().optional(),
    adultExtraBedAvailable: z.boolean().optional(),
    roomTypeCode: z.string().optional(),
    baseOccupancy: z.number().optional(),
    childPolicyId: z.string().optional(),
    status: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    if (input.id) {
      const current = await zite.roomTypes.findOne({ id: input.id });
      if (!current) throw new Error('Room Type was not found');
      const currentHotel = Array.isArray(current.hotel) ? current.hotel[0] : current.hotel;
      if (currentHotel !== input.hotelId) throw new Error('Room Type does not belong to this property');
    } else if (!await zite.hotels.findOne({ id: input.hotelId })) {
      throw new Error('Hotel was not found');
    }
    const record = {
      roomTypeName: input.roomTypeName,
      hotel: input.hotelId,
      internalCode: input.internalCode,
      maxOccupancy: input.maxOccupancy,
      mealPlan: input.mealPlan,
      description: input.description,
      beddingType: input.beddingType,
      views: input.views,
      inclusions: input.inclusions,
      sellEnabled: input.sellEnabled,
      onRequestOnly: input.onRequestOnly,
      maxAdults: input.maxAdults,
      maxChildren: input.maxChildren,
      maxAdultsWithChildren: input.maxAdultsWithChildren,
      minTotalOccupancy: input.minTotalOccupancy,
      minAdultsRequired: input.minAdultsRequired,
      extraBedCountsTowardTotal: input.extraBedCountsTowardTotal,
      maxExtraBeds: input.maxExtraBeds,
      eventMaxOccupancy: input.eventMaxOccupancy,
      lockAfterBooking: input.lockAfterBooking,
      childAllowed: input.childAllowed,
      childAgeFrom: input.childAgeFrom,
      childAgeTo: input.childAgeTo,
      childAgeFreeUpTo: input.childAgeFreeUpTo,
      childAgeAdultFrom: input.childAgeAdultFrom,
      extraBedAllowed: input.extraBedAllowed,
      adultExtraBedAvailable: input.adultExtraBedAvailable,
      roomTypeCode: input.roomTypeCode,
      baseOccupancy: input.baseOccupancy,
      childPolicyId: input.childPolicyId,
      status: input.status,
    };
    // Enforce unique room type name per hotel
    const existing = await zite.roomTypes.findOne({
      filters: { roomTypeName: input.roomTypeName, hotel: input.hotelId },
      fields: ['id'],
    });
    if (existing && existing.id !== input.id) {
      throw new ZiteError({
        code: 'CONFLICT',
        message: `A room type named "${input.roomTypeName}" already exists for this hotel. Please use a unique name.`,
      });
    }

    if (input.id) {
      await zite.roomTypes.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const created = await zite.roomTypes.create({ record });
      return { id: created.id };
    }
  },
});
