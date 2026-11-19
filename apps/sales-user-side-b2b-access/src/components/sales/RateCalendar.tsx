import { useMemo, useState } from 'react';
import { GetHotelProfileOutputType } from 'zitejs/api';
import {
  BedDouble, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Coffee,
  Filter, Search, ShieldCheck, Tag, Users, Utensils, XCircle
} from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import AvailabilitySearchForm from './AvailabilitySearchForm';

type RoomType = GetHotelProfileOutputType['roomTypes'][0];
type DailyRate = GetHotelProfileOutputType['dailyRates'][0];

export interface AvailabilitySearchParams {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  childAges: number[];
}

interface Props {
  roomTypes: RoomType[];
  dailyRates: DailyRate[];
  adults?: number;
  children?: number;
  rooms?: number;
  nights?: number;
  checkIn?: string;
  checkOut?: string;
  childAges?: number[];
  onRequest?: (roomTypeId: string, qty: number, ratePlanId: string) => void;
  onChangeSearch?: (p: AvailabilitySearchParams) => void;
}

interface TariffOption {
  roomType: RoomType;
  ratePlanId: string;
  ratePlanName: string;
  mealPlan: string;
  cancellationSummary: string;
  refundable: boolean;
  dominantStatus: 'Free Sale' | 'Limited' | 'On Request' | 'Stop Sale' | 'No Data';
  stayTotal: number | null;
  avgPerNight: number | null;
  allocation: number | null;
  complete: boolean;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AE', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

function mealIcon(meal: string) {
  if (meal === 'Room Only') return <BedDouble className="w-4 h-4" />;
  if (meal === 'Bed & Breakfast') return <Coffee className="w-4 h-4" />;
  return <Utensils className="w-4 h-4" />;
}

function statusClasses(status: TariffOption['dominantStatus']) {
  if (status === 'Free Sale') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Limited') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'On Request') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (status === 'Stop Sale') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-muted/40 text-muted-foreground border-border';
}

export default function RateCalendar({
  roomTypes, dailyRates, adults = 2, children = 0, rooms = 1, nights = 1,
  checkIn, checkOut, childAges = [], onRequest, onChangeSearch
}: Props) {
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [roomQuery, setRoomQuery] = useState('');
  const [mealFilter, setMealFilter] = useState('All');
  const [ratePlanFilter, setRatePlanFilter] = useState('All');
  const [cancellationFilter, setCancellationFilter] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

  const stayDates = useMemo(() => {
    const dates: string[] = [];
    if (!checkIn || !checkOut || nights <= 0) return dates;
    const d = new Date(checkIn + 'T00:00:00Z');
    for (let i = 0; i < nights; i++) {
      dates.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return dates;
  }, [checkIn, checkOut, nights]);

  const options = useMemo<TariffOption[]>(() => {
    const result: TariffOption[] = [];

    for (const rt of roomTypes) {
      const byPlan = new Map<string, DailyRate[]>();
      for (const dr of dailyRates) {
        if (dr.roomTypeId !== rt.id) continue;
        if (checkIn && dr.date < checkIn) continue;
        if (checkOut && dr.date >= checkOut) continue;
        const list = byPlan.get(dr.ratePlanId) ?? [];
        list.push(dr);
        byPlan.set(dr.ratePlanId, list);
      }

      for (const [ratePlanId, rates] of byPlan) {
        const byDate = new Map(rates.map(r => [r.date, r]));
        const complete = stayDates.length > 0 && stayDates.every(date => {
          const r = byDate.get(date);
          return !!r && r.status !== 'Stop Sale' && r.displayRate > 0;
        });

        const hasStop = stayDates.some(date => byDate.get(date)?.status === 'Stop Sale');
        const dominantStatus: TariffOption['dominantStatus'] = hasStop
          ? 'Stop Sale'
          : !complete
            ? 'No Data'
            : rates.some(r => r.status === 'On Request')
              ? 'On Request'
              : rates.some(r => r.status === 'Limited')
                ? 'Limited'
                : 'Free Sale';

        const stayTotal = complete
          ? Math.round(stayDates.reduce((sum, date) => sum + (byDate.get(date)?.displayRate ?? 0), 0))
          : null;

        const first = rates[0];
        const cancellationSummary = first?.cancellationSummary || '';
        result.push({
          roomType: rt,
          ratePlanId,
          ratePlanName: first?.ratePlanName || ratePlanId,
          mealPlan: first?.mealPlan || 'Room Only',
          cancellationSummary,
          refundable: !cancellationSummary.toLowerCase().includes('non-refundable'),
          dominantStatus,
          stayTotal,
          avgPerNight: stayTotal != null && nights > 0 ? stayTotal / nights : null,
          allocation: rates.reduce<number | null>((lowest, r) => {
            if (r.allocation == null) return lowest;
            return lowest == null ? r.allocation : Math.min(lowest, r.allocation);
          }, null),
          complete,
        });
      }
    }
    return result;
  }, [roomTypes, dailyRates, checkIn, checkOut, nights, stayDates]);

  const mealOptions = useMemo(
    () => ['All', ...Array.from(new Set(options.map(o => o.mealPlan))).sort()],
    [options]
  );
  const ratePlanOptions = useMemo(
    () => ['All', ...Array.from(new Set(options.map(o => o.ratePlanName))).sort()],
    [options]
  );

  const filteredOptions = useMemo(() => {
    const q = roomQuery.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;

    return options.filter(o => {
      if (q && !o.roomType.name.toLowerCase().includes(q) && !o.ratePlanName.toLowerCase().includes(q)) return false;
      if (mealFilter !== 'All' && o.mealPlan !== mealFilter) return false;
      if (ratePlanFilter !== 'All' && o.ratePlanName !== ratePlanFilter) return false;
      if (cancellationFilter === 'Refundable' && !o.refundable) return false;
      if (cancellationFilter === 'Non-refundable' && o.refundable) return false;
      if (min != null && o.stayTotal != null && o.stayTotal < min) return false;
      if (max != null && o.stayTotal != null && o.stayTotal > max) return false;
      return true;
    });
  }, [options, roomQuery, mealFilter, ratePlanFilter, cancellationFilter, minPrice, maxPrice]);

  const groupedRooms = useMemo(() => {
    return roomTypes
      .filter(rt => !roomQuery.trim() || rt.name.toLowerCase().includes(roomQuery.trim().toLowerCase()) ||
        filteredOptions.some(o => o.roomType.id === rt.id))
      .map(rt => ({
        roomType: rt,
        options: filteredOptions
          .filter(o => o.roomType.id === rt.id)
          .sort((a, b) => {
            if (a.stayTotal == null && b.stayTotal == null) return a.ratePlanName.localeCompare(b.ratePlanName);
            if (a.stayTotal == null) return 1;
            if (b.stayTotal == null) return -1;
            return a.stayTotal - b.stayTotal;
          }),
      }))
      .filter(group => group.options.length > 0 || (
        mealFilter === 'All' && ratePlanFilter === 'All' && cancellationFilter === 'All' && !minPrice && !maxPrice
      ));
  }, [roomTypes, filteredOptions, roomQuery, mealFilter, ratePlanFilter, cancellationFilter, minPrice, maxPrice]);

  const toggleExpanded = (roomTypeId: string) => {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      next.has(roomTypeId) ? next.delete(roomTypeId) : next.add(roomTypeId);
      return next;
    });
  };

