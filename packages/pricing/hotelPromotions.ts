export type PromotionType =
  | 'Percent Off' | 'PercentOff'
  | 'Fixed Amount Off' | 'FixedAmountOff'
  | 'Stay X Pay Y' | 'StayXPayY'
  | 'Discount Subsequent Nights' | 'DiscountSubsequentNights'
  | 'Early Bird' | 'EarlyBird'
  | 'Flash Sale' | 'FlashSale'
  | 'Free Night' | 'FreeNight'
  | 'Package Add-On' | 'PackageAddOn'
  | string;

export type PromotionLike = {
  id?: string;
  promotionCode?: string | null;
  promotionName?: string | null;
  status?: string | null;
  promoType?: PromotionType | null;
  priority?: number | null;
  stackingPolicy?: string | null;
  isFlashSale?: boolean | null;
  memberOnly?: boolean | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  stayNights?: number | null;
  payNights?: number | null;
  startNightIndex?: number | null;
  minRateAfterDiscount?: number | null;
  minLos?: number | null;
  maxLos?: number | null;
  minAdvanceDays?: number | null;
  maxAdvanceDays?: number | null;
  stayStartDate?: string | null;
  stayEndDate?: string | null;
  bookingStartDate?: string | null;
  bookingEndDate?: string | null;
  applicableDays?: string[] | null;
  channels?: string[] | null;
  roomTypeIDs?: string | null;
  ratePlanIDs?: string | null;
};

export type PromotionRuleLike = {
  fundingSource?: string | null;
  sourceMarkets?: string | null;
  agencySegments?: string | null;
  memberTiers?: string | null;
  wholeStayRequired?: boolean | null;
  minimumSellFloorAed?: number | null;
  minimumMargin?: number | null;
  maximumDiscount?: number | null;
  allowBelowNet?: boolean | null;
  overrideApproved?: boolean | null;
  overrideApprover?: string | null;
  overrideReason?: string | null;
  stackingGroup?: string | null;
  compatiblePromotionIds?: string | null;
  incompatiblePromotionIds?: string | null;
  sameFamilyStacking?: boolean | null;
};

export type PromotionContext = {
  bookingDate: string;
  checkIn: string;
  checkOut: string;
  stayDates: string[];
  roomTypeId: string;
  ratePlanId: string;
  mealPlan?: string;
  sourceMarket?: string;
  agencySegment?: string;
  memberTier?: string;
  isMember?: boolean;
  channel?: string;
  baseNet: number;
  baseSell: number;
  nightlySell?: number[];
};

export type PromotionDecision = {
  promotionId?: string;
  code: string;
  name: string;
  eligible: boolean;
  reasons: string[];
  rejectedReasons: string[];
  discountAmount: number;
  promotedSell: number;
  protectedFloor: number;
  floorBreached: boolean;
  overrideApplied: boolean;
  fundingSource: string;
  type: string;
  priority: number;
};

const splitCodes = (raw?: string | null) =>
  String(raw || '').split(/[\s,;|/]+/).map(v => v.trim()).filter(Boolean);

const normalizeType = (type?: string | null) =>
  String(type || '').replace(/[\s_-]+/g, '').toLowerCase();

const dateOnly = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

const inRange = (date: string, start?: string | null, end?: string | null) => {
  if (!date) return false;
  const s = dateOnly(start); const e = dateOnly(end);
  if (s && date < s) return false;
  if (e && date > e) return false;
  return true;
};

const weekday = (date: string) =>
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(date + 'T00:00:00Z').getUTCDay()];

