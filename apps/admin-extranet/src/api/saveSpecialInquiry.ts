import { requireStaff } from '../lib/requireStaff';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

/** Generate a sequential unique inquiry ref: INQ-YYYY-NNNN */
async function generateInquiryRef(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INQ-${year}-`;
  const res = await zite.specialInquiries.findAll({ fields: ['inquiryRef'], limit: 2000 });
  let max = 0;
  for (const r of res.records) {
    const ref = String(r.inquiryRef ?? '');
    if (ref.startsWith(prefix)) {
      const n = parseInt(ref.replace(prefix, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export default createEndpoint({
  authenticated: true,
  description: 'Create or update a special / offline inquiry',
  inputSchema: z.object({
    id: z.string().optional(),
    inquiryType: z.string().optional(),
    status: z.string().optional(),
    hotelName: z.string().optional(),
    checkinDate: z.string().optional(),
    checkoutDate: z.string().optional(),
    rooms: z.number().optional(),
    adults: z.number().optional(),
    children: z.number().optional(),
    roomType: z.string().optional(),
    mealPlan: z.string().optional(),
    ourRateAed: z.number().optional(),
    competitorPriceAed: z.number().optional(),
    competitorSourceUrl: z.string().optional(),
    destination: z.string().optional(),
    starPreference: z.string().optional(),
    boardBasis: z.string().optional(),
    budgetRange: z.string().optional(),
    urgentWithin72H: z.boolean().optional(),
    agentCompany: z.string().optional(),
    agentName: z.string().optional(),
    agentEmail: z.string().optional(),
    agentWhatsApp: z.string().optional(),
    notes: z.string().optional(),
    adminNotes: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string(), inquiryRef: z.string().optional() }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'saveSpecialInquiry');
    const { id, ...fields } = input;
    if (id) {
      const res = await zite.specialInquiries.update({ id, record: fields });
      return { id: res.id };
    }
    const rec = await zite.specialInquiries.create({
      record: { ...fields, submittedAt: new Date().toISOString(), status: fields.status ?? 'Pending Review' },
    });
    return { id: rec.id, inquiryRef: rec.inquiryRef != null ? String(rec.inquiryRef) : undefined };
  },
});
