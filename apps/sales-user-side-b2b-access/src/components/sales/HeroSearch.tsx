import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { Calendar } from '@project/components/ui/calendar';
import { Search, Users, MapPin, CalendarDays, Building2, X, TrendingDown, Users2, Globe2, BadgePercent, Sparkles } from 'lucide-react';
import { format, addDays, differenceInDays, startOfDay, startOfMonth } from 'date-fns';
import { Filters } from './SearchFilters';
import GuestSelector from './GuestSelector';
import { getCountryMaster, GetCountryMasterOutputType } from 'zitejs/api';
type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};
interface Suggestion {
  label: string;
  sublabel: string;
  type: 'hotel' | 'location';
  value: string;
}

type CountryOption = GetCountryMasterOutputType['countries'][0];
interface HeroSearchProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  onSearch?: () => void;
  variant?: 'hero' | 'compact';
  hotels?: {
    id: string;
    name: string;
    location?: string;
    emirate?: string;
  }[];
}
function buildSuggestions(query: string, hotels: HeroSearchProps['hotels'] = []): Suggestion[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const results: Suggestion[] = [];
  const addedLocations = new Set<string>();
  hotels.forEach(h => {
    if (h.name.toLowerCase().includes(q)) results.push({
      label: h.name,
      sublabel: h.location || h.emirate || '',
      type: 'hotel',
      value: h.name
    });
    const loc = h.location || h.emirate || '';
    if (loc && loc.toLowerCase().includes(q) && !addedLocations.has(loc)) {
      addedLocations.add(loc);
      results.push({
        label: loc,
        sublabel: 'Destination',
        type: 'location',
        value: loc
      });
    }
  });
  return results.slice(0, 6);
}
function buildGuestLabel(adults: number, children: number, childAges: number[], rooms: number) {
  let label = `${adults} adult${adults !== 1 ? 's' : ''}`;
  if (children > 0) {
    const validAges = childAges.filter(a => a >= 0);
    const agesStr = validAges.length === children ? ` (${validAges.map(a => a === 0 ? '<1' : a).join(', ')})` : '';
    label += ` · ${children} child${children !== 1 ? 'ren' : ''}${agesStr}`;
  }
  label += ` · ${rooms} room${rooms !== 1 ? 's' : ''}`;
  return label;
}
export default function HeroSearch({
  filters,
  onChange,
  onSearch,
  variant = 'hero',
  hotels = []
}: HeroSearchProps) {
  const navigate = useNavigate();
  const update = <K extends keyof Filters,>(key: K, value: Filters[K]) => onChange({
    ...filters,
    [key]: value
  });
  const today = startOfDay(new Date());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const selectedMarket = countries.find(c => c.iso2 === filters.nationality);
  const [nationalityQuery, setNationalityQuery] = useState('');
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalityActiveIndex, setNationalityActiveIndex] = useState(0);
  const [nationalityTouched, setNationalityTouched] = useState(false);
  const nationalityInputRef = useRef<HTMLInputElement>(null);
  const [markupOpen, setMarkupOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(today));
  const [dateError, setDateError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buildInquiryParams = () => {
    const p = new URLSearchParams();
    if (filters.checkIn) p.set('checkIn', filters.checkIn);
    if (filters.checkOut) p.set('checkOut', filters.checkOut);
    if (filters.search) p.set('hotel', filters.search);
    p.set('adults', String(filters.adults));
    p.set('children', String(filters.children));
    p.set('rooms', String(filters.rooms));
    return p.toString();
  };
  const checkInDate = filters.checkIn ? new Date(filters.checkIn + 'T00:00:00') : undefined;
  const checkOutDate = filters.checkOut ? new Date(filters.checkOut + 'T00:00:00') : undefined;
  const nights = checkInDate && checkOutDate ? differenceInDays(checkOutDate, checkInDate) : 0;
  const dateRange: DateRange = {
    from: checkInDate,
    to: checkOutDate
  };

  useEffect(() => {
    getCountryMaster({})
      .then(r => setCountries(r.countries))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!dateOpen) return;
    setCalendarMonth(startOfMonth(checkInDate && checkInDate >= today ? checkInDate : today));
  }, [dateOpen]);

  useEffect(() => {
    if (checkInDate && checkInDate < today) {
      onChange({ ...filters, checkIn: '', checkOut: '' });
      setDateError('Past dates were cleared. Please choose a current or future stay.');
      return;
    }
    if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      onChange({ ...filters, checkOut: '' });
      setDateError('Check-out must be later than check-in.');
    }
  }, [filters.checkIn, filters.checkOut]);
  useEffect(() => {
    const market = countries.find(c => c.iso2 === filters.nationality);
    if (!nationalityOpen && !nationalityTouched) {
      setNationalityQuery(market?.name || '');
    }
  }, [filters.nationality, nationalityOpen, nationalityTouched, countries]);

  const nationalitySuggestions = countries
    .filter(country => {
      const q = nationalityQuery.trim().toLowerCase();
      if (!q) return true;
      return country.iso2.toLowerCase().startsWith(q)
        || country.iso3.toLowerCase().startsWith(q)
        || country.name.toLowerCase().startsWith(q)
        || country.name.toLowerCase().includes(q);
    })
    .slice(0, 30);

  const commitNationality = (code: string, label: string) => {
    update('nationality', code);
    setNationalityQuery(label);
    setNationalityOpen(false);
    setNationalityActiveIndex(0);
    setNationalityTouched(false);
  };

  const restoreSelectedNationality = () => {
    const market = countries.find(c => c.iso2 === filters.nationality);
    setNationalityQuery(market?.name || '');
    setNationalityOpen(false);
    setNationalityActiveIndex(0);
    setNationalityTouched(false);
  };

  const handleNationalityBlur = () => {
    window.setTimeout(() => {
      const q = nationalityQuery.trim().toLowerCase();
      const exact = countries.find(country =>
        country.iso2.toLowerCase() === q ||
        country.iso3.toLowerCase() === q ||
        country.name.toLowerCase() === q
      );
      if (exact) commitNationality(exact.iso2, exact.name);
      else restoreSelectedNationality();
    }, 80);
  };

  const handleNationalityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setNationalityOpen(true);
      setNationalityActiveIndex(i => Math.min(i + 1, Math.max(0, nationalitySuggestions.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setNationalityOpen(true);
      setNationalityActiveIndex(i => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      if (!nationalityOpen || nationalitySuggestions.length === 0) return;
      e.preventDefault();
      const selected = nationalitySuggestions[nationalityActiveIndex] || nationalitySuggestions[0];
      if (selected) commitNationality(selected.iso2, selected.name);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      restoreSelectedNationality();
    }
  };

  const childAges = filters.childAges ?? [];
  const roomConfigs = filters.roomConfigs ?? [];
  const allAgesSet = roomConfigs.length > 0 ? roomConfigs.every(r => r.children === 0 || r.childAges.length === r.children && r.childAges.every(a => a >= 0)) : filters.children === 0 || childAges.length === filters.children && childAges.every(a => a >= 0);
  const datesValid = !!checkInDate && !!checkOutDate && checkInDate >= today && checkOutDate > checkInDate;
  const canSearch = filters.adults >= 1 && filters.rooms >= 1 && allAgesSet && datesValid && !!selectedMarket && !nationalityTouched;
  const guestLabel = buildGuestLabel(filters.adults, filters.children, childAges, filters.rooms);
  const suggestions = buildSuggestions(filters.search, hotels);

  const applyQuickDates = (offsetDays: number) => {
    const from = addDays(today, offsetDays);
    const stayLength = nights > 0 ? nights : 1;
    const to = addDays(from, stayLength);
    setDateError('');
    setCalendarMonth(startOfMonth(from));
    onChange({
      ...filters,
      checkIn: format(from, 'yyyy-MM-dd'),
      checkOut: format(to, 'yyyy-MM-dd')
    });
    setDateOpen(false);
  };

  const clearDates = () => {
    setDateError('');
    setCalendarMonth(startOfMonth(today));
    onChange({ ...filters, checkIn: '', checkOut: '' });
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) return;
    const from = startOfDay(range.from);
    const to = range.to ? startOfDay(range.to) : undefined;

    if (from < today) {
      setDateError('Check-in cannot be earlier than today.');
      return;
    }

    if (to && to <= from) {
      setDateError('Check-out must be later than check-in.');
      onChange({
        ...filters,
        checkIn: format(from, 'yyyy-MM-dd'),
        checkOut: ''
      });
      return;
    }

    setDateError('');
    onChange({
      ...filters,
      checkIn: format(from, 'yyyy-MM-dd'),
      checkOut: to ? format(to, 'yyyy-MM-dd') : ''
    });

    if (to) setDateOpen(false);
  };
  const submitSearch = () => {
    const currentCheckIn = filters.checkIn ? new Date(filters.checkIn + 'T00:00:00') : undefined;
    const currentCheckOut = filters.checkOut ? new Date(filters.checkOut + 'T00:00:00') : undefined;

    if (!selectedMarket || nationalityTouched) {
      setNationalityOpen(true);
      nationalityInputRef.current?.focus();
      return;
    }

    if (!currentCheckIn || currentCheckIn < today) {
      setDateError('Select a valid check-in date from today onwards.');
      setDateOpen(true);
      return;
    }
    if (!currentCheckOut || currentCheckOut <= currentCheckIn) {
      setDateError('Select a check-out date later than check-in.');
      setDateOpen(true);
      return;
    }

    setDateError('');
    if (onSearch) onSearch();
    else document.getElementById('hotel-results')?.scrollIntoView({ behavior: 'smooth' });
  };

  const dateLabel = checkInDate && checkOutDate ? `${format(checkInDate, 'EEE, dd MMM')} — ${format(checkOutDate, 'EEE, dd MMM')}` : checkInDate ? `${format(checkInDate, 'EEE, dd MMM')} → Check-out` : 'Check-in — Check-out';
  return <div className={variant === 'compact' ? 'relative z-30 py-3 px-4 overflow-visible' : 'relative z-30 bg-primary py-8 px-4 overflow-visible'}>
      <div className="container mx-auto max-w-6xl">
        {variant === 'hero' && (
          <>
            <h2 className="text-primary-foreground text-2xl font-bold mb-1">The World's Smartest B2B Tariff Engine</h2>
            <p className='text-primary-foreground/70 text-sm mb-5'>Instant Search. Smart Quotation. Real-Time Availability & Static DMC Rates</p>
          </>
        )}
        <div className={variant === 'compact' ? "bg-white rounded-t-2xl p-3 flex flex-col sm:flex-row gap-2 shadow-xl border border-black/5 border-b-0" : "bg-amber-400 rounded-xl p-1.5 flex flex-col sm:flex-row gap-1.5 shadow-xl"}>

          {/* Destination */}
          <div className="relative flex-1 min-w-0">
            <div className={variant === 'compact' ? "flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 h-full border border-amber-400" : "flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 h-full"}>
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Destination or hotel</span>
                <input ref={inputRef} placeholder="Search destinations & hotels..." value={filters.search} onChange={e => {
                update('search', e.target.value);
                setShowSuggestions(true);
              }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} className="border-0 p-0 h-auto text-sm bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground/60" />
              </div>
              {filters.search && <button onClick={() => update('search', '')} className="text-muted-foreground/50 hover:text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
            </div>
            {showSuggestions && suggestions.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {suggestions.map((s, i) => <button key={i} onMouseDown={() => {
              update('search', s.value);
              setShowSuggestions(false);
            }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 text-left transition-colors border-b border-border/50 last:border-0">
                    <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {s.type === 'hotel' ? <Building2 className="w-3.5 h-3.5 text-primary" /> : <MapPin className="w-3.5 h-3.5 text-primary" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{s.label}</div>
                      <div className="text-xs text-muted-foreground">{s.sublabel}</div>
                    </div>
                  </button>)}
              </div>}
          </div>

          {/* Date Range Picker */}
          <Popover open={dateOpen} onOpenChange={(open) => {
            setDateOpen(open);
            if (open) {
              setDateError('');
              setCalendarMonth(startOfMonth(checkInDate && checkInDate >= today ? checkInDate : today));
            }
          }}>
            <PopoverTrigger asChild>
              <button className={variant === 'compact' ? "flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 min-w-[220px] text-left border border-amber-400" : "flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 min-w-[220px] text-left"}>
                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Check-in — Check-out</span>
                  <span className={`text-sm font-medium ${checkInDate ? 'text-foreground' : 'text-muted-foreground'}`}>{dateLabel}</span>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 shadow-2xl border-0 rounded-2xl overflow-hidden" align="start" sideOffset={8}>
              {/* Header */}
              <div className="bg-primary px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-primary-foreground font-semibold text-sm">
                    {!checkInDate ? 'Select check-in date' : !checkOutDate ? 'Now select check-out' : `${nights} night${nights !== 1 ? 's' : ''} selected`}
                  </p>
                  {checkInDate && checkOutDate && <p className="text-primary-foreground/70 text-xs mt-0.5">
                      {format(checkInDate, 'dd MMM yyyy')} → {format(checkOutDate, 'dd MMM yyyy')}
                    </p>}
                </div>
                {(checkInDate || checkOutDate) && <button onClick={clearDates} className="text-primary-foreground/70 hover:text-primary-foreground text-xs border border-primary-foreground/30 rounded-lg px-2.5 py-1 transition-colors">
                    Clear dates
                  </button>}
              </div>
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mr-1">Quick start</span>
                <button type="button" onClick={() => applyQuickDates(0)} className="text-xs px-2.5 py-1 rounded-full border border-border bg-white hover:bg-muted transition-colors font-medium">
                  Earliest
                </button>
                <button type="button" onClick={() => applyQuickDates(7)} className="text-xs px-2.5 py-1 rounded-full border border-border bg-white hover:bg-muted transition-colors font-medium">
                  +7 days
                </button>
                <button type="button" onClick={() => applyQuickDates(30)} className="text-xs px-2.5 py-1 rounded-full border border-border bg-white hover:bg-muted transition-colors font-medium">
                  +30 days
                </button>
                {checkInDate && !checkOutDate && (
                  <>
                    <span className="w-px h-5 bg-border mx-1" />
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Stay</span>
                    {[1, 2, 3, 5, 7].map(n => (
                      <button key={n} type="button" onClick={() => {
                        const co = format(addDays(checkInDate, n), 'yyyy-MM-dd');
                        setDateError('');
                        onChange({ ...filters, checkOut: co });
                        setDateOpen(false);
                      }} className="text-xs px-2.5 py-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
                        {n}N
                      </button>
                    ))}
                  </>
                )}
              </div>
              {dateError && (
                <div className="px-4 pt-3 text-xs font-medium text-destructive">
                  {dateError}
                </div>
              )}
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                fromDate={today}
                disabled={date => startOfDay(date) < today}
                className="p-4"
              />
            </PopoverContent>
          </Popover>

          {/* Guests + Rooms */}
          <Popover open={guestOpen} onOpenChange={setGuestOpen}>
            <PopoverTrigger asChild>
              <button className={variant === 'compact' ? "flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 min-w-[180px] text-left border border-amber-400" : "flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 min-w-[180px] text-left"}>
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Guests & Rooms</span>
                  <span className={`text-sm truncate ${!allAgesSet ? 'text-destructive font-medium' : 'text-foreground'}`}>{guestLabel}</span>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <GuestSelector filters={filters} onChange={onChange} onClose={() => setGuestOpen(false)} />
            </PopoverContent>
          </Popover>

          <Button size="lg" disabled={!canSearch} className={variant === 'compact' ? "bg-amber-400 hover:bg-amber-500 text-black rounded-lg px-7 shrink-0 disabled:opacity-60 font-bold" : "bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6 shrink-0 disabled:opacity-60"} onClick={submitSearch}>
            <Search className="w-4 h-4 mr-2" /> Search
          </Button>
        </div>

        {/* Compact commercial controls */}
        <div className={variant === 'compact' ? "bg-white rounded-b-2xl px-3 pb-3 pt-1 shadow-xl border border-black/5 border-t-0 flex flex-col md:flex-row md:items-center gap-3" : "mt-2 flex flex-wrap items-center gap-2"}>
          <div className="relative min-w-[260px] md:w-[310px]">
            <div className="flex items-center gap-2 border-b border-amber-400 pb-1">
              <Globe2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] text-muted-foreground font-medium">Guest Nationality</span>
                <input
                  ref={nationalityInputRef}
                  value={nationalityQuery}
                  autoComplete="off"
                  spellCheck={false}
                  onFocus={() => {
                    setNationalityOpen(true);
                    setNationalityActiveIndex(0);
                  }}
                  onChange={e => {
                    setNationalityQuery(e.target.value);
                    setNationalityTouched(true);
                    setNationalityOpen(true);
                    setNationalityActiveIndex(0);
                  }}
                  onBlur={handleNationalityBlur}
                  onKeyDown={handleNationalityKeyDown}
                  placeholder="Type country or code"
                  className="w-full border-0 outline-none bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/70"
                  aria-label="Guest nationality"
                  aria-autocomplete="list"
                  aria-expanded={nationalityOpen}
                  aria-controls="guest-nationality-options"
                  role="combobox"
                />
              </div>
            </div>
            {nationalityOpen && (
              <div
                id="guest-nationality-options"
                role="listbox"
                className="absolute left-0 top-full mt-1 w-full min-w-[320px] max-h-80 overflow-y-auto rounded-xl border border-border bg-white shadow-2xl z-[80] p-1"
              >
                {nationalitySuggestions.length ? nationalitySuggestions.map((country, index) => (
                  <button
                    key={country.id}
                    type="button"
                    role="option"
                    aria-selected={filters.nationality === country.iso2}
                    onMouseEnter={() => setNationalityActiveIndex(index)}
                    onPointerDown={e => {
                      e.preventDefault();
                      commitNationality(country.iso2, country.name);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg text-left flex items-center justify-between gap-3 transition-colors ${index === nationalityActiveIndex ? 'bg-amber-50 text-foreground' : 'hover:bg-muted/50'}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate">{country.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{country.region || 'Guest nationality'} · {country.iso3}</span>
                    </span>
                    <span className="shrink-0 rounded-md border bg-muted/40 px-2 py-1 text-[10px] font-black text-muted-foreground">{country.iso2}</span>
                  </button>
                )) : (
                  <div className="px-3 py-3">
                    <p className="text-xs font-semibold text-foreground">No matching nationality</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Type a country name or ISO market code, then select a suggestion.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              title="View or update extra markup"
              aria-label="Set extra markup percentage"
              aria-expanded={markupOpen}
              onClick={() => setMarkupOpen(v => !v)}
              className={`relative h-11 w-11 rounded-lg border flex items-center justify-center transition-colors ${filters.extraMarkupPct > 0 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50'}`}
            >
              <BadgePercent className="w-5 h-5" />
              {filters.extraMarkupPct > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">{filters.extraMarkupPct}%</span>}
            </button>

            {markupOpen && (
              <div className="w-[190px] border-b border-amber-400 pb-1">
                <span className="block text-[10px] text-muted-foreground font-medium">Set extra markup (%)</span>
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    max={50}
                    step="0.5"
                    value={filters.extraMarkupPct}
                    onChange={e => update('extraMarkupPct', Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                    onBlur={() => setTimeout(() => setMarkupOpen(false), 150)}
                    className="w-full border-0 outline-none bg-transparent text-sm font-semibold text-foreground"
                    aria-label="Extra quote markup percentage"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">%</span>
                </div>
              </div>
            )}
          </div>

          {variant === 'compact' && (
            <div className="hidden md:flex flex-1 min-w-0 items-center rounded-lg bg-violet-50 border border-violet-100 h-11 overflow-hidden">
              <div className="h-full px-4 flex items-center gap-2 border-r border-violet-200 shrink-0">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <div>
                  <p className="text-xs font-bold text-foreground">Try Smart Search</p>
                  <p className="text-[10px] text-muted-foreground">Type or paste</p>
                </div>
              </div>
              <div className="px-4 text-xs text-muted-foreground truncate">Search faster by destination, dates, hotel class and occupancy.</div>
            </div>
          )}
        </div>

        {/* Quick Action Links */}
        <div className={variant === 'compact' ? "hidden" : "flex flex-wrap items-center gap-2 mt-3"}>
          <button onClick={() => navigate(`/price-match?${buildInquiryParams()}`)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full transition-colors border border-white/20">
            <TrendingDown className="w-3 h-3" />
            💰 Price Match Request
          </button>
          <button onClick={() => navigate(`/offline-inquiry?${buildInquiryParams()}`)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full transition-colors border border-white/20">
            <Building2 className="w-3 h-3" />
            🏨 Can't find a hotel? Offline Inquiry
          </button>
          <button onClick={() => navigate('/group-inquiry')} className="flex items-center gap-1.5 bg-amber-400/25 hover:bg-amber-400/40 text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-full transition-colors border border-amber-300/50">
            <Users2 className="w-3 h-3" />
            👥 Groups & MICE — Tailored Proposal in 60 Min
          </button>
        </div>

        {!allAgesSet && filters.children > 0 && <p className={variant === 'compact' ? "text-xs mt-2 flex items-center gap-1.5 text-destructive" : "text-primary-foreground/80 text-xs mt-2 flex items-center gap-1.5"}>
            ⚠ Please select child ages in the guest selector to enable search.
          </p>}
      </div>


    </div>;
}