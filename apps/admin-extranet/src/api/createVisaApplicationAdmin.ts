import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

export default createEndpoint({
    authenticated:true,
description:'Create an admin-entered visa application and applicant dossiers',
  inputSchema:z.object({
    actingUserId:z.string().min(1),
    visaProductId:z.string(),processingType:z.enum(['Standard','Express']),paymentStatus:z.enum(['Pending','Paid']),
    applicants:z.array(z.object({
      firstName:z.string().min(1),lastName:z.string().min(1),nationality:z.string().min(2),passportNumber:z.string().min(3),
      passportExpiry:z.string().min(10),dateOfBirth:z.string().min(10),gender:z.enum(['Male','Female','Other']),
    })).min(1).max(20),notes:z.string().optional(),
  }),
  outputSchema:z.object({id:z.string(),applicationReference:z.string()}),
  execute:async({input,context})=>{
    const actor=await requireAdminSessionVerified(context,input.actingUserId,'create visa applications');
    const product=await zite.visaProducts.findOne({id:input.visaProductId});
    if(!product||!product.active) throw new Error('Select an active visa product.');
    const count=input.applicants.length;
    const express=input.processingType==='Express'?Number(product.expressSurcharge||0):0;
    const ref='VISA-'+new Date().getFullYear()+'-'+Math.random().toString(36).slice(2,8).toUpperCase();
    const app=await zite.visaApplications.create({record:{
      applicationReference:ref,visaProduct:product.id,channel:'B2B Portal',
      totalNetCost:Number(product.netCost||0)*count,totalSellPrice:(Number(product.sellingPrice||0)+express)*count,
      applicantCount:count,processingType:input.processingType,paymentStatus:input.paymentStatus,
      applicationStatus:'Documents Pending',notes:input.notes||'',appliedBy:actor.id,stayStatus:'Not Entered',
    }});
    await zite.applicantDossiers.bulkCreate({records:input.applicants.map(x=>({
      fullName:(x.firstName+' '+x.lastName).trim(),visaApplication:app.id,firstName:x.firstName,lastName:x.lastName,
      nationality:x.nationality,passportNumber:x.passportNumber,passportExpiry:x.passportExpiry,dateOfBirth:x.dateOfBirth,
      gender:x.gender,documentStatus:'Pending Upload',applicantStatus:'Pending',
    }))});
    if(product.requiresSecurityDeposit){
      await zite.visaSecurityDeposits.create({record:{
        depositReference:'DEP-'+ref,visaApplication:app.id,depositAmount:Number(product.depositAmount||0)*count,
        depositStatus:'Held (Credit Line)',forfeitReason:'',
      }});
    }
    return {id:app.id,applicationReference:ref};
  },
});
