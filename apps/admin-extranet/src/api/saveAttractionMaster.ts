import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { emirateFromArea, productCategoryFrom } from '../../../../shared/attractionTaxonomy';
import {requireAdmin} from '../lib/requireAdmin';

export default createEndpoint({
  authenticated:true,
  description: 'Creates or updates a UAE attraction master',
  inputSchema: z.object({
    id: z.string().optional(),
    title: z.string().min(2),
    slug: z.string().min(2),
    city: z.string(),
    category: z.string(),
    shortDescription: z.string().optional(),
    description: z.string().optional(),
    cancellationPolicy: z.enum(['Free Cancellation','Flexible Cancellation','Non-Refundable']),
    instantConfirmation: z.boolean(),
    address: z.string().optional(),
    status: z.enum(['Active','Draft','Archived']),
  }),
  outputSchema: z.object({ id:z.string(), success:z.boolean() }),
  execute: async ({ input, context }) => {
    await requireAdmin(context,'manage attractions');
    if (input.status === 'Active' && (!input.city || !input.category)) {
      throw new ZiteError({ code:'BAD_REQUEST', message:'Active attractions require city and category.' });
    }
    const record:any = {
      title:input.title, slug:input.slug, city:input.city, category:input.category,
      emirate:emirateFromArea(input.city), productCategory:productCategoryFrom(input.category,input.title),
      shortDescription:input.shortDescription||'', description:input.description||'',
      cancellationPolicy:input.cancellationPolicy, instantConfirmation:input.instantConfirmation,
      address:input.address||'', status:input.status,
    };
    if (input.id) {
      await zite.attractions.update({ id:input.id, record });
      return { id:input.id, success:true };
    }
    const created = await zite.attractions.create({ record });
    return { id:created.id, success:true };
  },
});
