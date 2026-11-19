import { zite } from 'zitejs/db';
import {
  dateOnly,
  linkedIds,
  normalizeEventRule,
  eventSupplementForNight,
  matchingEventsForNight,
  validateEventStayRules,
  type HotelEventRule,
} from '@project/pricing/hotelEvents';

export type { HotelEventRule };
export { eventSupplementForNight, matchingEventsForNight, validateEventStayRules };

export async function loadHotelEventRules(hotelId: string): Promise<HotelEventRule[]> {
  const res = await zite.eventMaster.findAll({ filters: { hotel: hotelId }, limit: 500 });
  return (res.records as any[])
    .map(normalizeEventRule)
    .filter((rule): rule is HotelEventRule => !!rule);
}

// Backward-compatible exports used by older local code/tests.
export { dateOnly, linkedIds };
