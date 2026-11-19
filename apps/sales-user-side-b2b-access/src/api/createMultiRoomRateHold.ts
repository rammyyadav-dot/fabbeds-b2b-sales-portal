import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { recheckMultiRoomOffer } from '../lib/multiRoomRecheck';
import { resolveEffectiveRate, resolveInventoryGovernance, safeNum, validateAllocation } from '@project/pricing/hotelPricing';
import { appendHoldMovements, inventoryKey, loadInventoryConsumption, remainingAllocation } from '@project/pricing/inventoryLedger';

const HOLD_MINUTES=10;

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

function stayDates(checkIn:string,checkOut:string){
  const dates:string[]=[];
  const d=new Date(checkIn+'T00:00:00Z');
  const end=new Date(checkOut+'T00:00:00Z');
  while(d<end){dates.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}
  return dates;
}

async function releaseOwnHold(holdToken:string,source='partner_hold_release',actor='Partner'){
  const [lines,masters]=await Promise.all([
    zite.rateHoldLines.findAll({filters:{holdToken},limit:1000}),
    zite.rateHolds.findAll({filters:{holdToken},limit:100}),
  ]);
  for(const line of lines.records){
    if(line.status==='Active') await zite.rateHoldLines.update({id:line.id,record:{status:'Released'}});
  }
  for(const hold of masters.records){
    if(hold.holdStatus==='Active') await zite.rateHolds.update({id:hold.id,record:{holdStatus:'Released'}});
  }
  await appendHoldMovements({holdToken,movementType:'RELEASED',quantitySign:-1,source,actor,notes:'Active hold released'});
}

