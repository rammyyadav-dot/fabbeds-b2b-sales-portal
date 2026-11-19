import {
  CANONICAL_MEAL_PLANS,
  LAYER_PRIORITY,
  safeNum,
  type EffectiveRateLike,
  type MarkupRuleLike,
} from './hotelPricing';

export type CertificationStatus = 'PASS' | 'WARN' | 'FAIL';
export type DailyRateAuditStatus = 'VALID' | 'QUARANTINED' | 'ORPHANED' | 'AMBIGUOUS' | 'UNSELLABLE' | 'REPAIRABLE';

export type RatePlanAuditInput = {
  ratePlanId: string;
  hotelId?: string | null;
  roomTypeId?: string | null;
  roomHotelId?: string | null;
  code?: string | null;
  name?: string | null;
  status?: string | null;
  mealPlan?: string | null;
  mealPlanMasterId?: string | null;
  sellCurrency?: string | null;
  sourceMarket?: string | null;
  minStay?: number | null;
  maxStay?: number | null;
  cancellationType?: string | null;
  notes?: string | null;
  codeDuplicateCount?: number;
  dailyRateCount?: number;
  usableDailyRateCount?: number;
  quarantinedRows?: number;
  stopSaleRows?: number;
  zeroRateRows?: number;
  invalidCurrencyRows?: number;
  nullLayerRows?: number;
  duplicateKeys?: number;
  sellableDateCount?: number;
  coverageDays?: number;
  onRequestOnly?: boolean;
};

export type RatePlanAudit = {
  ratePlanId: string;
  hotelId?: string;
  roomTypeId?: string;
  code?: string;
  name: string;
  status: string;
  certificationStatus: CertificationStatus;
  errors: string[];
  warnings: string[];
  checks: {
    hotelLinked: boolean;
    roomLinked: boolean;
    hotelRoomAligned: boolean;
    ratePlanCodePresent: boolean;
    ratePlanCodeUnique: boolean;
    statusValid: boolean;
    mealPlanValid: boolean;
    mealPlanMasterLinked: boolean;
    sellCurrencyAed: boolean;
    sourceMarketExplicit: boolean;
    dailyRateCoverage: boolean;
    usableDailyRates: number;
    quarantinedRows: number;
    duplicateKeys: number;
    layerCoverage: boolean;
    zeroRateRows: number;
    invalidCurrencyRows: number;
    stopSaleRows: number;
  };
};

