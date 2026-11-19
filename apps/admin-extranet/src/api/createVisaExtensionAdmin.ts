import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
    authenticated:true,
description:'Create a visa extension request and place the application into extension-pending status',
  inputSchema:z.object({
    actingUserId:z.string().min(1),
    applicationId:z.string(),extensionType:z.enum(['Status Change','Visa Renewal','Grace Period','Overstay Regularization']),
    newExpiryDate:z.string().optional(),additionalDays:z.number().int().min(0),extensionFee:z.number().min(0),overstayFine:z.number().min(0),
    reason:z.string().min(2),notes:z.string().optional(),
  }),
  outputSchema:z.object({id:z.string()}),
  execute:async({input,context})=>{
    await requireAdminSessionVerified(context,input.actingUserId,'create visa extensions');
    const app=await zite.visaApplications.findOne({id:input.applicationId});
    if(!app) throw new Error('Visa application not found.');
    if(app.applicationStatus!=='Approved') throw new Error('Only approved visas can be extended.');
    const ext=await zite.visaExtensions.create({record:{
      visaApplication:app.id,extensionType:input.extensionType,extensionStatus:'Submitted',
      newExpiryDate:input.newExpiryDate||null,additionalDays:input.additionalDays,extensionFee:input.extensionFee,
      overstayFine:input.overstayFine,reason:input.reason,notes:input.notes||'',submittedAt:new Date(),
    }});
    await zite.visaApplications.update({id:app.id,record:{stayStatus:'Extension Pending'}});
    return {id:ext.id};
  },
});
