import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import {
  ArrowRight, BadgeCheck, Building2, CalendarDays, Clock3, Flame, MapPin,
  ShieldCheck, Sparkles, Star, Tag, TrendingDown, X, Zap
} from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import SalesHeader from '@/components/sales/SalesHeader';
import HeroSearch from '@/components/sales/HeroSearch';
import HorizontalCarousel from '@/components/home/HorizontalCarousel';
import UAEFooter from '@/components/home/UAEFooter';
import { ParallaxHeadline, ScrollGradientZoom, ScrollMarquee, WordReveal } from '@/components/home/ScrollTextEffects';
import { DEFAULT_FILTERS, type Filters } from '@/components/sales/SearchFilters';
import {
  getHomepageBanners,
  getSalesPortalData,
  type GetHomepageBannersOutputType,
  type GetSalesPortalDataOutputType
} from 'zitejs/api';
import {
  filtersToSearchParams, loadRecentSearches, removeRecentSearch,
  saveRecentSearch, type RecentSearch
} from '@/lib/searchState';
import {
  getCampaignVariant, UAE_DESTINATIONS, UAE_EXPERIENCES, UAE_PRODUCT_CATEGORIES
} from '@/lib/homeContent';
import { usePartnerAuth } from '@/lib/partnerAuth';

interface Deal {
  hotel: GetSalesPortalDataOutputType['hotels'][0];
  rate: GetSalesPortalDataOutputType['hotels'][0]['rates'][0];
}

