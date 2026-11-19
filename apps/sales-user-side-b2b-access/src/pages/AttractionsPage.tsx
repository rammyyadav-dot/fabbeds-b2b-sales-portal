import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isBefore, isSameDay,
  isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths
} from 'date-fns';
import { getAttractions, GetAttractionsOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Button } from '@project/components/ui/button';
import {
  Search, MapPin, AlertCircle, SlidersHorizontal, CalendarDays, Users,
  Minus, Plus, RotateCcw, TicketCheck, Check, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import SalesHeader from '@/components/sales/SalesHeader';
import AttractionCard from '@/components/attractions/AttractionCard';
import { usePartnerAuth } from '@/lib/partnerAuth';
import { ATTRACTION_HERO_IMAGES } from '@/lib/attractionImages';

type Attraction = GetAttractionsOutputType['attractions'][0];
interface Props { onLogout: () => void; }
type SortKey = 'recommended' | 'price-low' | 'price-high' | 'margin' | 'rating' | 'popular';

type Facet = { value: string; count: number };

function CardSkeleton() {
  return (
    <div className="rounded-md border border-black/10 bg-white overflow-hidden">
      <Skeleton className="h-40 w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

function TravellerCounter(props: {
  label:string; sublabel:string; value:number; min:number; max:number; onChange:(v:number)=>void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-bold text-sm">{props.label}</p>
        <p className="text-xs text-muted-foreground">{props.sublabel}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" disabled={props.value<=props.min} onClick={()=>props.onChange(props.value-1)}>
          <Minus className="w-4 h-4"/>
        </Button>
        <span className="w-8 text-center font-black">{props.value}</span>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" disabled={props.value>=props.max} onClick={()=>props.onChange(props.value+1)}>
          <Plus className="w-4 h-4"/>
        </Button>
      </div>
    </div>
  );
}

function ModernDatePicker({
  value,
  onChange,
  onClose,
}: {
  value:string;
  onChange:(value:string)=>void;
  onClose:()=>void;
}) {
  const selected = parseISO(value);
  const [month,setMonth] = useState(startOfMonth(selected));
  const today = new Date();
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days:Date[] = [];
  for (let d=gridStart; d<=gridEnd; d=addDays(d,1)) days.push(d);

  return (
    <div className="absolute z-[140] top-[calc(100%+8px)] left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 w-[336px] max-w-[calc(100vw-20px)] rounded-2xl border border-black/10 bg-white shadow-[0_24px_60px_rgba(0,0,0,.24)] p-4 text-[#111]">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={()=>setMonth(subMonths(month,1))}>
          <ChevronLeft className="w-4 h-4"/>
        </Button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">Visit date</p>
          <p className="font-black">{format(month,'MMMM yyyy')}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={()=>setMonth(addMonths(month,1))}>
          <ChevronRight className="w-4 h-4"/>
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mt-4">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><div key={day} className="text-center text-[10px] font-bold text-muted-foreground py-1">{day}</div>)}
        {days.map(day=>{
          const disabled=isBefore(day,new Date(today.getFullYear(),today.getMonth(),today.getDate()));
          const active=isSameDay(day,selected);
          const currentMonth=isSameMonth(day,month);
          return (
            <button
              type="button"
              key={day.toISOString()}
              disabled={disabled}
              onClick={()=>{
                onChange(format(day,'yyyy-MM-dd'));
                onClose();
              }}
              className={`aspect-square rounded-xl text-sm font-semibold transition-all ${active
                ? 'bg-[#D71921] text-white shadow-sm'
                : disabled
                  ? 'text-black/20 cursor-not-allowed'
                  : currentMonth
                    ? 'text-[#111] hover:bg-[#fff1f2] hover:text-[#D71921]'
                    : 'text-black/30 hover:bg-muted'}`}
            >
              {format(day,'d')}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t flex items-center justify-between">
        <button type="button" className="text-xs font-bold text-muted-foreground hover:text-[#111]" onClick={onClose}>Close</button>
        <button
          type="button"
          className="text-xs font-black text-[#D71921]"
          onClick={()=>{
            onChange(format(today,'yyyy-MM-dd'));
            setMonth(startOfMonth(today));
            onClose();
          }}
        >
          Today
        </button>
      </div>
    </div>
  );
}

export default function AttractionsPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const { token, isLoading: authLoading } = usePartnerAuth();
  const [pricesVisible, setPricesVisible] = useState(false);
  const [emirateFacets, setEmirateFacets] = useState<Facet[]>([]);
  const [categoryFacets, setCategoryFacets] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [visitDate, setVisitDate] = useState(format(new Date(),'yyyy-MM-dd'));
  const [showCalendar, setShowCalendar] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [showTravellers, setShowTravellers] = useState(false);
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [fastConfirmationOnly, setFastConfirmationOnly] = useState(false);

  const [sort, setSort] = useState<SortKey>('recommended');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroSlide(current => (current + 1) % ATTRACTION_HERO_IMAGES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const loadAttractions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAttractions({
        search: search.trim() || undefined,
        visitDate,
        adults,
        children,
        category: category || undefined,
        emirate: city || undefined,
        partnerToken: token || undefined,
        fastConfirmationOnly,
        freeCancellationOnly: false,
        availableOnly: false,
      });
      setAttractions(res.attractions);
      setPricesVisible(res.meta.pricesVisible);
      setEmirateFacets(res.meta.facets.emirates);
      setCategoryFacets(res.meta.facets.categories);
    } catch (err:any) {
      setError(err?.message || 'Unable to search attraction availability.');
      setAttractions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return; // wait for the agency session so rates load on the first search
    loadAttractions();
    // Initial merchandising load: always show contracted attraction products and their best available AED rate.
    // Search remains authoritative for the selected visit date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, token]);

  const resetSearch = () => {
    setSearch('');
    setCity('');
    setCategory('');
    setAdults(1);
    setChildren(0);
    setFastConfirmationOnly(false);
    setPriceMin('');
    setPriceMax('');
    setSort('recommended');
  };

  const filtered = useMemo(() => {
    let list = attractions;
    const min = parseFloat(priceMin);
    const max = parseFloat(priceMax);
    if (!Number.isNaN(min)) list = list.filter(a => (a.netPrice || 0) >= min);
    if (!Number.isNaN(max)) list = list.filter(a => (a.netPrice == null ? Infinity : a.netPrice) <= max);
    return list;
  }, [attractions, priceMin, priceMax]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === 'price-low') return list.sort((a,b)=>(a.netPrice == null ? Infinity : a.netPrice)-(b.netPrice == null ? Infinity : b.netPrice));
    if (sort === 'price-high') return list.sort((a,b)=>(b.netPrice || 0)-(a.netPrice || 0));
    if (sort === 'margin') return list.sort((a,b)=>((b.retailPrice||0)-(b.netPrice||0))-((a.retailPrice||0)-(a.netPrice||0)));
    if (sort === 'rating') return list.sort((a,b)=>b.rating-a.rating);
    if (sort === 'popular') return list.sort((a,b)=>b.bookedCount-a.bookedCount);
    return list.sort((a,b)=>{
      const aScore=(a.availableOnDate?5000:0)+(a.instantConfirmation?800:0)+(a.cancellationPolicy==='Free Cancellation'?400:0)+(a.rating*a.reviewCount)+(a.bookedCount*2);
      const bScore=(b.availableOnDate?5000:0)+(b.instantConfirmation?800:0)+(b.cancellationPolicy==='Free Cancellation'?400:0)+(b.rating*b.reviewCount)+(b.bookedCount*2);
      return bScore-aScore;
    });
  }, [filtered, sort]);

  const toggleQuick = (kind:string) => {
    if (kind==='dubai') setCity(city==='Dubai'?'':'Dubai');
    if (kind==='abudhabi') setCity(city==='Abu Dhabi'?'':'Abu Dhabi');
    if (kind==='theme') setCategory(category==='Theme Parks'?'':'Theme Parks');
    if (kind==='fast') setFastConfirmationOnly(v=>!v);
  };

  const detailUrl = (id:string, ticketOptionId?:string) => {
    const p = new URLSearchParams();
    p.set('date',visitDate);
    p.set('adults',String(adults));
    p.set('children',String(children));
    if (ticketOptionId) p.set('sku',ticketOptionId);
    return '/attraction/' + id + '?' + p.toString();
  };

  const travellerLabel = adults + ' Adult' + (adults!==1?'s':'') + (children ? ' · ' + children + ' Child' + (children!==1?'ren':'') : '');

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />

      <section className="relative overflow-visible border-b border-primary-foreground/10">
        <div className="absolute inset-0 overflow-hidden bg-black">
          {ATTRACTION_HERO_IMAGES.map((slide, index) => (
            <img
              key={slide.image}
              src={slide.image}
              alt={index === heroSlide ? slide.alt : ''}
              aria-hidden={index !== heroSlide}
              loading={index === 0 ? 'eager' : 'lazy'}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1400ms] ease-in-out ${index === heroSlide ? 'opacity-100' : 'opacity-0'}`}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#D71921]/94 via-[#D71921]/68 to-[#111111]/38" />

        <div className="relative text-white">
          <div className="container mx-auto max-w-6xl px-4 pt-8 sm:pt-10 pb-5 sm:pb-7">
            <div className="max-w-4xl">
              <p className="fb-kicker text-white/70 mb-3">fabBeds · UAE Attractions Distribution</p>
              <h1 className="fb-display text-[2.8rem] sm:text-[4rem] md:text-[5.2rem] text-white max-w-4xl leading-[0.9]">
                UAE Attractions &amp; Tickets
              </h1>

            </div>

            <div className="flex items-end justify-between gap-4 mt-6">
              <div className="rounded-lg bg-black/45 backdrop-blur-sm px-3 py-2 border border-white/15">
                <p className="text-[9px] uppercase tracking-[0.16em] font-bold text-white/65">UAE Experiences</p>
                <p className="text-xs sm:text-sm font-black mt-0.5">{ATTRACTION_HERO_IMAGES[heroSlide]?.alt}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur-sm px-2.5 py-2 border border-white/10">
                {ATTRACTION_HERO_IMAGES.map((slide, index) => (
                  <button
                    key={slide.image}
                    type="button"
                    onClick={() => setHeroSlide(index)}
                    aria-label={`Show ${slide.alt}`}
                    className={`h-2 rounded-full transition-all ${index === heroSlide ? 'w-7 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-40 bg-[#D71921] border-t border-white/10 overflow-visible">
            <div className="container mx-auto max-w-6xl px-4 py-3 overflow-visible">
              <div className="rounded-2xl border border-[#F2B51D] bg-[#F2B51D] p-[3px] shadow-[0_8px_22px_rgba(0,0,0,.14)] overflow-visible">
                <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_.9fr_.9fr_.72fr] gap-1.5">
                  <label className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 border border-black/5 focus-within:border-[#D71921]/40 transition-colors">
                    <Search className="w-4 h-4 text-muted-foreground shrink-0"/>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-bold">Destination / Attraction</p>
                      <input
                        value={search}
                        onChange={e=>setSearch(e.target.value)}
                        placeholder="Attraction, theme park, city or SKU"
                        className="w-full text-sm font-semibold outline-none bg-transparent placeholder:font-normal placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </label>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={()=>{
                        setShowTravellers(false);
                        setShowCalendar(v=>!v);
                      }}
                      aria-expanded={showCalendar}
                      className="w-full h-full bg-white rounded-xl px-4 py-3 flex items-center gap-3 text-left border border-black/10 hover:border-[#D71921]/35 focus:outline-none focus:ring-2 focus:ring-[#D71921]/15 transition-colors"
                    >
                      <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0"/>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-bold">Visit date</p>
                        <p className="text-sm font-semibold text-[#111]">{format(parseISO(visitDate),'EEE, dd MMM yyyy')}</p>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showCalendar?'rotate-180':''}`}/>
                    </button>
                    {showCalendar && (
                      <ModernDatePicker
                        value={visitDate}
                        onChange={setVisitDate}
                        onClose={()=>setShowCalendar(false)}
                      />
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={()=>{
                        setShowCalendar(false);
                        setShowTravellers(v=>!v);
                      }}
                      className="w-full h-full bg-white rounded-xl px-4 py-3 flex items-center gap-3 text-left border border-black/10 hover:border-[#D71921]/30 transition-colors"
                    >
                      <Users className="w-4 h-4 text-muted-foreground shrink-0"/>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-bold">Travellers</p>
                        <p className="text-sm font-semibold text-[#111]">{travellerLabel}</p>
                      </div>
                    </button>

                    {showTravellers && (
                      <div className="absolute z-50 top-[calc(100%+8px)] right-0 w-[330px] max-w-[90vw] rounded-xl border border-black/10 bg-white p-4 shadow-2xl text-[#111]">
                        <p className="font-black">Who's travelling?</p>
                        <p className="text-xs text-muted-foreground mt-1">Final age eligibility is validated against the selected SKU.</p>
                        <div className="divide-y mt-3">
                          <TravellerCounter label="Adults" sublabel="Adult ticket tier" value={adults} min={1} max={20} onChange={setAdults}/>
                          <TravellerCounter label="Children" sublabel="Child age rules vary by attraction" value={children} min={0} max={20} onChange={setChildren}/>
                        </div>
                        <Button className="w-full mt-3" onClick={()=>setShowTravellers(false)}>Apply Travellers</Button>
                      </div>
                    )}
                  </div>

                  <Button
                    className="h-full min-h-[62px] rounded-xl font-black text-sm gap-2 bg-[#D71921] hover:bg-[#b91219] text-white shadow-none border border-white/15"
                    onClick={loadAttractions}
                    disabled={loading || !visitDate}
                  >
                    <TicketCheck className="w-4 h-4"/>
                    {loading?'Checking…':'Search'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f6f4] border-b border-black/10">
        <div className="container mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                ['Dubai', city==='Dubai', 'dubai'],
                ['Abu Dhabi', city==='Abu Dhabi', 'abudhabi'],
                ['Theme Parks', category==='Theme Parks', 'theme'],
                ['Fast Confirmation', fastConfirmationOnly, 'fast'],
              ].map((item:any)=>(
                <button
                  key={item[0]}
                  type="button"
                  onClick={()=>toggleQuick(item[2])}
                  className={'rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ' + (item[1]
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-white text-[#333] border-black/10 hover:border-black/25')}
                >
                  {item[1] && <Check className="inline w-3 h-3 mr-1"/>}{item[0]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:ml-auto lg:w-[520px]">
              <Select value={city || 'all'} onValueChange={v=>setCity(v==='all'?'':v)}>
                <SelectTrigger className="h-9 bg-white border-black/10 text-[#222] text-xs rounded-lg">
                  <MapPin className="w-3.5 h-3.5 mr-1"/>
                  <SelectValue placeholder="All emirates"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All emirates</SelectItem>
                  {emirateFacets.map(f=><SelectItem key={f.value} value={f.value}>{f.value} ({f.count})</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={category || 'all'} onValueChange={v=>setCategory(v==='all'?'':v)}>
                <SelectTrigger className="h-9 bg-white border-black/10 text-[#222] text-xs rounded-lg">
                  <SelectValue placeholder="All categories"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryFacets.map(f=><SelectItem key={f.value} value={f.value}>{f.value} ({f.count})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-5 max-w-7xl">
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-white border border-black/10 rounded-md px-3 py-2 shadow-sm">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0"/>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium">Net AED:</span>
            <input placeholder="Min" value={priceMin} onChange={e=>setPriceMin(e.target.value)} className="w-16 h-7 text-[10px] border border-border rounded px-2 bg-background outline-none focus:border-primary"/>
            <span className="text-[10px] text-muted-foreground">—</span>
            <input placeholder="Max" value={priceMax} onChange={e=>setPriceMax(e.target.value)} className="w-16 h-7 text-[10px] border border-border rounded px-2 bg-background outline-none focus:border-primary"/>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={resetSearch}><RotateCcw className="w-3 h-3"/>Reset</Button>
            <Select value={sort} onValueChange={v=>setSort(v as SortKey)}>
              <SelectTrigger className="h-7 text-[10px] w-[145px] border-border"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="price-low">Lowest Net Rate</SelectItem>
                <SelectItem value="price-high">Highest Net Rate</SelectItem>
                <SelectItem value="margin">Highest Margin</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
            <div className="flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5"/> {error}</div>
            <button onClick={loadAttractions} className="font-semibold underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({length:9}).map((_,i)=><CardSkeleton key={i}/>)}</div>
        ) : sorted.length===0 ? (
          <div className="text-center py-14 bg-white border border-black/10 rounded-md">
            <p className="font-black text-lg">No matching ticket availability</p>
            <p className="text-muted-foreground text-sm mt-2">Try another date, destination, traveller count or remove one of the commercial filters.</p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <p className="fb-kicker text-primary">Availability results</p>
                <h2 className="text-2xl font-black mt-1">{sorted.length} experience{sorted.length!==1?'s':''}</h2>
                <p className="text-xs text-muted-foreground mt-1">{visitDate} · {adults}A{children ? ' · ' + children + 'C' : ''} · AED net pricing</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sorted.map(a=>(
                <AttractionCard key={a.ticketOptionId} {...a} pricesVisible={pricesVisible} onClick={()=>navigate(detailUrl(a.id,a.ticketOptionId))}/>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
