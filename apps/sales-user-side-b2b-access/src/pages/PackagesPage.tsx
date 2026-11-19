import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPackages, GetPackagesOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertCircle, MapPin, ChevronLeft, ChevronRight, Sparkles, Palmtree, Building2, Mountain, Waves } from 'lucide-react';
import SalesHeader from '@/components/sales/SalesHeader';
import PackageCategoryChips from '@/components/packages/PackageCategoryChips';
import PackageCard from '@/components/packages/PackageCard';
import { OFFICIAL_TOURISM_IMAGES, PACKAGE_HERO_SLIDES, packageFallbackImage } from '@/lib/packageImages';

type Pkg = GetPackagesOutputType['packages'][0];

const DESTINATIONS = [
  {name:'Dubai',image:OFFICIAL_TOURISM_IMAGES.dubaiBluewaters,icon:Building2},
  {name:'Abu Dhabi',image:OFFICIAL_TOURISM_IMAGES.abuDhabiStaycation,icon:Sparkles},
  {name:'Ras Al Khaimah',image:'/hero-carousel/ras-al-khaimah.jpg',icon:Mountain},
  {name:'Fujairah',image:OFFICIAL_TOURISM_IMAGES.dubaiLaMer,icon:Waves},
  {name:'Sharjah',image:OFFICIAL_TOURISM_IMAGES.dubaiDesignDistrict,icon:Building2},
  {name:'Ajman',image:OFFICIAL_TOURISM_IMAGES.dubaiLoveLake,icon:Palmtree},
];

const HOLIDAY_TYPES = [
  { eyebrow:'PLAY TOGETHER', title:'FAMILY HOLIDAYS', category:'Family', image:OFFICIAL_TOURISM_IMAGES.dubaiBluewaters, className:'md:row-span-2' },
  { eyebrow:'JUST THE TWO OF YOU', title:'HONEYMOONS', category:'Honeymoon', image:OFFICIAL_TOURISM_IMAGES.dubaiLoveLake, className:'md:col-span-2' },
  { eyebrow:'CITY ICONS, YOUR WAY', title:'PREMIUM ESCAPES', category:'Premium', image:OFFICIAL_TOURISM_IMAGES.abuDhabiStaycation, className:'' },
  { eyebrow:'SUN, SEA & SLOW DAYS', title:'BEACH HOLIDAYS', category:'Classic', image:OFFICIAL_TOURISM_IMAGES.dubaiLaMer, className:'' },
  { eyebrow:'BOLD DAYS OUT', title:'ADVENTURE', category:'Adventure', image:'/hero-carousel/ras-al-khaimah.jpg', className:'' },
  { eyebrow:'INDULGE IN THE UAE', title:'LUXURY', category:'Luxury', image:OFFICIAL_TOURISM_IMAGES.dubaiDesignDistrict, className:'' },
];

