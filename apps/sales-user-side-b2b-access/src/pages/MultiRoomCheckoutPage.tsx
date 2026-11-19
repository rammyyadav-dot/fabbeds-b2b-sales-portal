import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  recheckMultiRoomOffer,
  RecheckMultiRoomOfferOutputType,
  createMultiRoomBookingInquiry,
  createMultiRoomRateHold,
  releaseMultiRoomRateHold,
  getPartnerWallet,
  GetPartnerWalletOutputType,
} from 'zitejs/api';
import { AlertTriangle, ArrowLeft, BadgeCheck, BedDouble, CheckCircle2, Loader2, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import SalesHeader from '@/components/sales/SalesHeader';
import { usePartnerAuth } from '@/lib/partnerAuth';
import { toast } from 'sonner';

type RoomConfig={adults:number;children:number;childAges:number[]};
type Assignment={requestedRoomNo:number;roomTypeId:string;ratePlanId:string};

const decodeJson=<T,>(raw:string|null,fallback:T):T=>{
  if(!raw) return fallback;
  try { return JSON.parse(decodeURIComponent(raw)) as T; } catch { return fallback; }
};
const aed=(n:number)=>`AED ${n.toLocaleString('en-AE',{maximumFractionDigits:2})}`;

export default function MultiRoomCheckoutPage({onLogout}:{onLogout:()=>void}) {
  const {id}=useParams<{id:string}>();
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const {partner,token}=usePartnerAuth();

  const checkIn=params.get('checkIn')||'';
  const checkOut=params.get('checkOut')||'';
  const nationality=(params.get('nationality')||'IN').toUpperCase();
  const extraMarkupPct=Math.min(50,Math.max(0,Number(params.get('extraMarkupPct')||0)||0));
  const roomConfigs=useMemo(()=>decodeJson<RoomConfig[]>(params.get('roomConfigs'),[]),[params]);
  const initialAssignments=useMemo(()=>decodeJson<Assignment[]>(params.get('assignments'),[]),[params]);
  const initialExpected=Math.max(0,Number(params.get('expectedSellTotal')||0)||0);
  const initialSignature=params.get('expectedSignature')||'';

  const [assignments,setAssignments]=useState<Assignment[]>(initialAssignments);
  const [expectedSignature,setExpectedSignature]=useState(initialSignature);
  const [expectedSellTotal,setExpectedSellTotal]=useState(initialExpected);
  const [quote,setQuote]=useState<RecheckMultiRoomOfferOutputType|null>(null);
  const [quoteLoading,setQuoteLoading]=useState(true);
  const [quoteError,setQuoteError]=useState<string|null>(null);
  const [wallet,setWallet]=useState<GetPartnerWalletOutputType|null>(null);
  const [walletLoading,setWalletLoading]=useState(false);
  const [guestName,setGuestName]=useState('');
  const [specialRequests,setSpecialRequests]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [holdToken,setHoldToken]=useState('');
  const [holdExpiresAt,setHoldExpiresAt]=useState('');
  const [holdBusy,setHoldBusy]=useState(false);
  const [holdRemaining,setHoldRemaining]=useState(0);

  useEffect(()=>{
    if(!holdExpiresAt){setHoldRemaining(0);return;}
    const tick=()=>setHoldRemaining(Math.max(0,Math.ceil((new Date(holdExpiresAt).getTime()-Date.now())/1000)));
    tick(); const timer=setInterval(tick,1000); return()=>clearInterval(timer);
  },[holdExpiresAt]);

  const clearHold=()=>{setHoldToken('');setHoldExpiresAt('');setHoldRemaining(0);};

  const releaseHold=async()=>{
    if(!holdToken||!token){clearHold();return;}
    try{await releaseMultiRoomRateHold({partnerToken:token,holdToken});}catch{}
    clearHold();
  };

  const runRecheck=async(expected:number)=>{
    if(!id||!checkIn||!checkOut||!roomConfigs.length||!assignments.length) {
      setQuoteError('The mixed-room offer link is incomplete. Return to search and select the offer again.');
      setQuote(null); setQuoteLoading(false); return;
    }
    setQuoteLoading(true); setQuoteError(null);
    try {
      const result=await recheckMultiRoomOffer({
        hotelId:id,checkIn,checkOut,roomConfigs,assignments,nationality,extraMarkupPct,
        expectedSellTotal:expected>0?expected:undefined,
        expectedSignature:expectedSignature||undefined,
      });
      setQuote(result);
    } catch(err:any) {
      setQuote(null);
      setQuoteError(err?.message||'Unable to recheck this room combination.');
    } finally { setQuoteLoading(false); }
  };

  useEffect(()=>{ runRecheck(expectedSellTotal); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },[id,checkIn,checkOut,nationality,extraMarkupPct,JSON.stringify(roomConfigs),JSON.stringify(assignments)]);

  useEffect(()=>{
    if(!token){setWallet(null);return;}
    setWalletLoading(true);
    getPartnerWallet({token}).then(setWallet).catch(()=>setWallet(null)).finally(()=>setWalletLoading(false));
  },[token]);

  const creditInsufficient=!!quote&&!!wallet&&quote.sellTotal>wallet.creditAvailable;
  const holdActive=!!holdToken&&holdRemaining>0;
  const canSubmit=!!partner&&!!token&&!!wallet?.canBookOnCredit&&!creditInsufficient&&holdActive&&
    quote?.status==='RECHECKED'&&confirmed&&guestName.trim().length>=2&&!submitting&&!quoteLoading;

  const createHold=async()=>{
    if(!partner||!token){
      navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname+window.location.search)}`);
      return;
    }
    if(!quote||quote.status!=='RECHECKED'){toast.error('Recheck the room combination before holding it.');return;}
    setHoldBusy(true);
    try{
      const hold=await createMultiRoomRateHold({
        partnerToken:token,hotelId:id!,checkIn,checkOut,roomConfigs,assignments,nationality,extraMarkupPct,
        expectedSellTotal:quote.sellTotal,expectedSignature:quote.signature,
      });
      setHoldToken(hold.holdToken);setHoldExpiresAt(hold.expiresAt);
      toast.success('Rooms and price held for 10 minutes.');
    }catch(err:any){toast.error(err?.message||'Unable to hold this offer.');}
    finally{setHoldBusy(false);}
  };

  const acceptChangedPrice=async()=>{
    if(!quote||quote.status!=='PRICE_CHANGED') return;
    await releaseHold();
    setExpectedSellTotal(quote.sellTotal);
    await runRecheck(quote.sellTotal);
    toast.success('Updated price accepted and rechecked.');
  };

  const acceptReplacement=async()=>{
    if(!quote?.replacement) return;
    await releaseHold();
    setAssignments(quote.replacement.assignments);
    setExpectedSignature(quote.replacement.signature);
    setExpectedSellTotal(quote.replacement.sellTotal);
    setQuote(null);
    setQuoteLoading(true);
    try {
      const result=await recheckMultiRoomOffer({
        hotelId:id!,checkIn,checkOut,roomConfigs,
        assignments:quote.replacement.assignments,
        nationality,extraMarkupPct,
        expectedSellTotal:quote.replacement.sellTotal,
        expectedSignature:quote.replacement.signature,
      });
      setQuote(result);
      if(result.status==='RECHECKED') toast.success('Replacement room combination accepted and rechecked.');
    } catch(err:any) {
      setQuoteError(err?.message||'Replacement combination could not be rechecked.');
    } finally { setQuoteLoading(false); }
  };

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!partner||!token){
      navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname+window.location.search)}`);
      return;
    }
    if(!quote||quote.status!=='RECHECKED'){toast.error('A successful authoritative recheck is required.');return;}
    if(!holdActive){toast.error('Hold the rooms and price before submitting.');return;}
    if(!wallet?.canBookOnCredit){toast.error('Agency credit is not available for booking.');return;}
    if(creditInsufficient){toast.error('Insufficient agency credit.');return;}
    if(!confirmed){toast.error('Confirm the declaration to continue.');return;}

    setSubmitting(true);
    try {
      const result=await createMultiRoomBookingInquiry({
        partnerToken:token,
        hotelId:id!,
        checkIn,checkOut,roomConfigs,assignments,nationality,extraMarkupPct,
        expectedSellTotal:quote.sellTotal,
        expectedSignature:quote.signature,
        holdToken,
        guestName:guestName.trim(),
        specialRequests:specialRequests.trim()||undefined,
      });
      toast.success(`Reservation request ${result.bookingReference} submitted.`);
      navigate(`/booking/${result.bookingId}/confirmation`);
    } catch(err:any){
      toast.error(err?.message||'Mixed-room booking request could not be submitted.');
      await releaseHold();
      await runRecheck(quote.sellTotal);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0}/>
      <main className="container mx-auto max-w-6xl px-4 py-6">
        <Button variant="ghost" size="sm" className="-ml-2 mb-4 gap-2" onClick={()=>navigate(-1)}>
          <ArrowLeft className="w-4 h-4"/> Back
        </Button>

        <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-100 p-2"><BedDouble className="w-5 h-5 text-violet-700"/></div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-violet-700">Mixed-room checkout</p>
              <h1 className="text-xl font-black mt-1">Authoritative Room Combination</h1>
              <p className="text-sm text-muted-foreground mt-1">{checkIn} → {checkOut} · {roomConfigs.length} rooms · market {nationality}</p>
            </div>
          </div>
        </div>

        {quoteError&&<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5"/>{quoteError}</div>}

        <form onSubmit={submit}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
            <div className="space-y-5">
              <section className="bg-card border rounded-xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-bold">Room assignment</h2>
                    <p className="text-xs text-muted-foreground">Each requested room is rechecked independently against its exact Room Type and Rate Plan.</p>
                  </div>
                  {quote?.status==='RECHECKED'&&<span className="text-xs font-bold text-emerald-700 flex items-center gap-1"><ShieldCheck className="w-4 h-4"/> Rechecked</span>}
                </div>

                {quoteLoading ? (
                  <div className="py-12 flex justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2"/>Authoritative recheck…</div>
                ) : quote?.assignments.length ? (
                  <div className="space-y-3">
                    {quote.assignments.map((a,index)=>{
                      const rc=roomConfigs[index];
                      return <div key={a.requestedRoomNo} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-extrabold">Room {a.requestedRoomNo} · {a.roomTypeName}</p>
                            <p className="text-xs text-muted-foreground mt-1">{a.ratePlanName} · {a.mealPlan}</p>
                            <p className="text-xs text-muted-foreground mt-1">{rc?.adults||0} adults{(rc?.children||0)>0?` · ${rc.children} child${rc.children!==1?'ren':''} (${rc.childAges.join(', ')} yrs)`:''}</p>
                            <p className="text-[11px] mt-2">{a.cancellationPolicy||'Cancellation policy applies at booking'}</p>
                            <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                              {a.childTotal>0&&<span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-emerald-700">Child {aed(a.childTotal)}</span>}
                              {a.extraBedTotal>0&&<span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-1 text-amber-700">Extra bed {aed(a.extraBedTotal)}</span>}
                              {a.eventSupplementTotal>0&&<span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-1 text-violet-700">Event {aed(a.eventSupplementTotal)}</span>}
                              {a.promotionCode&&<span className="rounded-full bg-red-50 border border-red-200 px-2 py-1 text-red-700">{a.promotionName||a.promotionCode}</span>}
                            </div>
                          </div>
                          <p className="text-lg font-black text-primary whitespace-nowrap">{aed(a.roomSellTotal)}</p>
                        </div>
                      </div>
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No rechecked room assignment is available.</div>
                )}

                {quote&&quote.status!=='RECHECKED'&&quote.status!=='PRICE_CHANGED'&&(
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <b>{quote.status.replaceAll('_',' ')}</b>{quote.reasonCodes.length?` · ${quote.reasonCodes.join(' · ')}`:''}
                  </div>
                )}

                {quote?.replacement&&(
                  <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-extrabold text-violet-800">Replacement room combination available</p>
                        <p className="text-[11px] text-violet-700 mt-1">The original combination changed, but another complete valid combination is available.</p>
                      </div>
                      <p className="font-black text-violet-800 whitespace-nowrap">{aed(quote.replacement.sellTotal)}</p>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {quote.replacement.roomSummary.map(r=>(
                        <div key={r.requestedRoomNo} className="flex justify-between gap-3 text-xs">
                          <span>Room {r.requestedRoomNo} · {r.roomTypeName} · {r.mealPlan}</span>
                          <b>{aed(r.roomSellTotal)}</b>
                        </div>
                      ))}
                    </div>
                    <Button type="button" size="sm" className="w-full mt-3" onClick={acceptReplacement}>Accept replacement & recheck</Button>
                  </div>
                )}
              </section>

              <section className="bg-card border rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary"/><h2 className="font-bold">Lead traveller</h2></div>
                <div>
                  <Label className="text-xs text-muted-foreground">Guest name *</Label>
                  <Input value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder="Guest full name" className="mt-1.5"/>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Special requests</Label>
                  <Textarea value={specialRequests} onChange={e=>setSpecialRequests(e.target.value)} rows={3} className="mt-1.5" placeholder="Room preferences, dietary or accessibility requests"/>
                </div>
              </section>

              <section className="bg-card border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <Checkbox id="multi-declare" checked={confirmed} onCheckedChange={v=>setConfirmed(!!v)} className="mt-0.5"/>
                  <Label htmlFor="multi-declare" className="text-sm leading-relaxed text-muted-foreground cursor-pointer">
                    I confirm this mixed-room reservation request is subject to hotel confirmation, the cancellation policy of each assigned rate plan, and a final authoritative recheck at submission.
                  </Label>
                </div>
              </section>
            </div>

            <aside className="lg:sticky lg:top-4 h-fit bg-card border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-primary px-5 py-4 text-primary-foreground">
                <p className="text-[10px] uppercase tracking-widest opacity-70">Best valid offer</p>
                <p className="font-bold mt-1">Complete stay pricing</p>
              </div>
              <div className="p-5 space-y-4">
                {quoteLoading?<div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2"/>Rechecking…</div>:quote?<>
                  <div className="space-y-2">
                    {quote.assignments.map(a=><div key={a.requestedRoomNo} className="flex justify-between text-xs"><span>Room {a.requestedRoomNo}</span><b>{aed(a.roomSellTotal)}</b></div>)}
                  </div>
                  <div className="border-t pt-3 flex items-center justify-between"><span className="font-bold">Total</span><span className="text-xl font-black text-primary">{aed(quote.sellTotal)}</span></div>
                  <div className="text-[10px] text-muted-foreground">{quote.nights} nights · {quote.rooms} rooms · rechecked {new Date(quote.recheckedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>

                  {quote.status==='PRICE_CHANGED'&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-800">Price changed by {aed(Math.abs(quote.changedBy))}</p>
                    <p className="text-[11px] text-amber-700 mt-1">Review the new total before continuing.</p>
                    <Button type="button" size="sm" className="w-full mt-3" onClick={acceptChangedPrice}>Accept & recheck new price</Button>
                  </div>}
                  {quote.status==='RECHECKED'&&<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 flex gap-2"><CheckCircle2 className="w-4 h-4"/>Combination and price rechecked.</div>}

                  {partner&&quote.status==='RECHECKED'&&(
                    holdActive ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-extrabold text-emerald-800">Rooms & price held</p>
                            <p className="text-[11px] text-emerald-700 mt-1">
                              Expires in {String(Math.floor(holdRemaining/60)).padStart(2,'0')}:{String(holdRemaining%60).padStart(2,'0')}
                            </p>
                          </div>
                          <ShieldCheck className="w-5 h-5 text-emerald-700"/>
                        </div>
                        <Button type="button" size="sm" variant="outline" className="w-full mt-3" onClick={releaseHold}>Release hold</Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-bold text-amber-800">{holdToken&&holdRemaining===0?'Hold expired':'Secure inventory before booking'}</p>
                        <p className="text-[11px] text-amber-700 mt-1">A 10-minute hold protects the selected room allocation and quoted price while you submit.</p>
                        <Button type="button" size="sm" className="w-full mt-3" onClick={createHold} disabled={holdBusy}>
                          {holdBusy?<><Loader2 className="w-4 h-4 animate-spin mr-2"/>Holding…</>:'Hold rooms & price · 10 min'}
                        </Button>
                      </div>
                    )
                  )}
                </>:null}

                <div className="border-t pt-3">
                  {walletLoading?<p className="text-xs text-muted-foreground">Checking agency credit…</p>:wallet?<div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span>Credit available</span><b>{aed(wallet.creditAvailable)}</b></div>
                    {creditInsufficient&&<p className="text-red-600 mt-2">Insufficient credit for this request.</p>}
                  </div>:<p className="text-xs text-muted-foreground">Sign in to validate agency credit.</p>}
                </div>

                {!partner?<Button type="button" className="w-full" onClick={()=>navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname+window.location.search)}`)}>Sign in to continue</Button>:
                <Button type="submit" className="w-full" disabled={!canSubmit}>{submitting?<><Loader2 className="w-4 h-4 animate-spin mr-2"/>Submitting…</>:<><BadgeCheck className="w-4 h-4 mr-2"/>Submit reservation</>}</Button>}
              </div>
            </aside>
          </div>
        </form>
      </main>
    </div>
  );
}
