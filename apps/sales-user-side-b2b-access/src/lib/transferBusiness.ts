export type TransferKind = 'ARRIVAL' | 'DEPARTURE' | 'POINT_TO_POINT' | 'INTERCITY';

export interface ZoneSummary {
  id: string;
  type: string;
  emirate: string;
  waitingGrace: number;
}

export interface MarkupRule {
  markupType: string;
  markupValue: number;
  appliesTo: string;
  specificRouteId: string;
  maxCap: number;
  priority: number;
}

export function isNightPickup(pickupTime: string) {
  const hour = Number.parseInt((pickupTime || '').split(':')[0] || '', 10);
  return Number.isFinite(hour) && (hour >= 23 || hour < 6);
}

export function validatePickupDateTime(pickupDate: string, pickupTime: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) throw new Error('Invalid pickup date');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) throw new Error('Invalid pickup time');
  const pickup = new Date(`${pickupDate}T${pickupTime}:00+04:00`);
  if (Number.isNaN(pickup.getTime())) throw new Error('Invalid pickup date/time');
  if (pickup.getTime() <= Date.now()) throw new Error('Pickup time must be in the future');
  return pickup;
}

export function validateTransferType(kind: TransferKind, origin: ZoneSummary, destination: ZoneSummary) {
  if (origin.id === destination.id) throw new Error('Pickup and dropoff zones must be different');

  const originAirport = origin.type.toLowerCase() === 'airport';
  const destinationAirport = destination.type.toLowerCase() === 'airport';

  if (kind === 'ARRIVAL' && !originAirport) {
    throw new Error('Airport Arrival must start from an airport zone');
  }
  if (kind === 'DEPARTURE' && !destinationAirport) {
    throw new Error('Airport Departure must end at an airport zone');
  }
  if (kind === 'POINT_TO_POINT' && origin.emirate && destination.emirate && origin.emirate !== destination.emirate) {
    throw new Error('Point-to-point transfers must stay within the same Emirate');
  }
  if (kind === 'INTERCITY' && origin.emirate && destination.emirate && origin.emirate === destination.emirate) {
    throw new Error('Intercity transfers must travel between different Emirates');
  }
}

export type RouteClass = 'AIRPORT' | 'INTERCITY' | 'CITY';

/** Classify from the zones themselves (never from the route label text). */
export function classifyRoute(origin: { type: string; emirate: string }, destination: { type: string; emirate: string }): RouteClass {
  if ([origin.type, destination.type].some(t => String(t).toLowerCase() === 'airport')) return 'AIRPORT';
  if (origin.emirate && destination.emirate && origin.emirate !== destination.emirate) return 'INTERCITY';
  return 'CITY';
}

/** Specific route > class rule (airport / intercity / city) > global; highest priority first within each. */
export function resolveMarkup(rateId: string, routeClass: RouteClass, rules: MarkupRule[]): MarkupRule | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  const specific = sorted.find(r => r.appliesTo === 'Specific Route' && r.specificRouteId === rateId);
  if (specific) return specific;
  const target = routeClass === 'AIRPORT' ? 'Airport Transfers Only' : routeClass === 'INTERCITY' ? 'Intercity Transfers Only' : 'City Transfers Only';
  return sorted.find(r => r.appliesTo === target) || sorted.find(r => r.appliesTo === 'Global (All Transfers)') || null;
}

function markupAmount(base: number, rule: Pick<MarkupRule, 'markupType' | 'markupValue' | 'maxCap'>) {
  let m = rule.markupType === 'Flat' || rule.markupType === 'Flat Amount (AED)' ? rule.markupValue : base * (rule.markupValue / 100);
  if (rule.maxCap > 0 && m > rule.maxCap) m = rule.maxCap;
  return Math.max(0, m);
}
const money = (n: number) => Math.round(n * 100) / 100;

export function applyMarkup(netCost: number, rule: Pick<MarkupRule, 'markupType' | 'markupValue' | 'maxCap'>) {
  return money(netCost + markupAmount(netCost, rule));
}

