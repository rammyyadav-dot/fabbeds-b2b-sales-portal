import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
    authenticated:true,
description:'Verify or reject applicant documents and update visa identifiers',
  inputSchema:z.object({
    actingUserId:z.string().min(1),
    dossierId:z.string(),documentStatus:z.enum(['Pending Upload','Uploaded','Under Review','Verified','Rejected']).optional(),
    applicantStatus:z.enum(['Pending','Processing','Approved','Rejected']).optional(),uidNumber:z.string().optional(),
    visaNumber:z.string().optional(),rejectionReason:z.string().optional(),
  }),
  outputSchema:z.object({success:z.boolean()}),
  execute:async({input,context})=>{
    await requireAdminSessionVerified(context,input.actingUserId,'review visa applicant dossiers');
    const dossier=await zite.applicantDossiers.findOne({id:input.dossierId});
    if(!dossier) throw new Error('Applicant dossier not found.');
    if(input.documentStatus==='Rejected'&&!input.rejectionReason?.trim()) throw new Error('Rejection reason is required.');
    const record:any={};
    if(input.documentStatus) record.documentStatus=input.documentStatus;
    if(input.applicantStatus) record.applicantStatus=input.applicantStatus;
    if(input.uidNumber!==undefined) record.uidNumber=input.uidNumber;
    if(input.visaNumber!==undefined) record.visaNumber=input.visaNumber;
    if(input.rejectionReason!==undefined) record.rejectionReason=input.rejectionReason;
    await zite.applicantDossiers.update({id:input.dossierId,record});
    return {success:true};
  },
});
