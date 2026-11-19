import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import {requireAdmin} from '../lib/requireAdmin';

export default createEndpoint({
  authenticated:true,
  description:'Creates or updates an attraction commercial package and links ticket SKUs',
  inputSchema:z.object({
    id:z.string().optional(),
    attractionId:z.string(),
    name:z.string().min(2),
    ticketOptionIds:z.array(z.string()).min(1),
    description:z.string().optional(),
    badge:z.string().optional(),
    sortOrder:z.number().int().min(0).max(999).default(0),
    status:z.enum(['Active','Inactive']),
  }),
  outputSchema:z.object({id:z.string(),success:z.boolean()}),
  execute:async({input,context})=>{
    await requireAdmin(context,'manage attractions');
    const attraction=await zite.attractions.findOne({id:input.attractionId}) as any;
    if(!attraction) throw new ZiteError({code:'NOT_FOUND',message:'Attraction not found.'});

    const tickets=await zite.ticketOptions.findAll({filters:{id:{in:input.ticketOptionIds}},limit:100});
    if(tickets.records.length!==input.ticketOptionIds.length){
      throw new ZiteError({code:'BAD_REQUEST',message:'One or more selected ticket SKUs do not exist.'});
    }
    const wrong=(tickets.records as any[]).find(t=>{
      const aid=Array.isArray(t.attraction)?String(t.attraction[0]||''):String(t.attraction||'');
      return aid!==input.attractionId;
    });
    if(wrong) throw new ZiteError({code:'BAD_REQUEST',message:'All package SKUs must belong to the selected attraction.'});

    const record:any={
      packageName:input.name,
      attraction:input.attractionId,
      ticketOptions:input.ticketOptionIds,
      description:input.description||'',
      badge:input.badge||'',
      sortOrder:input.sortOrder,
      status:input.status,
    };
    if(input.id){
      await zite.attractionPackages.update({id:input.id,record});
      return{id:input.id,success:true};
    }
    const created=await zite.attractionPackages.create({record});
    return{id:created.id,success:true};
  },
});
