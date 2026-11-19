import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { enrichCurrentUser } from '../lib/currentUser';

export default createEndpoint({
  description:'Returns the researched UAE attraction product library for admin contracting use',
  inputSchema:z.object({}),
  outputSchema:z.object({
    products:z.array(z.object({
      id:z.string(),
      productName:z.string(),
      attractionName:z.string(),
      emirate:z.string(),
      area:z.string(),
      category:z.string(),
      ticketType:z.string(),
      productSummary:z.string(),
      highlights:z.string(),
      officialUrl:z.string(),
      source:z.string(),
      verificationStatus:z.string(),
      commercialStatus:z.string(),
      imageKey:z.string(),
      suggestedInternalSku:z.string(),
      lastVerified:z.string(),
    })),
  }),
  execute:async({context})=>{
    await enrichCurrentUser(context);
    const {records}=await zite.uaeAttractionProductLibrary.findAll({limit:500});
    return {
      products:(records as any[]).map(r=>({
        id:r.id,
        productName:r.productName||'',
        attractionName:r.attractionName||'',
        emirate:r.emirate||'',
        area:r.area||'',
        category:r.category||'',
        ticketType:r.ticketType||'',
        productSummary:r.productSummary||'',
        highlights:r.highlights||'',
        officialUrl:r.officialUrl||'',
        source:r.source||'',
        verificationStatus:r.verificationStatus||'',
        commercialStatus:r.commercialStatus||'',
        imageKey:r.imageKey||'',
        suggestedInternalSku:r.suggestedInternalSku||'',
        lastVerified:r.lastVerified?String(r.lastVerified).slice(0,10):'',
      })).sort((a,b)=>a.emirate.localeCompare(b.emirate)||a.attractionName.localeCompare(b.attractionName)||a.productName.localeCompare(b.productName)),
    };
  },
});