export default function PackagesPage({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [destination, setDestination] = useState('');
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroSlide,setHeroSlide]=useState(0);

  const loadPackages = () => {
    setLoading(true);
    setError(null);
    getPackages({ category: category || undefined })
      .then(r => setPackages(r.packages))
      .catch(() => setError('UAE holiday packages are temporarily unavailable.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPackages(); }, [category]);
  useEffect(()=>{
    const timer=window.setInterval(()=>setHeroSlide(v=>(v+1)%PACKAGE_HERO_SLIDES.length),5000);
    return()=>window.clearInterval(timer);
  },[]);

  const filtered=useMemo(()=>destination?packages.filter(p=>p.destinations.includes(destination)):packages,[packages,destination]);
  const quickEscapes=useMemo(()=>filtered.filter(p=>p.totalDays<=4).slice(0,6),[filtered]);
  const family=useMemo(()=>filtered.filter(p=>p.category==='Family').slice(0,6),[filtered]);
  const premium=useMemo(()=>filtered.filter(p=>['Luxury','Premium','Honeymoon'].includes(p.category)).slice(0,6),[filtered]);
  const covered=useMemo(()=>new Set(packages.flatMap(p=>p.destinations)).size,[packages]);
  const hero=PACKAGE_HERO_SLIDES[heroSlide];

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <SalesHeader onLogout={onLogout} hotelCount={0} />

      <section className="relative h-[390px] md:h-[460px] overflow-hidden bg-black">
        {PACKAGE_HERO_SLIDES.map((slide,i)=>(
          <img key={slide.image} src={slide.image} alt={slide.title} className={"absolute inset-0 w-full h-full object-cover transition-opacity duration-700 "+(i===heroSlide?'opacity-100':'opacity-0')}/>
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/10"/>
        <div className="absolute inset-0 container mx-auto max-w-6xl px-5 md:px-8 flex items-center">
          <div className="max-w-3xl text-white">
            <p className="text-xs md:text-sm font-bold tracking-[0.18em] uppercase text-white/70">UAE Holiday Marketplace</p>
            <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">UAE's Tailor-made<br/>Holiday Packages</h1>
            <p className="mt-4 text-sm md:text-lg text-white/85 max-w-2xl">Designing signature UAE holidays for your guests</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-xs font-semibold">UAE-only inventory</span>
              <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-xs font-semibold">Static B2B rates</span>
              <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-xs font-semibold">Day-by-day itineraries</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-5 left-0 right-0 container mx-auto max-w-6xl px-5 md:px-8 flex items-center justify-between">
          <div className="text-white"><p className="text-[10px] uppercase tracking-widest text-white/60">{hero.label}</p><p className="text-sm font-bold">{hero.title}</p></div>
          <div className="flex gap-2">
            <button className="w-9 h-9 rounded-full bg-black/35 border border-white/20 text-white grid place-items-center" onClick={()=>setHeroSlide(v=>(v-1+PACKAGE_HERO_SLIDES.length)%PACKAGE_HERO_SLIDES.length)}><ChevronLeft className="w-4 h-4"/></button>
            <button className="w-9 h-9 rounded-full bg-black/35 border border-white/20 text-white grid place-items-center" onClick={()=>setHeroSlide(v=>(v+1)%PACKAGE_HERO_SLIDES.length)}><ChevronRight className="w-4 h-4"/></button>
          </div>
        </div>
      </section>

      <section className="relative -mt-4 z-10 container mx-auto max-w-6xl px-4">
        <div className="bg-white rounded-2xl border shadow-xl p-4 md:p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-3">Find your UAE holiday style</p>
          <PackageCategoryChips value={category} onChange={setCategory} />
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <Stat value={packages.length} label="Active UAE packages"/>
          <Stat value={covered} label="UAE destinations"/>
          <Stat value="3–5★" label="Hotel options"/>
          <Stat value="B2B" label="Trade-ready pricing"/>
        </div>

        <section className="mb-12">
          <div className="text-center max-w-3xl mx-auto mb-7">
            <p className="text-[10px] md:text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">Holiday Types</p>
            <h2 className="mt-2 text-3xl md:text-5xl font-black tracking-tight leading-none">EXPERIENCE EVERYTHING, MISS NOTHING</h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">From family fun and romantic escapes to beaches, luxury and adventure, shape the UAE holiday around the way your guests want to travel.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-3 auto-rows-[210px] md:auto-rows-[210px]">
            {HOLIDAY_TYPES.map((item,index)=><button
              key={item.title}
              type="button"
              onClick={()=>{setDestination('');setCategory(item.category)}}
              className={"group relative min-h-[210px] overflow-hidden rounded-xl text-left border border-black/10 shadow-sm hover:shadow-xl transition-all "+item.className+(index===0?' md:col-span-1':'')}
            >
              <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/5"/>
              <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">{item.eyebrow}</p>
                <h3 className="mt-1 text-xl font-black tracking-tight">{item.title}</h3>
              </div>
            </button>)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-right">Destination imagery: official Visit Dubai and Experience Abu Dhabi tourism websites.</p>
        </section>

        <SectionTitle title="Popular UAE holiday destinations" subtitle="Choose a destination to instantly narrow the package collection." />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-9">
          {DESTINATIONS.map(x=>{
            const active=destination===x.name; const Icon=x.icon;
            return <button key={x.name} onClick={()=>setDestination(active?'':x.name)} className={"group relative h-40 rounded-xl overflow-hidden border text-left transition-all "+(active?'ring-2 ring-primary border-primary':'border-black/10 hover:shadow-lg')}>
              <img src={x.image} alt={x.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"/>
              <div className="absolute bottom-0 p-3 text-white"><Icon className="w-4 h-4 mb-1"/><p className="font-black text-sm">{x.name}</p><p className="text-[10px] text-white/70">{packages.filter(p=>p.destinations.includes(x.name)).length} packages</p></div>
            </button>;
          })}
        </div>

        {error && <div className="flex items-center justify-between text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-5"><div className="flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</div><button onClick={loadPackages} className="text-xs font-semibold underline">Retry</button></div>}

        <SectionTitle title={destination?destination+' holiday packages':'Featured UAE holiday packages'} subtitle="Curated land packages with clear hotel tier, transfers, itinerary and trade pricing." />
        {loading ? <PackageSkeleton/> : filtered.length===0 ? <Empty/> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">{filtered.map(p=><PackageCard key={p.id} pkg={p} onSelect={id=>navigate('/package/'+id)}/>)}</div>}

        {!loading && quickEscapes.length>0 && <PackageRail title="Short UAE escapes" subtitle="Compact 3–4 day breaks for weekends, stopovers and quick getaways." packages={quickEscapes} onOpen={id=>navigate('/package/'+id)}/>}
        {!loading && family.length>0 && <PackageRail title="Family & theme-park holidays" subtitle="UAE family itineraries with room for theme parks, beaches and easy transfers." packages={family} onOpen={id=>navigate('/package/'+id)}/>}
        {!loading && premium.length>0 && <PackageRail title="Luxury, premium & honeymoon escapes" subtitle="Higher-tier UAE stays for couples, premium leisure and special occasions." packages={premium} onOpen={id=>navigate('/package/'+id)}/>}

        <div className="mt-10 rounded-2xl bg-black text-white p-6 md:p-8 grid md:grid-cols-3 gap-5">
          <div><p className="text-xs uppercase tracking-widest text-white/50">UAE SPECIALISTS</p><h3 className="text-2xl font-black mt-2">Crafted for industry professionals, not mass</h3></div>
          <div className="text-sm text-white/70 leading-relaxed">Pure UAE itineraries structured with practical ground arrangements. Includes premium hotel stays, transfers, excursions, and smart day-by-day routing.</div>
          <div className="text-sm text-white/70 leading-relaxed">Final availability, room allocation, attraction slots and supplier vouchers remain subject to operational reconfirmation before final confirmation.</div>
        </div>
      </section>
    </div>
  );
}

function Stat({value,label}:{value:string|number;label:string}){return <div className="bg-white border rounded-xl p-4"><p className="text-2xl font-black text-primary">{value}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</p></div>}
function SectionTitle({title,subtitle}:{title:string;subtitle:string}){return <div className="mb-4"><h2 className="text-xl md:text-2xl font-black tracking-tight">{title}</h2><p className="text-sm text-muted-foreground mt-1">{subtitle}</p></div>}
function PackageSkeleton(){return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">{[1,2,3,4,5,6].map(i=><Skeleton key={i} className="h-80 rounded-2xl"/>)}</div>}
function Empty(){return <div className="py-16 text-center bg-white border rounded-2xl text-muted-foreground mb-10"><MapPin className="w-10 h-10 mx-auto mb-2 opacity-30"/><p className="font-bold">No UAE packages match this filter.</p></div>}
function PackageRail({title,subtitle,packages,onOpen}:{title:string;subtitle:string;packages:Pkg[];onOpen:(id:string)=>void}){return <section className="mb-10"><SectionTitle title={title} subtitle={subtitle}/><div className="flex gap-4 overflow-x-auto pb-3 snap-x">{packages.map(p=><button key={p.id} onClick={()=>onOpen(p.id)} className="snap-start shrink-0 w-[280px] bg-white border rounded-xl overflow-hidden text-left hover:shadow-lg transition-shadow"><div className="h-36 relative"><img src={p.coverImageUrl||packageFallbackImage(p.destinations)} className="w-full h-full object-cover" alt={p.title}/><div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent"/><div className="absolute bottom-3 left-3 right-3 text-white"><p className="font-black text-sm leading-tight">{p.title}</p></div></div><div className="p-3"><p className="text-xs text-muted-foreground">{p.totalDays}D/{p.totalNights}N · {p.hotelStarRating} · {p.destinations.join(' + ')}</p><p className="mt-2 font-black text-primary">from AED {(p.lowestSeasonPrice||p.startingPrice).toLocaleString()}</p></div></button>)}</div></section>}
