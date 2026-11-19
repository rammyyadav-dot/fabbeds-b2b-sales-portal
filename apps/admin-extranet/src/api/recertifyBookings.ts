import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';
import { assessBookingCertification, persistBookingCertification } from '../lib/bookingCertification';

export default createEndpoint({
  authenticated:true,
  description:'Re-certify recent hotel bookings and persist PASS/WARN/FAIL audit results',
  inputSchema:z.object({limit:z.number().int().min(1).max(200).default(100)}),
  outputSchema:z.object({checked:z.number(),pass:z.number(),warn:z.number(),fail:z.number(),errors:z.array(z.object({bookingId:z.string(),message:z.string()}))}),
  execute:async({input,context})=>{
    const actor=await requireAdmin(context,'re-certify hotel bookings');
    const bookings=await zite.bookings.findAll({limit:input.limit});
    const rows=[...bookings.records].sort((a,b)=>String((b as any).createdAt||'').localeCompare(String((a as any).createdAt||'')));
    let pass=0,warn=0,fail=0,checked=0;
    const errors:{bookingId:string;message:string}[]=[];
    for(const booking of rows){
      try{
        const result=await assessBookingCertification(booking.id);
        await persistBookingCertification(result,'bulk_recertification',actor.email||'Admin');
        checked++;
        if(result.status==='PASS')pass++; else if(result.status==='WARN')warn++; else fail++;
      }catch(err:any){errors.push({bookingId:booking.id,message:err?.message||'Certification failed'});}
    }
    return {checked,pass,warn,fail,errors};
  },
});
