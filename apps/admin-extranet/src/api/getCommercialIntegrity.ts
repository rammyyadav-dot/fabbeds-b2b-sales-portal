import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { linkedId, CANONICAL_MEAL_PLANS, safeNum } from '@project/pricing/hotelPricing';

export default createEndpoint({
  description: 'Commercial integrity summary for one hotel',
  inputSchema: z.object({ hotelId: z.string() }),
  outputSchema: z.object({
    roomTypes: z.number(),
    activeRatePlans: z.number(),
    mealMappingIssues: z.number(),
    validDailyRates: z.number(),
    quarantinedRates: z.number(),
    duplicateRates: z.number(),
    currencyIssues: z.number(),
    eventIssues: z.number(),
    sellableNext30Days: z.boolean(),
    issueCount: z.number(),
    issues: z.array(z.string()),
  }),
  execute: async ({ input }) => {
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const endDate = new Date(today);
    endDate.setUTCDate(endDate.getUTCDate() + 30);
    const end = endDate.toISOString().slice(0, 10);

    const [roomTypesRes, plansRes, ratesRes, eventsRes] = await Promise.all([
      zite.roomTypes.findAll({ filters: { hotel: { contains: input.hotelId } }, limit: 500 }),
      zite.ratePlans.findAll({ filters: { hotel: { contains: input.hotelId } }, limit: 1000 }),
      zite.dailyRates.findAll({ filters: { hotel: { contains: input.hotelId } }, limit: 2000 }),
      zite.eventMaster.findAll({ filters: { hotel: { contains: input.hotelId } }, limit: 1000 }),
    ]);

    const roomTypeIds = new Set(roomTypesRes.records.map(r => r.id));
    const activePlans = plansRes.records.filter(p => p.status === 'Active');
    const planById = new Map(activePlans.map(p => [p.id, p]));

    const issues: string[] = [];
    let mealMappingIssues = 0;
    for (const plan of activePlans) {
      const roomId = linkedId(plan.roomType);
      const mealMaster = linkedId(plan.mealPlanMaster);
      if (!roomId || !roomTypeIds.has(roomId)) {
        issues.push(`Rate Plan "${plan.ratePlanName || plan.id}" has an invalid Room Type relationship`);
      }
      if (!plan.mealPlan || !CANONICAL_MEAL_PLANS.includes(plan.mealPlan as any) || !mealMaster) {
        mealMappingIssues++;
      }
      if (plan.sellCurrency && plan.sellCurrency !== 'AED') {
        issues.push(`Rate Plan "${plan.ratePlanName || plan.id}" is not AED`);
      }
    }
    if (mealMappingIssues) issues.push(`${mealMappingIssues} active Rate Plan(s) have meal mapping issues`);

    let validDailyRates = 0;
    let quarantinedRates = 0;
    let currencyIssues = 0;
    const duplicateMap = new Map<string, number>();
    let sellableNext30Days = false;

    for (const rate of ratesRes.records) {
      if (rate.integrityStatus === 'Quarantined') {
        quarantinedRates++;
        continue;
      }
      if (rate.currency && rate.currency !== 'AED') {
        currencyIssues++;
        continue;
      }
      const roomId = linkedId(rate.roomType);
      const planId = linkedId(rate.ratePlan);
      const hotelId = linkedId(rate.hotel);
      const plan = planId ? planById.get(planId) : undefined;
      if (!roomId || !planId || hotelId !== input.hotelId || !plan || linkedId(plan.roomType) !== roomId) continue;
      if (rate.ratePlanId && rate.ratePlanId !== planId) continue;
      if (safeNum(rate.adult1Rate) <= 0 && safeNum(rate.adult2Rate) <= 0 && safeNum(rate.adult3Rate) <= 0) continue;

      validDailyRates++;
      const key = `${rate.rateDate || ''}|${roomId}|${planId}|${rate.layer || 'BASE'}|${safeNum(rate.priority)}`;
      duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);

      if (
        rate.rateDate &&
        rate.rateDate >= start &&
        rate.rateDate < end &&
        rate.status !== 'Stop Sale' &&
        rate.status !== 'On Request' &&
        safeNum(rate.allocation) > 0
      ) {
        sellableNext30Days = true;
      }
    }

    const duplicateRates = Array.from(duplicateMap.values()).filter(n => n > 1).reduce((sum, n) => sum + (n - 1), 0);
    if (duplicateRates) issues.push(`${duplicateRates} duplicate effective Daily Rate row(s)`);
    if (currencyIssues) issues.push(`${currencyIssues} non-AED Daily Rate row(s)`);
    if (quarantinedRates) issues.push(`${quarantinedRates} quarantined Daily Rate row(s)`);

    let eventIssues = 0;
    for (const event of eventsRes.records.filter(e => e.status === 'Active')) {
      if (!event.startDate || !event.endDate || safeNum(event.supplementAmount) <= 0 || linkedId(event.hotel) !== input.hotelId) {
        eventIssues++;
      }
    }
    if (eventIssues) issues.push(`${eventIssues} active Event Master row(s) are incomplete`);
    if (!sellableNext30Days) issues.push('No confirmed sellable Daily Rate in the next 30 days');

    return {
      roomTypes: roomTypesRes.records.filter(r => r.status === 'Active').length,
      activeRatePlans: activePlans.length,
      mealMappingIssues,
      validDailyRates,
      quarantinedRates,
      duplicateRates,
      currencyIssues,
      eventIssues,
      sellableNext30Days,
      issueCount: issues.length,
      issues,
    };
  },
});
