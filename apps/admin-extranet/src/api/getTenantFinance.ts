import {canOverrideFinanceReview} from '../lib/financeOwnerOverride';
import {z} from 'zod';
import {zite} from 'zitejs/db';
import {createEndpoint,ZiteError} from 'zitejs/backend';
import {requireFinance} from '../lib/requireFinance';
import {tenantExposure} from '../lib/tenantFinance';
export default createEndpoint({
 authenticated:true, description:'Tenant credit accounts and wallet request ledger; finance staff only',
 inputSchema:z.object({tenantId:z.string().optional(),search:z.string().max(100).default(''),page:z.number().int().min(0).default(0),requestPage:z.number().int().min(0).default(0)}),
 outputSchema:z.object({actor:z.string(),canOverrideReview:z.boolean(),accounts:z.array(z.record(z.string(),z.unknown())),total:z.number(),requests:z.array(z.record(z.string(),z.unknown())),requestTotal:z.number(),detail:z.record(z.string(),z.unknown()).nullable()}),
 execute:async({input,context})=>{
 const actor=await requireFinance(context);const term='%'+input.search+'%';
 const where=' FROM "PartnerAccounts" WHERE COALESCE("agencyName",\'\') ILIKE $1 OR COALESCE("agencyEmail",\'\') ILIKE $1';
 const count=await zite.sql({query:'SELECT COUNT(*) AS total'+where,params:[term]});
 const accounts=await zite.sql({query:'SELECT id,"agencyName","agencyEmail","accountStatus","creditLimitAed","creditStatus","creditTermsDays","lastSignedIn","country"'+where+' ORDER BY "agencyName",id LIMIT 25 OFFSET $2',params:[term,input.page*25]});
 let detail:Record<string,unknown>|null=null;let requests:Record<string,unknown>[]=[];let requestTotal=0;
 if(input.tenantId){
 const account=await zite.partnerAccounts.findOne({id:input.tenantId});if(!account)throw new ZiteError({code:'NOT_FOUND',message:'Tenant account not found'});
 const exposure=await tenantExposure(account.id);
 const wallet=await zite.sql({query:'SELECT COALESCE(SUM("amountMinor") FILTER(WHERE "requestType"=$2 AND "requestStatus"=$3),0) AS balance,COUNT(*) FILTER(WHERE "requestStatus"=$4) AS pending FROM "TenantFinanceRequests" WHERE "tenantAccountId"=$1',params:[account.id,'Wallet Deposit','Approved','Pending']});
 const limitMinor=Math.round(Number(account.creditLimitAed??0)*100);
 detail={id:account.id,agencyName:account.agencyName??'',agencyEmail:account.agencyEmail??'',accountStatus:account.accountStatus??'Unknown',creditStatus:account.creditStatus??'Pending Review',creditLimit:limitMinor/100,creditTermsDays:account.creditTermsDays??0,lastSignedIn:account.lastSignedIn??null,creditUsed:exposure.used/100,creditAvailable:Math.max(limitMinor-exposure.used,0)/100,openBookings:exposure.open,overdueBookings:exposure.overdue,incompleteExposure:exposure.unknown,walletBalance:Number(wallet.rows[0]?.balance??0)/100,pending:Number(wallet.rows[0]?.pending??0),walletSpendEnabled:false};
 const rc=await zite.sql({query:'SELECT COUNT(*) AS total FROM "TenantFinanceRequests" WHERE "tenantAccountId"=$1',params:[account.id]});requestTotal=Number(rc.rows[0]?.total??0);
 const rr=await zite.sql({query:'SELECT id,"requestReference","requestType","requestStatus","amountMinor","creditStatus","creditTermsDays","accountStatus","externalReference","evidenceUrl","reason","requestedBy","reviewedBy","reviewNotes","reviewedAt","createdAt" FROM "TenantFinanceRequests" WHERE "tenantAccountId"=$1 ORDER BY "createdAt" DESC,id LIMIT 25 OFFSET $2',params:[account.id,input.requestPage*25]});requests=rr.rows;
 }
 return {actor:String(actor?.email??''),canOverrideReview:canOverrideFinanceReview(actor),accounts:accounts.rows,total:Number(count.rows[0]?.total??0),requests,requestTotal,detail};
 }
});