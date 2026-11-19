import { safeNum } from './hotelPricing';

export type RoomOccupancyRequest = {
  roomNo?: number;
  adults: number;
  children: number;
  childAges: number[];
};

export type RoomTypeOccupancyPolicy = {
  maxOccupancy?: number | null;
  maxAdults?: number | null;
  maxChildren?: number | null;
  maxAdultsWithChildren?: number | null;
  minTotalOccupancy?: number | null;
  minAdultsRequired?: number | null;
  childAllowed?: boolean | null;
  childAgeFrom?: number | null;
  childAgeTo?: number | null;
  childAgeFreeUpTo?: number | null;
  childAgeAdultFrom?: number | null;
  extraBedAllowed?: boolean | null;
  maxExtraBeds?: number | null;
  adultExtraBedAvailable?: boolean | null;
  extraBedCountsTowardTotal?: boolean | null;
};

export type DailyOccupancyRates = {
  adult1Rate?: number | null;
  adult2Rate?: number | null;
  adult3Rate?: number | null;
  extraBedRate?: number | null;
  childSupplement?: number | null;
  childRate05?: number | null;
  childRate611?: number | null;
};

export type ChildClassification =
  | 'INFANT'
  | 'CHILD_FREE'
  | 'CHILD_NO_BED'
  | 'CHILD_WITH_BED'
  | 'CHILD_REQUIRES_EXTRA_BED'
  | 'ADULT_EQUIVALENT';

export type ChildCharge = {
  age: number;
  classification: ChildClassification;
  amount: number;
};

export type OccupancyPriceResult = {
  valid: boolean;
  errors: string[];
  effectiveAdults: number;
  payingChildren: number;
  occupancyBasis: 'SGL' | 'DBL' | 'TPL' | 'DBL_EXTRA_ADULT' | 'UNRESOLVED';
  baseRate: number;
  extraAdultCharge: number;
  extraBedCount: number;
  childCharges: ChildCharge[];
  net: number;
};

export function normalizeRoomOccupancy(room: RoomOccupancyRequest, index = 0): RoomOccupancyRequest {
  const adults = Math.max(0, Math.floor(safeNum(room.adults)));
  const children = Math.max(0, Math.floor(safeNum(room.children)));
  return {
    roomNo: room.roomNo || index + 1,
    adults,
    children,
    childAges: (room.childAges || []).slice(0, children).map(a => Math.floor(safeNum(a))),
  };
}

export function validateRequestedRoom(room: RoomOccupancyRequest): string[] {
  const errors: string[] = [];
  if (room.adults < 1) errors.push('MIN_ONE_ADULT_REQUIRED');
  if (room.children < 0 || room.adults < 0) errors.push('INVALID_OCCUPANCY');
  if (room.childAges.length !== room.children) errors.push('CHILD_AGE_REQUIRED');
  if (room.childAges.some(age => age < 0 || age > 17)) errors.push('CHILD_AGE_INVALID');
  return errors;
}

export function classifyChild(age: number, policy: RoomTypeOccupancyPolicy): ChildClassification {
  const adultFrom = safeNum(policy.childAgeAdultFrom);
  const freeUpTo = safeNum(policy.childAgeFreeUpTo);
  const childFrom = safeNum(policy.childAgeFrom);
  if (adultFrom > 0 && age >= adultFrom) return 'ADULT_EQUIVALENT';
  if (age <= 2 && (freeUpTo <= 0 || age <= freeUpTo)) return 'INFANT';
  if (freeUpTo >= 0 && age <= freeUpTo) return 'CHILD_FREE';
  if (childFrom > 0 && age < childFrom) return 'CHILD_FREE';
  return 'CHILD_NO_BED';
}

function childAmount(age: number, rates: DailyOccupancyRates): number {
  if (age <= 5 && safeNum(rates.childRate05) > 0) return safeNum(rates.childRate05);
  if (age >= 6 && age <= 11 && safeNum(rates.childRate611) > 0) return safeNum(rates.childRate611);
  return Math.max(0, safeNum(rates.childSupplement));
}

