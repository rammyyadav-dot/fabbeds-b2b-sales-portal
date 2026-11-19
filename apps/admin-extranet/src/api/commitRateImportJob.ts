import { requireStaff } from '../lib/requireStaff';
import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const MEAL_PLAN_MAP: Record<string, string> = {
  'RO': 'Room Only', 'BB': 'Bed & Breakfast', 'HB': 'Half Board',
  'HB+': 'Half Board', 'FB': 'Full Board', 'AI': 'All Inclusive',
};

function normalizeMealPlan(label: string): string {
  const key = label.trim().toUpperCase().replace(/\s+/g, '');
  return MEAL_PLAN_MAP[key] ?? label;
}

function expandDateRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(fromDate);
  const end = new Date(toDate);
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function mapLayer(layer: string): string {
  if (layer === 'PROMO') return 'PROMO';
  return 'BASE';
}

export default createEndpoint({
  authenticated: true,
  description: 'Commit a validated rate import job: upsert RatePlans + write DailyRates',
  inputSchema: z.object({ jobId: z.string() }),
  outputSchema: z.object({
    ratePlansCreated: z.number(),
    ratePlansReused: z.number(),
    dailyRatesWritten: z.number(),
    skipped: z.number(),
    errors: z.number(),
  }),
  execute: async ({ input, context }) => {
    await requireStaff(context, 'commitRateImportJob');
    await enrichCurrentUser(context);
    const job = await zite.rateImportJobs.findOne({ id: input.jobId });
    if (!job) throw new Error('Job not found');
    if (job.status === 'Committed') throw new Error('Job already committed');

    const hotelId = Array.isArray(job.hotel) ? job.hotel[0] : job.hotel;
    const conflictMode = job.conflictMode ?? 'Override';
    const layer = job.layer ?? 'BAR';
    const currency = job.currency ?? 'AED';
    const dailyLayer = mapLayer(layer);

    // Load all lines (no errors)
    const allLines: any[] = [];
    let offset = 0;
    while (true) {
      const { records, hasMore } = await zite.rateImportLines.findAll({
        filters: { importJob: input.jobId },
        offset, limit: 500,
      });
      allLines.push(...records);
      if (!hasMore) break;
      offset += 500;
    }

    if (job.status !== 'Validated') throw new Error('Validate the complete import before committing');
    const validLines = allLines.filter(l => l.validationStatus !== 'Error' && l.mappedRoomTypeId && l.mappedMealPlan);
    if (validLines.length !== allLines.length || !validLines.length) throw new Error('Every import line needs a valid room and meal plan');

    const { records: masters } = await zite.mealPlans.findAll({ filters: { status: 'Active' }, limit: 50 });
    const masterByLabel = new Map(masters.filter(m => ['RO', 'BB', 'HB', 'FB', 'AI'].includes(m.code ?? '')).map(m => [m.agentLabel, m.id]));
    const mappedRooms = new Set<string>();
    for (const line of validLines) {
      if (!line.fromDate || !line.toDate || new Date(line.fromDate) > new Date(line.toDate)) throw new Error('Invalid rate import date range');
      const meal = normalizeMealPlan(line.mappedMealPlan);
      if (!masterByLabel.has(meal)) throw new Error(`Unsupported meal plan: ${line.mappedMealPlan}`);
      if (!mappedRooms.has(line.mappedRoomTypeId)) {
        const room = await zite.roomTypes.findOne({ id: line.mappedRoomTypeId });
        const roomHotel = Array.isArray(room?.hotel) ? room.hotel[0] : room?.hotel;
        if (roomHotel !== hotelId) throw new Error('Mapped Room Type does not belong to the import hotel');
        mappedRooms.add(line.mappedRoomTypeId);
      }
    }
    const planLayer = layer === 'PROMO' ? 'Promo' : 'Base';

    // Cache rate plans: key = roomTypeId|mealPlan
    const ratePlanCache = new Map<string, string>();
    let ratePlansCreated = 0, ratePlansReused = 0;
    let dailyRatesWritten = 0, skipped = 0, errors = 0;

    // Load existing rate plans for this hotel
    const { records: existingPlans } = await zite.ratePlans.findAll({
      filters: { hotel: hotelId },
      limit: 2000,
    });
    for (const rp of existingPlans) {
      const rtId = Array.isArray(rp.roomType) ? rp.roomType[0] : rp.roomType;
      if (rtId && rp.mealPlan && rp.status === 'Active' && rp.ratePlanCode?.endsWith(`_${layer}`)) {
        const key = `${rtId}|${rp.mealPlan}|${layer}`;
        ratePlanCache.set(key, rp.id);
      }
    }

    // Group lines by (roomTypeId, mealPlan) to upsert rate plans
    const uniqueRpKeys = new Set<string>();
    for (const line of validLines) {
      const mealPlanNorm = normalizeMealPlan(line.mappedMealPlan);
      const key = `${line.mappedRoomTypeId}|${mealPlanNorm}|${layer}`;
      uniqueRpKeys.add(key);
    }

    for (const key of uniqueRpKeys) {
      if (ratePlanCache.has(key)) {
        ratePlansReused++;
        continue;
      }
      const [rtId, mealPlan] = key.split('|');
      const rtName = validLines.find(l => l.mappedRoomTypeId === rtId)?.mappedRoomTypeName ?? rtId;
      const rpName = `${rtName} ${mealPlan} ${layer}`;
      const rpCode = `${(rtName ?? '').replace(/\s+/g, '_').toUpperCase()}_${mealPlan.replace(/\s+/g, '_').toUpperCase()}_${layer}`;

      const newRp = await zite.ratePlans.create({
        record: {
          ratePlanName: rpName,
          hotel: hotelId,
          roomType: rtId,
          mealPlan: mealPlan as any,
          mealPlanMaster: [masterByLabel.get(mealPlan)!],
          layer: planLayer,
          ratePlanCode: rpCode,
          status: 'Active',
        },
      });
      ratePlanCache.set(key, newRp.id);
      ratePlansCreated++;
    }

    // Write daily rates
    for (const line of validLines) {
      if (!line.fromDate || !line.toDate) { errors++; continue; }
      const mealPlanNorm = normalizeMealPlan(line.mappedMealPlan);
      const rpKey = `${line.mappedRoomTypeId}|${mealPlanNorm}|${layer}`;
      const ratePlanId = ratePlanCache.get(rpKey);
      if (!ratePlanId) { errors++; continue; }

      const dates = expandDateRange(line.fromDate, line.toDate);
      const occKey = (line.occupancyKey ?? 'DBL').toUpperCase();

      for (const date of dates) {
        // Check for existing rate
        const { records: sameDateRates } = await zite.dailyRates.findAll({
          filters: { hotel: hotelId, roomType: line.mappedRoomTypeId, rateDate: date, layer: dailyLayer },
          limit: 200,
        });
        const existing = sameDateRates.find(r => r.ratePlanId === ratePlanId);

        if (existing && conflictMode === 'Skip') { skipped++; continue; }
        if (existing && conflictMode === 'Stop on Conflict') throw new Error(`Conflict at ${date} for room ${line.mappedRoomTypeId}`);

        const rateFields: any = {
          rateDate: date,
          hotel: hotelId,
          roomType: line.mappedRoomTypeId,
          currency,
          layer: dailyLayer,
          ratePlanId,
          ratePlan: [ratePlanId],
          integrityStatus: 'Valid',
          integrityCode: null,
          status: line.stopSell ? 'Stop Sale' : 'Free Sale',
          minStay: line.minStay,
        };

        if (occKey === 'SGL') { rateFields.adult1Rate = line.amount; rateFields.adult2Rate = line.amount; } // SGL/DBL = same rate
        else if (occKey === 'DBL') rateFields.adult2Rate = line.amount;
        else if (occKey === 'TPL') rateFields.adult3Rate = line.amount;

        if (existing) {
          await zite.dailyRates.update({ id: existing.id, record: rateFields });
        } else {
          await zite.dailyRates.create({ record: rateFields });
        }
        dailyRatesWritten++;
      }
    }

    await zite.rateImportJobs.update({
      id: input.jobId,
      record: {
        status: 'Committed',
        committedCount: dailyRatesWritten,
        skippedCount: skipped,
        errorCount: errors,
      },
    });

    return { ratePlansCreated, ratePlansReused, dailyRatesWritten, skipped, errors };
  },
});
