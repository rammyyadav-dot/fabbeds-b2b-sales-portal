import { zite } from 'zitejs/db';
import { eventSupplementForNight, loadHotelEventRules, validateEventStayRules } from './hotelEventPricing';
import { resolvePromotionPricing } from '@project/pricing/hotelPromotions';
import {
  applyMarkup,
  isSupportedAedRate,
  linkedId,
  resolveEffectiveRate,
  resolveMarkupRule,
  resolveInventoryGovernance,
  safeNum,
  validateAllocation,
  validateStayRestrictions,
} from '@project/pricing/hotelPricing';
import { priceRoomOccupancy, validateRequestedRoom, type RoomOccupancyRequest } from '@project/pricing/occupancyPricing';
import { findBestRoomCombination, type RequestedRoomOffer } from '@project/pricing/multiRoomPricing';
import { inventoryKey, loadInventoryConsumption, remainingAllocation } from '@project/pricing/inventoryLedger';

export type MultiRoomAssignmentInput = {
  requestedRoomNo: number;
  roomTypeId: string;
  ratePlanId: string;
};

export type MultiRoomRecheckStatus =
  | 'RECHECKED'
  | 'PRICE_CHANGED'
  | 'ROOM_COMBINATION_CHANGED'
  | 'CHILD_POLICY_CHANGED'
  | 'UNAVAILABLE';

export type RecheckedRoomAssignment = {
  requestedRoomNo: number;
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string;
  ratePlanName: string;
  mealPlan: string;
  cancellationPolicy: string;
  status: string;
  roomNetTotal: number;
  roomSellTotal: number;
  childTotal: number;
  extraBedTotal: number;
  eventSupplementTotal: number;
  promotionCode?: string;
  promotionName?: string;
  nightly: Array<{
    date: string;
    baseNet: number;
    childTotal: number;
    childCharges: Array<{ age: number; classification: string; amount: number }>;
    extraBedTotal: number;
    extraBedCount: number;
    eventSupplement: number;
    net: number;
    sell: number;
    occupancyBasis: string;
  }>;
};

export type ReplacementCombination = {
  signature: string;
  sellTotal: number;
  assignments: MultiRoomAssignmentInput[];
  roomSummary: Array<{
    requestedRoomNo: number;
    roomTypeId: string;
    roomTypeName: string;
    ratePlanId: string;
    ratePlanName: string;
    mealPlan: string;
    roomSellTotal: number;
  }>;
};

export type MultiRoomRecheckResult = {
  status: MultiRoomRecheckStatus;
  reasonCodes: string[];
  hotelId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  netTotal: number;
  sellTotal: number;
  expectedSellTotal: number | null;
  changedBy: number;
  recheckedAt: string;
  signature: string;
  assignments: RecheckedRoomAssignment[];
  replacement: ReplacementCombination | null;
};

function normalizeMarketCodes(raw: unknown): string[] {
  const text = String(raw || '').trim().toUpperCase();
  if (!text || text === 'ALL' || text === '*' || text === 'GLOBAL') return [];
  return Array.from(new Set(text.split(/[\s,;|/]+/).map(v => v.trim()).filter(Boolean)));
}

function cancellationSummary(plan: any, checkIn: string) {
  if (plan.refundable === false) return 'Non-refundable';
  if (plan.cancellationWindowDays != null && Number(plan.cancellationWindowDays) > 0) {
    const date = new Date(checkIn + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - Number(plan.cancellationWindowDays));
    return `Free cancellation until ${date.toLocaleDateString('en-AE', { day:'2-digit', month:'short', timeZone:'UTC' })}`;
  }
  if (plan.refundable) return 'Free cancellation';
  return '';
}

export function combinationSignature(assignments: MultiRoomAssignmentInput[]) {
  return [...assignments]
    .sort((a,b) => a.requestedRoomNo - b.requestedRoomNo)
    .map(a => `${a.requestedRoomNo}:${a.roomTypeId}:${a.ratePlanId}`)
    .join('|');
}

