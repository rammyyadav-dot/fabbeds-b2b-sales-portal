import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create an offline package booking with auto-pricing from season matrix',
  inputSchema: z.object({
    packageId: z.string(),
    travelStartDate: z.string(),
    leadTravelerName: z.string().min(1),
    contactEmail: z.string().email(),
    contactPhone: z.string().min(1),
    adultsTwin: z.number().min(0),
    adultsSingle: z.number().min(0),
    childrenWithBed: z.number().min(0),
    childrenNoBed: z.number().min(0),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    bookingReference: z.string(),
    totalNetCost: z.number(),
    totalSellPrice: z.number(),
    seasonApplied: z.string(),
  }),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const pkg = await zite.packageMasters.findOne({ id: input.packageId });
    if (!pkg) throw new Error('Package not found');

    // Find matching season price
    const { records: seasons } = await zite.packageSeasonPrices.findAll({
      filters: { _package: input.packageId },
      limit: 50,
    });

    const travelDate = input.travelStartDate;
    const matchingSeason = seasons.find(s =>
      s.validFrom && s.validTo && travelDate >= s.validFrom && travelDate <= s.validTo
    );

    if (!matchingSeason) throw new Error('No pricing available for the selected travel date. Please choose a date within an active season.');

    // Calculate costs
    const totalNet =
      (input.adultsTwin * (matchingSeason.netCostAdultTwin || 0)) +
      (input.adultsSingle * (matchingSeason.netCostAdultSingle || 0)) +
      (input.childrenWithBed * (matchingSeason.netCostChildWithBed || 0)) +
      (input.childrenNoBed * (matchingSeason.netCostChildNoBed || 0));

    const totalSell =
      (input.adultsTwin * (matchingSeason.retailAdultTwin || 0)) +
      (input.adultsSingle * (matchingSeason.retailAdultSingle || 0)) +
      (input.childrenWithBed * (matchingSeason.retailChildWithBed || 0)) +
      (input.childrenNoBed * (matchingSeason.retailChildNoBed || 0));

    // Generate booking reference
    const now = new Date();
    const ref = `ZT-PKG-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(Math.floor(Math.random() * 900) + 100)}`;

    const booking = await zite.packageBookings.create({
      record: {
        bookingReference: ref,
        _package: input.packageId,
        bookedBy: context.user.id,
        travelStartDate: input.travelStartDate,
        leadTravelerName: input.leadTravelerName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        adultsTwin: input.adultsTwin,
        adultsSingle: input.adultsSingle,
        childrenWithBed: input.childrenWithBed,
        childrenNoBed: input.childrenNoBed,
        totalNetCost: totalNet,
        totalSellPrice: totalSell,
        bookingStatus: 'Submitted',
        seasonApplied: matchingSeason.seasonName || '',
      },
    });

    return {
      success: true,
      bookingReference: ref,
      totalNetCost: totalNet,
      totalSellPrice: totalSell,
      seasonApplied: matchingSeason.seasonName || '',
    };
  },
});
