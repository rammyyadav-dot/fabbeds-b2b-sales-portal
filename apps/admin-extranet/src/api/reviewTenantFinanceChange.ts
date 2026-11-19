import {canOverrideFinanceReview} from '../lib/financeOwnerOverride';
import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireFinance} from '../lib/requireFinance';
import {policySnapshot,tenantExposure,validateCredit} from '../lib/tenantFinance';
export default createEndpoint({
 authenticated:true,description:'Review tenant finance requests with separation of duties and stale-policy checks',
 inputSchema:z.object({tenantId:z.string(),requestId:z.string(),decision:z.enum(['Approve','Reject']),notes:z.string().trim().min(10).max(2000),ownerOverride:z.boolean().default(false)}),
 outputSchema:z.object({status:z.string()}),
 execute:async({input,context})=>{
 const actor=await requireFinance(context);const email=String(actor?.email).toLowerCase();
 const r=await zite.tenantFinanceRequests.findOne({id:input.requestId});
 if(!r||r.tenantAccountId!==input.tenantId)throw new ZiteError({code:'NOT_FOUND',message:'Request not found for this tenant'});
 if(r.requestStatus!=='Pending')throw new ZiteError({code:'CONFLICT',message:'Request has already been reviewed'});
 const selfReview=String(r.requestedBy).toLowerCase()===email;
 const override=input.ownerOverride&&canOverrideFinanceReview(actor);
 if(input.ownerOverride&&!override)throw new ZiteError({code:'FORBIDDEN',message:'Owner override is restricted to Ram Kumar’s verified active Admin account'});
 if(selfReview&&!override)throw new ZiteError({code:'FORBIDDEN',message:'A separate finance user must review this request'});
 const a=await zite.partnerAccounts.findOne({id:input.tenantId});if(!a)throw new ZiteError({code:'NOT_FOUND',message:'Tenant not found'});
 if(input.decision==='Approve'){
 if(!['Credit Policy','Account Status','Wallet Deposit'].includes(r.requestType??''))throw new ZiteError({code:'BAD_REQUEST',message:'Unsupported request'});
 if(r.requestType==='Credit Policy'||r.requestType==='Account Status'){
 if(policySnapshot(a)!==r.policySnapshot)throw new ZiteError({code:'CONFLICT',message:'Account policy changed; reject and submit a fresh request'});
 if(r.requestType==='Credit Policy'){
 validateCredit(Number(r.amountMinor),String(r.creditStatus),Number(r.creditTermsDays),await tenantExposure(a.id));
 if(r.creditStatus==='Approved'&&a.accountStatus!=='Active')throw new ZiteError({code:'BAD_REQUEST',message:'Suspended tenant cannot receive approved credit'});
 await zite.partnerAccounts.update({id:a.id,record:{creditLimitAed:Number(r.amountMinor)/100,creditStatus:r.creditStatus,creditTermsDays:r.creditTermsDays}});
 }else{
 if(!['Active','Suspended'].includes(r.accountStatus??''))throw new ZiteError({code:'BAD_REQUEST',message:'Invalid account status'});
 await zite.partnerAccounts.update({id:a.id,record:{accountStatus:r.accountStatus}});
 }
 }else{
 if(a.accountStatus!=='Active'||!r.evidenceUrl?.startsWith('https://')||!r.externalReference||!Number.isSafeInteger(r.amountMinor)||(r.amountMinor??0)<=0)throw new ZiteError({code:'BAD_REQUEST',message:'Deposit evidence or account is invalid'});
 const dup=await zite.sql({query:'SELECT id FROM "TenantFinanceRequests" WHERE "externalReference"=$1 AND "requestType"=$2 AND "requestStatus"=$3 AND id<>$4 LIMIT 1',params:[r.externalReference,'Wallet Deposit','Approved',r.id]});
 if(dup.rows.length)throw new ZiteError({code:'CONFLICT',message:'Bank reference is already approved'});
 }
 }
 const status=input.decision==='Approve'?'Approved':'Rejected';
 await zite.tenantFinanceRequests.update({id:r.id,record:{requestStatus:status,reviewedBy:email,reviewNotes:override?'[RAM KUMAR ADMIN OVERRIDE] '+input.notes:input.notes,reviewedAt:new Date().toISOString()}});
 return {status};
 }
});