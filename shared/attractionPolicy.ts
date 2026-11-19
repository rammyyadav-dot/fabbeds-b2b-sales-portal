const id=(v:unknown)=>Array.isArray(v)?String(v[0]||''):String(v||'');
export function isAttractionBlackout(date:string,attractionId:string,ticketId:string,rows:any[]){
 return rows.some(r=>r.status==='Active'&&id(r.attraction)===attractionId&&(!id(r.ticketProduct)||id(r.ticketProduct)===ticketId)&&String(r.startDate||'').slice(0,10)<=date&&String(r.endDate||'').slice(0,10)>=date);
}

export function effectiveAttractionRateRows(rows:any[]){
 const ranks:Record<string,number>={OVERRIDE:4,PROMO:3,BASE:2,FALLBACK:1};
 const effective=new Map<string,any>();
 const sorted=[...rows].sort((a,b)=>(ranks[b.rateLayer||'BASE']||0)-(ranks[a.rateLayer||'BASE']||0)||Number(b.priority||0)-Number(a.priority||0)||Number(b.rateId||0)-Number(a.rateId||0)||String(b.id).localeCompare(String(a.id)));
 for(const row of sorted){
 const key=[id(row.ticketOption||row.ticketOptionId),id(row.ratePlan||row.ratePlanId)||'LEGACY',String(row.date).slice(0,10),row.slotTime||''].join('|');
 if(!effective.has(key))effective.set(key,row);
 }
 return [...effective.values()];
}

export function attractionRateRevision(row:any){
 return JSON.stringify([row.id,String(row.date||'').slice(0,10),Number(row.netCostAdult||0),Number(row.netCostChild||0),Number(row.retailAdult||0),Number(row.retailChild||0),Number(row.totalCapacity||0),Number(row.soldCount||0),row.inventoryStatus||'Available',!!row.stopSale,Number(row.bookingCutoffHours||0),row.rateLayer||'BASE',Number(row.priority||0)]);
}
export function applyAttractionAvailability(row:any,policy:any){
 if(!policy)return row;
 const r={...row};
 if(policy.status==='Stop Sale')r.stopSale=true;
 if(policy.status==='Free Sale'){r.stopSale=false;r.inventoryStatus='Available';}
 if(policy.status==='On Request'){r.stopSale=false;r.inventoryStatus='On Request';}
 if(policy.status==='Limited'){r.stopSale=false;r.inventoryStatus='Available';r.totalCapacity=Number(policy.allocation||0);}
 return r;
}
export function attractionAvailabilityRevision(row:any){
 return row?JSON.stringify([row.id,String(row.date).slice(0,10),row.status,row.allocation==null?null:Number(row.allocation)]):'';
}
