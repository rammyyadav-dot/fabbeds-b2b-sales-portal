import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  authenticated: true,
  description: 'Auto-create missing room types and a default rate plan for each, then return their IDs for mapping',
  inputSchema: z.object({
    hotelId: z.string(),
    labels: z.array(z.string()), // room labels from the file that need to be created
    layer: z.string().optional(),
  }),
  outputSchema: z.array(z.object({
    label: z.string(),
    roomTypeId: z.string(),
    roomTypeName: z.string(),
  })),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'autoCreateRoomTypes');
    const hotel = await zite.hotels.findOne({ id: input.hotelId });
    if (!hotel) throw new Error('Hotel not found');
    const results: { label: string; roomTypeId: string; roomTypeName: string }[] = [];

    for (const label of input.labels) {
      // Check if room type already exists
      const existing = await zite.roomTypes.findOne({
        filters: { roomTypeName: label, hotel: input.hotelId },
        fields: ['id', 'roomTypeName'],
      });

      let roomTypeId: string;
      let roomTypeName: string;

      if (existing) {
        roomTypeId = existing.id;
        roomTypeName = existing.roomTypeName ?? label;
      } else {
        // Create new room type
        const created = await zite.roomTypes.create({
          record: {
            roomTypeName: label,
            hotel: [input.hotelId],
            sellEnabled: true,
            status: 'Active',
            maxOccupancy: 2,
            maxAdults: 2,
            maxChildren: 1,
            childAllowed: true,
          },
        });
        roomTypeId = created.id;
        roomTypeName = label;
      }

      // Rate plans are created at import commit after the meal plan is mapped.
      results.push({ label, roomTypeId, roomTypeName });
    }

    return results;
  },
});
