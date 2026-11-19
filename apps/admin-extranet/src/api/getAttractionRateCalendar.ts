import {isAttractionBlackout,effectiveAttractionRateRows,applyAttractionAvailability,attractionRateRevision} from '../../../../shared/attractionPolicy';
import {allAttractionRecords} from '../lib/allAttractionRecords';
import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import {requireAdmin} from '../lib/requireAdmin';

const linkedId=(v:unknown)=>Array.isArray(v)?String(v[0]||''):String(v||'');

export default createEndpoint({
  authenticated:true,
  description:'Returns a monthly attraction SKU rate/allocation calendar with slot-level effective inventory',
  inputSchema:z.object({
    ticketOptionId:z.string(),
    ratePlanId:z.string().optional(),
    month:z.string().regex(/^\d{4}-\d{2}$/),
  }),
  outputSchema:z.object({
    ticket:z.object({
      id:z.string(),skuCode:z.string(),name:z.string(),ticketType:z.string(),requiresSlot:z.boolean(),
      minPax:z.number(),maxPax:z.number(),adultAgeFrom:z.number().nullable(),childAgeFrom:z.number().nullable(),childAgeTo:z.number().nullable(),
    }),
    month:z.string(),
    days:z.array(z.object({
      date:z.string(),
      minAdult:z.number().nullable(),
      minChild:z.number().nullable(),
      totalAllocation:z.number(),
      sold:z.number(),
      held:z.number(),
      sellable:z.number().nullable(),
      slotCount:z.number(),
      status:z.enum(['Available','Limited','Sold Out','Stop Sale','Rate Missing','On Request','Closed']),
      rows:z.array(z.object({
        id:z.string(),revision:z.string(),planId:z.string(),baseAllocation:z.number(),blocked:z.boolean(),slot:z.string(),adult:z.number(),child:z.number(),retailAdult:z.number(),retailChild:z.number(),
        allocation:z.number(),sold:z.number(),held:z.number(),sellable:z.number().nullable(),status:z.string(),
        stopSale:z.boolean(),cutoffHours:z.number(),rateLayer:z.string(),priority:z.number(),
      })),
    })),
    coverage:z.object({
      daysInMonth:z.number(),ratedDays:z.number(),availableDays:z.number(),missingDays:z.number(),
      stopSaleDays:z.number(),soldOutDays:z.number(),coveragePct:z.number(),
    }),
  }),
  execute:async({input,context})=>{
    await requireAdmin(context,'manage attractions');
    const ticket=await zite.ticketOptions.findOne({id:input.ticketOptionId}) as any;
    if(!ticket) throw new ZiteError({code:'NOT_FOUND',message:'Ticket option not found.'});

    const availability=await allAttractionRecords(zite.attractionAvailability,{filters:{ticketProduct:ticket.id}});
    const policyMap=new Map(availability.records.map(p=>[String(p.date).slice(0,10),p]));
    const blackouts=await allAttractionRecords(zite.attractionBlackouts,{filters:{attraction:linkedId(ticket.attraction),status:'Active'}});
    const [year,monthNo]=input.month.split('-').map(Number);
    const start=`${input.month}-01`;
    const endDate=new Date(Date.UTC(year,monthNo,0));
    const end=endDate.toISOString().slice(0,10);
    const daysInMonth=endDate.getUTCDate();

    const rates=await allAttractionRecords(zite.attractionRates,{filters:{ticketOption:input.ticketOptionId,...(input.ratePlanId?{ratePlan:input.ratePlanId}:{})},limit:2000});
    const periodIds=[...new Set((rates.records as any[]).map(r=>linkedId(r.ratePeriod)).filter(Boolean))];
    const periodRes=periodIds.length?await allAttractionRecords(zite.attractionRatePeriods,{filters:{id:{in:periodIds}},limit:2000}):{records:[]};
    const periodMap=new Map((periodRes.records as any[]).map(p=>[p.id,p]));
    const relevant=effectiveAttractionRateRows((rates.records as any[]).filter(r=>{
      const pid=linkedId(r.ratePeriod);
      if(pid&&periodMap.get(pid)?.status!=='Published')return false;
      const d=String(r.date||'').slice(0,10);
      return d>=start&&d<=end;
    }).map(raw=>{
      const policy=policyMap.get(String(raw.date).slice(0,10));
      const r=applyAttractionAvailability(raw,policy);
      return{...r,sourceRevision:attractionRateRevision(raw),baseAllocation:Number(raw.totalCapacity||0),periodStop:!!periodMap.get(linkedId(raw.ratePeriod))?.stopSale,stopSale:r.stopSale||!!periodMap.get(linkedId(raw.ratePeriod))?.stopSale};
    }));

    const holds=await allAttractionRecords(zite.attractionInventoryHolds,{limit:2000});
    const now=Date.now();
    const heldByRate=new Map<string,number>();
    for(const h of holds.records as any[]){
      if(h.status!=='ACTIVE'||new Date(h.expiresAt||0).getTime()<=now) continue;
      const rid=linkedId(h.attractionRate);
      heldByRate.set(rid,(heldByRate.get(rid)||0)+Math.max(0,Number(h.heldPax||0)));
    }

    const rowsByDate=new Map<string,any[]>();
    for(const r of relevant){
      const d=String(r.date||'').slice(0,10);
      const arr=rowsByDate.get(d)||[];
      arr.push(r);rowsByDate.set(d,arr);
    }

    const days:any[]=[];
    let ratedDays=0,availableDays=0,missingDays=0,stopSaleDays=0,soldOutDays=0;

    for(let day=1;day<=daysInMonth;day++){
      const date=`${input.month}-${String(day).padStart(2,'0')}`;
      const blackedOut=isAttractionBlackout(date,linkedId(ticket.attraction),ticket.id,blackouts.records);
      const source=(rowsByDate.get(date)||[]).map(r=>({...r,stopSale:r.stopSale||blackedOut}));
      const rows=source.map(r=>{
        const allocation=Math.max(0,Number(r.totalCapacity||0));
        const sold=Math.max(0,Number(r.soldCount||0));
        const held=heldByRate.get(r.id)||0;
        const sellable=r.stopSale?0:allocation>0?Math.max(0,allocation-sold-held):null;
        return{
          id:r.id,revision:r.sourceRevision,planId:linkedId(r.ratePlan),baseAllocation:r.baseAllocation,blocked:blackedOut||!!r.periodStop,slot:r.slotTime||'',adult:Number(r.netCostAdult||0),child:Number(r.netCostChild||0),
          retailAdult:Number(r.retailAdult||0),retailChild:Number(r.retailChild||0),
          allocation,sold,held,sellable,status:r.inventoryStatus||'Available',stopSale:!!r.stopSale,
          cutoffHours:Number(r.bookingCutoffHours||0),rateLayer:r.rateLayer||'BASE',priority:Number(r.priority||0),
        };
      });

      const positive=rows.filter(r=>(r.adult>0||r.child>0)&&!r.stopSale);
      const adultPrices=positive.map(r=>r.adult).filter(n=>n>0&&Number.isFinite(n));
      const childPrices=positive.map(r=>r.child).filter(n=>n>0&&Number.isFinite(n));
      const minAdult=adultPrices.length?Math.min(...adultPrices):null;
      const minChild=childPrices.length?Math.min(...childPrices):null;
      const totalAllocation=rows.reduce((s,r)=>s+r.allocation,0);
      const sold=rows.reduce((s,r)=>s+r.sold,0);
      const held=rows.reduce((s,r)=>s+r.held,0);
      const finiteSellable=rows.filter(r=>r.sellable!==null);
      const sellable=blackedOut?0:finiteSellable.length?finiteSellable.reduce((s,r)=>s+(r.sellable||0),0):null;
      const hasStop=rows.some(r=>r.stopSale);
      const onRequest=rows.length>0&&rows.every(r=>r.status==='On Request');
      const closed=rows.length>0&&rows.every(r=>{
        const cutoff=new Date(date+'T00:00:00Z').getTime()-r.cutoffHours*3600000;
        return now>cutoff;
      });

      let status:'Available'|'Limited'|'Sold Out'|'Stop Sale'|'Rate Missing'|'On Request'|'Closed'='Rate Missing';
      if(blackedOut||(hasStop&&rows.every(r=>r.stopSale))) status='Stop Sale';
      else if(rows.length===0||positive.length===0) status='Rate Missing';
      else if(closed) status='Closed';
      else if(onRequest) status='On Request';
      else if(sellable===0) status='Sold Out';
      else if(sellable!==null&&sellable<=10) status='Limited';
      else status='Available';

      if(rows.length>0) ratedDays++; else missingDays++;
      if(status==='Available'||status==='Limited'||status==='On Request') availableDays++;
      if(status==='Stop Sale') stopSaleDays++;
      if(status==='Sold Out') soldOutDays++;

      days.push({
        date,minAdult:Number.isFinite(minAdult as number)?minAdult:null,minChild:Number.isFinite(minChild as number)?minChild:null,
        totalAllocation,sold,held,sellable,slotCount:new Set(rows.map(r=>r.slot||'OPEN')).size,status,rows,
      });
    }

    return{
      ticket:{
        id:ticket.id,skuCode:ticket.skuCode||'',name:ticket.name||'',ticketType:ticket.ticketType||'Open Date',
        requiresSlot:!!ticket.requiresSlot,minPax:Number(ticket.minPax||1),maxPax:Number(ticket.maxPax||99),
        adultAgeFrom:ticket.adultAgeFrom==null?null:Number(ticket.adultAgeFrom),
        childAgeFrom:ticket.childAgeFrom==null?null:Number(ticket.childAgeFrom),
        childAgeTo:ticket.childAgeTo==null?null:Number(ticket.childAgeTo),
      },
      month:input.month,
      days,
      coverage:{
        daysInMonth,ratedDays,availableDays,missingDays,stopSaleDays,soldOutDays,
        coveragePct:daysInMonth?Math.round((ratedDays/daysInMonth)*100):0,
      },
    };
  },
});
