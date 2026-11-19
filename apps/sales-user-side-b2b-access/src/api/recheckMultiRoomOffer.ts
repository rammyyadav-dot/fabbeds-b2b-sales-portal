import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { recheckMultiRoomOffer } from '../lib/multiRoomRecheck';

const roomConfigSchema=z.object({
  adults:z.number().int().min(1),
  children:z.number().int().min(0),
  childAges:z.array(z.number().int().min(0)),
});
const assignmentSchema=z.object({
  requestedRoomNo:z.number().int().min(1),
  roomTypeId:z.string().min(1),
  ratePlanId:z.string().min(1),
});
const roomResultSchema=z.object({
  requestedRoomNo:z.number(),
  roomTypeId:z.string(),
  roomTypeName:z.string(),
  ratePlanId:z.string(),
  ratePlanName:z.string(),
  mealPlan:z.string(),
  cancellationPolicy:z.string(),
  status:z.string(),
  roomNetTotal:z.number(),
  roomSellTotal:z.number(),
  childTotal:z.number(),
  extraBedTotal:z.number(),
  eventSupplementTotal:z.number(),
  promotionCode:z.string().optional(),
  promotionName:z.string().optional(),
  nightly:z.array(z.object({
    date:z.string(),
    baseNet:z.number(),
    childTotal:z.number(),
    childCharges:z.array(z.object({age:z.number(),classification:z.string(),amount:z.number()})),
    extraBedTotal:z.number(),
    extraBedCount:z.number(),
    eventSupplement:z.number(),
    net:z.number(),
    sell:z.number(),
    occupancyBasis:z.string(),
  })),
});

export default createEndpoint({
  description:'Authoritatively recheck an exact mixed-room hotel offer before checkout/booking',
  inputSchema:z.object({
    hotelId:z.string().min(1),
    checkIn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    roomConfigs:z.array(roomConfigSchema).min(1),
    assignments:z.array(assignmentSchema).min(1),
    nationality:z.string().trim().min(2).max(3).optional(),
    extraMarkupPct:z.number().min(0).max(50).optional(),
    expectedSellTotal:z.number().positive().optional(),
    expectedSignature:z.string().optional(),
  }),
  outputSchema:z.object({
    status:z.enum(['RECHECKED','PRICE_CHANGED','ROOM_COMBINATION_CHANGED','CHILD_POLICY_CHANGED','UNAVAILABLE']),
    reasonCodes:z.array(z.string()),
    hotelId:z.string(),
    checkIn:z.string(),
    checkOut:z.string(),
    nights:z.number(),
    rooms:z.number(),
    netTotal:z.number(),
    sellTotal:z.number(),
    expectedSellTotal:z.number().nullable(),
    changedBy:z.number(),
    recheckedAt:z.string(),
    signature:z.string(),
    assignments:z.array(roomResultSchema),
    replacement:z.object({
      signature:z.string(),
      sellTotal:z.number(),
      assignments:z.array(assignmentSchema),
      roomSummary:z.array(z.object({
        requestedRoomNo:z.number(),
        roomTypeId:z.string(),
        roomTypeName:z.string(),
        ratePlanId:z.string(),
        ratePlanName:z.string(),
        mealPlan:z.string(),
        roomSellTotal:z.number(),
      })),
    }).nullable(),
  }),
  execute:async({input})=>recheckMultiRoomOffer(input),
});