export function auditRatePlan(input: RatePlanAuditInput): RatePlanAudit {
  const errors: string[] = [];
  const warnings: string[] = [];
  const code = String(input.code || '').trim();
  const sourceMarket = String(input.sourceMarket || '').trim();
  const mealPlan = String(input.mealPlan || '').trim();
  const status = String(input.status || 'Draft');

  if (!input.hotelId) errors.push('RATE_PLAN_HOTEL_MISSING');
  if (!input.roomTypeId) errors.push('RATE_PLAN_ROOM_MISSING');
  if (input.hotelId && input.roomTypeId && input.roomHotelId && input.hotelId !== input.roomHotelId) errors.push('ROOM_HOTEL_MISMATCH');
  if (!code) errors.push('RATE_PLAN_CODE_MISSING');
  if ((input.codeDuplicateCount || 0) > 1) errors.push('RATE_PLAN_CODE_DUPLICATE');
  if (!mealPlan || !CANONICAL_MEAL_PLANS.includes(mealPlan as any)) errors.push('MEAL_PLAN_INVALID');
  if (!input.mealPlanMasterId) errors.push('MEAL_PLAN_MASTER_MISSING');
  if (String(input.sellCurrency || '') !== 'AED') errors.push('SELL_CURRENCY_NOT_AED');
  if (!sourceMarket) errors.push('SOURCE_MARKET_MISSING');
  if ((input.minStay || 0) > 0 && (input.maxStay || 0) > 0 && safeNum(input.minStay) > safeNum(input.maxStay)) errors.push('INVALID_LOS');
  if (status === 'Active' && (input.usableDailyRateCount || 0) === 0) errors.push('ACTIVE_PLAN_NO_USABLE_DAILY_RATES');
  if (status === 'Active' && (input.dailyRateCount || 0) > 0 && (input.quarantinedRows || 0) === (input.dailyRateCount || 0)) errors.push('ACTIVE_PLAN_QUARANTINED_ONLY');

  if ((input.coverageDays || 0) > 0 && (input.sellableDateCount || 0) < (input.coverageDays || 0)) warnings.push('INCOMPLETE_FUTURE_COVERAGE');
  if ((input.duplicateKeys || 0) > 0) warnings.push('DUPLICATE_COMMERCIAL_KEYS');
  if ((input.nullLayerRows || 0) > 0) warnings.push('DAILY_RATE_LAYER_MISSING');
  if ((input.zeroRateRows || 0) > 0) warnings.push('ZERO_OR_NEGATIVE_RATE_ROWS');
  if ((input.invalidCurrencyRows || 0) > 0) warnings.push('NON_AED_DAILY_RATE_ROWS');
  if (input.onRequestOnly) warnings.push('ON_REQUEST_ONLY');
  if (!input.cancellationType) warnings.push('CANCELLATION_METADATA_INCOMPLETE');
  if (code && !/^[A-Z0-9-]{2,40}$/.test(code)) warnings.push('RATE_PLAN_CODE_NONSTANDARD');
  if (sourceMarket.toUpperCase() === 'ALL' && !/all\s*market|unrestricted/i.test(String(input.notes || ''))) warnings.push('ALL_MARKET_NOT_CONFIRMED_IN_NOTES');

  const certificationStatus: CertificationStatus = errors.length ? 'FAIL' : warnings.length ? 'WARN' : 'PASS';
  return {
    ratePlanId: input.ratePlanId,
    hotelId: input.hotelId || undefined,
    roomTypeId: input.roomTypeId || undefined,
    code: code || undefined,
    name: String(input.name || input.ratePlanId),
    status,
    certificationStatus,
    errors,
    warnings,
    checks: {
      hotelLinked: !!input.hotelId,
      roomLinked: !!input.roomTypeId,
      hotelRoomAligned: !input.hotelId || !input.roomTypeId || !input.roomHotelId || input.hotelId === input.roomHotelId,
      ratePlanCodePresent: !!code,
      ratePlanCodeUnique: (input.codeDuplicateCount || 0) <= 1,
      statusValid: ['Active','Draft','Inactive'].includes(status),
      mealPlanValid: !!mealPlan && CANONICAL_MEAL_PLANS.includes(mealPlan as any),
      mealPlanMasterLinked: !!input.mealPlanMasterId,
      sellCurrencyAed: input.sellCurrency === 'AED',
      sourceMarketExplicit: !!sourceMarket,
      dailyRateCoverage: (input.sellableDateCount || 0) >= (input.coverageDays || 0) && (input.coverageDays || 0) > 0,
      usableDailyRates: input.usableDailyRateCount || 0,
      quarantinedRows: input.quarantinedRows || 0,
      duplicateKeys: input.duplicateKeys || 0,
      layerCoverage: (input.nullLayerRows || 0) === 0,
      zeroRateRows: input.zeroRateRows || 0,
      invalidCurrencyRows: input.invalidCurrencyRows || 0,
      stopSaleRows: input.stopSaleRows || 0,
    },
  };
}

export function auditMarkupRule(rule: MarkupRuleLike & { startDate?: string | null; endDate?: string | null }): string[] {
  if (!rule.isActive) return [];
  const errors: string[] = [];
  if (!String(rule.ruleName || '').trim()) errors.push('MARKUP_RULE_NAME_MISSING');
  if (!['Percentage (%)','Fixed Amount'].includes(String(rule.markupType || ''))) errors.push('MARKUP_TYPE_INVALID');
  if (rule.markupValue == null || !Number.isFinite(Number(rule.markupValue))) errors.push('MARKUP_VALUE_MISSING');
  if (Number(rule.markupValue || 0) < 0) errors.push('MARKUP_VALUE_NEGATIVE');
  if (!['Global (All Hotels)','Specific Hotel'].includes(String(rule.appliesTo || ''))) errors.push('MARKUP_SCOPE_INVALID');
  if (rule.appliesTo === 'Specific Hotel' && !rule.specificHotel) errors.push('MARKUP_HOTEL_MISSING');
  if (rule.startDate && rule.endDate && rule.endDate < rule.startDate) errors.push('MARKUP_DATE_RANGE_INVALID');
  return errors;
}

export function explainEffectiveRate<T extends EffectiveRateLike>(records: T[]) {
  const sorted = [...records].sort((a, b) => {
    const la = LAYER_PRIORITY[a.layer || 'BASE'] ?? 0;
    const lb = LAYER_PRIORITY[b.layer || 'BASE'] ?? 0;
    if (la !== lb) return lb - la;
    const pa = safeNum(a.priority), pb = safeNum(b.priority);
    if (pa !== pb) return pb - pa;
    const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (ua !== ub) return ub - ua;
    return String(b.id).localeCompare(String(a.id));
  });
  const selected = sorted[0];
  return {
    selected,
    rejected: sorted.slice(1),
    reason: selected
      ? `Selected ${selected.layer || 'BASE'} by layer precedence, then priority ${safeNum(selected.priority)}, updatedAt, record-id tie-break`
      : 'No candidate rate rows',
  };
}
