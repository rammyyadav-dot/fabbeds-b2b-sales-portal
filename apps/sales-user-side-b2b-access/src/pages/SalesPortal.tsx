import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSalesPortalData, GetSalesPortalDataOutputType } from 'zitejs/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Skeleton } from '@project/components/ui/skeleton';
import {
  Building2, AlertCircle, ArrowUpDown, SlidersHorizontal, X,
  BadgeCheck, Clock3, CreditCard, ShieldCheck
} from 'lucide-react';
import { Button } from '@project/components/ui/button';
import SalesHeader from '@/components/sales/SalesHeader';
import { Filters } from '@/components/sales/SearchFilters';
import HeroSearch from '@/components/sales/HeroSearch';
import FilterSidebar from '@/components/sales/FilterSidebar';
import HotelCard from '@/components/sales/HotelCard';
import { filtersFromSearchParams, filtersToSearchParams, saveRecentSearch } from '@/lib/searchState';

interface SalesPortalProps { onLogout: () => void; }

type SalesHotel = GetSalesPortalDataOutputType['hotels'][0];
type SalesRate = SalesHotel['rates'][0];

const PAGE_SIZE = 20;

function HotelCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_190px]">
      <Skeleton className="h-52 md:h-full min-h-[230px] rounded-none" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <div className="border-l border-border p-4 space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-3 w-2/3 ml-auto" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

function positiveRates(hotel: SalesHotel) {
  return hotel.rates.filter(r =>
    r.occupancyFit !== false &&
    Number.isFinite(r.displaySellRate) &&
    Number.isFinite(r.displayStaySellTotal) &&
    r.displaySellRate > 0 &&
    r.displayStaySellTotal > 0
  );
}

function refundable(rate: SalesRate) {
  const value = (rate.cancellationSummary || '').toLowerCase();
  return value.includes('free cancellation') || (value.length > 0 && !value.includes('non-refundable'));
}

function recommendationScore(hotel: SalesHotel) {
  const priced = positiveRates(hotel);
  const best = hotel.bestValidOffer?.finalDisplayQuote ?? (priced.length ? Math.min(...priced.map(r => r.displayStaySellTotal)) : null);
  let score = 0;

  if (hotel.bestValidOffer?.completeStayPricing || priced.length) score += 100;
  if (hotel.rates.some(r => r.status === 'Free Sale' && r.occupancyFit !== false)) score += 35;
  if (hotel.rates.some(r => r.status === 'Limited' && r.occupancyFit !== false)) score += 15;
  if (hotel.rates.some(refundable)) score += 12;
  score += Math.min(15, priced.length * 2);
  score += (parseInt(hotel.starRating) || 0) * 3;

  if (hotel.guestRating && hotel.reviewCount > 0) {
    score += hotel.guestRating * 2;
    score += Math.min(8, Math.log10(hotel.reviewCount + 1) * 2);
  }

  // Small deterministic preference for commercially lower complete-stay offers.
  if (best != null) score += Math.max(0, 12 - Math.log10(best + 1) * 2);
  return score;
}

