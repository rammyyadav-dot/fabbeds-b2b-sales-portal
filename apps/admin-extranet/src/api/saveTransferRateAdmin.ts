import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
   authenticated:true,
description:'Create or update an authoritative transfer route fare',
 inputSchema:z.object({
  actingUserId:z.string().min(1),id:z.string().optional(),label:z.string().trim().min(3).max(180),originId:z.string(),destinationId:z.string(),vehicleId:z.string(),
  netCost:z.number().positive(),sellingPrice:z.number().min(0),midnightSurcharge:z.number().min(0),tollsIncluded:z.boolean(),active:z.boolean(),
  fareStatus:z.enum(['Indicative','Contracted']).default('Contracted'),distanceKm:z.number().min(0).max(1000).optional(),durationMinutes:z.number().int().min(0).max(900).optional(),routeCode:z.string().max(60).optional(),
 }),
 outputSchema:z.object({id:z.string()}),
 execute:async({input,context})=>{
  await requireAdminSessionVerified(context,input.actingUserId,'manage transfer rates');
  if(input.originId===input.destinationId) throw new Error('Origin and destination must be different zones.');
  const [origin,destination,vehicle]=await Promise.all([zite.transferZones.findOne({id:input.originId}),zite.transferZones.findOne({id:input.destinationId}),zite.vehicleCategories.findOne({id:input.vehicleId})]);
  if(!origin||!destination||!vehicle) throw new Error('Route must reference valid origin, destination and vehicle records.');
  if(input.active&&(!origin.active||!destination.active||!vehicle.active)) throw new Error('Active fares require active origin, destination and vehicle records.');
  if(input.sellingPrice>0&&input.sellingPrice<input.netCost) throw new Error('Stored selling price cannot be lower than net cost.');
  if(input.active&&input.fareStatus!=='Contracted') throw new Error('Only Contracted fares can be live. Mark the fare as Contracted first.');
  const record:any={routeLabel:input.label,originZone:input.originId,destinationZone:input.destinationId,vehicleCategory:input.vehicleId,netCost:input.netCost,sellingPrice:input.sellingPrice,midnightSurcharge:input.midnightSurcharge,tollsIncluded:input.tollsIncluded,active:input.active,
    fareStatus:input.fareStatus,distanceKm:input.distanceKm??null,durationMinutes:input.durationMinutes??null,routeCode:input.routeCode||`${(origin as any).zoneCode||origin.id.slice(0,6)}>${(destination as any).zoneCode||destination.id.slice(0,6)}:${String(vehicle.categoryName||'').slice(0,3).toUpperCase()}`};
  if(input.id){await zite.transferRates.update({id:input.id,record});return{id:input.id};}
  const created=await zite.transferRates.create({record});return{id:created.id};
 },
});
