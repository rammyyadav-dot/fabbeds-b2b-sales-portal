import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
    authenticated:true,
description:'Create or update transfer zones',
  inputSchema:z.object({
    actingUserId:z.string().min(1),id:z.string().optional(),name:z.string().trim().min(2).max(120),
    type:z.enum(['Airport','Port','Hotel','Area Zone','Intercity']),emirate:z.enum(['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain']),
    description:z.string().trim().max(1000).optional(),waitingGrace:z.number().int().min(0).max(240),active:z.boolean(),
    code:z.string().trim().max(20).optional(),iataCode:z.string().trim().max(3).optional(),districts:z.string().trim().max(1000).optional(),
    pickupPoint:z.string().trim().max(200).optional(),latitude:z.number().min(22).max(27).optional().nullable(),longitude:z.number().min(51).max(57).optional().nullable(),
  }),
  outputSchema:z.object({id:z.string()}),
  execute:async({input,context})=>{
    await requireAdminSessionVerified(context,input.actingUserId,'manage transfer zones');
    if(input.type==='Airport'&&input.waitingGrace<15) throw new Error('Airport zones require at least 15 minutes waiting grace.');
    if(input.type==='Airport'&&!/^[A-Z]{3}$/.test((input.iataCode||'').toUpperCase())) throw new Error('Airport zones require a 3-letter IATA code.');
    if(input.code){const dup=(await zite.transferZones.findAll({filters:{zoneCode:input.code} as any,limit:5})).records.find((r:any)=>r.id!==input.id);if(dup) throw new Error(`Zone code ${input.code} is already used by ${dup.zoneName}.`);}
    const record:any={zoneName:input.name,zoneType:input.type,emirate:input.emirate,description:input.description||'',waitingGraceMinutes:input.waitingGrace,active:input.active,
      zoneCode:input.code||'',iataCode:(input.iataCode||'').toUpperCase(),districtsCovered:input.districts||'',pickupPoint:input.pickupPoint||'',latitude:input.latitude??null,longitude:input.longitude??null};
    if(input.id){await zite.transferZones.update({id:input.id,record});return{id:input.id};}
    const created=await zite.transferZones.create({record});return{id:created.id};
  },
});
