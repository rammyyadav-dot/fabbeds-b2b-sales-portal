import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAdmin } from '../lib/requireAdmin';
import { validateMarkup } from '../../../../shared/attractionMarkup';
import { EMIRATES, PRODUCT_CATEGORIES } from '../../../../shared/attractionTaxonomy';

const optStr = z.string().trim().optional().nullable();
export default createEndpoint({
  authenticated: true,
  description: 'Creates or updates an attraction markup rule (blank scope fields = applies to all)',
  inputSchema: z.object({
    id: z.string().optional(),
    ruleName: z.string().trim().min(3),
    status: z.enum(['Active', 'Inactive']),
    markupType: z.enum(['Percent', 'Fixed AED per pax']),
    markupValue: z.number(),
    agencyTier: z.enum(['Standard', 'Silver', 'Gold', 'Platinum']).optional().nullable(),
    partnerAccountId: optStr, emirate: optStr, productCategory: optStr, ticketOptionId: optStr, market: optStr,
    validFrom: optStr, validTo: optStr,
    priority: z.number().int().min(0).max(1000).default(0),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const actor: any = await requireAdmin(context, 'manage markup rules');
    try { validateMarkup(input.markupType, input.markupValue); } catch (e: any) { throw new ZiteError({ code: 'BAD_REQUEST', message: e.message }); }
    if (input.emirate && !(EMIRATES as readonly string[]).includes(input.emirate)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Unknown emirate.' });
    if (input.productCategory && !(PRODUCT_CATEGORIES as readonly string[]).includes(input.productCategory)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Unknown product category.' });
    if (input.market && !/^[A-Za-z]{2}$/.test(input.market)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Market must be a 2-letter country code.' });
    if (input.validFrom && input.validTo && input.validTo < input.validFrom) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Valid To must be on or after Valid From.' });
    if (input.partnerAccountId && !(await zite.partnerAccounts.findOne({ id: input.partnerAccountId }))) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Agency not found.' });
    if (input.ticketOptionId && !(await zite.ticketOptions.findOne({ id: input.ticketOptionId }))) throw new ZiteError({ code: 'BAD_REQUEST', message: 'SKU not found.' });
    const record: any = {
      ruleName: input.ruleName, status: input.status, markupType: input.markupType, markupValue: input.markupValue,
      agencyTier: input.agencyTier || null, partnerAccount: input.partnerAccountId || null, emirate: input.emirate || null,
      productCategory: input.productCategory || null, ticketOption: input.ticketOptionId || null,
      market: input.market ? input.market.toUpperCase() : '', validFrom: input.validFrom || null, validTo: input.validTo || null,
      priority: input.priority, notes: input.notes || '', updatedBy: String(actor?.email || context.user?.email || ''),
    };
    const z_: any = zite;
    if (input.id) { await z_.attractionMarkupRules.update({ id: input.id, record }); return { id: input.id }; }
    const created = await z_.attractionMarkupRules.create({ record });
    return { id: created.id };
  },
});
