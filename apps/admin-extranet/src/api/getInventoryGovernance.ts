import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { resolveEffectiveRate, resolveInventoryGovernance, linkedId, safeNum } from '@project/pricing/hotelPricing';
import { inventoryKey, loadInventoryConsumption, remainingAllocation } from '@project/pricing/inventoryLedger';
import { requireInventoryGovernor } from '../lib/requireInventoryGovernor';
import { dateOnly, governanceRevision } from '../lib/inventoryGovernance';

const rowSchema=z.object({
  rateId:z.string(),date:z.string(),hotelId:z.string(),hotelName:z.string(),
  roomTypeId:z.string(),roomTypeName:z.string(),ratePlanId:z.string(),ratePlanName:z.string(),mealPlan:z.string(),
  layer:z.string(),priority:z.number(),status:z.string(),effectiveStatus:z.string(),
  allocationType:z.string(),contractedAllocation:z.number().nullable(),overbookingAllowance:z.number(),
  held:z.number(),booked:z.number(),remaining:z.number().nullable(),risk:z.enum(['OK','WATCH','FULL','OVER']),
  releaseDay:z.number().nullable(),releaseHourUtc:z.number().nullable(),releaseAction:z.string(),
  releaseAt:z.string(),released:z.boolean(),cta:z.boolean(),ctd:z.boolean(),
  minStay:z.number().nullable(),maxStay:z.number().nullable(),leadDays:z.number().nullable(),
  contractPoolCode:z.string(),stopSaleReason:z.string(),governanceNote:z.string(),isLocked:z.boolean(),
  revision:z.string(),
});

