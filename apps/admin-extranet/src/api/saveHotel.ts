import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

async function generateHotelCode(): Promise<string> {
  const { records } = await zite.hotels.findAll({ fields: ['hotelCode'], limit: 2000 });
  let maxSeq = 0;
  for (const h of records) {
    if (h.hotelCode) {
      const match = h.hotelCode.match(/UAEHTL(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
  }
  return `UAEHTL${String(maxSeq + 1).padStart(4, '0')}`;
}

export default createEndpoint({
  description: 'Create or update a hotel',
  inputSchema: z.object({
    id: z.string().optional(),
    hotelName: z.string(),
    location: z.string().optional(),
    starRating: z.string().optional(),
    emirate: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    reservationEmail: z.string().optional(),
    financeEmail: z.string().optional(),
    salesManager: z.string().optional(),
    mobileNo: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string(), hotelCode: z.string().optional() }),
  execute: async ({ input }) => {
    const record: Record<string, any> = {
      hotelName: input.hotelName,
      location: input.location,
      starRating: input.starRating,
      emirate: input.emirate,
      description: input.description,
      status: input.status || 'Active',
      reservationEmail: input.reservationEmail,
      financeEmail: input.financeEmail,
      salesManager: input.salesManager,
      mobileNo: input.mobileNo,
    };
    if (input.id) {
      await zite.hotels.update({ id: input.id, record });
      return { id: input.id };
    } else {
      const hotelCode = await generateHotelCode();
      record.hotelCode = hotelCode;
      const created = await zite.hotels.create({ record });
      return { id: created.id, hotelCode };
    }
  },
});
