export const CANONICAL_MEAL_PLANS = ['Room Only','Bed & Breakfast','Half Board','Full Board','All Inclusive'] as const;
export type CanonicalMealPlan = typeof CANONICAL_MEAL_PLANS[number];

export const LAYER_PRIORITY: Record<string, number> = {
  OVERRIDE: 400,
  PROMO: 300,
  BASE: 200,
  FALLBACK: 100,
};

export type EffectiveRateLike = {
  id: string;
  layer?: string | null;
  priority?: number | null;
  updatedAt?: string | Date | null;
};

export type MarkupRuleLike = {
  id?: string;
  ruleName?: string | null;
  markupType?: string | null;
  markupValue?: number | null;
  maxMarkupValue?: number | null;
  appliesTo?: string | null;
  specificHotel?: string | string[] | null;
  isActive?: boolean | null;
  ruleCategory?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function linkedId(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function resolveEffectiveRate<T extends EffectiveRateLike>(records: T[]): T | undefined {
  if (!records.length) return undefined;
  return [...records].sort((a, b) => {
    const la = LAYER_PRIORITY[a.layer || 'BASE'] ?? 0;
    const lb = LAYER_PRIORITY[b.layer || 'BASE'] ?? 0;
    if (la !== lb) return lb - la;
    const pa = safeNum(a.priority);
    const pb = safeNum(b.priority);
    if (pa !== pb) return pb - pa;
    const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (ua !== ub) return ub - ua;
    return String(b.id).localeCompare(String(a.id));
  })[0];
}

export function markupRulePriority(rule: MarkupRuleLike, hotelId: string): number {
  const isHotel = rule.appliesTo === 'Specific Hotel' && linkedId(rule.specificHotel) === hotelId;
  const isEvent = rule.ruleCategory === 'Event Override' || rule.ruleCategory === 'event_override';
  if (isHotel && isEvent) return 4;
  if (isHotel) return 3;
  if (isEvent) return 2;
  return 1;
}

export function isMarkupRuleValidForDate(rule: MarkupRuleLike, date: string): boolean {
  if (!rule.isActive) return false;
  if (!String(rule.ruleName || '').trim()) return false;
  if (!['Percentage (%)','Fixed Amount'].includes(String(rule.markupType || ''))) return false;
  if (rule.markupValue == null || !Number.isFinite(Number(rule.markupValue)) || Number(rule.markupValue) < 0) return false;
  if (!['Global (All Hotels)','Specific Hotel'].includes(String(rule.appliesTo || ''))) return false;
  if (rule.appliesTo === 'Specific Hotel' && !linkedId(rule.specificHotel)) return false;
  if (rule.startDate && rule.endDate && rule.endDate.slice(0,10) < rule.startDate.slice(0,10)) return false;
  if (rule.startDate && date < rule.startDate.slice(0,10)) return false;
  if (rule.endDate && date > rule.endDate.slice(0,10)) return false;
  return true;
}

export function resolveMarkupRule<T extends MarkupRuleLike>(hotelId: string, rules: T[], date: string): T | undefined {
  const valid = rules.filter(r => isMarkupRuleValidForDate(r, date));
  if (!valid.length) return undefined;
  return [...valid].sort((a,b) => {
    const p = markupRulePriority(b, hotelId) - markupRulePriority(a, hotelId);
    if (p !== 0) return p;
    return String(b.id || '').localeCompare(String(a.id || ''));
  })[0];
}

export function markupAmountForNet(net: number, rule?: MarkupRuleLike | null): number {
  if (!rule || net <= 0) return 0;
  const value = Math.abs(safeNum(rule.markupValue));
  let markup = rule.markupType === 'Percentage (%)'
    ? net * (value / 100)
    : value;
  const cap = safeNum(rule.maxMarkupValue);
  if (cap > 0 && markup > cap) markup = cap;
  return Math.max(0, markup);
}

export function applyMarkup(net: number, rule?: MarkupRuleLike | null): number {
  const sell = net + markupAmountForNet(net, rule);
  return Math.max(net, sell);
}

export function resolveOccupancyBaseRate(args: {
  adults: number;
  adult1Rate?: number | null;
  adult2Rate?: number | null;
  adult3Rate?: number | null;
  extraBedRate?: number | null;
}): { baseRate: number; extraBedTotal: number } {
  const a1 = safeNum(args.adult1Rate);
  const a2 = safeNum(args.adult2Rate) || a1;
  const a3 = safeNum(args.adult3Rate);
  const extraBed = safeNum(args.extraBedRate);
  if (args.adults <= 1) return { baseRate: a1, extraBedTotal: 0 };
  if (args.adults === 2) return { baseRate: a2, extraBedTotal: 0 };
  if (a3 > 0 && args.adults === 3) return { baseRate: a3, extraBedTotal: 0 };
  return { baseRate: a2, extraBedTotal: Math.max(0, args.adults - 2) * extraBed };
}

export function validateStayRestrictions(args: {
  requestedNights: number;
  checkIn: string;
  checkOut: string;
  today?: string;
  ratePlanMinStay?: number | null;
  ratePlanMaxStay?: number | null;
  dailyMinStay?: number | null;
  dailyMaxStay?: number | null;
  cta?: boolean | null;
  ctd?: boolean | null;
  leadDays?: number | null;
  status?: string | null;
}): string[] {
  const errors: string[] = [];
  const effectiveMin = Math.max(safeNum(args.ratePlanMinStay), safeNum(args.dailyMinStay));
  const maxCandidates = [safeNum(args.ratePlanMaxStay), safeNum(args.dailyMaxStay)].filter(n => n > 0);
  const effectiveMax = maxCandidates.length ? Math.min(...maxCandidates) : 0;
  if (effectiveMin > 0 && args.requestedNights < effectiveMin) errors.push(`Minimum stay is ${effectiveMin} night(s)`);
  if (effectiveMax > 0 && args.requestedNights > effectiveMax) errors.push(`Maximum stay is ${effectiveMax} night(s)`);
  if (args.cta) errors.push('Closed to arrival on check-in date');
  if (args.ctd) errors.push('Closed to departure on checkout date');
  if ((args.status || '') === 'Stop Sale') errors.push('Stop Sale');

  const leadDays = safeNum(args.leadDays);
  if (leadDays > 0) {
    const today = new Date((args.today || new Date().toISOString().slice(0,10)) + 'T00:00:00Z');
    const checkIn = new Date(args.checkIn + 'T00:00:00Z');
    const days = Math.floor((checkIn.getTime() - today.getTime()) / 86400000);
    if (days < leadDays) errors.push(`Requires at least ${leadDays} lead day(s)`);
  }
  return errors;
}

export function isSupportedAedRate(currency?: string | null, sellCurrency?: string | null): boolean {
  return (!currency || currency === 'AED') && (!sellCurrency || sellCurrency === 'AED');
}

export function isCanonicalMealPlan(value?: string | null): value is CanonicalMealPlan {
  return !!value && CANONICAL_MEAL_PLANS.includes(value as CanonicalMealPlan);
}

export function validateCommercialChain(args: {
  hotelId: string;
  roomTypeId: string;
  ratePlanId: string;
  roomHotelId?: string | null;
  ratePlanHotelId?: string | null;
  ratePlanRoomTypeId?: string | null;
  mealPlan?: string | null;
  mealPlanMasterId?: string | null;
  currency?: string | null;
  sellCurrency?: string | null;
}): string[] {
  const errors: string[] = [];
  if (args.roomHotelId !== args.hotelId) errors.push('ROOM_HOTEL_MISMATCH');
  if (args.ratePlanHotelId !== args.hotelId) errors.push('RATE_PLAN_HOTEL_MISMATCH');
  if (args.ratePlanRoomTypeId !== args.roomTypeId) errors.push('RATE_PLAN_ROOM_MISMATCH');
  if (!args.mealPlanMasterId || !isCanonicalMealPlan(args.mealPlan)) errors.push('MEAL_PLAN_INVALID');
  if (!isSupportedAedRate(args.currency, args.sellCurrency)) errors.push('UNSUPPORTED_CURRENCY');
  return errors;
}

export function validateAllocation(args: {
  status?: string | null;
  allocation?: number | null;
  requestedRooms: number;
  allowOnRequest?: boolean;
}): string[] {
  const errors: string[] = [];
  if ((args.status || '') === 'Stop Sale') errors.push('STOP_SALE');
  if ((args.status || '') === 'On Request' && !args.allowOnRequest) errors.push('ON_REQUEST');
  if ((args.status || '') !== 'Free Sale' && safeNum(args.allocation) < args.requestedRooms) errors.push('INSUFFICIENT_ALLOCATION');
  if ((args.status || '') === 'Free Sale' && args.allocation != null && safeNum(args.allocation) < args.requestedRooms) errors.push('INSUFFICIENT_ALLOCATION');
  return errors;
}


export type InventoryGovernanceLike = {
  status?: string | null;
  allocation?: number | null;
  allocationType?: string | null;
  releaseDay?: number | null;
  releaseHourUtc?: number | null;
  releaseAction?: string | null;
  overbookingAllowance?: number | null;
  cta?: number | boolean | null;
  ctd?: number | boolean | null;
  leadDays?: number | null;
};

export function resolveInventoryGovernance(args:{
  rate:InventoryGovernanceLike;
  stayDate:string;
  checkIn:string;
  checkOut:string;
  now?:Date;
}):{
  effectiveStatus:string;
  governedAllocation:number|null;
  overbookingAllowance:number;
  releaseAt:string;
  released:boolean;
  releaseAction:string;
  reasonCodes:string[];
}{
  const rate=args.rate;
  const allocationType=String(rate.allocationType||'');
  const rawStatus=String(rate.status||'Free Sale');
  const overbookingAllowance=Math.max(0,Math.floor(safeNum(rate.overbookingAllowance)));
  let effectiveStatus=rawStatus;
  let governedAllocation=rate.allocation==null?null:Math.max(0,safeNum(rate.allocation));
  const reasonCodes:string[]=[];

  if(allocationType==='Stop Sell'||rawStatus==='Stop Sale'){
    effectiveStatus='Stop Sale';
    reasonCodes.push('STOP_SALE');
  }

  const releaseDays=Math.max(0,Math.floor(safeNum(rate.releaseDay)));
  const releaseHour=Math.min(23,Math.max(0,Math.floor(safeNum(rate.releaseHourUtc))));
  let releaseAt='';
  let released=false;
  if((allocationType==='Allotment'||allocationType==='Flexi Allotment')&&releaseDays>=0){
    const releaseMoment=new Date(args.stayDate+'T00:00:00Z');
    releaseMoment.setUTCDate(releaseMoment.getUTCDate()-releaseDays);
    releaseMoment.setUTCHours(releaseHour,0,0,0);
    releaseAt=releaseMoment.toISOString();
    released=(args.now||new Date()).getTime()>=releaseMoment.getTime();

    if(released){
      const action=String(rate.releaseAction||(
        allocationType==='Flexi Allotment'?'Continue':'On Request'
      ));
      if(action==='Close'){
        effectiveStatus='Stop Sale';
        governedAllocation=0;
        reasonCodes.push('RELEASE_PERIOD_CLOSED');
      }else if(action==='On Request'){
        effectiveStatus='On Request';
        governedAllocation=0;
        reasonCodes.push('RELEASE_PERIOD_ON_REQUEST');
      }else{
        reasonCodes.push('RELEASE_PERIOD_CONTINUE');
      }
    }
  }

  if(args.stayDate===args.checkIn&&safeNum(rate.cta)>0) reasonCodes.push('CTA');
  const departureDate=args.checkOut;
  if(args.stayDate===departureDate&&safeNum(rate.ctd)>0) reasonCodes.push('CTD');

  return {
    effectiveStatus,governedAllocation,overbookingAllowance,releaseAt,released,
    releaseAction:String(rate.releaseAction||''),reasonCodes,
  };
}

export function applyMarkupWithFloor(
  net: number,
  rule?: MarkupRuleLike | null,
  minimumMarginFloor = 0,
): { sell: number; markup: number; floorApplied: boolean } {
  if (net <= 0) return { sell: 0, markup: 0, floorApplied: false };
  const canonicalMarkup = markupAmountForNet(net, rule);
  const floor = Math.max(0, safeNum(minimumMarginFloor));
  const finalMarkup = Math.max(canonicalMarkup, floor);
  return {
    sell: Math.max(net, Math.round((net + finalMarkup) * 100) / 100),
    markup: Math.round(finalMarkup * 100) / 100,
    floorApplied: finalMarkup > canonicalMarkup,
  };
}
