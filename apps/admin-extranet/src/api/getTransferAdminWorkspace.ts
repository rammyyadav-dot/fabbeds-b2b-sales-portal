import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

const linkedId=(v:unknown)=>Array.isArray(v)?String(v[0]||''):String(v||'');
const iso=(v:unknown)=>v?new Date(String(v)).toISOString():'';

export default createEndpoint({
    authenticated:true,
description:'Admin transfer control centre: routes, vehicles, fares, markups and operations',
  inputSchema:z.object({actingUserId:z.string().min(1)}),
  outputSchema:z.object({
    zones:z.array(z.object({id:z.string(),name:z.string(),type:z.string(),emirate:z.string(),description:z.string(),waitingGrace:z.number(),active:z.boolean(),code:z.string(),iataCode:z.string(),districts:z.string(),pickupPoint:z.string(),latitude:z.number().nullable(),longitude:z.number().nullable(),routes:z.number()})),
    vehicles:z.array(z.object({id:z.string(),name:z.string(),models:z.string(),maxPax:z.number(),maxLuggage:z.number(),wheelchair:z.boolean(),tier:z.string(),supplier:z.string(),active:z.boolean()})),
    rateTotals:z.object({all:z.number(),live:z.number(),contracted:z.number(),indicative:z.number()}),
    extras:z.array(z.object({id:z.string(),name:z.string(),code:z.string(),unit:z.string(),netCost:z.number(),sellPrice:z.number(),maxQuantity:z.number(),airportOnly:z.boolean(),description:z.string(),sortOrder:z.number(),active:z.boolean()})),
    rules:z.array(z.object({id:z.string(),name:z.string(),markupType:z.string(),markupValue:z.number(),appliesTo:z.string(),specificRouteId:z.string(),maxCap:z.number(),active:z.boolean(),priority:z.number(),notes:z.string()})),
    bookings:z.array(z.object({
      id:z.string(),reference:z.string(),transferType:z.string(),originId:z.string(),originName:z.string(),destinationId:z.string(),destinationName:z.string(),
      vehicleId:z.string(),vehicleName:z.string(),pickupAddress:z.string(),dropoffAddress:z.string(),pickupDate:z.string(),pickupTime:z.string(),
      flightNumber:z.string(),leadPassenger:z.string(),passengerPhone:z.string(),pax:z.number(),luggage:z.number(),meetAndGreet:z.boolean(),childSeat:z.boolean(),
      totalPrice:z.number(),netCost:z.number(),extrasSummary:z.string(),driverName:z.string(),driverPhone:z.string(),vehiclePlate:z.string(),status:z.string(),notes:z.string(),createdAt:z.string(),
      operationalIssues:z.array(z.string()),urgent:z.boolean(),
    })),
    stats:z.object({
      activeZones:z.number(),activeVehicles:z.number(),activeRates:z.number(),rateIssues:z.number(),today:z.number(),next24h:z.number(),
      confirmed:z.number(),dispatched:z.number(),enRoute:z.number(),completed:z.number(),cancelled:z.number(),noShow:z.number(),unassigned:z.number(),
    }),
  }),
  execute:async({input,context})=>{
    await requireAdminSessionVerified(context,input.actingUserId,'manage transfer operations');
    const [zr,vr,rr,mr,br,er,tot,zc]:any=await Promise.all([
      zite.transferZones.findAll({limit:1000}),
      zite.vehicleCategories.findAll({limit:1000}),
      zite.transferRates.findAll({filters:{active:true},limit:2000}),
      zite.transferMarkupRules.findAll({limit:500}),
      zite.transferBookings.findAll({limit:2000}),
      (zite as any).transferExtras.findAll({limit:200}),
      zite.sql({query:`SELECT COUNT(*) AS "all", COUNT(*) FILTER (WHERE "active") AS live, COUNT(*) FILTER (WHERE "fareStatus"='Contracted') AS contracted, COUNT(*) FILTER (WHERE "fareStatus"='Indicative') AS indicative FROM "TransferRates"`}),
      zite.sql({query:`SELECT z.id, COUNT(l."transferRatesId") AS n FROM "TransferZones" z LEFT JOIN "TransferRatesTransferZones" l ON l."transferZonesId"=z.id GROUP BY z.id`}).catch(()=>({rows:[]}))
    ]);
    const zones=new Map<string,any>(zr.records.map((x:any)=>[x.id,x]));
    const vehicles=new Map<string,any>(vr.records.map((x:any)=>[x.id,x]));
    const now=Date.now();
    const today=new Date(); today.setHours(0,0,0,0);
    const tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const nextDay=new Date(today); nextDay.setDate(nextDay.getDate()+2);

    const rates=rr.records.map(r=>{
      const originId=linkedId(r.originZone),destinationId=linkedId(r.destinationZone),vehicleId=linkedId(r.vehicleCategory);
      const origin=zones.get(originId),destination=zones.get(destinationId),vehicle=vehicles.get(vehicleId);
      const issues:string[]=[];
      if(!originId||!origin) issues.push('Origin zone missing');
      else if(!origin.active) issues.push('Origin zone inactive');
      if(!destinationId||!destination) issues.push('Destination zone missing');
      else if(!destination.active) issues.push('Destination zone inactive');
      if(originId&&destinationId&&originId===destinationId) issues.push('Origin and destination must differ');
      if(!vehicleId||!vehicle) issues.push('Vehicle missing');
      else if(!vehicle.active) issues.push('Vehicle inactive');
      if(Number(r.netCost||0)<=0) issues.push('Net cost must be positive');
      if(Number(r.sellingPrice||0)>0&&Number(r.sellingPrice||0)<Number(r.netCost||0)) issues.push('Stored selling price below net cost');
      return {
        id:r.id,label:r.routeLabel||'',originId,originName:origin?.zoneName||'Unmapped',
        destinationId,destinationName:destination?.zoneName||'Unmapped',vehicleId,vehicleName:vehicle?.categoryName||'Unmapped',
        netCost:Number(r.netCost||0),sellingPrice:Number(r.sellingPrice||0),midnightSurcharge:Number(r.midnightSurcharge||0),
        tollsIncluded:r.tollsIncluded??true,active:!!r.active,margin:Number(r.sellingPrice||0)-Number(r.netCost||0),ready:issues.length===0,readinessIssues:issues,
      };
    });

    const bookings=br.records.map(b=>{
      const originId=linkedId(b.originZone),destinationId=linkedId(b.destinationZone),vehicleId=linkedId(b.vehicleCategory);
      const origin=zones.get(originId),destination=zones.get(destinationId),vehicle=vehicles.get(vehicleId);
      const issues:string[]=[];
      if(!origin||!destination) issues.push('Route mapping incomplete');
      if(!vehicle) issues.push('Vehicle mapping incomplete');
      if(vehicle&&Number(vehicle.maxPassengers||0)<Number(b.paxCount||0)) issues.push('Passenger count exceeds capacity');
      if(vehicle&&Number(vehicle.maxLuggage||0)<Number(b.luggageCount||0)) issues.push('Luggage exceeds capacity');
      if(['Arrival','Departure'].includes(b.transferType||'')&&!b.flightNumber) issues.push('Flight number required');
      if(['Dispatched','En Route'].includes(b.bookingStatus||'')&&(!b.driverName||!b.driverPhone||!b.vehiclePlate)) issues.push('Driver assignment incomplete');
      const dt=b.pickupDate?new Date(String(b.pickupDate).slice(0,10)+'T'+(b.pickupTime||'00:00')+':00').getTime():0;
      const urgent=dt>now&&dt<=now+24*60*60*1000&&!['Completed','Cancelled','No Show'].includes(b.bookingStatus||'');
      return {
        id:b.id,reference:b.bookingReference||'',transferType:b.transferType||'',originId,originName:origin?.zoneName||'Unmapped',
        destinationId,destinationName:destination?.zoneName||'Unmapped',vehicleId,vehicleName:vehicle?.categoryName||'Unmapped',
        pickupAddress:b.pickupAddress||'',dropoffAddress:b.dropoffAddress||'',pickupDate:b.pickupDate||'',pickupTime:b.pickupTime||'',
        flightNumber:b.flightNumber||'',leadPassenger:b.leadPassengerName||'',passengerPhone:b.passengerPhone||'',
        pax:Number(b.paxCount||0),luggage:Number(b.luggageCount||0),meetAndGreet:!!b.meetAndGreet,childSeat:!!b.childSeat,
        totalPrice:Number(b.totalPrice||0),netCost:Number((b as any).netCostTotal||0),extrasSummary:String((b as any).extrasSummary||''),driverName:b.driverName||'',driverPhone:b.driverPhone||'',vehiclePlate:b.vehiclePlate||'',
        status:b.bookingStatus||'Confirmed',notes:b.specialNotes||'',createdAt:iso(b.createdAt),operationalIssues:issues,urgent,
      };
    }).sort((a,b)=>{
      const ad=a.pickupDate+' '+a.pickupTime,bd=b.pickupDate+' '+b.pickupTime;
      return ad.localeCompare(bd);
    });

    return {
      zones:zr.records.map((z:any)=>({id:z.id,name:z.zoneName||'',type:z.zoneType||'',emirate:z.emirate||'',description:z.description||'',waitingGrace:Number(z.waitingGraceMinutes||0),active:!!z.active,code:z.zoneCode||'',iataCode:z.iataCode||'',districts:z.districtsCovered||'',pickupPoint:z.pickupPoint||'',latitude:z.latitude??null,longitude:z.longitude??null,routes:Number((zc.rows.find((x:any)=>x.id===z.id)||{}).n||0)})).sort((a:any,b:any)=>a.emirate.localeCompare(b.emirate)||a.type.localeCompare(b.type)||a.name.localeCompare(b.name)),
      vehicles:vr.records.map(v=>({id:v.id,name:v.categoryName||'',models:v.exampleModels||'',maxPax:Number(v.maxPassengers||0),maxLuggage:Number(v.maxLuggage||0),wheelchair:!!v.wheelchairAccessible,tier:v.tier||'Standard',supplier:v.supplierName||'',active:!!v.active})),
      rateTotals:{all:Number(tot.rows[0]?.all||0),live:Number(tot.rows[0]?.live||0),contracted:Number(tot.rows[0]?.contracted||0),indicative:Number(tot.rows[0]?.indicative||0)},
      extras:er.records.map((x:any)=>({id:x.id,name:x.extraName||'',code:x.extraCode||'',unit:x.pricingUnit||'Per booking',netCost:Number(x.netCost||0),sellPrice:Number(x.sellPrice||0),maxQuantity:Number(x.maxQuantity||1),airportOnly:!!x.airportOnly,description:x.description||'',sortOrder:Number(x.sortOrder||0),active:!!x.active})).sort((a:any,b:any)=>a.sortOrder-b.sortOrder),
      rules:mr.records.map(m=>({id:m.id,name:m.ruleName||'',markupType:m.markupType||'',markupValue:Number(m.markupValue||0),appliesTo:m.appliesTo||'',specificRouteId:linkedId(m.specificRoute),maxCap:Number(m.maxMarkupCap||0),active:!!m.isActive,priority:Number(m.priority||0),notes:m.notes||''})),
      bookings,
      stats:{
        activeZones:zr.records.filter(x=>x.active).length,activeVehicles:vr.records.filter(x=>x.active).length,
        activeRates:rates.filter(x=>x.active).length,rateIssues:rates.filter(x=>x.active&&!x.ready).length,
        today:bookings.filter(x=>{const d=new Date(x.pickupDate);return d>=today&&d<tomorrow;}).length,
        next24h:bookings.filter(x=>x.urgent).length,
        confirmed:bookings.filter(x=>x.status==='Confirmed').length,dispatched:bookings.filter(x=>x.status==='Dispatched').length,
        enRoute:bookings.filter(x=>x.status==='En Route').length,completed:bookings.filter(x=>x.status==='Completed').length,
        cancelled:bookings.filter(x=>x.status==='Cancelled').length,noShow:bookings.filter(x=>x.status==='No Show').length,
        unassigned:bookings.filter(x=>['Confirmed','Dispatched'].includes(x.status)&&(!x.driverName||!x.driverPhone||!x.vehiclePlate)).length,
      },
    };
  },
});
