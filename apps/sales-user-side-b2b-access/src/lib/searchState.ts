import { DEFAULT_FILTERS, type Filters, type RoomConfig } from '@/components/sales/SearchFilters';

export function filtersToSearchParams(filters: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.search) p.set('q', filters.search);
  if (filters.checkIn) p.set('checkIn', filters.checkIn);
  if (filters.checkOut) p.set('checkOut', filters.checkOut);
  p.set('adults', String(filters.adults));
  p.set('children', String(filters.children));
  p.set('rooms', String(filters.rooms));
  if (filters.emirate !== 'All') p.set('emirate', filters.emirate);
  if (filters.stars !== 'all') p.set('stars', filters.stars);
  if (filters.mealPlan !== 'All') p.set('mealPlan', filters.mealPlan);
  if (filters.cancellation !== 'All') p.set('cancellation', filters.cancellation);
  if (filters.availability !== 'All') p.set('availability', filters.availability);
  if (filters.location !== 'All') p.set('location', filters.location);
  if (filters.guestRating !== 'All') p.set('guestRating', filters.guestRating);
  if (filters.priceRange[0] !== 0 || filters.priceRange[1] !== 20000) p.set('price', filters.priceRange.join(','));
  if (filters.childAges?.length) p.set('childAges', filters.childAges.join(','));
  if (filters.roomConfigs?.length) p.set('roomConfigs', encodeURIComponent(JSON.stringify(filters.roomConfigs)));
  if (filters.nationality) p.set('nationality', filters.nationality);
  if (filters.extraMarkupPct > 0) p.set('extraMarkupPct', String(Math.min(50, Math.max(0, filters.extraMarkupPct))));
  return p;
}

export function filtersFromSearchParams(params: URLSearchParams): Filters {
  const adults = Math.max(1, Number(params.get('adults') || DEFAULT_FILTERS.adults));
  const children = Math.max(0, Number(params.get('children') || DEFAULT_FILTERS.children));
  const rooms = Math.max(1, Number(params.get('rooms') || DEFAULT_FILTERS.rooms));
  const childAges = (params.get('childAges') || '')
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);

  let roomConfigs: RoomConfig[] = [];
  const encoded = params.get('roomConfigs');
  if (encoded) {
    try {
      const parsed = JSON.parse(decodeURIComponent(encoded));
      if (Array.isArray(parsed)) roomConfigs = parsed;
    } catch {
      roomConfigs = [];
    }
  }
  if (!roomConfigs.length) {
    roomConfigs = [{ adults, children, childAges }];
  }

  const priceParts = (params.get('price') || '').split(',').map(Number);
  const priceRange: [number, number] =
    priceParts.length === 2 && priceParts.every(Number.isFinite)
      ? [Math.max(0, priceParts[0]), Math.max(0, priceParts[1])]
      : DEFAULT_FILTERS.priceRange;

  return {
    ...DEFAULT_FILTERS,
    search: params.get('q') || '',
    checkIn: params.get('checkIn') || '',
    checkOut: params.get('checkOut') || '',
    adults,
    children,
    rooms,
    childAges,
    roomConfigs,
    emirate: params.get('emirate') || 'All',
    stars: params.get('stars') || 'all',
    mealPlan: params.get('mealPlan') || 'All',
    cancellation: params.get('cancellation') || 'All',
    availability: params.get('availability') || 'All',
    location: params.get('location') || 'All',
    roomType: 'All',
    ratePlan: 'All',
    guestRating: params.get('guestRating') || 'All',
    priceRange,
    nationality: (params.get('nationality') || DEFAULT_FILTERS.nationality).toUpperCase(),
    extraMarkupPct: Math.min(50, Math.max(0, Number(params.get('extraMarkupPct') || DEFAULT_FILTERS.extraMarkupPct) || 0)),
  };
}

export interface RecentSearch {
  id: string;
  label: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  query: string;
  createdAt: number;
  params: string;
}

const KEY = 'uaewb_recent_searches_v1';

export function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(filters: Filters) {
  if (!filters.search && !filters.checkIn && !filters.checkOut) return;
  const params = filtersToSearchParams(filters).toString();
  const item: RecentSearch = {
    id: params,
    label: filters.search || 'UAE Hotels',
    checkIn: filters.checkIn,
    checkOut: filters.checkOut,
    adults: filters.adults,
    children: filters.children,
    rooms: filters.rooms,
    query: filters.search,
    createdAt: Date.now(),
    params,
  };
  const existing = loadRecentSearches().filter(x => x.id !== item.id);
  localStorage.setItem(KEY, JSON.stringify([item, ...existing].slice(0, 6)));
}

export function removeRecentSearch(id: string) {
  const next = loadRecentSearches().filter(x => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
}
