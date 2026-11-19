import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAdmin } from '../lib/requireAdmin';
import { assessBookingCertification, persistBookingCertification } from '../lib/bookingCertification';

const resultSchema=z.object({
  bookingId:z.string(),bookingReference:z.string(),status:z.enum(['PASS','WARN','FAIL']),gate:z.enum(['ALLOW','WARN','BLOCK']),
  checkedAt:z.string(),reasons:z.array(z.string()),criticalReasons:z.array(z.string()),warnings:z.array(z.string()),
  pricingVersion:z.string(),nightlyExpected:z.number(),nightlyActual:z.number(),nightlyCoverage:z.enum(['COMPLETE','INCOMPLETE','MISSING']),
  bookingRoomsExpected:z.number(),bookingRoomsActual:z.number(),holdToken:z.string(),holdStatus:z.string(),
  sellTotal:z.number(),sellTotalFromNights:z.number(),sellDelta:z.number(),legacy:z.boolean(),
});

export default createEndpoint({
  authenticated:true,
  description:'Re-certify one hotel booking and persist the certification audit result',
  inputSchema:z.object({bookingId:z.string().min(1)}),
  outputSchema:resultSchema,
  execute:async({input,context})=>{
    const actor=await requireAdmin(context,'re-certify hotel bookings');
    try{
      const result=await assessBookingCertification(input.bookingId);
      await persistBookingCertification(result,'manual_recertification',actor.email||'Admin');
      return result;
    }catch(err:any){
      throw new ZiteError({code:'CONFLICT',message:err?.message||'Booking certification failed.'});
    }
  },
});