const UAE_HOSPITALITY_BRANDS = [
  { name: 'Emirates', logo: '/brand-logos/emirates.svg' },
  { name: 'Etihad Airways', logo: '/brand-logos/etihad-airways.svg' },
  { name: 'Jumeirah', logo: '/brand-logos/jumeirah.svg' },
  { name: 'Rotana', logo: '/brand-logos/rotana.png' },
  { name: 'Yas Island', logo: '/brand-logos/yas-island.png' },
  { name: 'Ferrari World / Ferrari', logo: '/brand-logos/ferrari.svg' },
  { name: 'Marriott International', logo: '/brand-logos/marriott.svg' },
  { name: 'Hilton', logo: '/brand-logos/hilton.svg' },

  // Additional hotel brands selected from the supplied reference artwork.
  { name: 'Sheraton', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sheraton_Hotels_and_Resorts.svg' },
  { name: 'Holiday Inn', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Holiday_Inn_Logo.png' },
  { name: 'Conrad Hotels & Resorts', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/12/ConradHotelsLogo.svg' },
  { name: 'Radisson Hotels', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Radisson_Hotels_logo.svg' },
  { name: 'Accor', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Logo_Accor.png' },
  { name: 'Hyatt', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hyatt_Logo.svg' },
  { name: 'Hyatt Place', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hyatt_Place_logo.svg' },
] as const;

function money(v: number) {
  return new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v);
}

function getUaeWeekendDeadline(now = new Date()) {
  const uaeNowMs = now.getTime() + (4 * 60 * 60 * 1000);
  const uaeNow = new Date(uaeNowMs);
  const day = uaeNow.getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  const deadlineUae = new Date(uaeNow);
  deadlineUae.setUTCDate(uaeNow.getUTCDate() + daysUntilSunday);
  deadlineUae.setUTCHours(23, 59, 59, 999);
  return deadlineUae.getTime() - (4 * 60 * 60 * 1000);
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m : ${String(s).padStart(2, '0')}s`;
}

function getHotelDealImage(hotel: Deal['hotel']) {
  if (hotel.imageUrl) return hotel.imageUrl;
  const place = `${hotel.location || ''} ${hotel.emirate || ''}`.toLowerCase();
  if (place.includes('abu dhabi')) return '/hero-carousel/emirates-palace.jpg';
  if (place.includes('ras al khaimah')) return '/hero-carousel/ras-al-khaimah.jpg';
  if (place.includes('dubai') || place.includes('bur dubai') || place.includes('deira')) return '/hero-carousel/atlantis-the-royal.jpg';
  return '/hero-carousel/five-palm-jumeirah.jpg';
}

function formatRecentDate(s: string) {
  if (!s) return '';
  try { return format(new Date(s + 'T00:00:00'), 'dd MMM'); } catch { return s; }
}

function scoreLabel(hotel: Deal['hotel']) {
  if (!hotel.guestRating || hotel.reviewCount <= 0) return null;
  return {
    label: hotel.reviewLabel || 'Guest rated',
    score: hotel.guestRating.toFixed(1),
    count: hotel.reviewCount.toLocaleString(),
  };
}

export default function HomePage() {
  const navigate = useNavigate();
  const { partner } = usePartnerAuth();
  const today = useMemo(() => new Date(), []);
  const campaign = useMemo(() => getCampaignVariant(today), [today]);
  const defaultCheckIn = useMemo(() => format(addDays(today, 7), 'yyyy-MM-dd'), [today]);
  const defaultCheckOut = useMemo(() => format(addDays(today, 9), 'yyyy-MM-dd'), [today]);

  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    checkIn: defaultCheckIn,
    checkOut: defaultCheckOut,
  });
  const [data, setData] = useState<GetSalesPortalDataOutputType | null>(null);
  const [banners, setBanners] = useState<GetHomepageBannersOutputType['banners']>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [heroSlide, setHeroSlide] = useState(0);
  const [countdownMs, setCountdownMs] = useState(() => Math.max(0, getUaeWeekendDeadline() - Date.now()));

  useEffect(() => {
    setRecent(loadRecentSearches());
    getSalesPortalData({
      checkIn: defaultCheckIn,
      checkOut: defaultCheckOut,
      adults: 2,
      children: 0,
      roomConfigs: [{ adults: 2, children: 0, childAges: [] }],
      nationality: DEFAULT_FILTERS.nationality,
      extraMarkupPct: 0,
    }).then(setData).catch(() => setData(null));
  }, [defaultCheckIn, defaultCheckOut]);

  useEffect(() => {
    getHomepageBanners({ signedIn: !!partner })
      .then(res => setBanners(res.banners))
      .catch(() => setBanners([]));
  }, [partner]);

  useEffect(() => {
    const tick = () => setCountdownMs(Math.max(0, getUaeWeekendDeadline() - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const deals = useMemo<Deal[]>(() => {
    if (!data) return [];
    return data.hotels
      .flatMap(hotel => hotel.rates
        .filter(rate => rate.staySellTotal > 0 && rate.sellRate > 0)
        .map(rate => ({ hotel, rate })))
      .sort((a, b) => a.rate.staySellTotal - b.rate.staySellTotal)
      .filter((d, i, arr) => arr.findIndex(x => x.hotel.id === d.hotel.id) === i)
      .slice(0, 10);
  }, [data]);

  const hotelDealBanners = useMemo(() => banners.filter(b => b.type === 'Hotel Deal'), [banners]);

  const heroSlides = useMemo(() => {
    const slides: Array<{ image: string; mobileImage?: string; alt: string; label: string }> = [
      {
        image: '/hero-carousel/atlantis-the-royal.jpg',
        alt: 'Atlantis The Royal resort exterior, Palm Jumeirah, Dubai',
        label: 'Atlantis The Royal',
      },
      {
        image: '/hero-carousel/yas-island.jpg',
        alt: 'Yas Island, Abu Dhabi',
        label: 'Yas Island',
      },
      {
        image: '/hero-carousel/emirates-palace.jpg',
        alt: 'Emirates Palace Mandarin Oriental, Abu Dhabi',
        label: 'Emirates Palace',
      },
      {
        image: '/hero-carousel/five-palm-jumeirah.jpg',
        alt: 'Beach by FIVE at FIVE Palm Jumeirah, Dubai',
        label: 'FIVE Palm Jumeirah',
      },
      {
        image: '/hero-carousel/ras-al-khaimah.jpg',
        alt: 'Ras Al Khaimah, UAE',
        label: 'Ras Al Khaimah',
      },
    ];

    return slides;
  }, []);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    setHeroSlide(current => Math.min(current, heroSlides.length - 1));
    const timer = window.setInterval(() => {
      setHeroSlide(current => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  const search = () => {
    saveRecentSearch(filters);
    navigate('/search?' + filtersToSearchParams(filters).toString());
  };

  const routeSearch = (query: string) => {
    const p = new URLSearchParams({
      q: query,
      checkIn: defaultCheckIn,
      checkOut: defaultCheckOut,
      adults: '2',
      children: '0',
      rooms: '1',
    });
    navigate('/search?' + p.toString());
  };

  const openDeal = (deal: Deal) => {
    const p = new URLSearchParams({
      checkIn: defaultCheckIn,
      checkOut: defaultCheckOut,
      adults: '2',
      children: '0',
      rooms: '1',
    });
    navigate(`/hotel/${deal.hotel.id}?${p.toString()}`);
  };

  const removeRecent = (id: string) => {
    removeRecentSearch(id);
    setRecent(loadRecentSearches());
  };

  return (
    <div className="min-h-screen bg-[#f6f6f4]">
      <SalesHeader onLogout={() => {}} hotelCount={data?.hotels.length ?? 0} />

      <section className="relative overflow-visible border-b border-primary-foreground/10">
        <div className="absolute inset-0 bg-black overflow-hidden">
          {heroSlides.map((slide, index) => (
            <picture
              key={slide.image}
              className={`absolute inset-0 transition-opacity duration-[1400ms] ease-in-out ${index === heroSlide ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden={index !== heroSlide}
            >
              {slide.mobileImage && <source media="(max-width: 767px)" srcSet={slide.mobileImage} />}
              <img
                src={slide.image}
                alt={index === heroSlide ? slide.alt : ''}
                className="w-full h-full object-cover"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </picture>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#D71921]/96 via-[#D71921]/78 to-[#111111]/48" />

        <div className="relative text-primary-foreground">
          <div className="container mx-auto max-w-6xl px-4 pt-10 pb-3">
            <div className="max-w-3xl">
              <p className="fb-kicker text-white/70 mb-4">fabBeds · UAE Wholesale Distribution</p>
              <h1 className="fb-display text-[3.15rem] sm:text-[4.6rem] md:text-[6rem] text-white max-w-4xl">
                The World&apos;s Wholesale Marketplace
              </h1>
              <p className="mt-5 text-sm md:text-lg text-white/85 max-w-2xl font-medium">
                Instant Search. Smart Quotation. Real-Time Availability &amp; Static DMC Rates
              </p>
            </div>

          </div>
          <HeroSearch
            filters={filters}
            onChange={setFilters}
            onSearch={search}
            variant="compact"
            hotels={data?.hotels.map(h => ({ id: h.id, name: h.name, location: h.location, emirate: h.emirate })) ?? []}
          />
        </div>
      </section>

      <main className="container mx-auto max-w-6xl px-4">
        {recent.length > 0 && (
          <section className="py-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold">Recent searches</h2>
                <p className="text-xs text-muted-foreground">Continue where your agency left off.</p>
              </div>
            </div>
            <HorizontalCarousel>
              {recent.map(item => (
                <div key={item.id} className="relative min-w-[280px] bg-card border border-border rounded-xl px-4 py-3 hover:shadow-md transition-shadow">
                  <button className="absolute right-2 top-2 text-muted-foreground hover:text-foreground" onClick={() => removeRecent(item.id)}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => navigate('/search?' + item.params)} className="text-left w-full pr-6">
                    <p className="font-semibold text-sm truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.checkIn && item.checkOut ? `${formatRecentDate(item.checkIn)} – ${formatRecentDate(item.checkOut)}` : 'Flexible dates'}
                      {' · '}{item.rooms} room{item.rooms !== 1 ? 's' : ''} · {item.adults} adult{item.adults !== 1 ? 's' : ''}
                    </p>
                  </button>
                </div>
              ))}
            </HorizontalCarousel>
          </section>
        )}

        <section className="py-7">
          {hotelDealBanners.length > 0 ? (
            <HorizontalCarousel>
              {hotelDealBanners.map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    if (b.hotelId) {
                      const p = new URLSearchParams({
                        checkIn: defaultCheckIn,
                        checkOut: defaultCheckOut,
                        adults: '2',
                        children: '0',
                        rooms: '1',
                      });
                      navigate(`/hotel/${b.hotelId}?${p.toString()}`);
                    } else if (b.ctaUrl?.startsWith('http')) {
                      window.location.assign(b.ctaUrl);
                    } else {
                      navigate(b.ctaUrl || '/search');
                    }
                  }}
                  className="relative min-w-[82%] md:min-w-[66%] lg:min-w-[56%] h-60 rounded-2xl overflow-hidden border border-border text-left group"
                >
                  <picture className="absolute inset-0">
                    {b.mobileImageUrl && <source media="(max-width: 767px)" srcSet={b.mobileImageUrl} />}
                    <img src={b.desktopImageUrl} alt={b.altText || b.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                  </picture>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white max-w-xl">
                    <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-white/75">LIVE WHOLESALE RATES</p>
                    <h2 className="text-2xl font-extrabold mt-1">{b.headline || b.name}</h2>
                    {b.subheadline && <p className="text-sm text-white/80 mt-2 line-clamp-2">{b.subheadline}</p>}
                    <span className="inline-flex items-center gap-1 mt-4 text-sm font-bold">
                      {b.ctaLabel || 'View deal'} <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </button>
              ))}
            </HorizontalCarousel>
          ) : (
            <div className={`rounded-2xl border overflow-hidden p-7 md:p-9 ${campaign.accent === 'amber' ? 'bg-amber-50 border-amber-200' : campaign.accent === 'blue' ? 'bg-sky-50 border-sky-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.16em] font-bold text-primary">{campaign.eyebrow}</p>
                <h2 className="text-2xl md:text-4xl font-extrabold mt-2 leading-tight">{campaign.title}</h2>
                <p className="text-sm text-muted-foreground mt-3 max-w-2xl">{campaign.body}</p>
                <Button className="mt-5 gap-2" onClick={() => navigate(campaign.route)}>
                  {campaign.cta} <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="py-9">
          <ParallaxHeadline
            eyebrow="Destination edit"
            title="Explore the UAE"
            className="mb-5 py-4 md:py-7"
          />
          <HorizontalCarousel>
            {UAE_DESTINATIONS.map(d => (
              <button
                key={d.name}
                onClick={() => routeSearch(d.query)}
                className="min-w-[250px] h-44 rounded-2xl overflow-hidden relative border border-border text-left group bg-card"
                title={d.credit}
              >
                <img
                  src={d.image}
                  alt={`${d.name} destination`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute left-4 right-4 bottom-4 text-white">
                  <h3 className="font-extrabold text-lg">{d.name}</h3>
                  <p className="text-xs text-white/80 mt-0.5">{d.subtitle}</p>
                </div>
              </button>
            ))}
          </HorizontalCarousel>
        </section>

        <section className="my-8 -mx-4 md:-mx-8 px-4 md:px-8 py-7 fb-panel-dark overflow-hidden">
          <div className="mb-5 max-w-5xl">
            <p className="fb-kicker text-[#D71921]">ONE RESERVATION PORTAL • EXCLUSIVE UAE WHOLESALE B2B RATES</p>
            <ScrollGradientZoom className="mt-2 origin-left">
              <h2 className="fb-display text-4xl md:text-6xl leading-[0.95]">
                BROWSE UAE WHOLESALE DEALS: UP TO 25% OFF
              </h2>
            </ScrollGradientZoom>
            <p className="text-sm md:text-base text-white/70 mt-4 max-w-3xl leading-relaxed">
              Access hotels, attractions, transfers, and complete UAE packages - expertly curated for travel agents, tour operators, and DMCs.
            </p>
          </div>

          <HorizontalCarousel>
            {UAE_PRODUCT_CATEGORIES.map((p, index) => {
              const image =
                p.title === 'Hotels' ? '/category-hd/atlantis-the-royal.webp' :
                p.title === 'Attractions' ? '/category-hd/ain-dubai.jpg' :
                p.title === 'Transfers' ? '/category-hd/yas-island.png' :
                p.title === 'Visa' ? '/category-hd/uae-visa.jpg' :
                '/category-hd/ras-al-khaimah.jpg';

              return (
                <button
                  key={p.title}
                  onClick={() => navigate(p.route)}
                  className="group relative min-w-[230px] md:min-w-[250px] h-[285px] rounded-2xl overflow-hidden border border-white/10 text-left bg-[#171717] hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300"
                >
                  <img
                    src={image}
                    alt={`${p.title} UAE wholesale deals`}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/5" />

                  <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                    <h3 className="text-2xl md:text-[28px] font-black text-white leading-none">{p.title}</h3>
                    <p className="text-xs md:text-sm text-white/75 mt-2 leading-relaxed line-clamp-2">{p.subtitle}</p>

                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-black text-black group-hover:bg-[#D71921] group-hover:text-white transition-colors">
                      Explore <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </HorizontalCarousel>
        </section>

        <ScrollMarquee
          items={['UAE WHOLESALE', 'LIVE HOTEL RATES', 'PRIVATE TRANSFERS', 'ATTRACTIONS', 'VISA', 'TAILOR-MADE PACKAGES']}
          className="-mx-4 md:-mx-8 py-5 md:py-7 border-y border-border bg-white text-[#111111]"
        />

        <section id="deals" className="py-8">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Live wholesale hotel deals</p>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-1">Deals for your next UAE quote</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Net AED rates for {formatRecentDate(defaultCheckIn)} – {formatRecentDate(defaultCheckOut)} · 2 adults · 1 room
              </p>
            </div>
            <Button variant="ghost" className="gap-1 shrink-0 font-bold text-sm" onClick={() => navigate('/search?' + new URLSearchParams({
              checkIn: defaultCheckIn, checkOut: defaultCheckOut, adults: '2', children: '0', rooms: '1'
            }).toString())}>
              View all <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="mb-5 rounded-2xl border border-border bg-[#111] text-white overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="flex items-center gap-3 px-4 py-3 md:flex-1">
                <Clock3 className="w-4 h-4 text-[#ff4d57] shrink-0" />
                <p className="text-xs md:text-sm">
                  <strong>48-Hour Agent Rush:</strong> extra 8% on selected Dubai &amp; Abu Dhabi premium hotels.
                </p>
              </div>
              <div className="hidden md:block h-6 w-px bg-white/15" />
              <div className="flex items-center gap-2 px-4 py-3 bg-white/5">
                <Zap className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="text-xs font-bold tabular-nums">{formatCountdown(countdownMs)}</span>
              </div>
              <div className="hidden md:block h-6 w-px bg-white/15" />
              <div className="flex items-center gap-2 px-4 py-3">
                <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="text-xs">Last-minute rates from <strong>AED 99/night</strong></span>
              </div>
            </div>
          </div>

          {deals.length > 0 ? (
            <HorizontalCarousel>
              {deals.map(({ hotel, rate }, index) => {
                const review = scoreLabel(hotel);
                const freeCancellation = rate.cancellationSummary.toLowerCase().includes('free cancellation');
                const stars = Math.max(0, parseInt(hotel.starRating || '0'));
                const premiumFlash = stars >= 4 && /dubai|abu dhabi/i.test(`${hotel.location || ''} ${hotel.emirate || ''}`);
                const image = getHotelDealImage(hotel);
                return (
                  <button
                    key={hotel.id}
                    onClick={() => openDeal({ hotel, rate })}
                    className="min-w-[280px] max-w-[280px] md:min-w-[300px] md:max-w-[300px] text-left bg-white border border-border rounded-2xl overflow-hidden hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 group"
                  >
                    <div className="h-[176px] relative overflow-hidden bg-muted">
                      <img
                        src={image}
                        alt={hotel.name}
                        loading={index < 2 ? 'eager' : 'lazy'}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

                      <div className="absolute left-3 top-3">
                        <Badge className="bg-white/95 text-primary hover:bg-white border-0 shadow-sm font-bold text-[10px] px-2.5 py-1">
                          <Tag className="w-3 h-3 mr-1" /> {premiumFlash ? 'B2B · Extra 8%' : 'B2B Deal'}
                        </Badge>
                      </div>

                      {rate.status === 'Free Sale' && (
                        <div className="absolute right-3 top-3 rounded-full bg-emerald-600/95 text-white text-[10px] font-bold px-2.5 py-1 shadow-sm">
                          Guaranteed
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-black text-[16px] leading-snug line-clamp-2 min-h-[44px]">{hotel.name}</h3>
                          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 min-w-0">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{hotel.location || hotel.emirate}</span>
                            </span>
                            {stars > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-amber-500 shrink-0">
                                <Star className="w-3 h-3 fill-current" /> {stars}
                              </span>
                            )}
                          </div>
                        </div>
                        {review && (
                          <div className="shrink-0 text-right">
                            <div className="inline-flex items-center justify-center rounded-md bg-[#D71921] text-white font-black text-[11px] px-2 py-1">
                              {review.score}
                            </div>
                            <p className="text-[9px] font-bold mt-1">{review.label}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-3 min-h-[25px]">
                        {freeCancellation && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-1">
                            <ShieldCheck className="w-3 h-3" /> Free cancellation
                          </span>
                        )}
                        {rate.status === 'Free Sale' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-50 rounded-full px-2 py-1">
                            <BadgeCheck className="w-3 h-3" /> Free Sale
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-3 line-clamp-1">
                        {rate.roomTypeName} · {rate.mealPlan}
                      </p>

                      <div className="mt-3 pt-3 border-t border-border flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.14em] font-bold text-muted-foreground">Net from</p>
                          <p className="text-[23px] font-black text-primary leading-none mt-1">
                            AED {money(rate.sellRate)}
                            <span className="text-xs font-bold text-foreground"> / night</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">Stay AED {money(rate.staySellTotal)} · {rate.occupancyNote}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-black text-primary whitespace-nowrap">
                          View <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </HorizontalCarousel>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <Building2 className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="font-semibold">No valid priced deals for the featured dates</p>
              <p className="text-sm text-muted-foreground mt-1">Search your required dates to check live UAE tariff inventory.</p>
            </div>
          )}
        </section>

        <section className="py-7">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Quick UAE trip planner</h2>
            <p className="text-sm text-muted-foreground">Start with a destination pattern, then refine by room, meal plan and cancellation.</p>
          </div>
          <HorizontalCarousel>
            {UAE_EXPERIENCES.map(item => (
              <button
                key={item.title}
                onClick={() => routeSearch(item.query)}
                className="min-w-[245px] rounded-2xl border border-border bg-white p-5 text-left hover:shadow-md transition-shadow"
              >
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-bold mt-3">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.subtitle}</p>
              </button>
            ))}
          </HorizontalCarousel>
        </section>

        <section className="py-4">
          <div className="rounded-2xl border border-border bg-white overflow-hidden">
            <div className="px-5 md:px-7 pt-5 pb-4">
              <p className="fb-kicker text-primary/70">UAE hospitality &amp; tourism ecosystem</p>
              <h2 className="fb-display text-2xl md:text-3xl mt-2 max-w-4xl">
                Connected to the brands shaping UAE hospitality &amp; tourism<span className="text-primary">.</span>
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground mt-2 max-w-4xl leading-relaxed">
                fabBeds brings UAE hotels, resorts, aviation and destination experiences into one B2B marketplace for travel agents, tour operators and DMCs. Brand visibility is subject to active contracting, loaded inventory and sellable dates.
              </p>
            </div>

            <div className="border-t border-border bg-white px-5 md:px-7 py-3">
              <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                Hotel groups, brands &amp; destination partners
              </p>
            </div>

            <div className="relative border-t border-border bg-[#FCFCFC] py-4 overflow-hidden">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-10 md:w-16 bg-gradient-to-r from-[#FCFCFC] to-transparent z-10" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 md:w-16 bg-gradient-to-l from-[#FCFCFC] to-transparent z-10" />

              <div className="brand-marquee-track items-center">
                {[...UAE_HOSPITALITY_BRANDS, ...UAE_HOSPITALITY_BRANDS].map((brand, index) => (
                  <div
                    key={`${brand.name}-uae-${index}`}
                    className="min-w-[210px] md:min-w-[260px] h-24 md:h-28 px-6 py-3 flex items-center justify-center"
                    title={brand.name}
                  >
                    <img
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      className="max-h-16 md:max-h-20 max-w-[170px] md:max-w-[220px] object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="relative border-t border-border bg-white py-4 overflow-hidden">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-10 md:w-16 bg-gradient-to-r from-white to-transparent z-10" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 md:w-16 bg-gradient-to-l from-white to-transparent z-10" />
              <div className="brand-marquee-track brand-marquee-track-reverse items-center">
                {[...UAE_HOSPITALITY_BRANDS].reverse().concat([...UAE_HOSPITALITY_BRANDS].reverse()).map((brand, index) => (
                  <div
                    key={`${brand.name}-second-row-${index}`}
                    className="min-w-[210px] md:min-w-[260px] h-24 md:h-28 px-6 py-3 flex items-center justify-center"
                    title={brand.name}
                  >
                    <img
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      className="max-h-16 md:max-h-20 max-w-[170px] md:max-w-[220px] object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        <section className="py-5 md:py-7">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#0f1115] text-white">
            <div className="absolute inset-0">
              <img
                src="/hero-carousel/atlantis-the-royal.jpg"
                alt=""
                className="w-full h-full object-cover opacity-40"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/72 to-black/45" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(215,25,33,0.22),transparent_36%)]" />
            </div>

            <div className="relative px-5 md:px-8 pt-7 md:pt-9 pb-6 md:pb-8">
              <div className="max-w-5xl">
                <p className="fb-kicker text-[#ff3b3b]">What we deliver</p>
                <h2 className="fb-display text-3xl md:text-5xl mt-3 leading-[0.96] max-w-5xl">
                  Empowering Global Travel, Localized in the Middle East<span className="text-[#D71921]">.</span>
                </h2>
                <p className="text-sm md:text-base text-white/72 mt-4 max-w-4xl leading-relaxed">
                  Connecting the region's premier destinations with a global travel distribution network built for modern B2B commerce.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 xl:grid-cols-4 gap-2.5 md:gap-3">
                {[
                  {
                    value: '50K+',
                    label: 'Worldwide Hotels',
                    text: 'Global hotel supply curated for GCC and international travel trade.'
                  },
                  {
                    value: '5K+',
                    label: 'Buyer Partners',
                    text: 'Travel agencies, DMCs and tour operators connected across key markets.'
                  },
                  {
                    value: '24/7',
                    label: 'Marketplace Access',
                    text: 'Always-on search, tariff visibility and B2B product discovery.'
                  },
                  {
                    value: '1K+/MO',
                    label: 'Premium Bookings',
                    text: 'Growing monthly booking volume across UAE and international products.'
                  }
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className="group rounded-2xl border border-white/12 bg-white/[0.07] backdrop-blur-md px-4 md:px-5 py-5 md:py-6 hover:bg-white/[0.11] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className="fb-display text-4xl md:text-5xl leading-none tabular-nums"
                        data-count-target={item.value}
                      >
                        {item.value}
                      </p>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                        0{index + 1}
                      </span>
                    </div>
                    <p className="text-[#ff3b3b] font-black mt-3 text-sm md:text-base">{item.label}</p>
                    <p className="text-xs md:text-sm text-white/62 mt-2 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-[10px] md:text-xs uppercase tracking-[0.14em] text-white/48">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Hotels</span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Attractions</span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Transfers</span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Visa</span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Packages</span>
              </div>
            </div>
          </div>
        </section>

        <section className="py-7 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => navigate('/price-match')} className="bg-card border border-border rounded-2xl p-5 text-left hover:shadow-md transition-shadow">
            <TrendingDown className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-bold">Price Match</h3>
            <p className="text-sm text-muted-foreground mt-1">Send a competing UAE hotel rate for commercial review.</p>
          </button>
          <button onClick={() => navigate('/offline-inquiry')} className="bg-card border border-border rounded-2xl p-5 text-left hover:shadow-md transition-shadow">
            <Building2 className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-bold">Request Any UAE Hotel</h3>
            <p className="text-sm text-muted-foreground mt-1">Ask operations to source a UAE property not yet available in live tariff inventory.</p>
          </button>
          <button onClick={() => navigate('/group-inquiry')} className="bg-card border border-border rounded-2xl p-5 text-left hover:shadow-md transition-shadow">
            <CalendarDays className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-bold">Groups & MICE</h3>
            <p className="text-sm text-muted-foreground mt-1">Submit UAE group, event and series requirements to the contracting team.</p>
          </button>
        </section>

        <section className="py-10">
          <div className="rounded-md bg-[#D71921] text-white p-7 md:p-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6 overflow-hidden relative">
            <div className="relative z-10">
              <p className="fb-kicker text-white/60">Travel agent account</p>
              <h2 className="fb-display text-4xl md:text-6xl mt-3 max-w-4xl">Free Registration, Fast Auto-Approval & Login</h2>
              <p className="text-sm md:text-base text-white/80 mt-4 max-w-3xl leading-relaxed">
                No Documentation. Access UAE’s fastest booking B2B portal. Sign in today to instantly search, compare, and quote UAE-wholesale B2B rates.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="secondary" onClick={() => navigate('/partner/sign-in')}>Sign in</Button>
              <Button variant="outline" className="border-white/30 text-white hover:text-white hover:bg-white/10" onClick={() => navigate('/partner/register')}>Create account</Button>
            </div>
          </div>
        </section>
      </main>

      <UAEFooter />
    </div>
  );
}
