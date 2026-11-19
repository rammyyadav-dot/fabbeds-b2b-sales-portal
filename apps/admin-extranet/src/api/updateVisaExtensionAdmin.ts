import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
    authenticated:true,
description:'Review and resolve a visa extension request',
  inputSchema:z.object({
    actingUserId:z.string().min(1),
    extensionId:z.string(),extensionStatus:z.enum(['Submitted','Under Review','Approved','Rejected']),
    newExpiryDate:z.string().optional(),notes:z.string().optional(),
  }),
  outputSchema:z.object({success:z.boolean()}),
  execute:async({input,context})=>{
    await requireAdminSessionVerified(context,input.actingUserId,'review visa extensions');
    const ext=await zite.visaExtensions.findOne({id:input.extensionId});
    if(!ext) throw new Error('Visa extension not found.');
    const appId=Array.isArray(ext.visaApplication)?String(ext.visaApplication[0]||''):String(ext.visaApplication||'');
    await zite.visaExtensions.update({id:ext.id,record:{
      extensionStatus:input.extensionStatus,newExpiryDate:input.newExpiryDate||ext.newExpiryDate||null,
      notes:input.notes??ext.notes??'',
    }});
    if(appId&&input.extensionStatus==='Approved'){
      await zite.visaApplications.update({id:appId,record:{
        stayStatus:'Extended',visaExpiryDate:input.newExpiryDate||ext.newExpiryDate||null,
      }});
    } else if(appId&&input.extensionStatus==='Rejected'){
      await zite.visaApplications.update({id:appId,record:{stayStatus:'In Country'}});
    }
    return {success:true};
  },
});
