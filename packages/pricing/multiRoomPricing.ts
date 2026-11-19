import type { RoomOccupancyRequest, OccupancyPriceResult } from './occupancyPricing';

export type RoomStayNight = {
  date: string;
  occupancyBasis: string;
  baseNet: number;
  childCharges: OccupancyPriceResult['childCharges'];
  extraAdultCharge: number;
  extraBedCount: number;
  eventSupplement: number;
  net: number;
  markup: number;
  sell: number;
};

export type RequestedRoomOffer = {
  requestedRoomNo: number;
  request: RoomOccupancyRequest;
  offerKey: string;
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string;
  ratePlanName: string;
  mealPlan: string;
  market: string;
  cancellationPolicy: string;
  status: string;
  minimumAllocation: number | null;
  nightly: RoomStayNight[];
  roomStayNet: number;
  roomStaySell: number;
  promotionCode?: string;
  promotionName?: string;
  promotionDiscountAmount?: number;
  promotionFundingSource?: string;
};

export type RoomCombinationResult = {
  complete: boolean;
  reasonCodes: string[];
  assignments: RequestedRoomOffer[];
  supplierNet: number;
  contractedSell: number;
  promotedSell: number;
  promotionDiscount: number;
  mixedRoomTypes: boolean;
  mixedRatePlans: boolean;
  mixedCancellation: boolean;
};

function canUseCapacity(assignments: RequestedRoomOffer[], candidate: RequestedRoomOffer): boolean {
  if (candidate.minimumAllocation == null) return false;
  const count = assignments.filter(a => a.offerKey === candidate.offerKey).length + 1;
  return count <= candidate.minimumAllocation;
}

export function findBestRoomCombination(
  requestedRooms: RoomOccupancyRequest[],
  offersByRoom: RequestedRoomOffer[][],
  maxCandidatesPerRoom = 12,
): RoomCombinationResult {
  if (requestedRooms.length === 0 || offersByRoom.length !== requestedRooms.length) {
    return {
      complete:false, reasonCodes:['ROOM_ASSIGNMENT_INCOMPLETE'], assignments:[],
      supplierNet:0, contractedSell:0, promotedSell:0, promotionDiscount:0,
      mixedRoomTypes:false, mixedRatePlans:false, mixedCancellation:false,
    };
  }

  const pruned = offersByRoom.map(list =>
    [...list]
      .filter(o => o.roomStaySell > 0 && o.nightly.length > 0)
      .sort((a,b) => a.roomStaySell - b.roomStaySell || a.offerKey.localeCompare(b.offerKey))
      .slice(0, maxCandidatesPerRoom)
  );

  if (pruned.some(list => list.length === 0)) {
    return {
      complete:false, reasonCodes:['NO_VALID_OFFER_FOR_REQUESTED_ROOM'], assignments:[],
      supplierNet:0, contractedSell:0, promotedSell:0, promotionDiscount:0,
      mixedRoomTypes:false, mixedRatePlans:false, mixedCancellation:false,
    };
  }

  const roomOrder = pruned
    .map((list, index) => ({ index, size:list.length }))
    .sort((a,b) => a.size - b.size || a.index - b.index)
    .map(x => x.index);

  let best: RequestedRoomOffer[] | null = null;
  let bestSell = Number.POSITIVE_INFINITY;
  let visited = 0;
  const VISIT_LIMIT = 50000;

  const dfs = (depth:number, chosen:RequestedRoomOffer[], runningSell:number) => {
    if (visited++ > VISIT_LIMIT) return;
    if (runningSell >= bestSell) return;
    if (depth === roomOrder.length) {
      best = [...chosen];
      bestSell = runningSell;
      return;
    }
    const roomIndex = roomOrder[depth];
    for (const candidate of pruned[roomIndex]) {
      if (!canUseCapacity(chosen, candidate)) continue;
      chosen.push(candidate);
      dfs(depth + 1, chosen, runningSell + candidate.roomStaySell);
      chosen.pop();
    }
  };
  dfs(0, [], 0);

  if (!best) {
    return {
      complete:false, reasonCodes:['INSUFFICIENT_GROUPED_ALLOCATION'], assignments:[],
      supplierNet:0, contractedSell:0, promotedSell:0, promotionDiscount:0,
      mixedRoomTypes:false, mixedRatePlans:false, mixedCancellation:false,
    };
  }

  const assignments = [...(best as RequestedRoomOffer[])].sort((a,b) => a.requestedRoomNo - b.requestedRoomNo);
  const supplierNet = assignments.reduce((s,a)=>s+a.roomStayNet,0);
  const promotedSell = assignments.reduce((s,a)=>s+a.roomStaySell,0);
  const promotionDiscount = assignments.reduce((s,a)=>s+Math.max(0,a.promotionDiscountAmount||0),0);
  const contractedSell = promotedSell + promotionDiscount;
  const roomTypes = new Set(assignments.map(a=>a.roomTypeId));
  const ratePlans = new Set(assignments.map(a=>a.ratePlanId));
  const cancellation = new Set(assignments.map(a=>a.cancellationPolicy || ''));

  return {
    complete:true,
    reasonCodes:[],
    assignments,
    supplierNet,
    contractedSell,
    promotedSell,
    promotionDiscount,
    mixedRoomTypes:roomTypes.size>1,
    mixedRatePlans:ratePlans.size>1,
    mixedCancellation:cancellation.size>1,
  };
}

export function aggregateDisplayQuote(
  combination: RoomCombinationResult,
  extraMarkupPct:number,
) {
  const pct = Math.min(50, Math.max(0, Number(extraMarkupPct)||0));
  const customerQuoteBeforeRounding = combination.promotedSell * (1 + pct / 100);
  return {
    supplierNet: combination.supplierNet,
    contractedSell: combination.contractedSell,
    promotionDiscount: combination.promotionDiscount,
    promotedSell: combination.promotedSell,
    extraMarkupPct:pct,
    customerQuoteBeforeRounding,
    finalDisplayQuote: Math.round(customerQuoteBeforeRounding),
  };
}
