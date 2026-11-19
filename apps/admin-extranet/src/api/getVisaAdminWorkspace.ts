import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdminSessionVerified } from '../lib/requireAdmin';

const linkId=(v:unknown)=>Array.isArray(v)?String(v[0]||''):String(v||'');
const iso=(v:unknown)=>v?new Date(String(v)).toISOString():'';

export default createEndpoint({
    authenticated:true,
description:'Admin visa operations workspace with products, applications, applicants, deposits and extensions',
  inputSchema:z.object({actingUserId:z.string().min(1)}),
  outputSchema:z.object({
    products:z.array(z.object({
      id:z.string(),visaName:z.string(),visaCategory:z.string(),validityDays:z.number(),stayDurationDays:z.number(),
      entryType:z.string(),processingType:z.string(),netCost:z.number(),sellingPrice:z.number(),expressSurcharge:z.number(),
      requiresSecurityDeposit:z.boolean(),depositAmount:z.number(),description:z.string(),active:z.boolean(),
    })),
    applications:z.array(z.object({
      id:z.string(),applicationReference:z.string(),visaProductId:z.string(),visaProductName:z.string(),channel:z.string(),
      totalNetCost:z.number(),totalSellPrice:z.number(),applicantCount:z.number(),processingType:z.string(),
      paymentStatus:z.string(),applicationStatus:z.string(),submissionDate:z.string(),completionDate:z.string(),
      notes:z.string(),createdAt:z.string(),entryDate:z.string(),visaExpiryDate:z.string(),stayStatus:z.string(),
      applicantNames:z.array(z.string()),verifiedApplicants:z.number(),depositStatus:z.string(),depositAmount:z.number(),
      extensionCount:z.number(),daysToExpiry:z.number().nullable(),overstayDays:z.number(),
    })),
    applicants:z.array(z.object({
      id:z.string(),applicationId:z.string(),fullName:z.string(),firstName:z.string(),lastName:z.string(),nationality:z.string(),
      passportNumber:z.string(),passportExpiry:z.string(),dateOfBirth:z.string(),gender:z.string(),uidNumber:z.string(),
      visaNumber:z.string(),documentStatus:z.string(),rejectionReason:z.string(),applicantStatus:z.string(),
      passportCopyCount:z.number(),passportPhotoCount:z.number(),additionalDocumentCount:z.number(),
    })),
    deposits:z.array(z.object({
      id:z.string(),applicationId:z.string(),depositReference:z.string(),depositAmount:z.number(),depositStatus:z.string(),
      forfeitReason:z.string(),updatedAt:z.string(),
    })),
    extensions:z.array(z.object({
      id:z.string(),applicationId:z.string(),extensionId:z.number(),extensionType:z.string(),extensionStatus:z.string(),
      newExpiryDate:z.string(),additionalDays:z.number(),extensionFee:z.number(),overstayFine:z.number(),
      reason:z.string(),notes:z.string(),submittedAt:z.string(),createdAt:z.string(),
    })),
    stats:z.object({
      total:z.number(),documentsPending:z.number(),underReview:z.number(),submitted:z.number(),approved:z.number(),rejected:z.number(),
      expiringSoon:z.number(),overstay:z.number(),depositExposure:z.number(),
    }),
  }),
  execute:async({input,context})=>{
    await requireAdminSessionVerified(context,input.actingUserId,'manage visa operations');
    const [p,a,d,s,e]=await Promise.all([
      zite.visaProducts.findAll({limit:500}),
      zite.visaApplications.findAll({limit:2000}),
      zite.applicantDossiers.findAll({limit:2000}),
      zite.visaSecurityDeposits.findAll({limit:2000}),
      zite.visaExtensions.findAll({limit:2000}),
    ]);

    const products=new Map(p.records.map(x=>[x.id,x]));
    const applicantsByApp=new Map<string,typeof d.records>();
    for(const x of d.records){
      const appId=linkId(x.visaApplication); if(!appId) continue;
      const arr=applicantsByApp.get(appId)||[]; arr.push(x); applicantsByApp.set(appId,arr);
    }
    const depositByApp=new Map<string,(typeof s.records)[number]>();
    for(const x of s.records){const appId=linkId(x.visaApplication); if(appId) depositByApp.set(appId,x);}
    const extByApp=new Map<string,typeof e.records>();
    for(const x of e.records){const appId=linkId(x.visaApplication); if(!appId) continue; const arr=extByApp.get(appId)||[]; arr.push(x); extByApp.set(appId,arr);}

    const today=new Date(); today.setHours(0,0,0,0);
    let expiringSoon=0,overstay=0;
    const applications=a.records.map(x=>{
      const productId=linkId(x.visaProduct);
      const product=products.get(productId);
      const dossier=applicantsByApp.get(x.id)||[];
      const dep=depositByApp.get(x.id);
      const extensions=extByApp.get(x.id)||[];
      let daysToExpiry:number|null=null,overstayDays=0;
      if(x.visaExpiryDate){
        const dt=new Date(x.visaExpiryDate); dt.setHours(0,0,0,0);
        daysToExpiry=Math.ceil((dt.getTime()-today.getTime())/86400000);
        if(daysToExpiry<0){overstayDays=Math.abs(daysToExpiry); overstay++;}
        else if(daysToExpiry<=7) expiringSoon++;
      }
      return {
        id:x.id,applicationReference:x.applicationReference||'',visaProductId:productId,visaProductName:product?.visaName||'Unmapped product',
        channel:x.channel||'',totalNetCost:Number(x.totalNetCost||0),totalSellPrice:Number(x.totalSellPrice||0),
        applicantCount:Number(x.applicantCount||0),processingType:x.processingType||'Standard',paymentStatus:x.paymentStatus||'Pending',
        applicationStatus:x.applicationStatus||'Draft',submissionDate:iso(x.submissionDate),completionDate:iso(x.completionDate),
        notes:x.notes||'',createdAt:iso(x.createdAt),entryDate:x.entryDate||'',visaExpiryDate:x.visaExpiryDate||'',
        stayStatus:x.stayStatus||'Not Entered',applicantNames:dossier.map(y=>y.fullName||[y.firstName,y.lastName].filter(Boolean).join(' ')),
        verifiedApplicants:dossier.filter(y=>y.documentStatus==='Verified').length,depositStatus:dep?.depositStatus||'Not Required',
        depositAmount:Number(dep?.depositAmount||0),extensionCount:extensions.length,daysToExpiry,overstayDays,
      };
    }).sort((x,y)=>y.createdAt.localeCompare(x.createdAt));

    return {
      products:p.records.map(x=>({
        id:x.id,visaName:x.visaName||'',visaCategory:x.visaCategory||'',validityDays:Number(x.validityDays||0),
        stayDurationDays:Number(x.stayDurationDays||0),entryType:x.entryType||'',processingType:x.processingType||'',
        netCost:Number(x.netCost||0),sellingPrice:Number(x.sellingPrice||0),expressSurcharge:Number(x.expressSurcharge||0),
        requiresSecurityDeposit:!!x.requiresSecurityDeposit,depositAmount:Number(x.depositAmount||0),
        description:x.description||'',active:!!x.active,
      })),
      applications,
      applicants:d.records.map(x=>({
        id:x.id,applicationId:linkId(x.visaApplication),fullName:x.fullName||'',firstName:x.firstName||'',lastName:x.lastName||'',
        nationality:x.nationality||'',passportNumber:x.passportNumber||'',passportExpiry:x.passportExpiry||'',dateOfBirth:x.dateOfBirth||'',
        gender:x.gender||'',uidNumber:x.uidNumber||'',visaNumber:x.visaNumber||'',documentStatus:x.documentStatus||'Pending Upload',
        rejectionReason:x.rejectionReason||'',applicantStatus:x.applicantStatus||'Pending',
        passportCopyCount:Array.isArray(x.passportCopy)?x.passportCopy.length:0,
        passportPhotoCount:Array.isArray(x.passportPhoto)?x.passportPhoto.length:0,
        additionalDocumentCount:Array.isArray(x.additionalDocuments)?x.additionalDocuments.length:0,
      })),
      deposits:s.records.map(x=>({
        id:x.id,applicationId:linkId(x.visaApplication),depositReference:x.depositReference||'',depositAmount:Number(x.depositAmount||0),
        depositStatus:x.depositStatus||'Not Required',forfeitReason:x.forfeitReason||'',updatedAt:iso(x.updatedAt),
      })),
      extensions:e.records.map(x=>({
        id:x.id,applicationId:linkId(x.visaApplication),extensionId:Number(x.extensionId||0),extensionType:x.extensionType||'',
        extensionStatus:x.extensionStatus||'Draft',newExpiryDate:x.newExpiryDate||'',additionalDays:Number(x.additionalDays||0),
        extensionFee:Number(x.extensionFee||0),overstayFine:Number(x.overstayFine||0),reason:x.reason||'',notes:x.notes||'',
        submittedAt:iso(x.submittedAt),createdAt:iso(x.createdAt),
      })),
      stats:{
        total:applications.length,
        documentsPending:applications.filter(x=>x.applicationStatus==='Documents Pending').length,
        underReview:applications.filter(x=>x.applicationStatus==='Under Review').length,
        submitted:applications.filter(x=>x.applicationStatus==='Submitted to Govt').length,
        approved:applications.filter(x=>x.applicationStatus==='Approved').length,
        rejected:applications.filter(x=>x.applicationStatus==='Rejected').length,
        expiringSoon,overstay,
        depositExposure:s.records.filter(x=>['Held (Credit Line)','Escrow Paid'].includes(x.depositStatus||'')).reduce((n,x)=>n+Number(x.depositAmount||0),0),
      },
    };
  },
});
