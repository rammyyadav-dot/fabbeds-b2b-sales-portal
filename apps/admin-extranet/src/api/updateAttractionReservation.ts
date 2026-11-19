import {isAttractionBlackout,applyAttractionAvailability} from '../../../../shared/attractionPolicy';
import {allAttractionRecords} from '../lib/allAttractionRecords';
import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import {requireAdmin} from '../lib/requireAdmin';

export default createEndpoint({
  authenticated:true,
  description:'Updates attraction reservation lifecycle and supplier confirmation',
  inputSchema:z.object({
    bookingId:z.string(),
    status:z.enum(['Awaiting Confirmation','Confirmed','Cancellation Requested','Cancelled','Rejected','Completed']),
    supplierConfirmationNo:z.string().optional(),
  }),
  outputSchema:z.object({success:z.boolean()}),
  execute:async({input,context})=>{
    await requireAdmin(context,'manage attractions');
    const b=await zite.attractionBookings.findOne({id:input.bookingId}) as any;
    if(!b) throw new ZiteError({code:'NOT_FOUND',message:'Attraction booking not found.'});

    const previous=b.reservationStatus||b.bookingStatus||'Awaiting Confirmation';
    if(['Cancelled','Rejected','Completed'].includes(previous)&&input.status!==previous){
      throw new ZiteError({code:'CONFLICT',message:`Terminal reservation status "${previous}" cannot be reopened.`});
    }

    let snapshot:any={};
    try{snapshot=JSON.parse(b.pricingSnapshotJson||'{}');}catch{}
    const rateId=String(snapshot.rateId||'');
    const pax=Number(b.adultCount||0)+Number(b.childCount||0);

    if(input.status==='Confirmed'){
      const conf=(input.supplierConfirmationNo||b.supplierConfirmationNo||'').trim();
      if(!conf) throw new ZiteError({code:'BAD_REQUEST',message:'Supplier confirmation number is required.'});

      if(previous!=='Confirmed'){
        if(!rateId) throw new ZiteError({code:'CONFLICT',message:'Booking price snapshot is missing rate linkage.'});
        let rate=await zite.attractionRates.findOne({id:rateId}) as any;
        if(rate){const tid=Array.isArray(rate.ticketOption)?String(rate.ticketOption[0]||''):String(rate.ticketOption||'');const policy=await zite.attractionAvailability.findOne({filters:{ticketProduct:tid,date:String(rate.date).slice(0,10)}});rate=applyAttractionAvailability(rate,policy);}
        if(!rate||rate.stopSale||rate.inventoryStatus==='Sold Out') throw new ZiteError({code:'CONFLICT',message:'Rate is no longer confirmable.'});
        const periodId=Array.isArray(rate.ratePeriod)?String(rate.ratePeriod[0]||''):String(rate.ratePeriod||'');
        if(periodId){
          const period=await zite.attractionRatePeriods.findOne({id:periodId});
          if(!period||period.status!=='Published'||period.stopSale)throw new ZiteError({code:'CONFLICT',message:'Rate period is stopped or unpublished.'});
        }
        const ticketId=Array.isArray(rate.ticketOption)?String(rate.ticketOption[0]||''):String(rate.ticketOption||'');
        const ticket=await zite.ticketOptions.findOne({id:ticketId});
        const attractionId=Array.isArray(ticket?.attraction)?String(ticket.attraction[0]||''):String(ticket?.attraction||'');
        const blackouts=await allAttractionRecords(zite.attractionBlackouts,{filters:{attraction:attractionId,status:'Active'}});
        if(isAttractionBlackout(String(b.targetDate).slice(0,10),attractionId,ticketId,blackouts.records))throw new ZiteError({code:'CONFLICT',message:'The selected date is blacked out.'});
        const capacity=Number(rate.totalCapacity||0), sold=Number(rate.soldCount||0);
        if(capacity>0&&sold+pax>capacity) throw new ZiteError({code:'CONFLICT',message:'Insufficient remaining attraction allocation.'});
        await zite.attractionRates.update({id:rate.id,record:{soldCount:sold+pax}});
      }

      await zite.attractionBookings.update({
        id:b.id,
        record:{
          reservationStatus:'Confirmed',
          bookingStatus:'Confirmed',
          supplierConfirmationNo:conf,
          confirmedAt:b.confirmedAt||new Date().toISOString(),
        } as any,
      });
      await zite.attractionBookingEvents.create({
        record:{
          eventName:'SUPPLIER_CONFIRMATION_RECORDED',
          booking:b.id,
          details:`Supplier reference ${conf}; confirmed by ${context?.user?.email || 'Admin'}`,
        },
      });
      return{success:true};
    }

    if(input.status==='Cancelled'||input.status==='Rejected'){
      if(previous==='Confirmed'&&rateId){
        const rate=await zite.attractionRates.findOne({id:rateId}) as any;
        if(rate){
          const sold=Number(rate.soldCount||0);
          await zite.attractionRates.update({id:rate.id,record:{soldCount:Math.max(0,sold-pax)}});
        }
      }
      await zite.attractionBookings.update({
        id:b.id,
        record:{
          reservationStatus:input.status,
          bookingStatus:'Cancelled',
          creditSettlementStatus:'Released',
        } as any,
      });
      await zite.attractionBookingEvents.create({
        record:{
          eventName:input.status==='Cancelled'?'ATTRACTION_BOOKING_CANCELLED':'ATTRACTION_BOOKING_REJECTED',
          booking:b.id,
          details:`Status changed from ${previous} to ${input.status}; credit released`,
        },
      });
      return{success:true};
    }

    await zite.attractionBookings.update({
      id:b.id,
      record:{
        reservationStatus:input.status,
        ...(input.status==='Completed'?{creditSettlementStatus:'Released'}:{}),
      } as any,
    });
    return{success:true};
  },
});
