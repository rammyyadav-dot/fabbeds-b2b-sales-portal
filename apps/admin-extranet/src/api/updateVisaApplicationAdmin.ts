import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

const transitions:Record<string,string[]>={
  'Draft':['Documents Pending'],
  'Documents Pending':['Under Review','Rejected'],
  'Under Review':['Submitted to Govt','Rejected'],
  'Submitted to Govt':['Approved','Rejected'],
  'Approved':[],
  'Rejected':['Documents Pending'],
};

export default createEndpoint({
    authenticated:true,
description:'Advance visa application workflow and update operational status',
  inputSchema:z.object({
    actingUserId:z.string().min(1),
    applicationId:z.string(),
    applicationStatus:z.enum(['Draft','Documents Pending','Under Review','Submitted to Govt','Approved','Rejected']).optional(),
    paymentStatus:z.enum(['Pending','Paid','Refunded']).optional(),
    stayStatus:z.enum(['Not Entered','In Country','Extension Pending','Extended','Overstay','Departed']).optional(),
    entryDate:z.string().optional().nullable(),visaExpiryDate:z.string().optional().nullable(),notes:z.string().optional(),
  }),
  outputSchema:z.object({success:z.boolean()}),
  execute:async({input,context})=>{
    await requireAdminSessionVerified(context,input.actingUserId,'update visa applications');
    const app=await zite.visaApplications.findOne({id:input.applicationId});
    if(!app) throw new Error('Visa application not found.');
    const record:any={};
    if(input.applicationStatus&&input.applicationStatus!==app.applicationStatus){
      const allowed=transitions[app.applicationStatus||'Draft']||[];
      if(!allowed.includes(input.applicationStatus)) throw new Error('Invalid workflow transition from '+(app.applicationStatus||'Draft')+' to '+input.applicationStatus+'.');
      record.applicationStatus=input.applicationStatus;
      if(input.applicationStatus==='Submitted to Govt'&&!app.submissionDate) record.submissionDate=new Date();
      if(['Approved','Rejected'].includes(input.applicationStatus)) record.completionDate=new Date();
    }
    if(input.paymentStatus) record.paymentStatus=input.paymentStatus;
    if(input.stayStatus) record.stayStatus=input.stayStatus;
    if(input.entryDate!==undefined) record.entryDate=input.entryDate||null;
    if(input.visaExpiryDate!==undefined) record.visaExpiryDate=input.visaExpiryDate||null;
    if(input.notes!==undefined) record.notes=input.notes;
    await zite.visaApplications.update({id:input.applicationId,record});
    return {success:true};
  },
});
