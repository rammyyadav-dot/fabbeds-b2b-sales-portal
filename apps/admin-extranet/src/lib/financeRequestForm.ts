export type FinanceRequestDraft = {
 tenantId?:string;type:'Credit Policy'|'Wallet Deposit'|'Account Status';amount:string;terms:string;
 creditStatus:'Pending Review'|'Approved'|'On Hold'|'Disabled';accountStatus:'Active'|'Suspended';
 reference:string;evidence:string;reason:string;
};
export function financeRequestPayload(d:FinanceRequestDraft){
 if(!d.tenantId)throw new Error('Select an agency first.');
 if(d.reason.trim().length<10)throw new Error('Add a short reason (at least 10 characters), for example: Credit limit for October bookings.');
 const amount=Number(d.amount);
 if(d.type!=='Account Status'&&(!d.amount.trim()||!Number.isFinite(amount)||amount<0||amount>1000000000||Math.abs(amount*100-Math.round(amount*100))>0.000001))throw new Error('Enter an AED amount with up to two decimal places.');
 const terms=Number(d.terms);
 if(d.type==='Credit Policy'&&(!d.terms.trim()||!Number.isInteger(terms)||terms<0||terms>365))throw new Error('Enter credit terms from 0 to 365 days.');
 if(d.type==='Credit Policy'&&d.creditStatus==='Approved'&&(amount<=0||terms<=0))throw new Error('Approved credit needs a positive limit and at least one day of credit terms.');
 if(d.type==='Wallet Deposit'){
 if(amount<=0)throw new Error('Deposit amount must be greater than zero.');
 if(!d.reference.trim())throw new Error('Add the bank receipt reference.');
 try{const url=new URL(d.evidence.trim());if(url.protocol!=='https:')throw new Error();}catch{throw new Error('Add a valid HTTPS link to the deposit evidence.');}
 }
 return {tenantId:d.tenantId,type:d.type,amountMinor:d.type==='Account Status'?0:Math.round(amount*100),
 creditStatus:d.type==='Credit Policy'?d.creditStatus:'Pending Review' as const,
 termsDays:d.type==='Credit Policy'?terms:0,accountStatus:d.accountStatus,
 reference:d.type==='Wallet Deposit'?d.reference.trim():'',
 evidenceUrl:d.type==='Wallet Deposit'?d.evidence.trim():undefined,reason:d.reason.trim()};
}
export function financeErrorMessage(e:unknown){
 if(e && typeof e==='object'){
 const a=e as {userFacingMessage?:unknown;message?:unknown;code?:unknown};
 if(a.code==='UNAUTHORIZED')return 'Your finance session expired. Sign in again, then retry.';
 if(typeof a.userFacingMessage==='string')return a.userFacingMessage;
 if(typeof a.message==='string')return a.message;
 }
 return 'Request could not be saved. Your entries are still here. Please retry.';
}