export function validatePromotionConfiguration(p: PromotionLike, r: PromotionRuleLike = {}) {
  const errors: string[] = [];
  const code = String(p.promotionCode || '').trim();
  const type = normalizeType(p.promoType);
  if (!code) errors.push('Promotion code is required.');
  if (code && !/^[A-Z0-9_-]{2,40}$/.test(code)) errors.push('Promotion code must use A-Z, 0-9, hyphen or underscore only.');
  if (!String(p.promotionName || '').trim()) errors.push('Promotion name is required.');
  if (!p.stayStartDate || !p.stayEndDate) errors.push('Travel period is required.');
  if (p.stayStartDate && p.stayEndDate && dateOnly(p.stayEndDate) < dateOnly(p.stayStartDate)) errors.push('Travel end must be on or after travel start.');
  if (p.bookingStartDate && p.bookingEndDate && dateOnly(p.bookingEndDate) < dateOnly(p.bookingStartDate)) errors.push('Booking end must be on or after booking start.');
  if ((p.isFlashSale || type === 'flashsale') && (!p.bookingStartDate || !p.bookingEndDate)) errors.push('Flash Sale requires a booking window.');
  if (p.memberOnly && !String(r.memberTiers || r.agencySegments || '').trim()) errors.push('Member-only promotion requires a member tier or agency segment.');
  if ((type === 'percentoff' || type === 'earlybird' || type === 'flashsale' || type === 'discountsubsequentnights') && !(Number(p.discountPercent) > 0)) errors.push('A positive discount percentage is required.');
  if (type === 'fixedamountoff' && !(Number(p.discountAmount) > 0)) errors.push('A positive fixed AED discount is required.');
  if (type === 'stayxpayy') {
    if (!(Number(p.stayNights) > 0) || !(Number(p.payNights) > 0) || Number(p.payNights) >= Number(p.stayNights)) errors.push('Stay X Pay Y requires stay nights > pay nights > 0.');
  }
  if (type === 'freenight' && !(Number(p.stayNights) > 1)) errors.push('Free Night requires a qualifying stay length greater than 1 night.');
  if (Number(p.minLos || 0) < 0 || Number(p.maxLos || 0) < 0) errors.push('Length-of-stay values cannot be negative.');
  if (p.maxLos && p.minLos && Number(p.maxLos) < Number(p.minLos)) errors.push('Maximum LOS cannot be lower than minimum LOS.');
  if (Number(p.minAdvanceDays || 0) < 0 || Number(p.maxAdvanceDays || 0) < 0) errors.push('Lead-day values cannot be negative.');
  if (p.maxAdvanceDays && p.minAdvanceDays && Number(p.maxAdvanceDays) < Number(p.minAdvanceDays)) errors.push('Maximum lead days cannot be lower than minimum lead days.');
  if (Number(r.minimumSellFloorAed || 0) < 0 || Number(r.minimumMargin || 0) < 0 || Number(r.maximumDiscount || 0) < 0) errors.push('Commercial protection values cannot be negative.');
  if (Number(r.maximumDiscount || 0) > 100) errors.push('Maximum discount cannot exceed 100%.');
  if (r.allowBelowNet && (!r.overrideApproved || !String(r.overrideApprover || '').trim() || !String(r.overrideReason || '').trim())) errors.push('Below-net selling requires approved override, approver and reason.');
  const markets = splitCodes(r.sourceMarkets);
  if (markets.length && !markets.every(v => v === 'ALL' || /^[A-Z]{2,3}$/.test(v.toUpperCase()))) errors.push('Source markets must be ALL or ISO-style 2-3 letter codes.');
  return errors;
}

