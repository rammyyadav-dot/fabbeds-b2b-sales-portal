// Shared search/filter types for the OTA-style hotel results workflow.

export interface RoomConfig {
  adults: number;
  children: number;
  childAges: number[];
}

export interface Filters {
  search: string;
  emirate: string;
  stars: string;
  mealPlan: string;
  cancellation: string;
  availability: string;
  location: string;
  roomType: string;
  ratePlan: string;
  guestRating: string;
  checkIn: string;
  checkOut: string;
  priceRange: [number, number];
  adults: number;
  children: number;
  rooms: number;
  childAges: number[];
  roomConfigs: RoomConfig[];
  nationality: string;
  extraMarkupPct: number;
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  emirate: 'All',
  stars: 'all',
  mealPlan: 'All',
  cancellation: 'All',
  availability: 'All',
  location: 'All',
  roomType: 'All',
  ratePlan: 'All',
  guestRating: 'All',
  checkIn: '',
  checkOut: '',
  priceRange: [0, 20000],
  adults: 2,
  children: 0,
  rooms: 1,
  childAges: [],
  roomConfigs: [{ adults: 2, children: 0, childAges: [] }],
  nationality: 'IN',
  extraMarkupPct: 0,
};

export default function SearchFilters(_props: { filters: Filters; onChange: (f: Filters) => void }) {
  return null;
}
