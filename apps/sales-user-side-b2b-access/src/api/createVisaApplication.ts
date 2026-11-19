import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create a visa application with applicant dossiers',
  inputSchema: z.object({
    visaProductId: z.string(),
    processingType: z.enum(['STANDARD', 'EXPRESS']),
    applicants: z.array(z.object({
      firstName: z.string(),
      lastName: z.string(),
      nationality: z.string(),
      passportNumber: z.string(),
      passportExpiry: z.string(),
      dateOfBirth: z.string(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    })),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({
    applicationId: z.string(),
    applicationReference: z.string(),
    totalSellPrice: z.number(),
    depositRequired: z.boolean(),
    depositAmount: z.number(),
  }),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const product = await zite.visaProducts.findOne({ id: input.visaProductId });
    if (!product) throw new Error('Visa product not found');

    const count = input.applicants.length;
    const basePrice = product.sellingPrice || 0;
    const expressFee = input.processingType === 'EXPRESS' ? (product.expressSurcharge || 150) : 0;
    const perApplicant = basePrice + expressFee;
    const totalSell = perApplicant * count;
    const totalNet = (product.netCost || 0) * count;

    const ref = `ZT-VISA-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const app = await zite.visaApplications.create({
      record: {
        applicationReference: ref,
        visaProduct: input.visaProductId,
        channel: 'B2B Portal',
        totalNetCost: totalNet,
        totalSellPrice: totalSell,
        applicantCount: count,
        processingType: input.processingType === 'EXPRESS' ? 'Express' : 'Standard',
        paymentStatus: 'Pending',
        applicationStatus: 'Documents Pending',
        notes: input.notes || '',
        appliedBy: context.user.id,
      },
    });

    // Create dossiers
    await zite.applicantDossiers.bulkCreate({
      records: input.applicants.map(a => ({
        fullName: `${a.firstName} ${a.lastName}`,
        visaApplication: app.id,
        firstName: a.firstName,
        lastName: a.lastName,
        nationality: a.nationality,
        passportNumber: a.passportNumber,
        passportExpiry: a.passportExpiry,
        dateOfBirth: a.dateOfBirth,
        gender: a.gender === 'MALE' ? 'Male' : a.gender === 'FEMALE' ? 'Female' : 'Other',
        documentStatus: 'Pending Upload',
        applicantStatus: 'Pending',
      })),
    });

    // Create security deposit if required
    const depositRequired = product.requiresSecurityDeposit || false;
    const depositAmount = depositRequired ? (product.depositAmount || 0) * count : 0;

    if (depositRequired) {
      await zite.visaSecurityDeposits.create({
        record: {
          depositReference: `DEP-${ref}`,
          visaApplication: app.id,
          depositAmount,
          depositStatus: 'Held (Credit Line)',
        },
      });
    }

    return {
      applicationId: app.id,
      applicationReference: ref,
      totalSellPrice: totalSell,
      depositRequired,
      depositAmount,
    };
  },
});
