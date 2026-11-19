import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const rateRowSchema = z.object({
  rateId: z.string(),
  hotelId: z.string(),
  hotelName: z.string(),
  roomTypeId: z.string(),
  roomTypeName: z.string(),
  mealPlan: z.string().optional(),
  seasonId: z.string(),
  seasonName: z.string(),
  seasonType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  netRate: z.number(),
  markupValue: z.number(),
  markupType: z.string(),
  sellingRate: z.number(),
  currency: z.string(),
  minNights: z.number().optional(),
});

export default createEndpoint({
  description: 'Get rate sheet with calculated selling rates',
  inputSchema: z.object({
    hotelId: z.string().optional(),
    seasonId: z.string().optional(),
  }),
  outputSchema: z.object({ rows: z.array(rateRowSchema) }),
  execute: async ({ input }) => {
    const [hotelsResult, roomTypesResult, seasonsResult, netRatesResult, markupRulesResult] = await Promise.all([
      zite.hotels.findAll({ limit: 500 }),
      zite.roomTypes.findAll({ limit: 500 }),
      zite.seasons.findAll({ limit: 500 }),
      zite.netRates.findAll({ filters: input.hotelId ? { hotel: input.hotelId } : {}, limit: 2000 }),
      zite.markupRules.findAll({ filters: { isActive: true }, limit: 500 }),
    ]);

    const hotelMap = new Map(hotelsResult.records.map(h => [h.id, h]));
    const roomTypeMap = new Map(roomTypesResult.records.map(r => [r.id, r]));
    const seasonMap = new Map(seasonsResult.records.map(s => [s.id, s]));
    const markupRules = markupRulesResult.records;

    const rows: Array<{
      rateId: string; hotelId: string; hotelName: string; roomTypeId: string; roomTypeName: string;
      mealPlan?: string; seasonId: string; seasonName: string; seasonType?: string;
      startDate?: string; endDate?: string; netRate: number; markupValue: number;
      markupType: string; sellingRate: number; currency: string; minNights?: number;
    }> = [];
    for (const rate of netRatesResult.records) {
      const hotelId = Array.isArray(rate.hotel) ? rate.hotel[0] : rate.hotel;
      const roomTypeId = Array.isArray(rate.roomType) ? rate.roomType[0] : rate.roomType;
      const seasonId = Array.isArray(rate.season) ? rate.season[0] : rate.season;

      if (!hotelId || !roomTypeId || !seasonId) continue;
      if (input.seasonId && seasonId !== input.seasonId) continue;

      const hotel = hotelMap.get(hotelId);
      const roomType = roomTypeMap.get(roomTypeId);
      const season = seasonMap.get(seasonId);
      if (!hotel || !roomType || !season) continue;

      const netRate = rate.netRatePerNight ?? 0;

      // Find applicable markup: priority hotel+event > hotel > global+event > global
      const getId = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
      function getRulePriority(r: typeof markupRules[0]): number {
        const isHotel = r.appliesTo === 'Specific Hotel' && getId(r.specificHotel) === hotelId;
        const isEvent = r.ruleCategory === 'Event Override' || r.ruleCategory === 'event_override';
        if (isHotel && isEvent) return 4; if (isHotel) return 3; if (isEvent) return 2; return 1;
      }
      const rule = markupRules.length ? markupRules.reduce((best, r) => getRulePriority(r) >= getRulePriority(best) ? r : best) : undefined;

      let sellingRate = netRate;
      let markupValue = 0;
      let markupType = 'none';
      if (rule) {
        markupValue = rule.markupValue ?? 0;
        markupType = rule.markupType ?? 'none';
        let markup = rule.markupType === 'Percentage (%)' ? netRate * (markupValue / 100) : markupValue;
        if (rule.maxMarkupValue && markup > rule.maxMarkupValue) markup = rule.maxMarkupValue;
        sellingRate = netRate + markup;
        markupValue = markup;
      }

      rows.push({
        rateId: rate.id,
        hotelId,
        hotelName: hotel.hotelName ?? '',
        roomTypeId,
        roomTypeName: roomType.roomTypeName ?? '',
        mealPlan: roomType.mealPlan,
        seasonId,
        seasonName: season.seasonName ?? '',
        seasonType: season.seasonType,
        startDate: season.startDate,
        endDate: season.endDate,
        netRate,
        markupValue,
        markupType,
        sellingRate: Math.round(sellingRate * 100) / 100,
        currency: rate.currency ?? 'AED',
        minNights: rate.minNights,
      });
    }

    return { rows };
  },
});
