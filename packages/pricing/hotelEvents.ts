export type HotelEventRule = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  supplementType: string;
  supplementAmount: number;
  applicableRoomTypes: string[];
  applicableRatePlans: string[];
  applicableWeekdays: string[];
  stackRule: string;
  mlos: number;
  noCheckinOn31Dec: boolean;
  status: string;
};

export const linkedIds = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (value == null || value === '') return [];
  return [String(value)];
};

export const dateOnly = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  try { return new Date(value as any).toISOString().slice(0, 10); } catch { return ''; }
};

const weekday = (date: string): string => {
  const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return labels[new Date(date + 'T00:00:00Z').getUTCDay()];
};

export function normalizeEventRule(e: any): HotelEventRule | null {
  const hotel = linkedIds(e.hotel);
  if (!hotel.length) return null;
  const rule: HotelEventRule = {
    id: String(e.id),
    name: e.eventName || 'Event supplement',
    startDate: dateOnly(e.startDate),
    endDate: dateOnly(e.endDate),
    supplementType: e.supplementType || 'Per Room Per Night',
    supplementAmount: Math.max(0, Number(e.supplementAmount || 0)),
    applicableRoomTypes: linkedIds(e.applicableRoomTypes),
    applicableRatePlans: linkedIds(e.applicableRatePlans),
    applicableWeekdays: Array.isArray(e.applicableWeekdays) ? e.applicableWeekdays.map(String) : [],
    stackRule: e.stackRule || 'Add All Matching Events',
    mlos: Math.max(0, Number(e.mlos || 0)),
    noCheckinOn31Dec: !!e.noCheckinOn31Dec,
    status: e.status || 'Active',
  };
  if (rule.status !== 'Active' || !rule.startDate || !rule.endDate || rule.supplementAmount <= 0) return null;
  return rule;
}

export function matchingEventsForNight(
  events: HotelEventRule[],
  date: string,
  roomTypeId: string,
  ratePlanId: string,
): HotelEventRule[] {
  const day = weekday(date);
  return events.filter(e => {
    if (date < e.startDate || date > e.endDate) return false;
    if (e.applicableRoomTypes.length && !e.applicableRoomTypes.includes(roomTypeId)) return false;
    if (e.applicableRatePlans.length && !e.applicableRatePlans.includes(ratePlanId)) return false;
    if (e.applicableWeekdays.length && !e.applicableWeekdays.includes(day)) return false;
    return true;
  });
}

export function eventSupplementForNight(params: {
  events: HotelEventRule[];
  date: string;
  roomTypeId: string;
  ratePlanId: string;
  rooms: Array<{ adults: number; children: number }>;
}): { amount: number; eventNames: string[] } {
  const matches = matchingEventsForNight(params.events, params.date, params.roomTypeId, params.ratePlanId);
  if (!matches.length) return { amount: 0, eventNames: [] };

  const amounts = matches.map(e => {
    const amount = e.supplementType.includes('Person')
      ? e.supplementAmount * params.rooms.reduce((sum, r) => sum + r.adults + r.children, 0)
      : e.supplementAmount * params.rooms.length;
    return { event: e, amount };
  });

  const highestOnly = matches.some(e => e.stackRule === 'Highest Matching Event Only');
  const selected = highestOnly
    ? [amounts.sort((a,b) => b.amount - a.amount)[0]]
    : amounts;

  return {
    amount: selected.reduce((sum, item) => sum + item.amount, 0),
    eventNames: selected.map(item => item.event.name),
  };
}

export function validateEventStayRules(params: {
  events: HotelEventRule[];
  stayDates: string[];
  checkIn: string;
  roomTypeId: string;
  ratePlanId: string;
}): string[] {
  const matched = params.events.filter(e =>
    params.stayDates.some(date => matchingEventsForNight([e], date, params.roomTypeId, params.ratePlanId).length > 0)
  );
  const errors: string[] = [];
  for (const e of matched) {
    if (e.mlos > 0 && params.stayDates.length < e.mlos) {
      errors.push(`${e.name}: minimum stay is ${e.mlos} night(s).`);
    }
    if (e.noCheckinOn31Dec && params.checkIn.slice(5,10) === '12-31') {
      errors.push(`${e.name}: check-in is not permitted on 31 Dec.`);
    }
  }
  return errors;
}