export function evaluatePromotion(p: PromotionLike, r: PromotionRuleLike, ctx: PromotionContext): PromotionDecision {
  const reasons: string[] = [];
  const rejectedReasons: string[] = [];
  const nights = ctx.stayDates.length;
  const type = normalizeType(p.promoType);
  const code = String(p.promotionCode || 'PROMO');
  const name = String(p.promotionName || code);
  const bookingDate = dateOnly(ctx.bookingDate);
  const checkIn = dateOnly(ctx.checkIn);
  const checkOut = dateOnly(ctx.checkOut);

  if (p.status !== 'Active') rejectedReasons.push('PROMOTION_NOT_ACTIVE');
  if (!inRange(checkIn, p.stayStartDate, p.stayEndDate)) rejectedReasons.push('TRAVEL_START_OUTSIDE_WINDOW');
  if (r.wholeStayRequired && p.stayEndDate && checkOut > dateOnly(p.stayEndDate)) rejectedReasons.push('WHOLE_STAY_OUTSIDE_TRAVEL_WINDOW');
  if (p.bookingStartDate || p.bookingEndDate) {
    if (!inRange(bookingDate, p.bookingStartDate, p.bookingEndDate)) rejectedReasons.push('BOOKING_OUTSIDE_WINDOW');
  }
  if (p.minLos && nights < Number(p.minLos)) rejectedReasons.push('MIN_LOS_NOT_MET');
  if (p.maxLos && nights > Number(p.maxLos)) rejectedReasons.push('MAX_LOS_EXCEEDED');

  const leadDays = Math.floor((new Date(checkIn + 'T00:00:00Z').getTime() - new Date(bookingDate + 'T00:00:00Z').getTime()) / 86400000);
  if (p.minAdvanceDays && leadDays < Number(p.minAdvanceDays)) rejectedReasons.push('MIN_LEAD_NOT_MET');
  if (p.maxAdvanceDays && leadDays > Number(p.maxAdvanceDays)) rejectedReasons.push('MAX_LEAD_EXCEEDED');

  const allowedMarkets = splitCodes(r.sourceMarkets).map(v => v.toUpperCase());
  if (allowedMarkets.length && !allowedMarkets.includes('ALL') && !allowedMarkets.includes(String(ctx.sourceMarket || '').toUpperCase())) rejectedReasons.push('SOURCE_MARKET_NOT_ELIGIBLE');

  const allowedSegments = splitCodes(r.agencySegments).map(v => v.toLowerCase());
  if (allowedSegments.length && !allowedSegments.includes(String(ctx.agencySegment || '').toLowerCase())) rejectedReasons.push('BUYER_SEGMENT_NOT_ELIGIBLE');

  const allowedTiers = splitCodes(r.memberTiers).map(v => v.toLowerCase());
  if (p.memberOnly && !ctx.isMember) rejectedReasons.push('MEMBER_REQUIRED');
  if (allowedTiers.length && !allowedTiers.includes(String(ctx.memberTier || '').toLowerCase())) rejectedReasons.push('MEMBER_TIER_NOT_ELIGIBLE');

  const channels = (p.channels || []).map(v => String(v).toLowerCase());
  if (channels.length && ctx.channel && !channels.includes(ctx.channel.toLowerCase())) rejectedReasons.push('CHANNEL_NOT_ELIGIBLE');

  const roomIds = splitCodes(p.roomTypeIDs);
  if (roomIds.length && !roomIds.includes(ctx.roomTypeId)) rejectedReasons.push('ROOM_TYPE_NOT_ELIGIBLE');
  const rateIds = splitCodes(p.ratePlanIDs);
  if (rateIds.length && !rateIds.includes(ctx.ratePlanId)) rejectedReasons.push('RATE_PLAN_NOT_ELIGIBLE');

  const days = p.applicableDays || [];
  if (days.length && !ctx.stayDates.some(d => days.includes(weekday(d)))) rejectedReasons.push('NO_ELIGIBLE_WEEKDAY');

  let rawDiscount = 0;
  if (!rejectedReasons.length) {
    if (type === 'percentoff' || type === 'earlybird' || type === 'flashsale') {
      rawDiscount = ctx.baseSell * Math.max(0, Number(p.discountPercent || 0)) / 100;
    } else if (type === 'fixedamountoff') {
      rawDiscount = Math.max(0, Number(p.discountAmount || 0));
    } else if (type === 'discountsubsequentnights') {
      const start = Math.max(2, Number(p.startNightIndex || 2));
      const eligibleNights = Math.max(0, nights - start + 1);
      rawDiscount = nights > 0 ? (ctx.baseSell / nights) * eligibleNights * Math.max(0, Number(p.discountPercent || 0)) / 100 : 0;
    } else if (type === 'stayxpayy') {
      const stay = Math.max(1, Number(p.stayNights || 0));
      const pay = Math.max(0, Number(p.payNights || 0));
      if (stay > pay && nights >= stay) {
        const cycles = Math.floor(nights / stay);
        const freeNights = cycles * (stay - pay);
        rawDiscount = (ctx.baseSell / nights) * freeNights;
      }
    } else if (type === 'freenight') {
      const stay = Math.max(2, Number(p.stayNights || 0));
      if (nights >= stay) rawDiscount = ctx.baseSell / nights;
    } else if (type === 'packageaddon') {
      rawDiscount = 0;
    } else {
      rejectedReasons.push('UNSUPPORTED_PROMOTION_TYPE');
    }
  }

  const maxDiscountPct = Math.max(0, Number(r.maximumDiscount || 0));
  if (maxDiscountPct > 0) rawDiscount = Math.min(rawDiscount, ctx.baseSell * maxDiscountPct / 100);
  let promotedSell = Math.max(0, ctx.baseSell - rawDiscount);

  const marginFloor = ctx.baseNet * (1 + Math.max(0, Number(r.minimumMargin || 0)) / 100);
  const configuredFloor = Math.max(0, Number(r.minimumSellFloorAed || p.minRateAfterDiscount || 0));
  const protectedFloor = Math.max(configuredFloor, marginFloor, r.allowBelowNet ? 0 : ctx.baseNet);
  const floorBreached = promotedSell < protectedFloor;
  const overrideApplied = floorBreached && !!r.allowBelowNet && !!r.overrideApproved && !!r.overrideApprover && !!r.overrideReason;

  if (floorBreached && !overrideApplied) {
    promotedSell = protectedFloor;
    reasons.push('PROTECTED_FLOOR_APPLIED');
  }
  if (overrideApplied) reasons.push('BELOW_NET_OVERRIDE_APPLIED');
  if (!rejectedReasons.length) reasons.push('ELIGIBLE');

  const discountAmount = Math.max(0, ctx.baseSell - promotedSell);
  return {
    promotionId: p.id,
    code,
    name,
    eligible: rejectedReasons.length === 0,
    reasons,
    rejectedReasons,
    discountAmount: Math.round(discountAmount * 100) / 100,
    promotedSell: Math.round(promotedSell * 100) / 100,
    protectedFloor: Math.round(protectedFloor * 100) / 100,
    floorBreached,
    overrideApplied,
    fundingSource: r.fundingSource || 'Supplier Funded',
    type: String(p.promoType || ''),
    priority: Number(p.priority || 0),
  };
}

