import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';
const allowed:Record<string,string[]>={Submitted:['Allocating','Rejected','Cancelled'],Allocating:['Voucher Pending','Rejected','Cancelled'],'Voucher Pending':['Confirmed','Rejected','Cancelled'],Confirmed:['Cancelled'],Rejected:[],Cancelled:[]};
export default createEndpoint({
   authenticated:true,
description:'Controlled package booking operations workflow',
 inputSchema:z.object({actingUserId:z.string().min(1),bookingId:z.string(),status:z.enum(['Submitted','Allocating','Voucher Pending','Confirmed','Rejected','Cancelled']),assignedOps:z.string().max(120).optional(),vouchers:z.string().max(3000).optional(),notes:z.string().max(2000).optional()}),
 outputSchema:z.object({success:z.boolean()}),
 execute:async({input,context})=>{
  await requireAdminSessionVerified(context,input.actingUserId,'operate package bookings');
  const b=await zite.packageBookings.findOne({id:input.bookingId});if(!b)throw new Error('Package booking not found.');
  const current=b.bookingStatus||'Submitted';
  if(input.status!==current&&!(allowed[current]||[]).includes(input.status))throw new Error('Invalid package status transition from '+current+' to '+input.status+'.');
  const assigned=input.assignedOps??b.assignedOpsUser??'', vouchers=input.vouchers??b.supplierVouchers??'', notes=input.notes??b.internalNotes??'';
  if(['Allocating','Voucher Pending','Confirmed'].includes(input.status)&&!assigned.trim())throw new Error('Assigned operations user is required before allocation.');
  if(input.status==='Confirmed'&&!vouchers.trim())throw new Error('Supplier vouchers / confirmation references are required before final confirmation.');
  if(['Rejected','Cancelled'].includes(input.status)&&!notes.trim())throw new Error(input.status+' requires an internal reason.');
  await zite.packageBookings.update({id:b.id,record:{bookingStatus:input.status,assignedOpsUser:assigned,supplierVouchers:vouchers,internalNotes:notes}});
  return{success:true};
 }
});
