import {zite} from 'zitejs/db';
import {ZiteError} from 'zitejs/backend';
export function isAdminRole(role?:string|null){return String(role??'').split(',').map(r=>r.trim()).includes('Admin');}
export async function requireAdmin(context:{user?:({email?:string}&Record<string,unknown>)|null},action:string){
 const email=context.user?.email?.trim().toLowerCase();
 if(!email)throw new ZiteError({code:'UNAUTHORIZED',message:'Verified Admin session required'});
 const result=await zite.sql({query:'SELECT id FROM "Users" WHERE LOWER("email")=$1',params:[email]});
 if(result.rows.length!==1)throw new ZiteError({code:'FORBIDDEN',message:'A unique staff account is required'});
 const actor=await zite.users.findOne({id:String(result.rows[0].id)});
 if(!actor||actor.status!=='Active'||!isAdminRole(actor.role))throw new ZiteError({code:'FORBIDDEN',message:'Only active Admins may '+action});
 return actor;
}

export async function requireAdminSession(userId:string|undefined,action:string){
 if(!userId)throw new ZiteError({code:'UNAUTHORIZED',message:'Admin session is required'});
 const actor=await zite.users.findOne({id:userId});
 if(!actor||actor.status!=='Active'||!isAdminRole(actor.role))throw new ZiteError({code:'FORBIDDEN',message:'Only active Admins may '+action});
 return actor;
}

/**
 * CTO audit P0 fix: the acting user is taken from the VERIFIED Zite session (context.user), never from the
 * client. A client-supplied actingUserId is accepted only as a consistency check and must match the session.
 */
export async function requireAdminSessionVerified(context:{user?:({email?:string;id?:string}&Record<string,unknown>)|null},claimedUserId:string|undefined,action:string){
 const actor=await requireAdmin(context as any,action);
 if(claimedUserId&&actor&&claimedUserId!==actor.id)throw new ZiteError({code:'FORBIDDEN',message:'Session does not match the acting user'});
 return actor;
}