export function choosePromotions(decisions: PromotionDecision[], promotions: PromotionLike[]) {
  const eligible = decisions.filter(d => d.eligible).sort((a,b) => b.priority - a.priority || a.code.localeCompare(b.code));
  if (!eligible.length) return [] as PromotionDecision[];
  const promoById = new Map(promotions.map(p => [p.id, p]));

  const exclusive = eligible.find(d => String(promoById.get(d.promotionId)?.stackingPolicy || 'Exclusive') === 'Exclusive');
  if (exclusive) return [exclusive];

  const bestDealCandidates = eligible.filter(d => String(promoById.get(d.promotionId)?.stackingPolicy || '') === 'Best Deal Only');
  if (bestDealCandidates.length) {
    return [bestDealCandidates.slice().sort((a,b) => a.promotedSell - b.promotedSell || b.priority - a.priority || a.code.localeCompare(b.code))[0]];
  }

  return eligible.filter(d => String(promoById.get(d.promotionId)?.stackingPolicy || '') === 'Stackable');
}

export type PromotionCandidate = { promotion: PromotionLike; rule: PromotionRuleLike };

const familyOf = (type?: string | null) => {
  const t = normalizeType(type);
  if (['percentoff','earlybird','flashsale','discountsubsequentnights'].includes(t)) return 'PERCENT';
  if (['freenight','stayxpayy'].includes(t)) return 'STAY_PATTERN';
  if (t === 'fixedamountoff') return 'FIXED';
  if (t === 'packageaddon') return 'PACKAGE';
  return t.toUpperCase();
};

