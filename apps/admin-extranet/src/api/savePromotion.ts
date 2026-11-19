import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAdmin } from '../lib/requireAdmin';
import { validatePromotionConfiguration } from '@project/pricing/hotelPromotions';

const promoFields = z.object({
  id: z.string().optional(),
  hotelId: z.string(),
  promotionCode: z.string(),
  promotionName: z.string(),
  status: z.string().optional(),
  promoType: z.string().optional(),
  priority: z.number().optional(),
  stackingPolicy: z.string().optional(),
  isFlashSale: z.boolean().optional(),
  memberOnly: z.boolean().optional(),
  discountPercent: z.number().optional(),
  discountAmount: z.number().optional(),
  stayNights: z.number().optional(),
  payNights: z.number().optional(),
  startNightIndex: z.number().optional(),
  minRateAfterDiscount: z.number().optional(),
  minLos: z.number().optional(),
  maxLos: z.number().optional(),
  minAdvanceDays: z.number().optional(),
  maxAdvanceDays: z.number().optional(),
  stayStartDate: z.string().optional(),
  stayEndDate: z.string().optional(),
  bookingStartDate: z.string().optional(),
  bookingEndDate: z.string().optional(),
  applicableDays: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  roomTypeIDs: z.string().optional(),
  ratePlanIDs: z.string().optional(),
  descriptionPublic: z.string().optional(),
  descriptionInternal: z.string().optional(),
  blackoutDatesJson: z.string().optional(),
  packageBenefitJson: z.string().optional(),

  fundingSource: z.string().optional(),
  sourceMarkets: z.string().optional(),
  agencySegments: z.string().optional(),
  memberTiers: z.string().optional(),
  wholeStayRequired: z.boolean().optional(),
  minimumSellFloorAed: z.number().optional(),
  minimumMargin: z.number().optional(),
  maximumDiscount: z.number().optional(),
  allowBelowNet: z.boolean().optional(),
  overrideApproved: z.boolean().optional(),
  overrideApprover: z.string().optional(),
  overrideReason: z.string().optional(),
  stackingGroup: z.string().optional(),
  compatiblePromotionIds: z.string().optional(),
  incompatiblePromotionIds: z.string().optional(),
  sameFamilyStacking: z.boolean().optional(),
  reason: z.string().optional(),
});

const commercialKeys = [
  'fundingSource','sourceMarkets','agencySegments','memberTiers','wholeStayRequired',
  'minimumSellFloorAed','minimumMargin','maximumDiscount','allowBelowNet','overrideApproved',
  'overrideApprover','overrideReason','stackingGroup','compatiblePromotionIds',
  'incompatiblePromotionIds','sameFamilyStacking'
] as const;

function normCode(value:string){return value.trim().toUpperCase().replace(/\s+/g,'_');}

