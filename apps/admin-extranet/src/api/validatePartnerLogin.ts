import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';

export default createEndpoint({
  description: 'Validate hotel partner login with email and access code',
  inputSchema: z.object({
    email: z.string().email(),
    accessCode: z.string().min(1),
  }),
  outputSchema: z.object({
    id: z.string(),
    username: z.string(),
    fullName: z.string(),
    email: z.string(),
    role: z.string(),
    hotelId: z.string().optional(),
    hotelName: z.string().optional(),
  }),
  execute: async ({ input }) => {
    // Look up partner in the dedicated Hotel Partners table (separate from DMC TmsUsers)
    const partner = await zite.hotelPartners.findOne({
      filters: { email: input.email },
    });

    if (!partner) {
      throw new ZiteError({ code: 'UNAUTHORIZED', message: 'No partner account found with this email.' });
    }

    if (partner.accessCode !== input.accessCode) {
      throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Invalid email or access code. Please try again.' });
    }

    if (!partner.approved) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Your partner account is pending approval. Please contact UAE Hotels TMS.' });
    }

    // Resolve linked hotel
    let hotelId: string | undefined;
    let hotelName: string | undefined;
    const rawHotel = partner.hotel;
    const linkedId = Array.isArray(rawHotel) ? rawHotel[0] : rawHotel;
    if (linkedId) {
      const hotel = await zite.hotels.findOne({ id: linkedId, fields: ['id', 'hotelName'] });
      if (hotel) {
        hotelId = hotel.id;
        hotelName = hotel.hotelName;
      }
    }

    return {
      id: partner.id,
      username: partner.email ?? '',
      fullName: partner.fullName ?? '',
      email: partner.email ?? '',
      role: partner.role ?? 'Hotel Owner',
      hotelId,
      hotelName,
    };
  },
});
