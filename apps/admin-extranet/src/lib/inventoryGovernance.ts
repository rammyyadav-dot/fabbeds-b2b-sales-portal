import type { DailyRatesRecordType } from 'zitejs/db';

export function governanceSnapshot(rate:DailyRatesRecordType|any){
  return {
    allocation:rate.allocation==null?null:Number(rate.allocation),
    status:String(rate.status||'Free Sale'),
    allocationType:String(rate.allocationType||''),
    releaseDay:rate.releaseDay==null?null:Number(rate.releaseDay),
    releaseHourUtc:rate.releaseHourUtc==null?null:Number(rate.releaseHourUtc),
    releaseAction:String(rate.releaseAction||''),
    overbookingAllowance:rate.overbookingAllowance==null?0:Number(rate.overbookingAllowance),
    cta:Number(rate.cta||0),
    ctd:Number(rate.ctd||0),
    minStay:rate.minStay==null?null:Number(rate.minStay),
    maxStay:rate.maxStay==null?null:Number(rate.maxStay),
    leadDays:rate.leadDays==null?null:Number(rate.leadDays),
    contractPoolCode:String(rate.contractPoolCode||''),
    stopSaleReason:String(rate.stopSaleReason||''),
    governanceNote:String(rate.governanceNote||''),
  };
}

export function governanceRevision(rate:DailyRatesRecordType|any){
  return JSON.stringify(governanceSnapshot(rate));
}

export function dateOnly(value:any){
  if(!value)return '';
  return typeof value==='string'?value.slice(0,10):new Date(value).toISOString().slice(0,10);
}
