import {zite} from 'zitejs/db';
import {ZiteError} from 'zitejs/backend';
import {allAttractionRecords} from './allAttractionRecords';
import {linkedId,validatePrices} from './attractionCommercialRules';
import {attractionRateRevision} from '../../../../shared/attractionPolicy';
export async function prepareCalendarEdit(attractionId:string,ticketId:string,planId:string|undefined,edit:any){
 const row=await zite.attractionRates.findOne({id:edit.rateId}) as any;
 if(!row||linkedId(row.ticketOption)!==ticketId||(planId&&linkedId(row.ratePlan)!==planId))throw new ZiteError({code:'BAD_REQUEST',message:'Rate row does not belong to this ticket / plan.'});
 if(edit.revision!==attractionRateRevision(row))throw new ZiteError({code:'CONFLICT',message:'This row changed. Refresh and retry your edit.'});
 const pid=linkedId(row.ratePeriod);
 if(pid){const p=await zite.attractionRatePeriods.findOne({id:pid});if(p?.status!=='Published')throw new ZiteError({code:'CONFLICT',message:'Only published daily rows can be edited.'});}
 const money=(n:number)=>Math.round(n*100)/100;
 const adult=edit.adult??Number(row.netCostAdult||0),child=edit.child??Number(row.netCostChild||0);
 const retailAdult=edit.retailAdult??(edit.adult!==undefined?(adult>0?money(adult+Math.max(0,Number(row.retailAdult||0)-Number(row.netCostAdult||0))):0):Number(row.retailAdult||0));
 const retailChild=edit.retailChild??(edit.child!==undefined?(child>0?money(child+Math.max(0,Number(row.retailChild||0)-Number(row.netCostChild||0))):0):Number(row.retailChild||0));
 try{validatePrices(adult,child,retailAdult,retailChild);}catch(e:any){throw new ZiteError({code:'BAD_REQUEST',message:e.message});}
 const allocation=edit.allocation??Number(row.totalCapacity||0);
 const holds=await allAttractionRecords(zite.attractionInventoryHolds,{filters:{attractionRate:row.id}});
 const held=holds.records.filter(h=>h.status==='ACTIVE'&&new Date(h.expiresAt||0).getTime()>Date.now()).reduce((sum,h)=>sum+Number(h.heldPax||0),0);
 if(allocation<Number(row.soldCount||0)+held)throw new ZiteError({code:'CONFLICT',message:'Allocation cannot be below sold + active holds.'});
 if(allocation===0&&row.inventoryStatus==='Available'&&!row.stopSale)throw new ZiteError({code:'BAD_REQUEST',message:'Free Sale requires positive allocation. Paint On Request for unallocated requests.'});
 const record={netCostAdult:money(adult),netCostChild:money(child),retailAdult:money(retailAdult),retailChild:money(retailChild),totalCapacity:allocation,bookingCutoffHours:edit.cutoffHours??Number(row.bookingCutoffHours||0)};
 return{row,record};
}
export async function applyCalendarEdit(prepared:any,actorEmail:string){
 const current=await zite.attractionRates.findOne({id:prepared.row.id}) as any;
 if(!current||attractionRateRevision(current)!==attractionRateRevision(prepared.row))throw new ZiteError({code:'CONFLICT',message:'Rate changed during save. Refresh and retry.'});
 await zite.attractionRates.update({id:current.id,record:prepared.record});
 await zite.attractionRateAuditEvents.create({record:{eventLabel:'Calendar edit '+String(current.date).slice(0,10),ticketOption:linkedId(current.ticketOption),rateRow:current.id,action:'CALENDAR EDIT',effectiveDate:String(current.date).slice(0,10),timeSlot:current.slotTime||'',beforeSnapshot:JSON.stringify(current),afterSnapshot:JSON.stringify(prepared.record),reason:'Calendar autosave / bulk change · '+actorEmail} as any});
 const after={...current,...prepared.record};
 return{id:after.id,revision:attractionRateRevision(after),adult:after.netCostAdult,child:after.netCostChild,retailAdult:after.retailAdult,retailChild:after.retailChild,allocation:after.totalCapacity,cutoffHours:after.bookingCutoffHours};
}
export async function calendarTicket(attractionId:string,ticketId:string){
 const ticket=await zite.ticketOptions.findOne({id:ticketId});
 if(!ticket||linkedId(ticket.attraction)!==attractionId)throw new ZiteError({code:'BAD_REQUEST',message:'Select a ticket product for this attraction.'});
 return ticket;
}