export default function SalesPortal({ onLogout }: SalesPortalProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => filtersFromSearchParams(searchParams));
  const [sortBy, setSortBy] = useState('recommended');
  const [data, setData] = useState<GetSalesPortalDataOutputType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSalesPortalData({
      checkIn: filters.checkIn || undefined,
      checkOut: filters.checkOut || undefined,
      adults: filters.adults,
      children: filters.children,
      childAges: filters.childAges,
      roomConfigs: filters.roomConfigs?.length ? filters.roomConfigs : undefined,
      nationality: filters.nationality,
      extraMarkupPct: filters.extraMarkupPct,
    })
      .then(setData)
      .catch(() => setError('Failed to load hotel data. Please refresh.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.checkIn,
    filters.checkOut,
    filters.adults,
    filters.children,
    filters.rooms,
    JSON.stringify(filters.roomConfigs),
    filters.nationality,
    filters.extraMarkupPct,
  ]);

  const commitSearch = () => {
    saveRecentSearch(filters);
    setSearchParams(filtersToSearchParams(filters), { replace: true });
    setVisibleCount(PAGE_SIZE);
    document.getElementById('hotel-results')?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setSearchParams(filtersToSearchParams(filters), { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.search,
    filters.emirate,
    filters.stars,
    filters.mealPlan,
    filters.cancellation,
    filters.availability,
    filters.location,
    filters.guestRating,
    filters.priceRange[0],
    filters.priceRange[1],
  ]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sortBy]);

  const nights = useMemo(() => {
    if (!filters.checkIn || !filters.checkOut) return 0;
    return Math.max(0, Math.round(
      (new Date(filters.checkOut).getTime() - new Date(filters.checkIn).getTime()) / 86400000
    ));
  }, [filters.checkIn, filters.checkOut]);

  const filterOptions = useMemo(() => {
    if (!data) return { locations: [] as string[] };
    const locations = Array.from(
      new Set(data.hotels.map(h => h.location?.trim()).filter((v): v is string => !!v))
    ).sort((a, b) => a.localeCompare(b));
    return { locations };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filters.search.trim().toLowerCase();
    const [min, max] = filters.priceRange ?? [0, 20000];

    const result = data.hotels.filter(h => {
      if (q &&
        !h.name.toLowerCase().includes(q) &&
        !h.location?.toLowerCase().includes(q) &&
        !h.emirate?.toLowerCase().includes(q)
      ) return false;

      if (filters.emirate !== 'All' && h.emirate !== filters.emirate) return false;
      if (filters.location !== 'All' && h.location !== filters.location) return false;
      if (filters.stars !== 'all' && h.starRating !== filters.stars) return false;
      if (filters.guestRating !== 'All') {
        const threshold = Number(filters.guestRating);
        if (!h.guestRating || h.reviewCount <= 0 || h.guestRating < threshold) return false;
      }

      const fitRates = h.rates.filter(r => r.occupancyFit !== false);
      if (filters.mealPlan !== 'All' && !fitRates.some(r => r.mealPlan === filters.mealPlan)) return false;
      if (filters.availability !== 'All' &&
          !fitRates.some(r => r.status === filters.availability) &&
          h.bestValidOffer?.status !== filters.availability) return false;

      if (filters.cancellation === 'Refundable' && !fitRates.some(refundable)) return false;
      if (filters.cancellation === 'Non-refundable' &&
          !fitRates.some(r => (r.cancellationSummary || '').toLowerCase().includes('non-refundable'))) return false;

      const monetaryRates = positiveRates(h);
      const authoritativeAvg = h.bestValidOffer?.averagePerRoomNight ?? null;
      if (authoritativeAvg != null) {
        if (authoritativeAvg < min || authoritativeAvg > max) return false;
      } else if (monetaryRates.length > 0 && !monetaryRates.some(r => r.displaySellRate >= min && r.displaySellRate <= max)) {
        return false;
      }

      return true;
    });

    return [...result].sort((a, b) => {
      const aRates = positiveRates(a);
      const bRates = positiveRates(b);
      const aMin = a.bestValidOffer?.averagePerRoomNight ?? (aRates.length ? Math.min(...aRates.map(r => r.displaySellRate)) : null);
      const bMin = b.bestValidOffer?.averagePerRoomNight ?? (bRates.length ? Math.min(...bRates.map(r => r.displaySellRate)) : null);

      if (sortBy === 'price-asc') {
        if (aMin === null && bMin === null) return a.name.localeCompare(b.name);
        if (aMin === null) return 1;
        if (bMin === null) return -1;
        return aMin - bMin;
      }
      if (sortBy === 'price-desc') {
        if (aMin === null && bMin === null) return a.name.localeCompare(b.name);
        if (aMin === null) return 1;
        if (bMin === null) return -1;
        return bMin - aMin;
      }
      if (sortBy === 'stars-desc') return (parseInt(b.starRating) || 0) - (parseInt(a.starRating) || 0);
      if (sortBy === 'guest-rating') return (b.guestRating || 0) - (a.guestRating || 0);
      if (sortBy === 'free-sale') {
        const av = a.rates.some(r => r.status === 'Free Sale' && r.occupancyFit !== false) ? 1 : 0;
        const bv = b.rates.some(r => r.status === 'Free Sale' && r.occupancyFit !== false) ? 1 : 0;
        if (av !== bv) return bv - av;
        return recommendationScore(b) - recommendationScore(a);
      }
      if (sortBy === 'free-cancellation') {
        const av = a.rates.some(refundable) ? 1 : 0;
        const bv = b.rates.some(refundable) ? 1 : 0;
        if (av !== bv) return bv - av;
        return recommendationScore(b) - recommendationScore(a);
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return recommendationScore(b) - recommendationScore(a);
    });
  }, [data, filters, sortBy]);

  const summary = useMemo(() => {
    let priced = 0;
    let freeSale = 0;
    let onRequest = 0;
    let refundableHotels = 0;
    for (const h of filtered) {
      if (positiveRates(h).length > 0) priced++;
      if (h.rates.some(r => r.status === 'Free Sale' && r.occupancyFit !== false)) freeSale++;
      if (h.rates.some(r => r.status === 'On Request' && r.occupancyFit !== false)) onRequest++;
      if (h.rates.some(refundable)) refundableHotels++;
    }
    return { priced, freeSale, onRequest, refundableHotels };
  }, [filtered]);

  const visibleHotels = filtered.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={filtered.length} />

      {/* Existing search widget remains the source of stay/occupancy criteria */}
      <HeroSearch
        filters={filters}
        onChange={setFilters}
        onSearch={commitSearch}
        variant="compact"
        hotels={data?.hotels.map(h => ({ id: h.id, name: h.name, location: h.location, emirate: h.emirate })) ?? []}
      />

      <main className="container mx-auto px-4 py-5 max-w-7xl">
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-6 mt-3">
          {/* Desktop filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="bg-card border border-border rounded-xl p-4 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <FilterSidebar
                filters={filters}
                onChange={setFilters}
                resultCount={filtered.length}
                locations={filterOptions.locations}
              />
            </div>
          </aside>

          {/* Results */}
          <div id="hotel-results" className="flex-1 min-w-0">
            {!loading && !error && (
              <div className="sticky top-0 z-20 bg-muted/95 backdrop-blur pb-3">
                <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <p className="text-sm font-bold">{filtered.length} hotels found</p>
                        {nights > 0 && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            {nights} night{nights !== 1 ? 's' : ''} · {filters.rooms} room{filters.rooms !== 1 ? 's' : ''} · {filters.adults} adult{filters.adults !== 1 ? 's' : ''}
                            {filters.children > 0 ? ` · ${filters.children} child${filters.children !== 1 ? 'ren' : ''}` : ''}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="lg:hidden h-8 text-xs gap-1"
                          onClick={() => setMobileSidebarOpen(v => !v)}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1">
                          <CreditCard className="w-3 h-3" /> {summary.priced} priced
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1">
                          <BadgeCheck className="w-3 h-3" /> {summary.freeSale} Free Sale
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-2 py-1">
                          <Clock3 className="w-3 h-3" /> {summary.onRequest} On Request
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-2 py-1">
                          <ShieldCheck className="w-3 h-3" /> {summary.refundableHotels} refundable
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">Sort:</span>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-52 h-9 text-xs gap-1 bg-white">
                          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recommended">Recommended</SelectItem>
                          <SelectItem value="price-asc">Price: Low → High</SelectItem>
                          <SelectItem value="price-desc">Price: High → Low</SelectItem>
                          <SelectItem value="free-sale">Free Sale first</SelectItem>
                          <SelectItem value="free-cancellation">Free cancellation first</SelectItem>
                          <SelectItem value="guest-rating">Guest rating</SelectItem>
                          <SelectItem value="stars-desc">Stars: High → Low</SelectItem>
                          <SelectItem value="name">Name A → Z</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mobileSidebarOpen && (
              <div className="lg:hidden bg-card border border-border rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">Filters</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMobileSidebarOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <FilterSidebar
                  filters={filters}
                  onChange={setFilters}
                  resultCount={filtered.length}
                  locations={filterOptions.locations}
                />
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => <HotelCardSkeleton key={i} />)}
              </div>
            ) : !error && filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-xl">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-base">{data?.hotels.length === 0 ? 'No hotels in database yet' : 'No properties match your search'}</p>
                <p className="text-sm mt-1">{data?.hotels.length === 0 ? 'Add hotels via the admin panel' : 'Try adjusting location, availability, cancellation, meal-plan or price filters.'}</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {visibleHotels.map(hotel => (
                    <HotelCard
                      key={hotel.id}
                      hotel={hotel}
                      mealPlanFilter={filters.mealPlan}
                      checkIn={filters.checkIn}
                      checkOut={filters.checkOut}
                      adults={filters.adults}
                      children={filters.children}
                      rooms={filters.rooms}
                      roomConfigs={filters.roomConfigs}
                      nationality={filters.nationality}
                      extraMarkupPct={filters.extraMarkupPct}
                    />
                  ))}
                </div>

                {visibleCount < filtered.length && (
                  <div className="flex flex-col items-center py-8">
                    <p className="text-xs text-muted-foreground mb-3">
                      Showing {visibleHotels.length} of {filtered.length} hotels
                    </p>
                    <Button variant="outline" onClick={() => setVisibleCount(v => Math.min(v + PAGE_SIZE, filtered.length))}>
                      Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more hotels
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