export async function recheckMultiRoomOffer(args: {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  roomConfigs: RoomOccupancyRequest[];
  assignments: MultiRoomAssignmentInput[];
  nationality?: string;
  extraMarkupPct?: number;
  expectedSellTotal?: number;
  expectedSignature?: string;
  excludeHoldToken?: string;
}): Promise<MultiRoomRecheckResult> {
  const reasonCodes: string[] = [];
  const nights = Math.round((new Date(args.checkOut + 'T00:00:00Z').getTime() - new Date(args.checkIn + 'T00:00:00Z').getTime()) / 86400000);
  const now = new Date().toISOString();
  const signature = combinationSignature(args.assignments);

  const empty = (status: MultiRoomRecheckStatus): MultiRoomRecheckResult => ({
    status,
    reasonCodes:Array.from(new Set(reasonCodes)),
    hotelId:args.hotelId,
    checkIn:args.checkIn,
    checkOut:args.checkOut,
    nights:Math.max(0,nights),
    rooms:args.roomConfigs.length,
    netTotal:0,
    sellTotal:0,
    expectedSellTotal:args.expectedSellTotal ?? null,
    changedBy:args.expectedSellTotal ? -args.expectedSellTotal : 0,
    recheckedAt:now,
    signature,
    assignments:[],
    replacement:null,
  });

  if (nights <= 0) {
    reasonCodes.push('INVALID_STAY_DATES');
    return empty('UNAVAILABLE');
  }
  if (args.roomConfigs.length < 1 || args.assignments.length !== args.roomConfigs.length) {
    reasonCodes.push('ROOM_ASSIGNMENT_INCOMPLETE');
    return empty('ROOM_COMBINATION_CHANGED');
  }
  const orderedAssignments = [...args.assignments].sort((a,b)=>a.requestedRoomNo-b.requestedRoomNo);
  if (orderedAssignments.some((a,i)=>a.requestedRoomNo !== i+1)) {
    reasonCodes.push('ROOM_NUMBER_SEQUENCE_CHANGED');
    return empty('ROOM_COMBINATION_CHANGED');
  }
  if (args.expectedSignature && args.expectedSignature !== signature) {
    reasonCodes.push('ROOM_COMBINATION_SIGNATURE_CHANGED');
    return empty('ROOM_COMBINATION_CHANGED');
  }
  for (let i=0;i<args.roomConfigs.length;i++) {
    const errors = validateRequestedRoom({ ...args.roomConfigs[i], roomNo:i+1 });
    if (errors.length) reasonCodes.push(...errors.map(e=>`ROOM_${i+1}_${e}`));
  }
  if (reasonCodes.length) return empty('CHILD_POLICY_CHANGED');

  const stayDates:string[] = [];
  const d = new Date(args.checkIn + 'T00:00:00Z');
  for (let i=0;i<nights;i++) {
    stayDates.push(d.toISOString().slice(0,10));
    d.setUTCDate(d.getUTCDate()+1);
  }

  const uniqueRoomTypeIds = Array.from(new Set(args.assignments.map(a=>a.roomTypeId)));
  const uniqueRatePlanIds = Array.from(new Set(args.assignments.map(a=>a.ratePlanId)));

  const [roomTypesRes, ratePlansRes, dailySql, markupRes, eventRules, promotionsRes, promotionRulesRes] = await Promise.all([
    zite.roomTypes.findAll({ limit:500 }),
    zite.ratePlans.findAll({ limit:1000 }),
    zite.sql({
      query:`
        SELECT dr.id, dr."rateDate", dr."adult1Rate", dr."adult2Rate", dr."adult3Rate",
               dr."childSupplement", dr."childRate05", dr."childRate611", dr."extraBedRate",
               dr."allocation", dr."status", dr."layer", dr."priority", dr."currency",
               dr."minStay", dr."maxStay", dr."cta", dr."ctd", dr."leadDays", dr."ratePlanId",
               dr."allocationType", dr."releaseDay", dr."releaseHourUtc", dr."releaseAction",
               dr."overbookingAllowance", dr."contractPoolCode", dr."stopSaleReason", dr."governanceNote",
               dr.updated_at AS "updatedAt",
               l_h."hotelsId" AS "hotelId",
               l_rt."roomTypesId" AS "roomTypeId",
               l_rp."ratePlansId" AS "ratePlanLinkId"
        FROM "DailyRates" dr
        LEFT JOIN "DailyRatesHotels" l_h ON l_h."dailyRatesId"=dr.id
        LEFT JOIN "DailyRatesRoomTypes" l_rt ON l_rt."dailyRatesId"=dr.id
        LEFT JOIN "DailyRatesRatePlans" l_rp ON l_rp."dailyRatesId"=dr.id
        WHERE l_h."hotelsId"=$1
          AND dr."rateDate">=$2
          AND dr."rateDate"<=$3
          AND (dr."integrityStatus" IS NULL OR dr."integrityStatus"!='Quarantined')
      `,
      params:[args.hotelId,args.checkIn,args.checkOut],
    }),
    zite.markupRules.findAll({ filters:{ isActive:true }, limit:500 }),
    loadHotelEventRules(args.hotelId),
    zite.promotions.findAll({ filters:{ status:'Active' }, limit:1000 }),
    zite.promotionCommercialRules.findAll({ limit:1000 }),
  ]);

  const roomTypeMap = new Map(roomTypesRes.records.map(r=>[r.id,r]));
  const ratePlanMap = new Map(ratePlansRes.records.map(r=>[r.id,r]));
  const requestedMarket = args.nationality?.toUpperCase();

  let originalChainInvalid=false;
  for (const a of args.assignments) {
    const rt = roomTypeMap.get(a.roomTypeId);
    const rp = ratePlanMap.get(a.ratePlanId);
    if (!rt || !rp || linkedId(rt.hotel)!==args.hotelId || linkedId(rp.hotel)!==args.hotelId || linkedId(rp.roomType)!==a.roomTypeId || rp.status!=='Active') {
      reasonCodes.push(`ROOM_${a.requestedRoomNo}_COMMERCIAL_CHAIN_CHANGED`);
      originalChainInvalid=true;
      continue;
    }
    const codes = normalizeMarketCodes(rp.nationalityMarket);
    if (codes.length && (!requestedMarket || !codes.includes(requestedMarket))) {
      reasonCodes.push(`ROOM_${a.requestedRoomNo}_SOURCE_MARKET_CHANGED`);
      originalChainInvalid=true;
    }
    if (!rp.mealPlan || !linkedId(rp.mealPlanMaster) || !isSupportedAedRate(undefined,rp.sellCurrency)) {
      reasonCodes.push(`ROOM_${a.requestedRoomNo}_RATE_PLAN_INVALID`);
      originalChainInvalid=true;
    }
  }

  const grouped = new Map<string, any[]>();
  for (const raw of dailySql.rows as any[]) {
    const hotelId = raw.hotelId ? String(raw.hotelId) : '';
    const roomTypeId = raw.roomTypeId ? String(raw.roomTypeId) : '';
    const ratePlanId = raw.ratePlanLinkId ? String(raw.ratePlanLinkId) : '';
    const date = raw.rateDate ? (typeof raw.rateDate==='string' ? raw.rateDate.slice(0,10) : new Date(raw.rateDate).toISOString().slice(0,10)) : '';
    if (!hotelId || !roomTypeId || !ratePlanId || !date) continue;
    if (raw.ratePlanId && String(raw.ratePlanId)!==ratePlanId) continue;
    const key=`${roomTypeId}|${ratePlanId}|${date}`;
    const list=grouped.get(key)||[];
    list.push({ ...raw, id:String(raw.id), layer:raw.layer||'BASE', priority:safeNum(raw.priority), updatedAt:raw.updatedAt });
    grouped.set(key,list);
  }

  const effective = new Map<string,any>();
  for (const [key,candidates] of grouped) {
    const best=resolveEffectiveRate(candidates);
    if (best) effective.set(key,best);
  }

  const inventoryConsumption=await loadInventoryConsumption({
    checkIn:args.checkIn,
    checkOut:args.checkOut,
    hotelId:args.hotelId,
    excludeHoldToken:args.excludeHoldToken,
  });

  // Atomic grouped allocation across all requested rooms sharing one commercial product.
  let originalAllocationInvalid=false;
  const assignmentCounts = new Map<string,number>();
  for (const a of args.assignments) {
    const key=`${a.roomTypeId}|${a.ratePlanId}`;
    assignmentCounts.set(key,(assignmentCounts.get(key)||0)+1);
  }
  for (const [offerKey,count] of assignmentCounts) {
    const [roomTypeId,ratePlanId]=offerKey.split('|');
    for (const date of stayDates) {
      const row=effective.get(`${roomTypeId}|${ratePlanId}|${date}`);
      if (!row) {
        reasonCodes.push(`${date}_RATE_MISSING`);
        originalAllocationInvalid=true;
        continue;
      }
      const governance=resolveInventoryGovernance({
        rate:row,stayDate:date,checkIn:args.checkIn,checkOut:args.checkOut,
      });
      const remaining=remainingAllocation({
        allocation:governance.governedAllocation,
        status:governance.effectiveStatus,
        overbookingAllowance:governance.overbookingAllowance,
        consumed:inventoryConsumption.get(inventoryKey(args.hotelId,roomTypeId,ratePlanId,date)),
      });
      const allocationErrors=validateAllocation({
        status:governance.effectiveStatus,
        allocation:remaining,
        requestedRooms:count,
        allowOnRequest:false,
      });
      if (allocationErrors.length) {
        reasonCodes.push(...allocationErrors.map(e=>`${date}_${e}`));
        originalAllocationInvalid=true;
      }
    }
  }

  const promotionRuleById = new Map(promotionRulesRes.records.map(r=>[r.promotionId,r]));
  const promotionsByHotel = promotionsRes.records
    .filter(p=>linkedId(p.hotel)===args.hotelId)
    .map(p=>({ promotion:p, rule:promotionRuleById.get(p.id)||{} }));

  const publicMarkupPct=Math.min(50,Math.max(0,args.extraMarkupPct||0));

  const discoverReplacement = (): ReplacementCombination | null => {
    const offersByRoom: RequestedRoomOffer[][] = args.roomConfigs.map(()=>[]);
    for (const rp of ratePlansRes.records) {
      const roomTypeId=linkedId(rp.roomType);
      if (rp.status!=='Active' || linkedId(rp.hotel)!==args.hotelId || !roomTypeId) continue;
      const rt=roomTypeMap.get(roomTypeId);
      if (!rt || linkedId(rt.hotel)!==args.hotelId || rt.status==='Inactive' || rt.sellEnabled===false) continue;
      if (!rp.mealPlan || !linkedId(rp.mealPlanMaster) || !isSupportedAedRate(undefined,rp.sellCurrency)) continue;
      const markets=normalizeMarketCodes(rp.nationalityMarket);
      if (markets.length && (!requestedMarket || !markets.includes(requestedMarket))) continue;

      const rows=stayDates.map(date=>effective.get(`${roomTypeId}|${rp.id}|${date}`));
      if (rows.some(row=>!row || !isSupportedAedRate(row.currency,rp.sellCurrency))) continue;
      const governedRows=rows.map((row,index)=>resolveInventoryGovernance({
        rate:row!,stayDate:stayDates[index],checkIn:args.checkIn,checkOut:args.checkOut,
      }));
      if(governedRows.some(g=>g.effectiveStatus==='Stop Sale')) continue;

      const minAllocation=rows.reduce((min,row,index)=>{
        const governance=governedRows[index];
        const remaining=remainingAllocation({
          allocation:governance.governedAllocation,
          status:governance.effectiveStatus,
          overbookingAllowance:governance.overbookingAllowance,
          consumed:inventoryConsumption.get(inventoryKey(args.hotelId,roomTypeId,rp.id,stayDates[index])),
        });
        const cap=remaining==null?999:remaining;
        return Math.min(min,cap);
      },999);
      if (minAllocation<1) continue;

      const eventErrors=validateEventStayRules({events:eventRules,stayDates,checkIn:args.checkIn,roomTypeId,ratePlanId:rp.id});
      if (eventErrors.length) continue;

      for (let i=0;i<args.roomConfigs.length;i++) {
        const rc={...args.roomConfigs[i],roomNo:i+1};
        let roomNet=0, roomSell=0, valid=true;
        const nightly:RequestedRoomOffer['nightly']=[];
        for (let n=0;n<stayDates.length;n++) {
          const date=stayDates[n], row=rows[n]!;
          const restrictions=validateStayRestrictions({
            requestedNights:nights,checkIn:args.checkIn,checkOut:args.checkOut,
            ratePlanMinStay:rp.minStayNights,ratePlanMaxStay:rp.maxStayNights,
            dailyMinStay:safeNum(row.minStay),dailyMaxStay:safeNum(row.maxStay),
            cta:date===args.checkIn && safeNum(row.cta)>0,ctd:false,leadDays:safeNum(row.leadDays),status:governedRows[n].effectiveStatus,
          });
          if (restrictions.length) { valid=false; break; }
          const occ=priceRoomOccupancy(rc,rt,{
            adult1Rate:safeNum(row.adult1Rate),adult2Rate:safeNum(row.adult2Rate),adult3Rate:safeNum(row.adult3Rate),
            childSupplement:safeNum(row.childSupplement),childRate05:safeNum(row.childRate05),childRate611:safeNum(row.childRate611),extraBedRate:safeNum(row.extraBedRate),
          });
          if (!occ.valid) { valid=false; break; }
          const ev=eventSupplementForNight({events:eventRules,date,roomTypeId,ratePlanId:rp.id,rooms:[{adults:rc.adults,children:rc.children}]});
          const net=occ.net+ev.amount;
          const sell=applyMarkup(net,resolveMarkupRule(args.hotelId,markupRes.records,date));
          roomNet+=net; roomSell+=sell;
          nightly.push({date,occupancyBasis:occ.occupancyBasis,baseNet:occ.baseRate,childCharges:occ.childCharges,extraAdultCharge:occ.extraAdultCharge,extraBedCount:occ.extraBedCount,eventSupplement:ev.amount,net,markup:Math.max(0,sell-net),sell});
        }
        if (!valid || nightly.length!==stayDates.length) continue;
        const promo=resolvePromotionPricing(promotionsByHotel,{
          bookingDate:new Date().toISOString().slice(0,10),checkIn:args.checkIn,checkOut:args.checkOut,stayDates,
          roomTypeId,ratePlanId:rp.id,mealPlan:rp.mealPlan,sourceMarket:requestedMarket,isMember:false,channel:'Bedbank',
          baseNet:roomNet,baseSell:roomSell,nightlySell:nightly.map(x=>x.sell),
        });
        const finalSell=promo.applied.length?promo.finalSell:roomSell;
        offersByRoom[i].push({
          requestedRoomNo:i+1,request:rc,offerKey:`${roomTypeId}|${rp.id}`,
          roomTypeId,roomTypeName:rt.roomTypeName||roomTypeId,ratePlanId:rp.id,ratePlanName:rp.ratePlanName||rp.id,
          mealPlan:String(rp.mealPlan||''),market:String(rp.nationalityMarket||'ALL'),cancellationPolicy:cancellationSummary(rp,args.checkIn),
          status:rows.some(r=>r.status==='Limited')?'Limited':'Free Sale',minimumAllocation:minAllocation,nightly,roomStayNet:roomNet,
          roomStaySell:finalSell,promotionCode:promo.applied[0]?.code,promotionName:promo.applied[0]?.name,
          promotionDiscountAmount:Math.max(0,roomSell-finalSell),promotionFundingSource:promo.applied[0]?.fundingSource,
        });
      }
    }
    const combo=findBestRoomCombination(args.roomConfigs,offersByRoom);
    if (!combo.complete) return null;
    const assignments=combo.assignments.map(a=>({requestedRoomNo:a.requestedRoomNo,roomTypeId:a.roomTypeId,ratePlanId:a.ratePlanId}));
    const sellTotal=Math.round(combo.assignments.reduce((s,a)=>s+a.roomStaySell*(1+publicMarkupPct/100),0)*100)/100;
    return {
      signature:combinationSignature(assignments),
      sellTotal,
      assignments,
      roomSummary:combo.assignments.map(a=>({
        requestedRoomNo:a.requestedRoomNo,roomTypeId:a.roomTypeId,roomTypeName:a.roomTypeName,
        ratePlanId:a.ratePlanId,ratePlanName:a.ratePlanName,mealPlan:a.mealPlan,
        roomSellTotal:Math.round(a.roomStaySell*(1+publicMarkupPct/100)*100)/100,
      })),
    };
  };

  const failWithReplacement = (fallbackStatus: MultiRoomRecheckStatus) => {
    const replacement=discoverReplacement();
    const result=empty(replacement ? 'ROOM_COMBINATION_CHANGED' : fallbackStatus);
    result.replacement=replacement;
    if (replacement) result.reasonCodes.push('REPLACEMENT_COMBINATION_AVAILABLE');
    return result;
  };

  if (originalChainInvalid || originalAllocationInvalid) return failWithReplacement('UNAVAILABLE');

  const recheckedAssignments:RecheckedRoomAssignment[]=[];

  for (let i=0;i<orderedAssignments.length;i++) {
    const a=orderedAssignments[i];
    const rc={...args.roomConfigs[i],roomNo:i+1};
    const rt=roomTypeMap.get(a.roomTypeId)!;
    const rp=ratePlanMap.get(a.ratePlanId)!;

    const eventErrors=validateEventStayRules({
      events:eventRules,
      stayDates,
      checkIn:args.checkIn,
      roomTypeId:a.roomTypeId,
      ratePlanId:a.ratePlanId,
    });
    if (eventErrors.length) {
      reasonCodes.push(...eventErrors.map(e=>`ROOM_${i+1}_EVENT_RULE_CHANGED:${e}`));
      return failWithReplacement('UNAVAILABLE');
    }

    let roomNet=0;
    let contractedSell=0;
    let childTotal=0;
    let extraBedTotal=0;
    let eventSupplementTotal=0;
    const nightly:RecheckedRoomAssignment['nightly']=[];

    for (const date of stayDates) {
      const row=effective.get(`${a.roomTypeId}|${a.ratePlanId}|${date}`);
      if (!row) {
        reasonCodes.push(`ROOM_${i+1}_${date}_RATE_MISSING`);
        return failWithReplacement('UNAVAILABLE');
      }
      const restrictionErrors=validateStayRestrictions({
        requestedNights:nights,
        checkIn:args.checkIn,
        checkOut:args.checkOut,
        ratePlanMinStay:rp.minStayNights,
        ratePlanMaxStay:rp.maxStayNights,
        dailyMinStay:safeNum(row.minStay),
        dailyMaxStay:safeNum(row.maxStay),
        cta:date===args.checkIn && safeNum(row.cta)>0,
        ctd:false,
        leadDays:safeNum(row.leadDays),
        status:row.status||'Free Sale',
      });
      if (restrictionErrors.length) {
        reasonCodes.push(...restrictionErrors.map(e=>`ROOM_${i+1}_${date}_${e}`));
        return failWithReplacement('UNAVAILABLE');
      }

      const occ=priceRoomOccupancy(rc,rt,{
        adult1Rate:safeNum(row.adult1Rate),
        adult2Rate:safeNum(row.adult2Rate),
        adult3Rate:safeNum(row.adult3Rate),
        childSupplement:safeNum(row.childSupplement),
        childRate05:safeNum(row.childRate05),
        childRate611:safeNum(row.childRate611),
        extraBedRate:safeNum(row.extraBedRate),
      });
      if (!occ.valid) {
        reasonCodes.push(...occ.errors.map(e=>`ROOM_${i+1}_${e}`));
        return failWithReplacement('CHILD_POLICY_CHANGED');
      }

      const ev=eventSupplementForNight({
        events:eventRules,date,roomTypeId:a.roomTypeId,ratePlanId:a.ratePlanId,
        rooms:[{adults:rc.adults,children:rc.children}],
      });
      const net=occ.net+ev.amount;
      const rule=resolveMarkupRule(args.hotelId,markupRes.records,date);
      const sell=applyMarkup(net,rule);
      roomNet+=net;
      contractedSell+=sell;
      const nightChild=occ.childCharges.reduce((s,c)=>s+c.amount,0);
      childTotal+=nightChild;
      extraBedTotal+=occ.extraAdultCharge;
      eventSupplementTotal+=ev.amount;
      nightly.push({
        date,
        baseNet:Math.round(occ.baseRate*100)/100,
        childTotal:Math.round(nightChild*100)/100,
        childCharges:occ.childCharges.map(c=>({age:c.age,classification:c.classification,amount:Math.round(c.amount*100)/100})),
        extraBedTotal:Math.round(occ.extraAdultCharge*100)/100,
        extraBedCount:occ.extraBedCount,
        eventSupplement:Math.round(ev.amount*100)/100,
        net:Math.round(net*100)/100,
        sell:Math.round(sell*100)/100,
        occupancyBasis:occ.occupancyBasis,
      });
    }

    const promo=resolvePromotionPricing(promotionsByHotel,{
      bookingDate:new Date().toISOString().slice(0,10),
      checkIn:args.checkIn,
      checkOut:args.checkOut,
      stayDates,
      roomTypeId:a.roomTypeId,
      ratePlanId:a.ratePlanId,
      mealPlan:rp.mealPlan,
      sourceMarket:requestedMarket,
      isMember:false,
      channel:'Bedbank',
      baseNet:roomNet,
      baseSell:contractedSell,
      nightlySell:nightly.map(n=>n.sell),
    });
    const applied=promo.applied[0];
    const promotedSell=promo.applied.length?promo.finalSell:contractedSell;

    recheckedAssignments.push({
      requestedRoomNo:i+1,
      roomTypeId:a.roomTypeId,
      roomTypeName:rt.roomTypeName||a.roomTypeId,
      ratePlanId:a.ratePlanId,
      ratePlanName:rp.ratePlanName||a.ratePlanId,
      mealPlan:String(rp.mealPlan || ''),
      cancellationPolicy:cancellationSummary(rp,args.checkIn),
      status:stayDates.some(date=>effective.get(`${a.roomTypeId}|${a.ratePlanId}|${date}`)?.status==='Limited')?'Limited':'Free Sale',
      roomNetTotal:Math.round(roomNet*100)/100,
      roomSellTotal:Math.round(promotedSell*(1+publicMarkupPct/100)*100)/100,
      childTotal:Math.round(childTotal*100)/100,
      extraBedTotal:Math.round(extraBedTotal*100)/100,
      eventSupplementTotal:Math.round(eventSupplementTotal*100)/100,
      promotionCode:applied?.code,
      promotionName:applied?.name,
      nightly,
    });
  }

  const netTotal=Math.round(recheckedAssignments.reduce((s,a)=>s+a.roomNetTotal,0)*100)/100;
  const sellTotal=Math.round(recheckedAssignments.reduce((s,a)=>s+a.roomSellTotal,0)*100)/100;
  const expected=args.expectedSellTotal;
  const changedBy=expected==null?0:Math.round((sellTotal-expected)*100)/100;
  const status:MultiRoomRecheckStatus = expected!=null && Math.abs(changedBy)>=0.01 ? 'PRICE_CHANGED' : 'RECHECKED';

  return {
    status,
    reasonCodes:[],
    hotelId:args.hotelId,
    checkIn:args.checkIn,
    checkOut:args.checkOut,
    nights,
    rooms:args.roomConfigs.length,
    netTotal,
    sellTotal,
    expectedSellTotal:expected??null,
    changedBy,
    recheckedAt:now,
    signature,
    assignments:recheckedAssignments,
    replacement:null,
  };
}