export default createEndpoint({
  authenticated:true,
  description:'Load authoritative hotel allotment, release-period and stop-sale governance by commercial inventory cell',
  inputSchema:z.object({
    hotelId:z.string().min(1),
    startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  outputSchema:z.object({
    hotelId:z.string(),hotelName:z.string(),checkedAt:z.string(),
    rows:z.array(rowSchema),
    summary:z.object({
      cells:z.number(),freeSale:z.number(),allotment:z.number(),flexi:z.number(),stopSale:z.number(),
      released:z.number(),onRequest:z.number(),over:z.number(),full:z.number(),watch:z.number(),
    }),
  }),
  execute:async({input,context})=>{
    await requireInventoryGovernor(context,'view hotel inventory governance');
    const hotel=await zite.hotels.findOne({id:input.hotelId});
    if(!hotel) throw new Error('Hotel not found');

    const rates:any[]=[];
    let offset=0;
    while(true){
      const page=await zite.dailyRates.findAll({
        filters:{
          hotel:{contains:input.hotelId},
          rateDate:{gte:new Date(input.startDate),lte:new Date(input.endDate)},
        },
        limit:2000,offset,
      });
      rates.push(...page.records);
      if(!page.hasMore)break;
      offset+=page.records.length;
    }

    const [roomTypes,ratePlans]=await Promise.all([
      zite.roomTypes.findAll({limit:1500}),
      zite.ratePlans.findAll({limit:2000}),
    ]);
    const roomMap=new Map(roomTypes.records.map(r=>[r.id,r]));
    const planMap=new Map(ratePlans.records.map(p=>[p.id,p]));

    const grouped=new Map<string,any[]>();
    for(const rate of rates){
      const roomTypeId=linkedId(rate.roomType)||'';
      const ratePlanId=linkedId(rate.ratePlan)||String(rate.ratePlanId||'');
      const date=dateOnly(rate.rateDate);
      if(!roomTypeId||!ratePlanId||!date)continue;
      const key=`${roomTypeId}|${ratePlanId}|${date}`;
      const list=grouped.get(key)||[];
      list.push({...rate,updatedAt:(rate as any).updatedAt});
      grouped.set(key,list);
    }

    const endExclusive=new Date(input.endDate+'T00:00:00Z');
    endExclusive.setUTCDate(endExclusive.getUTCDate()+1);
    const consumption=await loadInventoryConsumption({
      checkIn:input.startDate,checkOut:endExclusive.toISOString().slice(0,10),hotelId:input.hotelId,
    });

    const rows:any[]=[];
    for(const [key,candidates] of grouped){
      const rate=resolveEffectiveRate(candidates);
      if(!rate)continue;
      const [roomTypeId,ratePlanId,date]=key.split('|');
      const plan=planMap.get(ratePlanId);
      const room=roomMap.get(roomTypeId);
      if(!plan||plan.status!=='Active')continue;
      const governance=resolveInventoryGovernance({
        rate,stayDate:date,checkIn:date,checkOut:new Date(new Date(date+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10),
      });
      const used=consumption.get(inventoryKey(input.hotelId,roomTypeId,ratePlanId,date))||{held:0,booked:0,total:0};
      const remaining=remainingAllocation({
        allocation:governance.governedAllocation,status:governance.effectiveStatus,
        overbookingAllowance:governance.overbookingAllowance,consumed:used,
      });
      const capacity=governance.governedAllocation==null?null:Math.max(0,safeNum(governance.governedAllocation))+governance.overbookingAllowance;
      const utilization=capacity&&capacity>0?used.total/capacity:null;
      const risk=capacity==null?'OK':used.total>capacity?'OVER':used.total===capacity&&capacity>0?'FULL':utilization!=null&&utilization>=0.8?'WATCH':'OK';
      rows.push({
        rateId:rate.id,date,hotelId:input.hotelId,hotelName:hotel.hotelName||input.hotelId,
        roomTypeId,roomTypeName:room?.roomTypeName||roomTypeId,ratePlanId,ratePlanName:plan.ratePlanName||ratePlanId,mealPlan:plan.mealPlan||'',
        layer:String(rate.layer||'BASE'),priority:safeNum(rate.priority),status:String(rate.status||'Free Sale'),effectiveStatus:governance.effectiveStatus,
        allocationType:String(rate.allocationType||((rate.status||'Free Sale')==='Free Sale'?'Free Sale':'Allotment')),contractedAllocation:rate.allocation==null?null:safeNum(rate.allocation),
        overbookingAllowance:governance.overbookingAllowance,held:used.held,booked:used.booked,remaining,
        risk:risk as 'OK'|'WATCH'|'FULL'|'OVER',
        releaseDay:rate.releaseDay==null?null:safeNum(rate.releaseDay),
        releaseHourUtc:rate.releaseHourUtc==null?null:safeNum(rate.releaseHourUtc),
        releaseAction:String(rate.releaseAction||''),releaseAt:governance.releaseAt,released:governance.released,
        cta:safeNum(rate.cta)>0,ctd:safeNum(rate.ctd)>0,
        minStay:rate.minStay==null?null:safeNum(rate.minStay),maxStay:rate.maxStay==null?null:safeNum(rate.maxStay),
        leadDays:rate.leadDays==null?null:safeNum(rate.leadDays),
        contractPoolCode:String(rate.contractPoolCode||''),stopSaleReason:String(rate.stopSaleReason||''),
        governanceNote:String(rate.governanceNote||''),isLocked:!!rate.isLocked,revision:governanceRevision(rate),
      });
    }
    rows.sort((a,b)=>a.date.localeCompare(b.date)||a.roomTypeName.localeCompare(b.roomTypeName)||a.ratePlanName.localeCompare(b.ratePlanName));

    return {
      hotelId:input.hotelId,hotelName:hotel.hotelName||input.hotelId,checkedAt:new Date().toISOString(),rows,
      summary:{
        cells:rows.length,freeSale:rows.filter(r=>r.allocationType==='Free Sale').length,
        allotment:rows.filter(r=>r.allocationType==='Allotment').length,
        flexi:rows.filter(r=>r.allocationType==='Flexi Allotment').length,
        stopSale:rows.filter(r=>r.effectiveStatus==='Stop Sale').length,
        released:rows.filter(r=>r.released).length,onRequest:rows.filter(r=>r.effectiveStatus==='On Request').length,
        over:rows.filter(r=>r.risk==='OVER').length,full:rows.filter(r=>r.risk==='FULL').length,watch:rows.filter(r=>r.risk==='WATCH').length,
      },
    };
  },
});
