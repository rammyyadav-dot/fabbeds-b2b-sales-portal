import type { ReactNode } from 'react';
import { Slider } from '@project/components/ui/slider';
import { Button } from '@project/components/ui/button';
import {
  X, Star, Utensils, MapPin, SlidersHorizontal, ShieldCheck,
  BadgeCheck, Gauge
} from 'lucide-react';
import { Filters, DEFAULT_FILTERS } from './SearchFilters';

interface FilterSidebarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  resultCount: number;
  locations?: string[];
}

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Fujairah', 'Ajman', 'Umm Al Quwain'];
const STAR_OPTIONS = [{ label: '5 Stars', value: '5 Star' }, { label: '4 Stars', value: '4 Star' }, { label: '3 Stars', value: '3 Star' }];
const MEAL_PLANS = ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All Inclusive'];

export default function FilterSidebar({
  filters,
  onChange,
  resultCount,
  locations = [],
}: FilterSidebarProps) {
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  const hasFilters =
    filters.emirate !== 'All' ||
    filters.stars !== 'all' ||
    filters.mealPlan !== 'All' ||
    filters.cancellation !== 'All' ||
    filters.availability !== 'All' ||
    filters.location !== 'All' ||
    filters.guestRating !== 'All' ||
    filters.priceRange[0] !== 0 ||
    filters.priceRange[1] !== 20000;

  const reset = () => onChange({
    ...DEFAULT_FILTERS,
    search: filters.search,
    checkIn: filters.checkIn,
    checkOut: filters.checkOut,
    adults: filters.adults,
    children: filters.children,
    rooms: filters.rooms,
    childAges: filters.childAges,
    roomConfigs: filters.roomConfigs,
  });

  return (
    <aside className="w-full space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Filter by
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{resultCount} matching hotels</p>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary px-2" onClick={reset}>
            <X className="w-3 h-3 mr-1" /> Reset
          </Button>
        )}
      </div>

      <FilterSection title="Budget per room / night" icon={<Gauge className="w-3.5 h-3.5" />}>
        <div className="space-y-3 pt-1">
          <Slider
            min={0}
            max={20000}
            step={100}
            value={filters.priceRange}
            onValueChange={(v) => update('priceRange', v as [number, number])}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>AED {filters.priceRange[0].toLocaleString()}</span>
            <span>AED {filters.priceRange[1].toLocaleString()}</span>
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Availability" icon={<BadgeCheck className="w-3.5 h-3.5" />}>
        <CheckOption label="Free Sale" checked={filters.availability === 'Free Sale'} onChange={v => update('availability', v ? 'Free Sale' : 'All')} />
        <CheckOption label="Limited" checked={filters.availability === 'Limited'} onChange={v => update('availability', v ? 'Limited' : 'All')} />
        <CheckOption label="On Request" checked={filters.availability === 'On Request'} onChange={v => update('availability', v ? 'On Request' : 'All')} />
      </FilterSection>

      <FilterSection title="Cancellation" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
        <CheckOption label="Free cancellation" checked={filters.cancellation === 'Refundable'} onChange={v => update('cancellation', v ? 'Refundable' : 'All')} />
        <CheckOption label="Non-refundable" checked={filters.cancellation === 'Non-refundable'} onChange={v => update('cancellation', v ? 'Non-refundable' : 'All')} />
      </FilterSection>

      <FilterSection title="Star rating" icon={<Star className="w-3.5 h-3.5" />}>
        {STAR_OPTIONS.map(s => (
          <CheckOption
            key={s.value}
            label={s.label}
            checked={filters.stars === s.value}
            onChange={v => update('stars', v ? s.value : 'all')}
          />
        ))}
      </FilterSection>

      <FilterSection title="Guest rating" icon={<Star className="w-3.5 h-3.5" />}>
        <CheckOption label="8+ Very good" checked={filters.guestRating === '8'} onChange={v => update('guestRating', v ? '8' : 'All')} />
        <CheckOption label="9+ Excellent" checked={filters.guestRating === '9'} onChange={v => update('guestRating', v ? '9' : 'All')} />
      </FilterSection>

      <FilterSection title="Meal plan" icon={<Utensils className="w-3.5 h-3.5" />}>
        {MEAL_PLANS.map(m => (
          <CheckOption key={m} label={m} checked={filters.mealPlan === m} onChange={v => update('mealPlan', v ? m : 'All')} />
        ))}
      </FilterSection>

      {locations.length > 0 && (
        <FilterSection title="Location" icon={<MapPin className="w-3.5 h-3.5" />}>
          {locations.slice(0, 16).map(v => (
            <CheckOption
              key={v}
              label={v}
              checked={filters.location === v}
              onChange={checked => update('location', checked ? v : 'All')}
            />
          ))}
        </FilterSection>
      )}

      <FilterSection title="Emirate" icon={<MapPin className="w-3.5 h-3.5" />}>
        {EMIRATES.map(e => (
          <CheckOption key={e} label={e} checked={filters.emirate === e} onChange={v => update('emirate', v ? e : 'All')} />
        ))}
      </FilterSection>
    </aside>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer group py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="rounded border-border mt-0.5"
      />
      <span className="text-sm leading-tight text-foreground group-hover:text-primary transition-colors">{label}</span>
    </label>
  );
}

function FilterSection({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-b border-border py-4">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
        {icon}{title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
