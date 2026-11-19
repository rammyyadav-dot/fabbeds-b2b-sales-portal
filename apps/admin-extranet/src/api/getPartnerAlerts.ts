import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const alertSchema = z.object({
  type: z.enum(['error', 'warning', 'info']),
  title: z.string(),
  message: z.string(),
  count: z.number().optional(),
});

export default createEndpoint({
  description: 'Get partner dashboard alerts and stats',
  inputSchema: z.object({}),
  outputSchema: z.object({
    alerts: z.array(alertSchema),
    stats: z.object({
      totalHotels: z.number(),
      activeRoomTypes: z.number(),
      activeRatePlans: z.number(),
      ratesLoadedNext30: z.number(),
      stopSellDates: z.number(),
    }),
    lastUpdated: z.string(),
  }),
  execute: async () => {
    const today = new Date();
    const next30 = new Date(today.getTime() + 30 * 86400000);
    const todayStr = today.toISOString().split('T')[0];
    const next30Str = next30.toISOString().split('T')[0];

    const [hotels, roomTypes, ratePlans, dailyRates, allotments] = await Promise.all([
      zite.hotels.findAll({ filters: { status: 'Active' }, fields: ['id', 'hotelName'] }),
      zite.roomTypes.findAll({ filters: { status: 'Active' }, fields: ['id', 'roomTypeName'] }),
      zite.ratePlans.findAll({ filters: { status: 'Active' }, fields: ['id', 'ratePlanName'] }),
      zite.dailyRates.findAll({ limit: 2000, fields: ['id', 'rateDate', 'status', 'adult1Rate'] }),
      zite.roomAllotment.findAll({ limit: 2000, fields: ['id', 'date', 'totalRooms', 'roomsOnAllotment', 'roomsBlocked'] }),
    ]);

    const alerts: z.infer<typeof alertSchema>[] = [];
    const ratesNext30 = dailyRates.records.filter(dr => dr.rateDate && dr.rateDate >= todayStr && dr.rateDate <= next30Str);
    const stopSellDates = ratesNext30.filter(dr => dr.status === 'Stop Sale');
    const nullRates = ratesNext30.filter(dr => !dr.adult1Rate || dr.adult1Rate === 0);

    if (roomTypes.records.length === 0)
      alerts.push({ type: 'error', title: 'No Active Room Types', message: 'Add room types to your hotel before loading rates.' });

    if (ratePlans.records.length === 0)
      alerts.push({ type: 'error', title: 'No Active Rate Plans', message: 'Create at least one active rate plan to start accepting bookings.' });

    if (ratesNext30.length === 0)
      alerts.push({ type: 'error', title: 'No Rates Loaded (Next 30 Days)', message: 'No rates found for the next 30 days. Load rates immediately to accept bookings.', count: 30 });
    else if (nullRates.length > 0)
      alerts.push({ type: 'warning', title: 'Missing Rate Values', message: `${nullRates.length} rate records have no price set for the next 30 days.`, count: nullRates.length });

    if (stopSellDates.length > 0)
      alerts.push({ type: 'warning', title: 'Stop-Sell Active', message: `${stopSellDates.length} dates are set to Stop Sale in the next 30 days.`, count: stopSellDates.length });

    const lowAllotments = allotments.records.filter(a => {
      if (!a.date || a.date < todayStr || a.date > next30Str) return false;
      const avail = (a.totalRooms ?? 0) - (a.roomsOnAllotment ?? 0) - ((a as any).roomsBlocked ?? 0);
      return avail <= 1;
    });
    if (lowAllotments.length > 0)
      alerts.push({ type: 'warning', title: 'Low Inventory', message: `${lowAllotments.length} dates have ≤1 room available in the next 30 days.`, count: lowAllotments.length });

    if (alerts.length === 0)
      alerts.push({ type: 'info', title: 'All Systems Good', message: 'Rates and inventory are loaded and ready for the next 30 days.' });

    return {
      alerts,
      stats: {
        totalHotels: hotels.records.length,
        activeRoomTypes: roomTypes.records.length,
        activeRatePlans: ratePlans.records.length,
        ratesLoadedNext30: ratesNext30.length,
        stopSellDates: stopSellDates.length,
      },
      lastUpdated: new Date().toISOString(),
    };
  },
});
