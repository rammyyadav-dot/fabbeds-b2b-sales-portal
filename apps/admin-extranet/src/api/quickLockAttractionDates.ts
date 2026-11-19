import {z} from 'zod';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {zite} from 'zitejs/db';
import {requireAdmin} from '../lib/requireAdmin';
import {allAttractionRecords} from '../lib/allAttractionRecords';
import {linkedId,periodDates} from '../lib/attractionCommercialRules';

export default createEndpoint({
  authenticated:true,
  description:'Locks attraction SKU dates at availability-policy level without changing contracted rates, allocation, sold or held quantities',
  inputSchema:z.object({
    attractionId:z.string(),ticketId:z.string(),start:z.string(),end:z.string(),
    weekdays:z.array(z.number().int().min(0).max(6)).min(1)
  }),
  outputSchema:z.object({locked:z.number()}),
  execute:async({input,context})=>{
    const actor=await requireAdmin(context,'lock attraction dates');
    const ticket=await zite.ticketOptions.findOne({id:input.ticketId});
    if(!ticket||linkedId(ticket.attraction)!==input.attractionId)throw new ZiteError({code:'BAD_REQUEST',message:'SKU product does not belong to the selected attraction.'});
    let dates:string[]=[];
    try{dates=periodDates(input.start,input.end,input.weekdays);}catch(e:any){throw new ZiteError({code:'BAD_REQUEST',message:e.message});}
    const today=new Date().toISOString().slice(0,10);
    if(dates.some(d=>d<today))throw new ZiteError({code:'BAD_REQUEST',message:'Back-dated Quick Updates are not allowed.'});
    const existing=await allAttractionRecords(zite.attractionAvailability,{filters:{ticketProduct:input.ticketId,date:{gte:input.start,lte:input.end}},limit:2000});
    for(const date of dates){
      const before=(existing.records as any[]).find(p=>String(p.date).slice(0,10)===date);
      const record:any={availabilityKey:input.ticketId+'|'+date,ticketProduct:input.ticketId,date,status:'Stop Sale',allocation:null};
      if(before)await zite.attractionAvailability.update({id:before.id,record}); else await zite.attractionAvailability.create({record});
      await zite.attractionRateAuditEvents.create({record:{eventLabel:'Quick lock '+date,ticketOption:input.ticketId,action:'QUICK LOCK',effectiveDate:date,beforeSnapshot:before?JSON.stringify(before):'',afterSnapshot:JSON.stringify(record),reason:'Attraction Quick Update · '+actor.email} as any});
    }
    return{locked:dates.length};
  }
});
