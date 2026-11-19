import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { linkedId, resolveInventoryGovernance, safeNum } from '@project/pricing/hotelPricing';
import { inventoryKey, loadInventoryConsumption, remainingAllocation } from '@project/pricing/inventoryLedger';
import { requireInventoryGovernor } from '../lib/requireInventoryGovernor';
import { dateOnly, governanceRevision, governanceSnapshot } from '../lib/inventoryGovernance';

const changeSchema=z.object({
  rateId:z.string().min(1),
  revision:z.string(),
  status:z.enum(['Free Sale','Limited','On Request','Stop Sale']),
  allocationType:z.enum(['Free Sale','Allotment','Flexi Allotment','Stop Sell']),
  allocation:z.number().int().min(0).nullable(),
  overbookingAllowance:z.number().int().min(0).max(999).default(0),
  releaseDay:z.number().int().min(0).max(365).nullable(),
  releaseHourUtc:z.number().int().min(0).max(23).nullable(),
  releaseAction:z.enum(['On Request','Close','Continue']).optional(),
  cta:z.boolean(),
  ctd:z.boolean(),
  minStay:z.number().int().min(1).max(365).nullable(),
  maxStay:z.number().int().min(1).max(365).nullable(),
  leadDays:z.number().int().min(0).max(365).nullable(),
  contractPoolCode:z.string().trim().max(80).optional(),
  stopSaleReason:z.string().trim().max(180).optional(),
  governanceNote:z.string().trim().max(1000).optional(),
  reason:z.string().trim().min(3).max(500),
});

