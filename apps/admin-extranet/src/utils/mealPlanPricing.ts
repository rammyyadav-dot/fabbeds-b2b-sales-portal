/**
 * OTA-grade meal plan supplement pricing utility.
 * Computes supplement costs given guest composition and a supplement record.
 *
 * Child age bands (industry standard):
 *   0–5   → free (childSuppAge05Pppn, typically 0)
 *   6–11  → paying child (childSuppAge611Pppn)
 *   12+   → treated as adult (childSuppAge12Pppn, usually = adultSupplementPerNight)
 */

export interface SupplementRecord {
  adultSupplementPerNight?: number;
  childSuppAge05Pppn?: number;
  childSuppAge611Pppn?: number;
  childSuppAge12Pppn?: number;
  applyTo?: string;
  roundingRule?: string;
}

export interface SupplementBreakdownLine {
  label: string;
  pppn: number;
  count: number;
  nights: number;
  subtotal: number;
}

export interface SupplementCostResult {
  adultTotal: number;
  childTotal: number;
  grandTotal: number;
  breakdown: SupplementBreakdownLine[];
}

function applyRounding(value: number, rule?: string): number {
  if (rule === 'Round Up') return Math.ceil(value);
  if (rule === 'Nearest') return Math.round(value);
  return value;
}

export function calcSupplementCost(params: {
  supplement: SupplementRecord;
  adults: number;
  childAges: number[];
  nights: number;
}): SupplementCostResult {
  const { supplement, adults, childAges, nights } = params;
  const applyTo = supplement.applyTo ?? 'all_guests';
  const breakdown: SupplementBreakdownLine[] = [];

  // Classify children by age band
  const free = childAges.filter(a => a <= 5).length;
  const payingChild = childAges.filter(a => a >= 6 && a <= 11).length;
  const childAsAdult = childAges.filter(a => a >= 12).length;

  // Effective adult count (12+ children treated as adults for supplement)
  const effectiveAdults = adults + childAsAdult;

  let adultTotal = 0;
  let childTotal = 0;

  // Adults
  if (applyTo !== 'children_only' && effectiveAdults > 0) {
    const pppn = supplement.adultSupplementPerNight ?? 0;
    const subtotal = applyRounding(pppn * effectiveAdults * nights, supplement.roundingRule);
    if (pppn > 0 || effectiveAdults > 0) {
      breakdown.push({ label: `Adults (×${effectiveAdults})`, pppn, count: effectiveAdults, nights, subtotal });
      adultTotal = subtotal;
    }
  }

  // Children 6–11
  if (applyTo !== 'adults_only' && payingChild > 0) {
    const pppn = supplement.childSuppAge611Pppn ?? 0;
    const subtotal = applyRounding(pppn * payingChild * nights, supplement.roundingRule);
    breakdown.push({ label: `Children 6–11 (×${payingChild})`, pppn, count: payingChild, nights, subtotal });
    childTotal += subtotal;
  }

  // Children 0–5 (free — show as 0 for transparency)
  if (free > 0) {
    const pppn = supplement.childSuppAge05Pppn ?? 0;
    breakdown.push({ label: `Children 0–5 (×${free}) — Free`, pppn: 0, count: free, nights, subtotal: 0 });
  }

  return {
    adultTotal,
    childTotal,
    grandTotal: adultTotal + childTotal,
    breakdown,
  };
}

/** Format AED currency */
export function fmtAED(value: number): string {
  return `AED ${value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Find the best-matching supplement for a date (checks validFrom/validTo) */
export function findActiveSupplements(
  supplements: Array<SupplementRecord & { validFrom?: string; validTo?: string; mealPlan?: string }>,
  checkInDate: string,
  mealPlan: string,
): typeof supplements {
  return supplements.filter(s => {
    if (s.mealPlan !== mealPlan) return false;
    if (s.validFrom && checkInDate < s.validFrom) return false;
    if (s.validTo && checkInDate > s.validTo) return false;
    return true;
  });
}
