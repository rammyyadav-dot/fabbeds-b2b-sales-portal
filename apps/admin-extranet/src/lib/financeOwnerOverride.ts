export function canOverrideFinanceReview(actor:{id?:string;email?:string;role?:string;status?:string}){
 return actor.id==='8f886a82-ff1f-4a46-85d1-642d0dd3690b' &&
 actor.email?.trim().toLowerCase()==='rammy.yadav@gmail.com' &&
 actor.status==='Active' && String(actor.role??'').split(',').map(r=>r.trim()).includes('Admin');
}