export default createEndpoint({
  authenticated: true,
  description: 'Create/update a hotel promotion with server-side activation certification, commercial protections and audit',
  inputSchema: promoFields,
  outputSchema: z.object({ id: z.string(), status: z.string(), validationErrors: z.array(z.string()) }),
  execute: async ({ input, context }) => {
    const actor = await requireAdmin(context, 'manage hotel promotions');
    const code = normCode(input.promotionCode);
    const desiredStatus = input.status || 'Draft';

    const hotel = await zite.hotels.findOne({ id: input.hotelId });
    if (!hotel) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Hotel not found.' });

    const duplicate = await zite.promotions.findAll({ filters: { promotionCode: code }, limit: 100 });
    if (duplicate.records.some(p => p.id !== input.id && (Array.isArray(p.hotel) ? p.hotel[0] : p.hotel) === input.hotelId)) {
      throw new ZiteError({ code: 'CONFLICT', message: 'Promotion code already exists for this hotel.' });
    }

    const before = input.id ? await zite.promotions.findOne({ id: input.id }) : null;
    if (before && before.status === 'Active' && before.promotionCode && normCode(before.promotionCode) !== code) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Promotion code is immutable after activation.' });
    }

    const ruleInput:any = {};
    for (const key of commercialKeys) ruleInput[key] = input[key];
    const validationErrors = validatePromotionConfiguration({
      ...input,
      promotionCode: code,
      status: desiredStatus,
    }, ruleInput);

    if (desiredStatus === 'Active' || desiredStatus === 'Validated' || desiredStatus === 'Scheduled') {
      if (validationErrors.length) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Promotion certification failed: ' + validationErrors.join(' | ') });
      }

      const roomIds = String(input.roomTypeIDs || '').split(/[\s,;|]+/).filter(Boolean);
      const rateIds = String(input.ratePlanIDs || '').split(/[\s,;|]+/).filter(Boolean);
      if (!roomIds.length || !rateIds.length) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Activation requires at least one scoped Room Type and Rate Plan.' });
      }

      const plans = await zite.ratePlans.findAll({ filters: { hotel: input.hotelId }, limit: 1000 });
      const scoped = plans.records.filter(p => rateIds.includes(p.id));
      if (scoped.length !== rateIds.length || scoped.some(p => p.status !== 'Active' || (p.sellCurrency && p.sellCurrency !== 'AED'))) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'All scoped Rate Plans must belong to this hotel, be Active and sell in AED.' });
      }
      for (const p of scoped) {
        const rt = Array.isArray(p.roomType) ? p.roomType[0] : p.roomType;
        if (!rt || !roomIds.includes(String(rt))) {
          throw new ZiteError({ code: 'BAD_REQUEST', message: 'Rate Plan scope must match the selected Room Types.' });
        }
      }

      if (input.memberOnly && !String(input.memberTiers || input.agencySegments || '').trim()) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Member-only promotion requires Member Tiers or Agency Segments.' });
      }

      const active = await zite.promotions.findAll({ filters: { hotel: input.hotelId, status: 'Active' }, limit: 500 });
      if (input.stackingPolicy === 'Exclusive') {
        const conflict = active.records.find(p =>
          p.id !== input.id &&
          p.stackingPolicy === 'Exclusive' &&
          Number(p.priority || 0) === Number(input.priority || 0) &&
          String(p.stayStartDate || '') <= String(input.stayEndDate || '') &&
          String(p.stayEndDate || '') >= String(input.stayStartDate || '')
        );
        if (conflict) throw new ZiteError({ code: 'CONFLICT', message: 'Equal-priority Exclusive promotion conflict: ' + (conflict.promotionCode || conflict.id) });
      }
    }

    const {
      id, hotelId, reason,
      fundingSource, sourceMarkets, agencySegments, memberTiers, wholeStayRequired,
      minimumSellFloorAed, minimumMargin, maximumDiscount, allowBelowNet, overrideApproved,
      overrideApprover, overrideReason, stackingGroup, compatiblePromotionIds,
      incompatiblePromotionIds, sameFamilyStacking,
      ...rest
    } = input;

    const record:any = {
      ...rest,
      promotionCode: code,
      hotel: hotelId,
      status: desiredStatus,
    };

    let promotionId:string;
    if (id) {
      const updated = await zite.promotions.update({ id, record });
      promotionId = updated.id;
    } else {
      const created = await zite.promotions.create({ record: { ...record, status: desiredStatus || 'Draft' } });
      promotionId = created.id;
    }

    const rules = await zite.promotionCommercialRules.findAll({ filters: { promotionId }, limit: 10 });
    const ruleRecord:any = {
      ruleName: code + ' · commercial controls',
      promotionId,
      hotelId,
      fundingSource: fundingSource || 'Supplier Funded',
      sourceMarkets: (sourceMarkets || 'ALL').toUpperCase().replace(/\s+/g,''),
      agencySegments: agencySegments || '',
      memberTiers: memberTiers || '',
      wholeStayRequired: !!wholeStayRequired,
      minimumSellFloorAed: Math.max(0, Number(minimumSellFloorAed || 0)),
      minimumMargin: Math.max(0, Number(minimumMargin || 0)),
      maximumDiscount: Math.max(0, Number(maximumDiscount || 0)),
      allowBelowNet: !!allowBelowNet,
      overrideApproved: !!overrideApproved,
      overrideApprover: overrideApprover || '',
      overrideReason: overrideReason || '',
      stackingGroup: stackingGroup || '',
      compatiblePromotionIds: compatiblePromotionIds || '',
      incompatiblePromotionIds: incompatiblePromotionIds || '',
      sameFamilyStacking: !!sameFamilyStacking,
    };
    if (rules.records[0]) await zite.promotionCommercialRules.update({ id: rules.records[0].id, record: ruleRecord });
    else await zite.promotionCommercialRules.create({ record: ruleRecord });

    const after = await zite.promotions.findOne({ id: promotionId });
    const action = !before ? 'CREATED'
      : desiredStatus === 'Active' && before.status !== 'Active' ? 'ACTIVATED'
      : desiredStatus === 'Validated' ? 'VALIDATED'
      : desiredStatus === 'Paused' ? 'PAUSED'
      : desiredStatus === 'Expired' ? 'EXPIRED'
      : desiredStatus === 'Archived' ? 'ARCHIVED'
      : 'CHANGED';

    await zite.promotionAuditEvents.create({ record: {
      eventSummary: action + ' · ' + code,
      promotionId,
      hotelId,
      action,
      actor: actor.email || actor.id,
      reason: reason || '',
      beforeJson: before ? JSON.stringify(before) : '',
      afterJson: JSON.stringify({ promotion: after, commercialRules: ruleRecord }),
    } as any });

    if (allowBelowNet && overrideApproved) {
      await zite.promotionAuditEvents.create({ record: {
        eventSummary: 'OVERRIDE_APPROVED · ' + code,
        promotionId,
        hotelId,
        action: 'OVERRIDE_APPROVED',
        actor: actor.email || actor.id,
        reason: overrideReason || '',
        beforeJson: '',
        afterJson: JSON.stringify({ overrideApprover, allowBelowNet: true }),
      } as any });
    }

    return { id: promotionId, status: desiredStatus, validationErrors };
  },
});
