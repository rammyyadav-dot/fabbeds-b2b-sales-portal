import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all active visa products for the visa portal',
  inputSchema: z.object({
    category: z.string().optional(),
  }),
  outputSchema: z.object({
    products: z.array(z.object({
      id: z.string(),
      visaName: z.string(),
      category: z.string(),
      validityDays: z.number(),
      stayDays: z.number(),
      entryType: z.string(),
      processingType: z.string(),
      sellingPrice: z.number(),
      expressSurcharge: z.number(),
      requiresDeposit: z.boolean(),
      depositAmount: z.number(),
      description: z.string(),
    })),
  }),
  execute: async ({ input }) => {
    const res = await zite.visaProducts.findAll({
      filters: {
        active: true,
        ...(input.category ? { visaCategory: input.category } : {}),
      },
      limit: 200,
    });

    return {
      products: res.records.map(p => ({
        id: p.id,
        visaName: p.visaName || '',
        category: p.visaCategory || '',
        validityDays: p.validityDays || 0,
        stayDays: p.stayDurationDays || 0,
        entryType: p.entryType || 'Single Entry',
        processingType: p.processingType || 'Standard (3-5 Days)',
        sellingPrice: p.sellingPrice || 0,
        expressSurcharge: p.expressSurcharge || 150,
        requiresDeposit: p.requiresSecurityDeposit || false,
        depositAmount: p.depositAmount || 0,
        description: p.description || '',
      })),
    };
  },
});