export function priceRoomOccupancy(
  rawRoom: RoomOccupancyRequest,
  policy: RoomTypeOccupancyPolicy,
  rates: DailyOccupancyRates,
): OccupancyPriceResult {
  const room = normalizeRoomOccupancy(rawRoom);
  const errors = validateRequestedRoom(room);
  if (errors.length) {
    return {
      valid:false, errors, effectiveAdults:room.adults, payingChildren:0, occupancyBasis:'UNRESOLVED',
      baseRate:0, extraAdultCharge:0, extraBedCount:0, childCharges:[], net:0,
    };
  }

  if (room.children > 0 && policy.childAllowed === false) errors.push('CHILD_NOT_ALLOWED');

  const childCharges: ChildCharge[] = [];
  let adultEquivalentChildren = 0;
  let payingChildren = 0;

  for (const age of room.childAges) {
    const classification = classifyChild(age, policy);
    if (classification === 'ADULT_EQUIVALENT') {
      adultEquivalentChildren += 1;
      childCharges.push({ age, classification, amount:0 });
      continue;
    }
    if (classification === 'INFANT' || classification === 'CHILD_FREE') {
      childCharges.push({ age, classification, amount:0 });
      continue;
    }
    const amount = childAmount(age, rates);
    if (amount <= 0) {
      errors.push('CHILD_POLICY_UNRESOLVED');
      childCharges.push({ age, classification, amount:0 });
    } else {
      payingChildren += 1;
      childCharges.push({ age, classification, amount });
    }
  }

  const effectiveAdults = room.adults + adultEquivalentChildren;
  const totalGuests = effectiveAdults + (room.children - adultEquivalentChildren);

  const minAdults = Math.max(1, safeNum(policy.minAdultsRequired) || 1);
  if (effectiveAdults < minAdults) errors.push('MIN_ADULTS_NOT_MET');

  const maxAdults = safeNum(policy.maxAdults);
  if (maxAdults > 0 && effectiveAdults > maxAdults) errors.push('MAX_ADULTS_EXCEEDED');

  const maxChildren = safeNum(policy.maxChildren);
  if (maxChildren > 0 && room.children - adultEquivalentChildren > maxChildren) errors.push('MAX_CHILDREN_EXCEEDED');

  const maxAdultsWithChildren = safeNum(policy.maxAdultsWithChildren);
  if (room.children > 0 && maxAdultsWithChildren > 0 && effectiveAdults > maxAdultsWithChildren) errors.push('MAX_ADULTS_WITH_CHILDREN_EXCEEDED');

  const maxOccupancy = safeNum(policy.maxOccupancy);
  if (maxOccupancy > 0 && totalGuests > maxOccupancy) errors.push('ROOM_OCCUPANCY_EXCEEDED');

  const minTotal = safeNum(policy.minTotalOccupancy);
  if (minTotal > 0 && totalGuests < minTotal) errors.push('MIN_OCCUPANCY_NOT_MET');

  const a1 = safeNum(rates.adult1Rate);
  const a2 = safeNum(rates.adult2Rate) || a1;
  const a3 = safeNum(rates.adult3Rate);
  const extraBedRate = safeNum(rates.extraBedRate);

  let occupancyBasis: OccupancyPriceResult['occupancyBasis'] = 'UNRESOLVED';
  let baseRate = 0;
  let extraAdultCharge = 0;
  let extraBedCount = 0;

  if (effectiveAdults <= 1) {
    baseRate = a1;
    occupancyBasis = 'SGL';
  } else if (effectiveAdults === 2) {
    baseRate = a2;
    occupancyBasis = 'DBL';
  } else if (effectiveAdults === 3 && a3 > 0) {
    baseRate = a3;
    occupancyBasis = 'TPL';
  } else if (effectiveAdults > 2) {
    const extraAdults = effectiveAdults - 2;
    const bedAllowed = policy.extraBedAllowed !== false && policy.adultExtraBedAvailable !== false;
    const maxExtraBeds = safeNum(policy.maxExtraBeds);
    if (!bedAllowed || extraBedRate <= 0 || (maxExtraBeds > 0 && extraAdults > maxExtraBeds)) {
      errors.push('EXTRA_BED_UNAVAILABLE');
    } else {
      baseRate = a2;
      extraBedCount = extraAdults;
      extraAdultCharge = extraAdults * extraBedRate;
      occupancyBasis = 'DBL_EXTRA_ADULT';
    }
  }

  if (baseRate <= 0) errors.push('BASE_OCCUPANCY_RATE_MISSING');

  const childTotal = childCharges.reduce((sum, c) => sum + c.amount, 0);
  const net = Math.max(0, baseRate + extraAdultCharge + childTotal);

  return {
    valid: errors.length === 0 && net > 0,
    errors: Array.from(new Set(errors)),
    effectiveAdults,
    payingChildren,
    occupancyBasis,
    baseRate,
    extraAdultCharge,
    extraBedCount,
    childCharges,
    net,
  };
}

export function validateRoomRequestAgainstPolicy(
  room: RoomOccupancyRequest,
  policy: RoomTypeOccupancyPolicy,
): string[] {
  const placeholderRates: DailyOccupancyRates = {
    adult1Rate:1, adult2Rate:1, adult3Rate:1, extraBedRate:1, childSupplement:1, childRate05:1, childRate611:1,
  };
  return priceRoomOccupancy(room, policy, placeholderRates).errors.filter(e =>
    !['BASE_OCCUPANCY_RATE_MISSING','CHILD_POLICY_UNRESOLVED'].includes(e)
  );
}
