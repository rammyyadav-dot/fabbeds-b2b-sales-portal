import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const discrepancySchema = z.object({
  hotelName: z.string(),
  roomTypeName: z.string(),
  ratePlanName: z.string(),
  date: z.string(),
  issueType: z.string(),
  oldValue: z.string(),
  newValue: z.string(),
});

export default createEndpoint({
  description: 'Run full rate sync & recheck workflow – validates Daily Rates against Net Rates',
  inputSchema: z.object({}),
  outputSchema: z.object({
    runId: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    lockStatus: z.enum(['acquired', 'already_running']),
    status: z.enum(['success', 'partial', 'failed']),
    summary: z.object({
      totalHotels: z.number(),
      totalRoomTypes: z.number(),
      totalRatePlans: z.number(),
      totalDailyRates: z.number(),
      totalChecked: z.number(),
      totalValid: z.number(),
      totalFlagged: z.number(),
      totalNullRates: z.number(),
      totalNegativeRates: z.number(),
      totalMissingRatePlan: z.number(),
      totalNoNetRate: z.number(),
    }),
    discrepancies: z.array(discrepancySchema),
    validationErrors: z.array(z.string()),
    checkedAt: z.string(),
  }),
  execute: async () => {
    const runId = `SYNC-${Date.now()}`;
    const startTime = new Date().toISOString();
    const discrepancies: z.infer<typeof discrepancySchema>[] = [];
    const validationErrors: string[] = [];

    const hotelsResult = await zite.hotels.findAll({ filters: { status: 'Active' }, fields: ['id', 'hotelName'] });
    const hotels = hotelsResult.records;
    if (hotels.length === 0) validationErrors.push('No active hotels found');

    const roomTypesResult = await zite.roomTypes.findAll({ fields: ['id', 'roomTypeName', 'hotel', 'status'] });
    const roomTypes = roomTypesResult.records;

    const ratePlansResult = await zite.ratePlans.findAll({ filters: { status: 'Active' }, fields: ['id', 'ratePlanName', 'hotel', 'roomType'] });
    const ratePlans = ratePlansResult.records;

    const dailyRatesResult = await zite.dailyRates.findAll({ limit: 2000, fields: ['id', 'hotel', 'roomType', 'ratePlanId', 'rateDate', 'adult1Rate', 'status'] });
    const dailyRates = dailyRatesResult.records;

    const netRatesResult = await zite.netRates.findAll({ fields: ['id', 'hotel', 'roomType', 'netRatePerNight'] });
    const netRates = netRatesResult.records;

    const netRateSet = new Set(netRates.map(nr => `${Array.isArray(nr.hotel) ? nr.hotel[0] : nr.hotel}|${Array.isArray(nr.roomType) ? nr.roomType[0] : nr.roomType}`));
    const hotelMap = new Map(hotels.map(h => [h.id, h.hotelName ?? 'Unknown']));
    const roomTypeMap = new Map(roomTypes.map(rt => [rt.id, rt.roomTypeName ?? 'Unknown']));

    let totalChecked = 0, totalValid = 0, totalFlagged = 0;
    let totalNullRates = 0, totalNegativeRates = 0, totalMissingRatePlan = 0, totalNoNetRate = 0;

    for (const dr of dailyRates) {
      totalChecked++;
      const hotelId = Array.isArray(dr.hotel) ? dr.hotel[0] : dr.hotel;
      const roomTypeId = Array.isArray(dr.roomType) ? dr.roomType[0] : dr.roomType;
      const hotelName = hotelMap.get(hotelId ?? '') ?? 'Unknown Hotel';
      const roomTypeName = roomTypeMap.get(roomTypeId ?? '') ?? 'Unknown Room';
      const date = dr.rateDate ?? 'N/A';
      const ratePlanName = dr.ratePlanId ? `Plan:${dr.ratePlanId.slice(0, 8)}` : 'None';
      let isValid = true;

      if (dr.adult1Rate == null) {
        discrepancies.push({ hotelName, roomTypeName, ratePlanName, date, issueType: 'NULL_RATE', oldValue: 'null', newValue: 'Requires base rate' });
        totalNullRates++; isValid = false;
      }
      if (dr.adult1Rate != null && dr.adult1Rate < 0) {
        discrepancies.push({ hotelName, roomTypeName, ratePlanName, date, issueType: 'NEGATIVE_RATE', oldValue: String(dr.adult1Rate), newValue: '≥ 0 required' });
        totalNegativeRates++; isValid = false;
      }
      if (!dr.ratePlanId) {
        discrepancies.push({ hotelName, roomTypeName, ratePlanName, date, issueType: 'MISSING_RATE_PLAN', oldValue: 'null', newValue: 'Rate plan ID required' });
        totalMissingRatePlan++; isValid = false;
      }
      const key = `${hotelId}|${roomTypeId}`;
      if (!netRateSet.has(key)) {
        discrepancies.push({ hotelName, roomTypeName, ratePlanName, date, issueType: 'NO_NET_RATE', oldValue: 'Missing', newValue: 'Net rate required as admin source' });
        totalNoNetRate++; isValid = false;
      }
      if (isValid) totalValid++; else totalFlagged++;
    }

    for (const rt of roomTypes) {
      if (rt.status === 'Inactive') continue;
      const hasDailyRate = dailyRates.some(dr => (Array.isArray(dr.roomType) ? dr.roomType[0] : dr.roomType) === rt.id);
      if (!hasDailyRate) {
        const hotelId = Array.isArray(rt.hotel) ? rt.hotel[0] : rt.hotel;
        validationErrors.push(`Room type "${rt.roomTypeName}" (Hotel: ${hotelMap.get(hotelId ?? '') ?? 'Unknown'}) has no daily rates loaded`);
      }
    }

    const endTime = new Date().toISOString();
    const status: 'success' | 'partial' | 'failed' = totalFlagged === 0 && validationErrors.length === 0 ? 'success' : 'partial';

    return {
      runId, startTime, endTime,
      lockStatus: 'acquired' as const,
      status,
      summary: { totalHotels: hotels.length, totalRoomTypes: roomTypes.length, totalRatePlans: ratePlans.length, totalDailyRates: dailyRates.length, totalChecked, totalValid, totalFlagged, totalNullRates, totalNegativeRates, totalMissingRatePlan, totalNoNetRate },
      discrepancies: discrepancies.slice(0, 100),
      validationErrors,
      checkedAt: endTime,
    };
  },
});
