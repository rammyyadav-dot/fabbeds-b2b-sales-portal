import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import {
  ArrowLeft, BadgeCheck, CalendarCheck, CalendarDays, CheckCircle2,
  ChevronRight, Clock, FileText, MapPin, Minus, Plus, ShieldCheck,
  Ticket, Users, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import {Input} from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import {
  getAttractionDetail,
  recheckAttractionOffer,
  type GetAttractionDetailOutputType,
  type RecheckAttractionOfferOutputType,
} from 'zitejs/api';
import SalesHeader from '@/components/sales/SalesHeader';
import SupportHelpCard from '@/components/attractions/SupportHelpCard';
import AttractionBookingSteps from '@/components/attractions/AttractionBookingSteps';
import { usePartnerAuth } from '@/lib/partnerAuth';

type AttractionData = GetAttractionDetailOutputType;
type TicketOption = AttractionData['ticketOptions'][0];
type TicketRate = TicketOption['rates'][0];

interface Props { onLogout: () => void; }

function DateStrip({ selectedDate, onSelect }: { selectedDate: string; onSelect: (v: string) => void }) {
  const dates = Array.from({ length: 21 }, (_, i) => addDays(new Date(), i));
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {dates.map(d => {
        const iso = format(d, 'yyyy-MM-dd');
        const active = iso === selectedDate;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onSelect(iso)}
            className={`min-w-[64px] snap-start rounded-xl border px-3 py-2 text-center transition-all ${active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card border-border hover:border-primary/50'}`}
          >
            <p className={`text-[9px] uppercase font-semibold ${active ? 'text-primary-foreground/80':'text-muted-foreground'}`}>{format(d,'MMM')}</p>
            <p className="text-lg font-black leading-tight">{format(d,'d')}</p>
            <p className={`text-[9px] ${active ? 'text-primary-foreground/80':'text-muted-foreground'}`}>{format(d,'EEE')}</p>
          </button>
        );
      })}
    </div>
  );
}

function Counter({
  label, sublabel, value, min, max, onChange,
}: {
  label:string; sublabel:string; value:number; min:number; max:number; onChange:(v:number)=>void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="icon" className="rounded-full h-9 w-9" disabled={value<=min} onClick={()=>onChange(value-1)}>
          <Minus className="w-4 h-4"/>
        </Button>
        <span className="w-5 text-center font-bold">{value}</span>
        <Button type="button" variant="outline" size="icon" className="rounded-full h-9 w-9" disabled={value>=max} onClick={()=>onChange(value+1)}>
          <Plus className="w-4 h-4"/>
        </Button>
      </div>
    </div>
  );
}

function lowestAdult(option:TicketOption){
  const values=option.rates.map(r=>r.netCostAdult).filter(v=>v>0);
  return values.length?Math.min(...values):null;
}

function packageLabel(name:string){
  const n=name.toLowerCase();
  if(n.includes('fast')) return 'Fast Track';
  if(n.includes('meal')||n.includes('dining')) return 'Ticket + Meal';
  if(n.includes('combo')||n.includes('multi')) return 'Combo Ticket';
  if(n.includes('vip')||n.includes('premium')) return 'VIP Experience';
  return 'Admission Ticket';
}

function optionPackageLabel(option:TicketOption){
  return option.packageName?.trim() || packageLabel(option.name);
}