export default createEndpoint({
  authenticated:true,
  description:'Persist hotel allotment, stop-sale, release-period and stay-control governance with live consumption guards and audit evidence',
  inputSchema:z.object({changes:z.array(changeSchema).min(1).max(366)}),
  outputSchema:z.object({
    saved:z.array(z.object({rateId:z.string(),revision:z.string(),effectiveStatus:z.string(),remaining:z.number().nullable()})),
    failed:z.array(z.object({rateId:z.string(),message:z.string()})),
  }),
  execute:async({input,context})=>{
    const actor=await requireInventoryGovernor(context,'change hotel inventory governance');
    const saved:{rateId:string;revision:string;effectiveStatus:string;remaining:number|null}[]=[];
    const failed:{rateId:string;message:string}[]=[];

    for(const change of input.changes){
      try{
        const rate=await zite.dailyRates.findOne({id:change.rateId}) as any;
        if(!rate) throw new Error('Daily Rate cell not found.');
        if(governanceRevision(rate)!==change.revision) throw new Error('Inventory governance changed since you opened this row. Refresh before saving.');
        if(rate.isLocked) throw new Error('This rate cell is locked. Unlock through the controlled rate workflow before changing governance.');

        const hotelId=linkedId(rate.hotel),roomTypeId=linkedId(rate.roomType),ratePlanId=linkedId(rate.ratePlan)||String(rate.ratePlanId||'');
        const stayDate=dateOnly(rate.rateDate);
        if(!hotelId||!roomTypeId||!ratePlanId||!stayDate) throw new Error('Commercial linkage is incomplete.');

        if(change.minStay&&change.maxStay&&change.maxStay<change.minStay) throw new Error('Maximum stay cannot be below minimum stay.');
        if((change.allocationType==='Allotment'||change.allocationType==='Flexi Allotment')&&(change.allocation==null||change.allocation<1)){
          throw new Error(change.allocationType+' requires a positive contracted allocation.');
        }
        if(change.allocationType==='Free Sale'&&change.status==='Limited') throw new Error('Free Sale allocation type cannot use Limited status.');
        if(change.allocationType==='Stop Sell'&&change.status!=='Stop Sale') throw new Error('Stop Sell allocation type must use Stop Sale status.');
        if(change.status==='Stop Sale'&&!change.stopSaleReason) throw new Error('Stop Sale requires a reason for audit.');
        if((change.allocationType==='Allotment'||change.allocationType==='Flexi Allotment')&&change.releaseDay==null){
          throw new Error('Allotment release days are required.');
        }
        if((change.allocationType==='Allotment'||change.allocationType==='Flexi Allotment')&&change.releaseHourUtc==null){
          throw new Error('Allotment release hour UTC is required.');
        }
        if(change.allocationType==='Allotment'&&!change.releaseAction) throw new Error('Allotment release action is required.');
        if(change.allocationType==='Flexi Allotment'&&!change.releaseAction) throw new Error('Flexi Allotment release action is required.');

        const checkOutDate=new Date(stayDate+'T00:00:00Z');checkOutDate.setUTCDate(checkOutDate.getUTCDate()+1);
        const consumption=await loadInventoryConsumption({checkIn:stayDate,checkOut:checkOutDate.toISOString().slice(0,10),hotelId});
        const used=consumption.get(inventoryKey(hotelId,roomTypeId,ratePlanId,stayDate))||{held:0,booked:0,total:0};

        const proposed={
          ...rate,
          status:change.status,allocationType:change.allocationType,allocation:change.allocation,
          overbookingAllowance:change.overbookingAllowance,releaseDay:change.releaseDay,releaseHourUtc:change.releaseHourUtc,
          releaseAction:change.releaseAction||'',cta:change.cta?1:0,ctd:change.ctd?1:0,
          minStay:change.minStay,maxStay:change.maxStay,leadDays:change.leadDays,
          contractPoolCode:change.contractPoolCode||'',stopSaleReason:change.stopSaleReason||'',governanceNote:change.governanceNote||'',
        };
        const governance=resolveInventoryGovernance({
          rate:proposed,stayDate,checkIn:stayDate,checkOut:checkOutDate.toISOString().slice(0,10),
        });

        const capacity=governance.governedAllocation==null?null:
          Math.max(0,safeNum(governance.governedAllocation))+Math.max(0,governance.overbookingAllowance);
        if(capacity!=null&&used.total>capacity&&governance.effectiveStatus!=='Stop Sale'){
          throw new Error(`Cannot reduce governed capacity below committed inventory: ${used.held} held + ${used.booked} booked = ${used.total}; proposed capacity ${capacity}.`);
        }

        const before=governanceSnapshot(rate);
        const record:any={
          status:change.status,allocationType:change.allocationType,allocation:change.allocation,
          overbookingAllowance:change.overbookingAllowance,releaseDay:change.releaseDay,releaseHourUtc:change.releaseHourUtc,
          releaseAction:change.releaseAction||null,cta:change.cta?1:0,ctd:change.ctd?1:0,
          minStay:change.minStay,maxStay:change.maxStay,leadDays:change.leadDays,
          contractPoolCode:change.contractPoolCode||null,stopSaleReason:change.stopSaleReason||null,
          governanceNote:change.governanceNote||null,
        };
        await zite.dailyRates.update({id:rate.id,record});
        const fresh=await zite.dailyRates.findOne({id:rate.id}) as any;
        const after=governanceSnapshot(fresh);

        const stopping=change.status==='Stop Sale'||change.allocationType==='Stop Sell';
        const wasStopped=String(rate.status||'')==='Stop Sale'||String(rate.allocationType||'')==='Stop Sell';
        const releaseChanged=before.releaseDay!==after.releaseDay||before.releaseHourUtc!==after.releaseHourUtc||before.releaseAction!==after.releaseAction;
        const action=stopping&&!wasStopped?'STOP_SALE':!stopping&&wasStopped?'RESUME':releaseChanged?'RELEASE_POLICY':'UPDATE';

        await zite.hotelInventoryGovernanceAudit.create({record:{
          auditKey:`${rate.id}|${Date.now()}|${crypto.randomUUID()}`,
          hotelId,roomTypeId,ratePlanId,stayDate,action,
          beforeJson:JSON.stringify(before),afterJson:JSON.stringify(after),
          reason:change.reason,actor:actor.email||'Staff',occurredAt:new Date().toISOString(),
        }});

        const remaining=remainingAllocation({
          allocation:governance.governedAllocation,status:governance.effectiveStatus,
          overbookingAllowance:governance.overbookingAllowance,consumed:used,
        });
        saved.push({rateId:rate.id,revision:governanceRevision(fresh),effectiveStatus:governance.effectiveStatus,remaining});
      }catch(err:any){
        failed.push({rateId:change.rateId,message:err?.message||'Governance save failed.'});
      }
    }
    return {saved,failed};
  },
});
