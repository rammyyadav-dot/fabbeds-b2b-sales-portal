type EligibilityInput = {
  ratePlan: any;
  requestedNationality?: string;
  requestedResidency?: string;
  agencyCountry?: string;
};

function linkedIds(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
}

export async function loadMarketContext(zite: any) {
  const [countriesRes, profilesRes, membershipsRes] = await Promise.all([
    zite.countryMaster.findAll({ filters: { active: true }, limit: 500 }),
    zite.sourceMarketProfiles.findAll({ filters: { status: 'Active' }, limit: 200 }),
    zite.sourceMarketCountries.findAll({ limit: 1000 }),
  ]);

  const countryById = new Map<string, any>(countriesRes.records.map((c: any) => [c.id, c]));
  const countryByIso2 = new Map<string, any>(countriesRes.records.map((c: any) => [String(c.iso2Code || '').toUpperCase(), c]));
  const profileById = new Map<string, any>(profilesRes.records.map((m: any) => [m.id, m]));
  const profileCountries = new Map<string, Set<string>>();

  for (const m of membershipsRes.records as any[]) {
    const marketId = Array.isArray(m.sourceMarket) ? m.sourceMarket[0] : m.sourceMarket;
    const countryId = Array.isArray(m.country) ? m.country[0] : m.country;
    if (!marketId || !countryId) continue;
    const country = countryById.get(countryId);
    const iso2 = String(country?.iso2Code || '').toUpperCase();
    if (!iso2) continue;
    const set = profileCountries.get(marketId) ?? new Set<string>();
    set.add(iso2);
    profileCountries.set(marketId, set);
  }

  return { countryByIso2, profileById, profileCountries };
}

export function resolveRatePlanEligibility(
  ctx: Awaited<ReturnType<typeof loadMarketContext>>,
  input: EligibilityInput,
) {
  const rp = input.ratePlan;
  const basis = String(rp.marketEligibilityType || 'Guest Nationality');
  const applicability = String(rp.marketApplicability || '').trim();
  const requested =
    basis === 'Guest Residency' ? input.requestedResidency :
    basis === 'Agency Source Market' ? input.agencyCountry :
    input.requestedNationality;
  const code = String(requested || '').toUpperCase();

  const excludedIds = new Set(linkedIds(rp.excludedCountries));
  if (code) {
    const country = ctx.countryByIso2.get(code);
    if (country && excludedIds.has(country.id)) {
      return { eligible: false, code, reason: 'EXCLUDED_COUNTRY', marketId: null as string | null };
    }
  }

  if (!applicability || applicability === 'Worldwide') {
    return { eligible: true, code, reason: 'WORLDWIDE', marketId: null as string | null };
  }

  if (!code) return { eligible: false, code, reason: 'MISSING_ELIGIBILITY_CONTEXT', marketId: null as string | null };

  if (applicability === 'Selected Countries') {
    const country = ctx.countryByIso2.get(code);
    const included = new Set(linkedIds(rp.includedCountries));
    return {
      eligible: !!country && included.has(country.id),
      code,
      reason: !!country && included.has(country.id) ? 'EXACT_COUNTRY' : 'COUNTRY_NOT_INCLUDED',
      marketId: null as string | null,
    };
  }

  if (applicability === 'Selected Markets') {
    const marketIds = linkedIds(rp.sourceMarkets);
    const matching = marketIds
      .map(id => ({ id, countries: ctx.profileCountries.get(id) ?? new Set<string>(), profile: ctx.profileById.get(id) }))
      .filter(x => x.countries.has(code))
      .sort((a, b) => Number(b.profile?.priority || 0) - Number(a.profile?.priority || 0));
    const winner = matching[0];
    return {
      eligible: !!winner,
      code,
      reason: winner ? 'SOURCE_MARKET' : 'MARKET_NOT_INCLUDED',
      marketId: winner?.id || null,
    };
  }

  // Legacy compatibility only: explicit old code list, fail closed if restricted.
  const legacy = String(rp.nationalityMarket || '').trim().toUpperCase();
  if (!legacy || legacy === 'ALL' || legacy === '*' || legacy === 'GLOBAL') {
    return { eligible: true, code, reason: 'LEGACY_WORLDWIDE', marketId: null as string | null };
  }
  const codes = legacy.split(/[\s,;|/]+/).filter(Boolean);
  return { eligible: codes.includes(code), code, reason: codes.includes(code) ? 'LEGACY_EXACT' : 'LEGACY_NOT_ELIGIBLE', marketId: null as string | null };
}