export type TransferExtra = { code: string; name: string; unit: string; sellPrice: number; netCost: number; maxQuantity: number; airportOnly: boolean };
export type ExtraRequest = { code: string; quantity: number };

/** Validates requested extras against the active extras table and prices them (sell + net). */
export function priceExtras(requested: ExtraRequest[], catalogue: TransferExtra[], routeClass: RouteClass) {
  const lines = requested.filter(r => r.quantity > 0).map(r => {
    const x = catalogue.find(c => c.code === r.code);
    if (!x) throw new Error(`Extra ${r.code} is not available`);
    if (x.airportOnly && routeClass !== 'AIRPORT') throw new Error(`${x.name} is only available on airport transfers`);
    const qty = x.unit === 'Per booking' ? 1 : Math.min(Math.max(1, Math.floor(r.quantity)), Math.max(1, x.maxQuantity || 1));
    return { code: x.code, name: x.name, quantity: qty, sell: money(x.sellPrice * qty), net: money(x.netCost * qty) };
  });
  return { lines, sell: money(lines.reduce((s, l) => s + l.sell, 0)), net: money(lines.reduce((s, l) => s + l.net, 0)) };
}

export function calculateTransferPrice(args: {
  netCost: number;
  storedSellingPrice: number;
  midnightSurcharge: number;
  pickupTime: string;
  rule: MarkupRule | null;
  extras?: { sell: number; net: number };
  // legacy flags (used only when no extras catalogue is supplied)
  meetAndGreet?: boolean;
  childSeat?: boolean;
}) {
  const basePrice = args.rule ? applyMarkup(args.netCost, args.rule) : (args.storedSellingPrice || args.netCost);
  const night = isNightPickup(args.pickupTime) && args.midnightSurcharge > 0;
  // Fix: a FLAT markup is earned once per trip (already in basePrice); only a percentage markup scales the surcharge.
  const percentRule = args.rule && !(args.rule.markupType === 'Flat' || args.rule.markupType === 'Flat Amount (AED)');
  const nightSurcharge = night ? (percentRule ? applyMarkup(args.midnightSurcharge, args.rule!) : args.midnightSurcharge) : 0;
  const legacy = args.extras ? null : { meetAndGreet: args.meetAndGreet ? 50 : 0, childSeat: args.childSeat ? 35 : 0 };
  const extrasSell = args.extras ? args.extras.sell : legacy!.meetAndGreet + legacy!.childSeat;
  const total = money(basePrice + nightSurcharge + extrasSell);
  const netTotal = money(args.netCost + (night ? args.midnightSurcharge : 0) + (args.extras ? args.extras.net : 0));
  return { basePrice, nightSurcharge, meetAndGreet: legacy?.meetAndGreet ?? 0, childSeat: legacy?.childSeat ?? 0, extrasTotal: extrasSell, total, netTotal, margin: money(total - netTotal) };
}

export async function loadTransferExtras(zite: any): Promise<TransferExtra[]> {
  const { records } = await zite.transferExtras.findAll({ filters: { active: true }, limit: 100 });
  return records.map((r: any) => ({ code: String(r.extraCode || ''), name: String(r.extraName || ''), unit: String(r.pricingUnit || 'Per booking'), sellPrice: Number(r.sellPrice || 0), netCost: Number(r.netCost || 0), maxQuantity: Number(r.maxQuantity || 1), airportOnly: !!r.airportOnly }))
    .sort((a: TransferExtra, b: TransferExtra) => a.code.localeCompare(b.code));
}

/** Maps the storefront's legacy checkboxes onto the extras catalogue codes. */
export function legacyExtras(meetAndGreet?: boolean, childSeat?: boolean, extras?: ExtraRequest[]): ExtraRequest[] {
  const list = [...(extras || [])];
  if (meetAndGreet && !list.some(e => e.code === 'MNG')) list.push({ code: 'MNG', quantity: 1 });
  if (childSeat && !list.some(e => e.code === 'CSEAT')) list.push({ code: 'CSEAT', quantity: 1 });
  return list;
}
