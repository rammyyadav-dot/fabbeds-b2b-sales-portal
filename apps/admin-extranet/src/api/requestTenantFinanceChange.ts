import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireFinance} from '../lib/requireFinance';
import {policySnapshot,tenantExposure,validateCredit} from '../lib/tenantFinance';
export default createEndpoint({
 authenticated:true, description:'Submit tenant credit policy, account status or verified deposit request for independent review',
 inputSchema:z.object({tenantId:z.string(),type:z.enum(['Credit Policy','Wallet Deposit','Account Status']),amountMinor:z.number().int().min(0).max(100000000000),creditStatus:z.enum(['Pending Review','Approved','On Hold','Disabled']).default('Pending Review'),termsDays:z.number().int().min(0).max(365).default(0),accountStatus:z.enum(['Active','Suspended']).default('Active'),reference:z.string().trim().max(100).default(''),evidenceUrl:z.string().url().max(2000).optional(),reason:z.string().trim().min(10).max(2000)}),
 outputSchema:z.object({id:z.string(),reference:z.string()}),
 execute:async({input,context})=>{
 const actor=await requireFinance(context);const account=await zite.partnerAccounts.findOne({id:input.tenantId});if(!account)throw new ZiteError({code:'NOT_FOUND',message:'Tenant not found'});
 if(input.type==='Credit Policy')validateCredit(input.amountMinor,input.creditStatus,input.termsDays,await tenantExposure(account.id));
 if(input.type==='Wallet Deposit'){
 if(account.accountStatus!=='Active'||input.amountMinor<=0||!input.reference||!input.evidenceUrl)throw new ZiteError({code:'BAD_REQUEST',message:'Deposit requires active tenant, positive AED amount, unique bank reference and HTTPS evidence'});
 if(!input.evidenceUrl.startsWith('https://'))throw new ZiteError({code:'BAD_REQUEST',message:'Evidence must use HTTPS'});
 const dup=await zite.sql({query:'SELECT id FROM "TenantFinanceRequests" WHERE "externalReference"=$1 AND "requestType"=$2 AND "requestStatus"<>$3 LIMIT 1',params:[input.reference,'Wallet Deposit','Rejected']});
 if(dup.rows.length)throw new ZiteError({code:'CONFLICT',message:'This bank reference already has a deposit request'});
 }
 const reference='FIN-'+crypto.randomUUID();
 const r=await zite.tenantFinanceRequests.create({record:{requestReference:reference,tenantAccountId:account.id,requestType:input.type,requestStatus:'Pending',amountMinor:input.amountMinor,creditStatus:input.creditStatus,creditTermsDays:input.termsDays,accountStatus:input.accountStatus,externalReference:input.reference,evidenceUrl:input.evidenceUrl,reason:input.reason,requestedBy:String(actor?.email).toLowerCase(),policySnapshot:policySnapshot(account)}});
 return {id:r.id,reference};
 }
});