export default createEndpoint({
  description:'Create a fail-closed 10-minute inventory and price hold for an authoritative mixed-room offer',
  inputSchema:z.object({
    partnerToken:z.string(),
    hotelId:z.string().min(1),
    checkIn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    roomConfigs:z.array(roomConfigSchema).min(1),
    assignments:z.array(assignmentSchema).min(1),
    nationality:z.string().trim().min(2).max(3).optional(),
    extraMarkupPct:z.number().min(0).max(50).optional(),
    expectedSellTotal:z.number().positive(),
    expectedSignature:z.string().min(1),
  }),
  outputSchema:z.object({
    holdToken:z.string(),
    expiresAt:z.string(),
    holdSeconds:z.number(),
    sellTotal:z.number(),
    signature:z.string(),
  }),
  execute:async({input})=>{
    const partnerId=await verifyPartnerToken(input.partnerToken);
    if(!partnerId) throw new ZiteError({code:'UNAUTHORIZED',message:'Your partner session has expired. Please sign in again.'});
    const partner=await zite.partnerAccounts.findOne({id:partnerId}) as any;
    if(!partner||partner.accountStatus!=='Active') throw new ZiteError({code:'FORBIDDEN',message:'Partner account is not active.'});

    // Release this partner's older active hold for the same exact combination before recheck.
    const old=await zite.rateHoldLines.findAll({filters:{partnerId,status:'Active'},limit:1000});
    const oldTokens=Array.from(new Set(old.records.filter(x=>x.combinationSignature===input.expectedSignature).map(x=>x.holdToken).filter(Boolean) as string[]));
    for(const token of oldTokens) await releaseOwnHold(token,'partner_hold_replaced',partner.agencyEmail||'Partner');

    const recheck=await recheckMultiRoomOffer({
      hotelId:input.hotelId,checkIn:input.checkIn,checkOut:input.checkOut,
      roomConfigs:input.roomConfigs,assignments:input.assignments,
      nationality:input.nationality,extraMarkupPct:input.extraMarkupPct,
      expectedSellTotal:input.expectedSellTotal,expectedSignature:input.expectedSignature,
    });
    if(recheck.status==='PRICE_CHANGED') throw new ZiteError({code:'CONFLICT',message:`Price changed to AED ${recheck.sellTotal.toFixed(2)}. Accept the new price before holding inventory.`});
    if(recheck.status!=='RECHECKED') throw new ZiteError({code:'CONFLICT',message:`Offer cannot be held: ${recheck.reasonCodes.join(' | ')||recheck.status}.`});

    const dates=stayDates(input.checkIn,input.checkOut);
    const groups=new Map<string,{roomTypeId:string;ratePlanId:string;quantity:number}>();
    for(const a of input.assignments){
      const key=`${a.roomTypeId}|${a.ratePlanId}`;
      const current=groups.get(key);
      if(current) current.quantity+=1;
      else groups.set(key,{roomTypeId:a.roomTypeId,ratePlanId:a.ratePlanId,quantity:1});
    }

    const sql=await zite.sql({
      query:`
        SELECT dr.id,dr."rateDate",dr."allocation",dr."status",dr."layer",dr."priority",
               dr."allocationType",dr."releaseDay",dr."releaseHourUtc",dr."releaseAction",dr."overbookingAllowance",
               dr."contractPoolCode",dr."stopSaleReason",dr."governanceNote",dr.updated_at AS "updatedAt",
               l_rt."roomTypesId" AS "roomTypeId",l_rp."ratePlansId" AS "ratePlanId"
        FROM "DailyRates" dr
        JOIN "DailyRatesHotels" l_h ON l_h."dailyRatesId"=dr.id
        JOIN "DailyRatesRoomTypes" l_rt ON l_rt."dailyRatesId"=dr.id
        JOIN "DailyRatesRatePlans" l_rp ON l_rp."dailyRatesId"=dr.id
        WHERE l_h."hotelsId"=$1 AND dr."rateDate">=$2 AND dr."rateDate"<$3
          AND (dr."integrityStatus" IS NULL OR dr."integrityStatus"!='Quarantined')
      `,
      params:[input.hotelId,input.checkIn,input.checkOut],
    });
    const candidates=new Map<string,any[]>();
    for(const row of sql.rows as any[]){
      const date=typeof row.rateDate==='string'?row.rateDate.slice(0,10):new Date(row.rateDate).toISOString().slice(0,10);
      const key=`${row.roomTypeId}|${row.ratePlanId}|${date}`;
      const list=candidates.get(key)||[];
      list.push({...row,id:String(row.id),layer:row.layer||'BASE',priority:safeNum(row.priority),updatedAt:row.updatedAt});
      candidates.set(key,list);
    }
    const effective=new Map<string,any>();
    for(const [key,list] of candidates){const best=resolveEffectiveRate(list);if(best)effective.set(key,best);}

    const preConsumption=await loadInventoryConsumption({
      checkIn:input.checkIn,checkOut:input.checkOut,hotelId:input.hotelId,
    });

    for(const g of groups.values()){
      for(const date of dates){
        const key=`${g.roomTypeId}|${g.ratePlanId}|${date}`;
        const row=effective.get(key);
        if(!row) throw new ZiteError({code:'CONFLICT',message:`Inventory changed for ${date}; no authoritative Daily Rate remains.`});
        const governance=resolveInventoryGovernance({
          rate:row,stayDate:date,checkIn:input.checkIn,checkOut:input.checkOut,
        });
        const remaining=remainingAllocation({
          allocation:governance.governedAllocation,
          status:governance.effectiveStatus,
          overbookingAllowance:governance.overbookingAllowance,
          consumed:preConsumption.get(inventoryKey(input.hotelId,g.roomTypeId,g.ratePlanId,date)),
        });
        const errors=validateAllocation({status:governance.effectiveStatus,allocation:remaining,requestedRooms:g.quantity,allowOnRequest:false});
        if(errors.length) throw new ZiteError({code:'CONFLICT',message:`Inventory is no longer available for ${date} after active holds and booked rooms are reconciled. Please recheck.`});
      }
    }

    const holdToken=`HR-${crypto.randomUUID()}`;
    const expiresAt=new Date(Date.now()+HOLD_MINUTES*60_000).toISOString();
    const snapshot=JSON.stringify({
      version:'multi-room-hold-v1',partnerId,hotelId:input.hotelId,
      checkIn:input.checkIn,checkOut:input.checkOut,roomConfigs:input.roomConfigs,
      assignments:input.assignments,signature:recheck.signature,sellTotal:recheck.sellTotal,
      nationality:input.nationality,extraMarkupPct:input.extraMarkupPct||0,recheckedAt:recheck.recheckedAt,
    });

    for(const ratePlanId of Array.from(new Set(input.assignments.map(a=>a.ratePlanId)))){
      await zite.rateHolds.create({record:{
        holdToken,ratePlan:ratePlanId,holdStatus:'Active',expiresAt,
        quotedSellTotal:recheck.sellTotal,rateSnapshot:snapshot,
      }});
    }
    const lines=[] as any[];
    for(const g of groups.values()){
      for(const date of dates){
        lines.push({
          holdLineKey:`${holdToken}|${g.roomTypeId}|${g.ratePlanId}|${date}`,
          holdToken,partnerId,hotelId:input.hotelId,roomTypeId:g.roomTypeId,ratePlanId:g.ratePlanId,
          stayDate:date,quantity:g.quantity,status:'Active',expiresAt,
          quotedSellTotal:recheck.sellTotal,combinationSignature:recheck.signature,
        });
      }
    }
    for(let i=0;i<lines.length;i+=100) await zite.rateHoldLines.bulkCreate({records:lines.slice(i,i+100)});

    // Post-create contention check. Active holds + durable booked inventory may never exceed contracted allocation.
    const postConsumption=await loadInventoryConsumption({
      checkIn:input.checkIn,checkOut:input.checkOut,hotelId:input.hotelId,
    });
    for(const g of groups.values()){
      for(const date of dates){
        const key=`${g.roomTypeId}|${g.ratePlanId}|${date}`;
        const row=effective.get(key);
        const governance=row?resolveInventoryGovernance({
          rate:row,stayDate:date,checkIn:input.checkIn,checkOut:input.checkOut,
        }):null;
        if(governance?.effectiveStatus==='Free Sale' && governance?.governedAllocation==null) continue;
        const consumed=postConsumption.get(inventoryKey(input.hotelId,g.roomTypeId,g.ratePlanId,date))?.total||0;
        const governedCapacity=Math.max(0,safeNum(governance?.governedAllocation))+Math.max(0,safeNum(governance?.overbookingAllowance));
        if(consumed>governedCapacity){
          await releaseOwnHold(holdToken,'contention_guard',partner.agencyEmail||'Partner');
          throw new ZiteError({code:'CONFLICT',message:'Another booking or hold consumed the last allocation at the same time. Your hold was safely released; please recheck.'});
        }
      }
    }

    await appendHoldMovements({
      holdToken,movementType:'HOLD',quantitySign:1,
      source:'partner_rate_hold',actor:partner.agencyEmail||'Partner',
      notes:`10-minute hold created for authoritative combination ${recheck.signature}`,
    });

    return {holdToken,expiresAt,holdSeconds:HOLD_MINUTES*60,sellTotal:recheck.sellTotal,signature:recheck.signature};
  },
});
