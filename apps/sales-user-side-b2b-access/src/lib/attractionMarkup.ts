import { zite } from 'zitejs/db';
import { allAttractionRecords } from './allAttractionRecords';
import { selectMarkupRule, applyMarkup, type MarkupRule, type MarkupContext, type AppliedMarkup } from '../../../../shared/attractionMarkup';

export async function loadMarkupRules(): Promise<MarkupRule[]> {
  const { records } = await allAttractionRecords((zite as any).attractionMarkupRules, { filters: { status: 'Active' } });
  return records as MarkupRule[];
}
export async function partnerTier(partnerId?: string | null): Promise<string | undefined> {
  if (!partnerId) return undefined;
  const p: any = await zite.partnerAccounts.findOne({ id: partnerId });
  return p?.agencyTier || 'Standard';
}
export function agentPrice(rules: MarkupRule[], ctx: MarkupContext, costAdult: number, costChild: number): AppliedMarkup {
  return applyMarkup(costAdult, costChild, selectMarkupRule(rules, ctx));
}