const familyOrder = (type?: string | null) => {
  const f = familyOf(type);
  return f === 'STAY_PATTERN' ? 1 : f === 'PERCENT' ? 2 : f === 'FIXED' ? 3 : f === 'PACKAGE' ? 4 : 5;
};

const csvSet = (raw?: string | null) => new Set(splitCodes(raw));

function mutuallyCompatible(a: PromotionCandidate, b: PromotionCandidate) {
  const aId = a.promotion.id || '';
  const bId = b.promotion.id || '';
  if (csvSet(a.rule.incompatiblePromotionIds).has(bId) || csvSet(b.rule.incompatiblePromotionIds).has(aId)) return false;

  const aExplicit = csvSet(a.rule.compatiblePromotionIds);
  const bExplicit = csvSet(b.rule.compatiblePromotionIds);
  if (aExplicit.size && !aExplicit.has(bId)) return false;
  if (bExplicit.size && !bExplicit.has(aId)) return false;

  const sameFamily = familyOf(a.promotion.promoType) === familyOf(b.promotion.promoType);
  if (sameFamily && !(a.rule.sameFamilyStacking && b.rule.sameFamilyStacking)) return false;

  if (a.rule.stackingGroup && b.rule.stackingGroup && a.rule.stackingGroup !== b.rule.stackingGroup) return false;
  return true;
}

export function resolvePromotionPricing(candidates: PromotionCandidate[], ctx: PromotionContext) {
  const initialDecisions = candidates.map(c => evaluatePromotion(c.promotion, c.rule, ctx));
  const eligiblePairs = candidates
    .map((c, i) => ({ candidate: c, decision: initialDecisions[i] }))
    .filter(x => x.decision.eligible)
    .sort((a,b) =>
      b.decision.priority - a.decision.priority ||
      familyOrder(a.candidate.promotion.promoType) - familyOrder(b.candidate.promotion.promoType) ||
      a.decision.code.localeCompare(b.decision.code)
    );

  if (!eligiblePairs.length) {
    return { applied: [] as PromotionDecision[], decisions: initialDecisions, finalSell: ctx.baseSell };
  }

  const exclusive = eligiblePairs.find(x => String(x.candidate.promotion.stackingPolicy || 'Exclusive') === 'Exclusive');
  if (exclusive) {
    return { applied: [exclusive.decision], decisions: initialDecisions, finalSell: exclusive.decision.promotedSell };
  }

  const bestDeals = eligiblePairs.filter(x => String(x.candidate.promotion.stackingPolicy || '') === 'Best Deal Only');
  if (bestDeals.length) {
    const best = bestDeals.slice().sort((a,b) =>
      a.decision.promotedSell - b.decision.promotedSell ||
      b.decision.priority - a.decision.priority ||
      a.decision.code.localeCompare(b.decision.code)
    )[0];
    return { applied: [best.decision], decisions: initialDecisions, finalSell: best.decision.promotedSell };
  }

  const stackables = eligiblePairs.filter(x => String(x.candidate.promotion.stackingPolicy || '') === 'Stackable');
  const selected: typeof stackables = [];
  for (const item of stackables) {
    if (selected.every(existing => mutuallyCompatible(existing.candidate, item.candidate))) selected.push(item);
  }

  let runningSell = ctx.baseSell;
  const applied: PromotionDecision[] = [];
  for (const item of selected) {
    const decision = evaluatePromotion(item.candidate.promotion, item.candidate.rule, { ...ctx, baseSell: runningSell });
    if (!decision.eligible) continue;
    runningSell = decision.promotedSell;
    applied.push(decision);
  }

  return { applied, decisions: initialDecisions, finalSell: runningSell };
}