  const handleApplySearch = (p: AvailabilitySearchParams) => {
    setShowSearchForm(false);
    onChangeSearch?.(p);
  };

  const guestLabel = `${adults} adult${adults !== 1 ? 's' : ''} · ${children} child${children !== 1 ? 'ren' : ''} · ${rooms} room${rooms !== 1 ? 's' : ''}`;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Choose your room & rate plan</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {roomTypes.length} backend room type{roomTypes.length !== 1 ? 's' : ''} · {options.length} rate plan option{options.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
            <Tag className="w-4 h-4" /> We Price Match
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className={`flex flex-col sm:flex-row border-2 rounded-lg overflow-hidden ${showSearchForm ? 'border-primary' : 'border-amber-400'}`}>
            <button
              className="flex items-center gap-2 px-4 py-3 flex-1 border-b sm:border-b-0 sm:border-r border-amber-300 bg-white/70 text-left"
              onClick={() => setShowSearchForm(true)}
            >
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{checkIn && checkOut ? `${fmtDate(checkIn)} — ${fmtDate(checkOut)}` : 'Select dates'}</span>
            </button>
            <button
              className="flex items-center gap-2 px-4 py-3 flex-1 border-b sm:border-b-0 sm:border-r border-amber-300 bg-white/70 text-left"
              onClick={() => setShowSearchForm(true)}
            >
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium flex-1">{guestLabel}</span>
              {showSearchForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <Button className="rounded-none px-6 h-auto" onClick={() => setShowSearchForm(v => !v)}>Change search</Button>
          </div>
        </div>

        {showSearchForm && (
          <AvailabilitySearchForm
            initial={{ checkIn: checkIn || '', checkOut: checkOut || '', adults, children, rooms, childAges }}
            onApply={handleApplySearch}
            onCancel={() => setShowSearchForm(false)}
            dailyRates={dailyRates}
          />
        )}

        <div className="border-y border-border bg-sky-50/60">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-5 p-4 border-b lg:border-b-0 lg:border-r border-sky-200">
              <div className="flex items-center gap-2 font-semibold text-sm mb-3">
                <Filter className="w-4 h-4" /> Filter room offers
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Select value={cancellationFilter} onValueChange={setCancellationFilter}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Cancellation" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All cancellation</SelectItem>
                    <SelectItem value="Refundable">Refundable</SelectItem>
                    <SelectItem value="Non-refundable">Non-refundable</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={mealFilter} onValueChange={setMealFilter}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Meal plan" /></SelectTrigger>
                  <SelectContent>{mealOptions.map(v => <SelectItem key={v} value={v}>{v === 'All' ? 'All meal plans' : v}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={ratePlanFilter} onValueChange={setRatePlanFilter}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Rate plan" /></SelectTrigger>
                  <SelectContent>{ratePlanOptions.map(v => <SelectItem key={v} value={v}>{v === 'All' ? 'All rate plans' : v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="lg:col-span-3 p-4 border-b lg:border-b-0 lg:border-r border-sky-200">
              <label className="text-sm font-semibold">Search by room / rate plan</label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input value={roomQuery} onChange={e => setRoomQuery(e.target.value)} placeholder="e.g. deluxe, suite, refundable" className="pl-9 bg-white" />
              </div>
            </div>

            <div className="lg:col-span-4 p-4">
              <label className="text-sm font-semibold">Total stay price range (AED)</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input type="number" min="0" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="bg-white" />
                <Input type="number" min="0" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="bg-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-12 bg-muted/50 border-b border-border text-sm font-bold">
          <div className="col-span-4 px-5 py-3 border-r border-border">Room type</div>
          <div className="col-span-8 px-5 py-3">Choose your rate plan</div>
        </div>

        {groupedRooms.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="font-semibold">No room offers match these filters.</p>
            <button className="text-primary text-sm mt-2 hover:underline" onClick={() => {
              setRoomQuery(''); setMealFilter('All'); setRatePlanFilter('All'); setCancellationFilter('All'); setMinPrice(''); setMaxPrice('');
            }}>Clear filters</button>
          </div>
        ) : groupedRooms.map(({ roomType, options: roomOptions }) => {
          const expanded = expandedRooms.has(roomType.id);
          const shownOptions = expanded ? roomOptions : roomOptions.slice(0, 2);
          const hiddenCount = Math.max(0, roomOptions.length - shownOptions.length);
          const maxOcc = roomType.maxOccupancy ?? roomType.maxAdults ?? null;

          return (
            <div key={roomType.id} className="grid grid-cols-1 md:grid-cols-12 border-b border-border last:border-b-0">
              <div className="md:col-span-4 p-5 bg-white md:border-r border-border">
                <h3 className="text-xl font-bold text-foreground">{roomType.name}</h3>
                <div className="flex flex-wrap gap-2 mt-3">
                  {roomType.beddingType && <span className="text-xs border border-border rounded-md px-2 py-1 bg-muted/30"><BedDouble className="inline w-3 h-3 mr-1" />{roomType.beddingType}</span>}
                  {maxOcc && <span className="text-xs border border-border rounded-md px-2 py-1 bg-muted/30"><Users className="inline w-3 h-3 mr-1" />Up to {maxOcc} guests</span>}
                  {roomType.views && <span className="text-xs border border-border rounded-md px-2 py-1 bg-muted/30">{roomType.views}</span>}
                </div>
                {roomType.inclusions && <p className="text-xs text-muted-foreground mt-3 line-clamp-3">{roomType.inclusions}</p>}
                {roomType.occupancyWarning && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 mt-3">{roomType.occupancyWarning}</p>}
                {roomOptions.length === 0 && <p className="text-sm text-muted-foreground mt-4">No valid rate plan for the selected stay.</p>}
              </div>

              <div className="md:col-span-8 p-3 space-y-3 bg-muted/10">
                {shownOptions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-white p-5 text-sm text-muted-foreground">
                    Room type is loaded in the backend, but no valid priced rate plan covers every selected night.
                  </div>
                ) : shownOptions.map(option => {
                  const bookable = option.complete && option.stayTotal != null && option.stayTotal > 0 && option.dominantStatus !== 'Stop Sale';
                  return (
                    <div key={option.ratePlanId} className="rounded-xl border border-border bg-white p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-base">{option.ratePlanName}</h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm">
                              <span className="flex items-center gap-1.5 text-foreground">{mealIcon(option.mealPlan)} {option.mealPlan}</span>
                              <span className={`flex items-center gap-1.5 ${option.refundable ? 'text-emerald-700' : 'text-red-600'}`}>
                                {option.refundable ? <ShieldCheck className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                {option.cancellationSummary || (option.refundable ? 'Refundable' : 'Non-refundable')}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[11px] px-2 py-1 rounded-full border font-semibold whitespace-nowrap ${statusClasses(option.dominantStatus)}`}>
                            {option.dominantStatus}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                          <span>Exact backend rate plan</span>
                          {option.allocation != null && <span>• {option.allocation} room{option.allocation === 1 ? '' : 's'} allocation</span>}
                          <span>• {adults}A{children > 0 ? `+${children}C` : ''}</span>
                        </div>
                      </div>

                      <div className="lg:w-56 lg:border-l border-border lg:pl-5 flex lg:flex-col items-center lg:items-end justify-between gap-3">
                        {bookable ? (
                          <>
                            <div className="text-right">
                              <p className="text-2xl font-extrabold text-foreground">AED {option.stayTotal!.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">total · {nights} night{nights !== 1 ? 's' : ''} · {rooms} room{rooms !== 1 ? 's' : ''}</p>
                              {option.avgPerNight != null && <p className="text-[11px] text-muted-foreground mt-1">AED {option.avgPerNight.toLocaleString(undefined, { maximumFractionDigits: 2 })} / room / night</p>}
                            </div>
                            <Button className="bg-amber-400 hover:bg-amber-500 text-foreground font-bold whitespace-nowrap" onClick={() => onRequest?.(roomType.id, rooms, option.ratePlanId)}>
                              Book this room
                            </Button>
                          </>
                        ) : (
                          <div className="text-right">
                            <p className="text-sm font-semibold text-muted-foreground">{option.dominantStatus === 'Stop Sale' ? 'Unavailable' : 'Rate not complete'}</p>
                            <p className="text-xs text-muted-foreground mt-1">Check other dates or tariff calendar.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {roomOptions.length > 2 && (
                  <div className="text-center pt-1">
                    <Button variant="ghost" size="sm" className="text-primary" onClick={() => toggleExpanded(roomType.id)}>
                      {expanded ? <>Show fewer options <ChevronUp className="w-4 h-4 ml-1" /></> : <>Show {hiddenCount} more option{hiddenCount !== 1 ? 's' : ''} <ChevronDown className="w-4 h-4 ml-1" /></>}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="px-5 py-3 bg-muted/20 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Room types and rate plans are sourced from the hotel backend. Only an exact Room Type + Rate Plan covering the selected stay can be booked.
        </div>
      </div>
    </div>
  );
}
