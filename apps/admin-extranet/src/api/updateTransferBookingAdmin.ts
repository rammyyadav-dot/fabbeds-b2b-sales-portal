import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

const allowed:Record<string,string[]>={
 'Confirmed':['Dispatched','Cancelled'],
 'Dispatched':['En Route','Cancelled'],
 'En Route':['Completed','No Show'],
 'Completed':[],
 'No Show':[],
 'Cancelled':[],
};

export default createEndpoint({
   authenticated:true,
description:'Apply controlled transfer operations workflow updates',
 inputSchema:z.object({
  actingUserId:z.string().min(1),bookingId:z.string(),status:z.enum(['Confirmed','Dispatched','En Route','Completed','No Show','Cancelled']).optional(),
  driverName:z.string().trim().max(120).optional(),driverPhone:z.string().trim().max(40).optional(),vehiclePlate:z.string().trim().max(50).optional(),
  flightNumber:z.string().trim().max(30).optional(),pickupTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),notes:z.string().trim().max(1200).optional(),
 }),
 outputSchema:z.object({success:z.boolean()}),
 execute:async({input,context})=>{
  await requireAdminSessionVerified(context,input.actingUserId,'operate transfer bookings');
  const booking=await zite.transferBookings.findOne({id:input.bookingId});
  if(!booking) throw new Error('Transfer booking not found.');
  const vehicleId=Array.isArray(booking.vehicleCategory)?booking.vehicleCategory[0]:booking.vehicleCategory;
  const vehicle=vehicleId?await zite.vehicleCategories.findOne({id:String(vehicleId)}):null;
  if(!vehicle) throw new Error('Booking vehicle category is unmapped.');
  if(Number(vehicle.maxPassengers||0)<Number(booking.paxCount||0)) throw new Error('Passenger count exceeds booked vehicle capacity.');
  if(Number(vehicle.maxLuggage||0)<Number(booking.luggageCount||0)) throw new Error('Luggage count exceeds booked vehicle capacity.');

  const next=input.status;
  const current=booking.bookingStatus||'Confirmed';
  if(next&&next!==current){
    if(!(allowed[current]||[]).includes(next)) throw new Error('Invalid transfer status transition from '+current+' to '+next+'.');
  }
  const driverName=input.driverName??booking.driverName??'';
  const driverPhone=input.driverPhone??booking.driverPhone??'';
  const vehiclePlate=input.vehiclePlate??booking.vehiclePlate??'';
  const flightNumber=input.flightNumber??booking.flightNumber??'';
  const notes=input.notes??booking.specialNotes??'';
  const target=next||current;

  if(['Arrival','Departure'].includes(booking.transferType||'')&&!flightNumber.trim()) throw new Error('Flight number is mandatory for airport arrival/departure transfers.');
  if(['Dispatched','En Route','Completed'].includes(target)&&(!driverName.trim()||!driverPhone.trim()||!vehiclePlate.trim())) throw new Error('Driver name, driver phone and vehicle plate are required before dispatch.');
  if(target==='No Show'&&!notes.trim()) throw new Error('No-show requires an operational note.');
  if(target==='Cancelled'&&!notes.trim()) throw new Error('Cancellation requires a reason in operational notes.');
  if(target==='Completed'&&current!=='En Route') throw new Error('A transfer must be En Route before it can be completed.');

  await zite.transferBookings.update({id:booking.id,record:{
    bookingStatus:target,driverName,driverPhone,vehiclePlate,flightNumber,pickupTime:input.pickupTime??booking.pickupTime??'',specialNotes:notes,
    // Shared credit ledger: a cancelled transfer frees the agency's credit; No Show stays billable.
    ...(target==='Cancelled'&&(booking as any).creditSettlementStatus!=='Settled'?{creditSettlementStatus:'Released'}:{}),
  } as any});
  return{success:true};
 },
});