export default function AttractionDetailPage({ onLogout }: Props) {
  const { id } = useParams<{id:string}>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || format(new Date(),'yyyy-MM-dd');
  const initialSku = searchParams.get('sku') || '';
  const initialAdults = Math.max(1, Number(searchParams.get('adults') || 1));
  const initialChildren = Math.max(0, Number(searchParams.get('children') || 0));
  const [data,setData]=useState<AttractionData|null>(null);
  const { token, isLoading: authLoading } = usePartnerAuth();
  const [loading,setLoading]=useState(true);
  const [selectedDate,setSelectedDate]=useState(initialDate);
  const [selectedTicketId,setSelectedTicketId]=useState(initialSku);
  const [activePackage,setActivePackage]=useState('Admission Ticket');
  const [selectedSlot,setSelectedSlot]=useState('');
  const [selectedRateId,setSelectedRateId]=useState('');
  const [market,setMarket]=useState('');
  const [promoCode,setPromoCode]=useState('');
  const [adults,setAdults]=useState(initialAdults);
  const [children,setChildren]=useState(initialChildren);
  const [liveQuote,setLiveQuote]=useState<RecheckAttractionOfferOutputType|null>(null);
  const [quoteLoading,setQuoteLoading]=useState(false);
  const [quoteError,setQuoteError]=useState('');

  useEffect(()=>{
    if(!id||authLoading)return;
    setLoading(true);
    getAttractionDetail({attractionId:id,partnerToken:token||undefined,date:selectedDate,market:market||undefined,promoCode:promoCode||undefined})
      .then(res=>{
        setData(res);
        const currentStillValid=res.ticketOptions.some(t=>t.id===selectedTicketId);
        if(!currentStillValid) {
          const firstSellable=res.ticketOptions.find(t=>t.rates.length>0);
          const first=firstSellable||res.ticketOptions[0];
          setSelectedTicketId(first?.id||'');
          setActivePackage(first ? optionPackageLabel(first) : 'Admission Ticket');
          setSelectedSlot(first?.rates.find(r=>r.slotTime)?.slotTime||'');
        }
      })
      .catch(()=>toast.error('Failed to load attraction'))
      .finally(()=>setLoading(false));
  },[id,selectedDate,market,promoCode,authLoading,token]);

  const selectedOption=useMemo(
    ()=>data?.ticketOptions.find(t=>t.id===selectedTicketId)||null,
    [data,selectedTicketId]
  );

  const packageTabs=useMemo(
    ()=>Array.from(new Set((data?.ticketOptions||[]).map(t=>optionPackageLabel(t)))),
    [data]
  );
  const packageTicketOptions=useMemo(
    ()=>(data?.ticketOptions||[]).filter(t=>optionPackageLabel(t)===activePackage),
    [data,activePackage]
  );

  const slots=useMemo(
    ()=>Array.from(new Set((selectedOption?.rates||[]).map(r=>r.slotTime).filter(Boolean))).sort(),
    [selectedOption]
  );

  useEffect(()=>{
    if(!selectedOption)return;
    setSelectedRateId('');
    if(selectedOption.requiresSlot){
      if(!selectedSlot||!slots.includes(selectedSlot)) setSelectedSlot(slots[0]||'');
    } else {
      setSelectedSlot('');
    }
    const minPax=Math.max(1,selectedOption.minPax||1);
    const maxPax=Math.max(minPax,selectedOption.maxPax||99);
    const currentPax=adults+children;
    if(currentPax<minPax) setAdults(Math.max(1,minPax-children));
    if(currentPax>maxPax) {
      setChildren(Math.min(children,Math.max(0,maxPax-1)));
      setAdults(Math.max(1,maxPax-Math.min(children,Math.max(0,maxPax-1))));
    }
  },[selectedOption?.id]);

  const activeRate=useMemo<TicketRate|null>(()=>{
    const rates=(selectedOption?.rates||[]).filter(r=>!selectedOption?.requiresSlot||r.slotTime===selectedSlot);
    return rates.find(r=>r.id===selectedRateId)||rates[0]||null;
  },[selectedOption,selectedSlot,selectedRateId]);

  useEffect(()=>{
    if(!selectedOption||!activeRate) {
      setLiveQuote(null);
      setQuoteError('');
      return;
    }
    if(selectedOption.requiresSlot&&!selectedSlot) return;
    if(!token||data?.pricesVisible===false) { setLiveQuote(null); setQuoteError(''); return; }

    let cancelled=false;
    setLiveQuote(null);
    setQuoteLoading(true);
    setQuoteError('');
    const timer=setTimeout(()=>{
      recheckAttractionOffer({
        ticketOptionId:selectedOption.id,
        rateId:activeRate.id,market:market||undefined,promoCode:promoCode||undefined,
        partnerToken:token,
        date:selectedDate,
        slot:selectedSlot||undefined,
        adultCount:adults,
        childCount:children,
      })
        .then(q=>{if(!cancelled)setLiveQuote(q);})
        .catch((err:any)=>{
          if(cancelled)return;
          setLiveQuote(null);
          setQuoteError(err?.message||'Offer unavailable');
        })
        .finally(()=>{if(!cancelled)setQuoteLoading(false);});
    },250);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[selectedOption?.id,activeRate?.id,selectedDate,selectedSlot,adults,children,market,promoCode,token,data?.pricesVisible]);

  const localTotal=activeRate
    ? activeRate.netCostAdult*adults + activeRate.netCostChild*children
    : 0;
  const total=liveQuote?.netTotal ?? localTotal;
  const remaining=liveQuote?.remaining ?? activeRate?.remaining ?? null;
  const pax=adults+children;
  const canContinue=!!selectedOption&&!!activeRate&&!!liveQuote&&liveQuote.rateId===activeRate.id&&liveQuote.date===selectedDate&&liveQuote.adultCount===adults&&liveQuote.childCount===children&&!quoteLoading&&!quoteError&&total>0&&pax>=selectedOption.minPax&&pax<=selectedOption.maxPax&&(remaining===null||remaining>=pax)&&(!selectedOption.requiresSlot||!!selectedSlot);

  const continueToCheckout=()=>{
    if(!id||!selectedOption||!activeRate||!canContinue)return;
    const params=new URLSearchParams({
      ticketOptionId:selectedOption.id,
      date:selectedDate,
      adults:String(adults),
      children:String(children),
    });
    params.set('rateId',activeRate.id);
    if(market)params.set('market',market);
    if(promoCode)params.set('promoCode',promoCode);
    if(selectedSlot)params.set('slot',selectedSlot);
    navigate(`/attraction/${id}/checkout?${params.toString()}`);
  };

  if(loading){
    return (
      <div className="min-h-screen bg-muted/30">
        <SalesHeader onLogout={onLogout} hotelCount={0}/>
        <div className="container mx-auto max-w-6xl px-4 py-6 space-y-4">
          <Skeleton className="h-7 w-44"/>
          <Skeleton className="h-72 rounded-2xl"/>
          <Skeleton className="h-80 rounded-2xl"/>
        </div>
      </div>
    );
  }
  if(!data)return null;
  const {attraction,ticketOptions}=data;

  return (
    <div className="min-h-screen bg-muted/30 pb-24 lg:pb-8">
      <SalesHeader onLogout={onLogout} hotelCount={0}/>

      <main className="container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-5">
        <Button variant="ghost" size="sm" className="-ml-2 mb-3 gap-2" onClick={()=>navigate('/attractions')}>
          <ArrowLeft className="w-4 h-4"/> Back to attractions
        </Button>

        <AttractionBookingSteps current={1} detailPath={id ? `/attraction/${id}` : undefined} />

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 sm:gap-5">
          <div className="space-y-4">
            <section className="bg-card border border-border rounded-2xl overflow-hidden">
              {attraction.coverImage && (
                <div className="h-56 sm:h-64 overflow-hidden relative">
                  <img src={attraction.coverImage} alt={attraction.title} className="w-full h-full object-cover"/>
                  {attraction.imageCredit && (
                    <a href={attraction.imageSourceUrl || undefined} target="_blank" rel="noopener noreferrer" className="absolute bottom-1.5 right-2 max-w-[90%] truncate text-[10px] text-white/90 bg-black/45 px-1.5 py-0.5 rounded-sm hover:underline">{attraction.imageCredit}</a>
                  )}
                </div>
              )}
              <div className="p-5">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline">{attraction.category||'Attraction'}</Badge>
                  {attraction.city&&<span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3"/>{attraction.city}</span>}
                  {attraction.rating>0&&<span className="text-xs font-semibold text-amber-600">★ {attraction.rating.toFixed(1)}{attraction.reviewCount>0?` · ${attraction.reviewCount.toLocaleString()} reviews`:''}</span>}
                </div>
                <h1 className="text-2xl font-black mt-3 leading-tight">{attraction.title}</h1>
                {(attraction.shortDescription||attraction.description)&&(
                  <p className="text-sm text-muted-foreground leading-relaxed mt-3">{attraction.shortDescription||attraction.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  {attraction.instantConfirmation&&<Badge className="bg-emerald-600 gap-1"><Zap className="w-3 h-3"/>Fast confirmation eligible</Badge>}
                  {attraction.cancellationPolicy==='Free Cancellation'&&<Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 gap-1"><CalendarCheck className="w-3 h-3"/>Free cancellation</Badge>}
                  <Badge variant="outline" className="gap-1"><ShieldCheck className="w-3 h-3"/>B2B contracted AED rates</Badge>
                </div>
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-bold">Booking information</h2>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  [ShieldCheck,'Authoritative price & availability recheck'],
                  [Ticket,'Agency credit booking'],
                  [FileText,'Confirmation voucher after approval'],
                  [BadgeCheck,'Supplier QR / ticket included when applicable'],
                ].map(([Icon,label]:any)=><div key={label} className="flex items-start gap-2"><Icon className="w-4 h-4 text-primary mt-0.5"/><span>{label}</span></div>)}
              </div>
              <div className="border-t mt-4 pt-4 text-xs text-muted-foreground space-y-2">
                <p><strong className="text-foreground">Cancellation:</strong> {attraction.cancellationPolicy||'Ticket-specific policy applies.'}</p>
                <p><strong className="text-foreground">Children:</strong> Age/passport requirements depend on the selected ticket.</p>
                <p><strong className="text-foreground">Booking cut-off:</strong> Enforced against the selected rate and visit date.</p>
              </div>
            </section>

            <SupportHelpCard/>
          </div>

          <div className="space-y-5">
            <section className="bg-card border border-border rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-bold">Packages</h2>
                  <p className="text-xs text-muted-foreground mt-1">Choose the commercial package first, then date, time and travellers.</p>
                </div>
                <Badge variant="outline">{packageTabs.length} package{packageTabs.length===1?'':'s'}</Badge>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {packageTabs.map(pkg=>{
                  const active=pkg===activePackage;
                  return (
                    <button
                      type="button"
                      key={pkg}
                      onClick={()=>{
                        setActivePackage(pkg);
                        const first=(data?.ticketOptions||[]).find(t=>optionPackageLabel(t)===pkg);
                        if(first){
                          setSelectedTicketId(first.id);
                          setSelectedSlot(first.rates.find(r=>r.slotTime)?.slotTime||'');
                        }
                      }}
                      className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${active?'border-primary bg-primary text-primary-foreground':'border-border bg-white hover:border-primary/40'}`}
                    >
                      {pkg}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-primary"/>
                <h2 className="font-bold">1. Select visit date</h2>
              </div>
              <DateStrip selectedDate={selectedDate} onSelect={v=>{setSelectedDate(v);setSelectedSlot('');}}/>
            </section>

            <section className="bg-card border border-border rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold">2. Choose ticket option</h2>
                  <p className="text-xs text-muted-foreground mt-1">Select the exact SKU you want to book.</p>
                </div>
                <Badge variant="outline">{packageTicketOptions.length} option{packageTicketOptions.length===1?'':'s'}</Badge>
              </div>

              {packageTicketOptions.length===0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <Ticket className="w-8 h-8 mx-auto text-muted-foreground"/>
                  <p className="font-semibold mt-2">No ticket products configured</p>
                  <p className="text-xs text-muted-foreground mt-1">Contracting must add an active SKU for this attraction.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {packageTicketOptions.map(opt=>{
                    const from=lowestAdult(opt);
                    const selected=opt.id===selectedTicketId;
                    const sellable=opt.rates.length>0&&from!==null;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={()=>{setSelectedTicketId(opt.id);setSelectedSlot(opt.rates.find(r=>r.slotTime)?.slotTime||'');}}
                        className={`w-full text-left rounded-xl border p-4 transition-all ${selected?'border-primary bg-primary/[0.035] ring-1 ring-primary/20':'border-border hover:border-primary/40'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold">{opt.name}</h3>
                              <Badge variant="outline" className="text-[10px]">{opt.ticketType}</Badge>
                              {opt.packageBadge&&<Badge className="text-[10px]">{opt.packageBadge}</Badge>}
                              {opt.skuCode&&<span className="text-[10px] font-mono text-muted-foreground">{opt.skuCode}</span>}
                            </div>
                            {(opt.packageDescription||opt.inclusions)&&<p className="text-xs text-muted-foreground mt-2 line-clamp-2">{opt.packageDescription||opt.inclusions}</p>}
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>{opt.minPax}-{opt.maxPax} pax</span>
                              {opt.requiresSlot&&<span>· Timed entry</span>}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            {sellable ? (
                              <>
                                <p className="text-[10px] text-muted-foreground">from</p>
                                <p className="text-xl font-black text-primary">AED {from!.toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground">per adult</p>
                              </>
                            ) : (
                              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                                <p className="text-xs font-semibold text-amber-800">{data?.pricesVisible===false&&opt.rates.length>0?'Sign in for agent rates':'Tariff unavailable'}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {selectedOption&&data?.pricesVisible===false&&(
              <section className="bg-card border border-border rounded-2xl p-5 text-center">
                <h2 className="font-bold">Agent rates and booking</h2>
                <p className="text-sm text-muted-foreground mt-1">B2B net prices, live allocation and booking on credit are available to registered agencies.</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
                  <Button className="font-black" onClick={()=>navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>Sign in to see rates</Button>
                  <Button variant="outline" onClick={()=>navigate('/partner/register')}>Register your agency</Button>
                </div>
              </section>
            )}

            {selectedOption&&data?.pricesVisible!==false&&(
              <section className="bg-card border border-border rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-primary"/>
                  <h2 className="font-bold">3. Configure ticket</h2>
                </div>

                <details className="border rounded-lg p-3 mb-3"><summary className="text-xs font-semibold cursor-pointer">Market & Promo</summary><div className="grid grid-cols-2 gap-2 mt-2"><label className="text-xs">Market Code<Input maxLength={2} placeholder="AE" value={market} onChange={e=>setMarket(e.target.value.toUpperCase())}/></label><label className="text-xs">Promo Code<Input value={promoCode} onChange={e=>setPromoCode(e.target.value)}/></label></div></details>
                {selectedOption.rates.length===0 ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
                    <p className="font-bold text-amber-900">No sellable tariff for {selectedDate}</p>
                    <p className="text-sm text-amber-800 mt-1">No positive active AED rate is available for this SKU/date. Try another date or contact fabBeds Attractions Support.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {selectedOption.requiresSlot&&(
                      <div>
                        <LabelLike icon={<Clock className="w-4 h-4"/>} text="Select time slot"/>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                          {slots.map(s=>{
                            const r=selectedOption.rates.find(x=>x.slotTime===s);
                            const soldOut=!r||(r.remaining!==null&&r.remaining<=0)||r.inventoryStatus==='Sold Out';
                            return (
                              <button key={s} type="button" disabled={soldOut} onClick={()=>setSelectedSlot(s)}
                                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selectedSlot===s?'bg-primary text-primary-foreground border-primary':'bg-white border-border'} disabled:opacity-40 disabled:line-through`}>
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeRate&&(
                      <>
                        <label className="block text-xs font-semibold">Rate Plan
                          <select className="w-full border rounded-lg p-3 mt-1 bg-card" value={activeRate.id} onChange={e=>setSelectedRateId(e.target.value)}>
                            {selectedOption.rates.filter(r=>!selectedOption.requiresSlot||r.slotTime===selectedSlot).map(r=><option key={r.id} value={r.id}>{r.ratePlanName} · AED {r.netCostAdult.toFixed(2)}</option>)}
                          </select>
                        </label>
                        <div className="text-xs space-y-1"><p>{liveQuote?.cancellation||activeRate.cancellation}</p>{(liveQuote?.inclusions||activeRate.inclusions)&&<p>{liveQuote?.inclusions||activeRate.inclusions}</p>}{(liveQuote?.restrictions||activeRate.restrictions)&&<p>{liveQuote?.restrictions||activeRate.restrictions}</p>}</div>
                        <div className="rounded-xl border border-border p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div><p className="text-xs text-muted-foreground">Adult</p><p className="font-black mt-1">AED {activeRate.netCostAdult.toLocaleString()}</p></div>
                            <div><p className="text-xs text-muted-foreground">Child</p><p className="font-black mt-1">{activeRate.netCostChild>0?`AED ${activeRate.netCostChild.toLocaleString()}`:'Not priced'}</p></div>
                          </div>
                          <div className="border-t mt-3 pt-3 text-xs text-muted-foreground">
                            {remaining!==null ? `${remaining} ticket(s) remaining for this rate` : 'Allocation managed by operations'}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border p-4">
                          <Counter label="Adults" sublabel="Adult ticket" value={adults} min={1} max={Math.max(1,selectedOption.maxPax-children)} onChange={setAdults}/>
                          {activeRate.netCostChild>0&&<Counter label="Children" sublabel="Child ticket" value={children} min={0} max={Math.max(0,selectedOption.maxPax-adults)} onChange={setChildren}/>}
                        </div>

                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                          <div className="flex items-end justify-between gap-4">
                            <div>
                              <p className="text-xs text-emerald-800">B2B agency total</p>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {quoteLoading ? 'Rechecking live price & allocation…' : liveQuote ? 'Authoritatively rechecked · AED only' : 'Waiting for authoritative recheck'}
                              </p>
                            </div>
                            <p className="text-2xl font-black text-emerald-800">AED {total.toLocaleString()}</p>
                          </div>
                          {liveQuote && liveQuote.retailTotal > liveQuote.netTotal && (
                            <div className="grid grid-cols-2 gap-3 border-t border-emerald-200 mt-3 pt-3 text-xs">
                              <div><span className="text-muted-foreground">Suggested retail</span><p className="font-bold">AED {liveQuote.retailTotal.toLocaleString()}</p></div>
                              <div><span className="text-muted-foreground">Potential margin</span><p className="font-bold text-emerald-800">AED {(liveQuote.retailTotal-liveQuote.netTotal).toLocaleString()}</p></div>
                            </div>
                          )}
                        </div>

                        {quoteError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{quoteError}</div>
                        )}

                        <Button className="w-full h-12 font-black hidden lg:flex" disabled={!canContinue} onClick={continueToCheckout}>
                          Continue to Checkout · AED {total.toLocaleString()} <ChevronRight className="w-4 h-4 ml-1"/>
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="min-w-0 flex-1">
            {activeRate&&canContinue ? (
              <>
                <p className="text-[10px] uppercase text-muted-foreground">Agency total</p>
                <p className="text-xl font-black text-primary">AED {total.toLocaleString()}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-sm">{selectedOption ? 'Complete ticket selection' : 'Select a ticket'}</p>
                <p className="text-[11px] text-muted-foreground">{selectedOption?.rates.length===0?'Tariff unavailable for this date':'Choose date, ticket, time and pax'}</p>
              </>
            )}
          </div>
          <Button className="shrink-0 min-w-[160px] font-black" disabled={!canContinue} onClick={continueToCheckout}>
            {canContinue?`Checkout · AED ${total.toLocaleString()}`:'Select Ticket'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LabelLike({icon,text}:{icon:React.ReactNode;text:string}){
  return <div className="flex items-center gap-2 text-sm font-semibold">{icon}{text}</div>;
}
