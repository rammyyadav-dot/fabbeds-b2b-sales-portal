import {zite} from 'zitejs/db';
import {ZiteError} from 'zitejs/backend';
export async function requireFinance(context:{user?:({email?:string}&Record<string,unknown>)|null}){
 const email=context.user?.email?.trim().toLowerCase();
 if(!email)throw new ZiteError({code:'UNAUTHORIZED',message:'Verified finance session required'});
 const result=await zite.sql({query:'SELECT id FROM "Users" WHERE LOWER("email")=$1',params:[email]});
 if(result.rows.length!==1)throw new ZiteError({code:'FORBIDDEN',message:'A unique staff account is required'});
 const actor=await zite.users.findOne({id:String(result.rows[0].id)});
 const roles=String(actor?.role??'').split(',').map(r=>r.trim());
 if(!actor||actor.status!=='Active'||!roles.some(r=>['Admin','Finance Controller'].includes(r)))throw new ZiteError({code:'FORBIDDEN',message:'Active Admin or Finance Controller access required'});
 return actor;
}
