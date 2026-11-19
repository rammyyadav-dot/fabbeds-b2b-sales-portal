import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  createAttractionBooking,
  createAttractionHold,
  getPartnerWallet,
  recheckAttractionOffer,
  type GetPartnerWalletOutputType,
  type RecheckAttractionOfferOutputType,
} from 'zitejs/api';
import { toast } from 'sonner';
import {
  ArrowLeft, BadgeCheck, CalendarDays, Clock3, CreditCard, FileText, MapPin,
  ShieldCheck, Ticket, Users, Zap
} from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import SalesHeader from '@/components/sales/SalesHeader';
import SupportHelpCard from '@/components/attractions/SupportHelpCard';
import { usePartnerAuth } from '@/lib/partnerAuth';
import { resolveAttractionImage } from '@/lib/attractionImages';
import AttractionBookingSteps from '@/components/attractions/AttractionBookingSteps';

function SectionCard({ num, title, children }: { num: number; title: string; children: ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{num}</div>
        <h2 className="font-bold text-sm">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

export default function AttractionCheckoutPage({ onLogout }: { onLogout: () => void }) {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { partner, token, isLoading: authLoading } = usePartnerAuth();

  const ticketOptionId = params.get('ticketOptionId') || '';
  const targetDate = params.get('date') || '';
  const targetSlot = params.get('slot') || undefined;
  const selectedRateId=params.get('rateId')||undefined;
  const market=params.get('market')||undefined;
  const promoCode=params.get('promoCode')||undefined;
  const adultCount = Math.max(0, Number(params.get('adults') || 1));
  const childCount = Math.max(0, Number(params.get('children') || 0));

  const [quote, setQuote] = useState<RecheckAttractionOfferOutputType | null>(null);
  const [wallet, setWallet] = useState<GetPartnerWalletOutputType | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [hold, setHold] = useState<{ holdId: string; holdReference: string; expiresAt: string } | null>(null);
  const [guestName, setGuestName] = useState('');
  const [nationality, setNationality] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!hold) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hold?.expiresAt]);

  useEffect(() => {
    if (authLoading) return;
    if (!partner || !token) {
      navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
      return;
    }

    setLoading(true);
    Promise.all([
      recheckAttractionOffer({
        ticketOptionId,rateId:selectedRateId,market,promoCode,
        partnerToken: token,
        date: targetDate,
        slot: targetSlot,
        adultCount,
        childCount,
      }),
      getPartnerWallet({ token }),
    ])
      .then(async ([q, w]) => {
        setQuote(q);
        setWallet(w);

        const h = await createAttractionHold({
          partnerToken: token,
          offerId: q.offerId,
          ticketOptionId: q.ticketOptionId,rateId:q.rateId,market,promoCode,
          date: q.date,
          slot: q.slot || undefined,
          adultCount: q.adultCount,
          childCount: q.childCount,
        });
        setHold({ holdId: h.holdId, holdReference: h.holdReference, expiresAt: h.expiresAt });
      })
      .catch((err: any) => {
        setQuote(null);
        setHold(null);
        toast.error(err?.message || 'This attraction offer could not be rechecked or held.');
      })
      .finally(() => setLoading(false));
  }, [authLoading, partner, token, ticketOptionId, targetDate, targetSlot, adultCount, childCount, selectedRateId, market, promoCode, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!partner || !token || !quote || !hold) return;
    if (new Date(hold.expiresAt).getTime() <= Date.now()) return toast.error('Your ticket hold expired. Please recheck availability.');
    if (!guestName.trim()) return toast.error('Lead guest name is required.');
    if (!confirmed) return toast.error('Please accept the booking declaration.');
    if (!wallet?.canBookOnCredit) return toast.error('Agency credit is not currently available for booking.');
    if (quote.netTotal > wallet.creditAvailable) {
      return toast.error(`Insufficient agency credit. Available AED ${wallet.creditAvailable.toLocaleString()}.`);
    }

    setBooking(true);
    try {
      const res = await createAttractionBooking({
        partnerToken: token,
        offerId: quote.offerId,
        holdId: hold.holdId,
        ticketOptionId: quote.ticketOptionId,rateId:quote.rateId,market,promoCode,
        targetDate: quote.date,
        targetSlot: quote.slot || undefined,
        adultCount: quote.adultCount,
        childCount: quote.childCount,
        guestName: guestName.trim(),
        guestNationality: nationality.trim() || undefined,
        specialRequests: specialRequests.trim() || undefined,
      });

      toast.success(
        res.reservationStatus === 'Confirmed' ? 'Attraction booking confirmed' : 'Reservation submitted',
        { description: `${res.bookingReference} · Available credit AED ${res.creditAvailableAfter.toLocaleString()}` }
      );
      navigate(`/attraction/booking/${res.bookingId}/confirmation`);
    } catch (err: any) {
      toast.error(err?.message || 'Attraction reservation could not be created.');
    } finally {
      setBooking(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SalesHeader onLogout={onLogout} hotelCount={0} />
        <div className="container mx-auto max-w-6xl px-4 py-7 space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!quote || !partner || !token) return null;

  const insufficient = !!wallet && quote.netTotal > wallet.creditAvailable;
  const holdRemainingSeconds = hold ? Math.max(0, Math.floor((new Date(hold.expiresAt).getTime() - nowMs) / 1000)) : 0;
  const holdExpired = !!hold && holdRemainingSeconds <= 0;
  const holdMinutes = Math.floor(holdRemainingSeconds / 60);
  const holdSeconds = holdRemainingSeconds % 60;
  const holdCountdown = `${String(holdMinutes).padStart(2,'0')}:${String(holdSeconds).padStart(2,'0')}`;
  const adultSubtotal = quote.netAdult * quote.adultCount;
  const childSubtotal = quote.netChild * quote.childCount;
  const tradeSavings = Math.max(0, quote.retailTotal - quote.netTotal);
  const blocked = !wallet?.canBookOnCredit || insufficient || !hold || holdExpired;
  const attractionImage = resolveAttractionImage({ title: quote.attractionName });
  const ctaLabel = quote.instantConfirmation ? `Book Now · AED ${quote.netTotal.toLocaleString()}` : `Submit Booking · AED ${quote.netTotal.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-muted/30 pb-24 lg:pb-0">
      <SalesHeader onLogout={onLogout} hotelCount={0} />
      <main className="container mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-7">
        <Button variant="ghost" size="sm" className="-ml-2 mb-3 gap-2" onClick={() => navigate(`/attraction/${id}`)}>
          <ArrowLeft className="w-4 h-4" /> Back to attraction
        </Button>

        <AttractionBookingSteps current={2} detailPath={id ? `/attraction/${id}` : undefined} />

        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5 shadow-sm">
          <div className="grid grid-cols-[96px_1fr] sm:grid-cols-[132px_1fr_auto] items-stretch">
            <img src={attractionImage} alt={quote.attractionName} className="w-full h-full min-h-[96px] sm:min-h-[118px] object-cover" />
            <div className="p-4 sm:p-5 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-primary font-bold">Review & book</p>
              <h1 className="font-extrabold text-lg sm:text-xl mt-1">{quote.attractionName}</h1>
              <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                <span>{quote.ticketOptionName}</span><span>·</span><span className="font-mono">{quote.sku}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline" className="gap-1"><BadgeCheck className="w-3 h-3" /> Price rechecked</Badge>
                {hold && !holdExpired && <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800"><Clock3 className="w-3 h-3" /> Held {holdCountdown}</Badge>}
                {quote.instantConfirmation && <Badge className="gap-1 bg-emerald-600"><Zap className="w-3 h-3" /> Fast confirmation eligible</Badge>}
              </div>
            </div>
            <div className="hidden sm:flex p-5 items-center justify-end">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total payable</p>
                <p className="text-2xl font-black text-primary mt-1">AED {quote.netTotal.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Agency credit</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px] gap-4 sm:gap-5">
            <div className="min-w-0 space-y-4 sm:space-y-5">
              <SectionCard num={1} title="Experience & Rechecked Offer">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label className="text-xs text-muted-foreground">Visit date</Label><div className="mt-1.5 border rounded-lg p-3 text-sm font-semibold flex gap-2"><CalendarDays className="w-4 h-4 text-primary" />{quote.date}</div></div>
                  <div><Label className="text-xs text-muted-foreground">Time slot</Label><div className="mt-1.5 border rounded-lg p-3 text-sm font-semibold">{quote.slot || 'Open date / no slot'}</div></div>
                  <div><Label className="text-xs text-muted-foreground">Travellers</Label><div className="mt-1.5 border rounded-lg p-3 text-sm font-semibold">{quote.adultCount} Adult(s) · {quote.childCount} Child(ren)</div></div>
                  <div><Label className="text-xs text-muted-foreground">Availability</Label><div className="mt-1.5 border rounded-lg p-3 text-sm font-semibold">{quote.inventoryStatus}{quote.remaining != null ? ` · ${quote.remaining} remaining` : ''}</div></div>
                </div>
                <div className="rounded-xl border border-border bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/20">
                    <p className="text-xs font-bold">Price breakdown</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Authoritative AED rates from the latest recheck.</p>
                  </div>
                  <div className="p-4 space-y-2.5 text-sm">
                    {quote.adultCount > 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Adult × {quote.adultCount} <span className="text-[11px]">(@ AED {quote.netAdult.toLocaleString()})</span></span>
                        <span className="font-semibold">AED {adultSubtotal.toLocaleString()}</span>
                      </div>
                    )}
                    {quote.childCount > 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Child × {quote.childCount} <span className="text-[11px]">(@ AED {quote.netChild.toLocaleString()})</span></span>
                        <span className="font-semibold">AED {childSubtotal.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="border-t pt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="font-bold">Total payable</p>
                        <p className="text-[11px] text-muted-foreground">Charged to agency credit · no online payment</p>
                      </div>
                      <p className="text-2xl font-black text-primary">AED {quote.netTotal.toLocaleString()}</p>
                    </div>
                    {tradeSavings > 0 && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-between text-xs">
                        <span className="text-emerald-800">Suggested retail AED {quote.retailTotal.toLocaleString()}</span>
                        <span className="font-bold text-emerald-800">Trade value AED {tradeSavings.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                {hold && (
                  <div className={`rounded-lg border p-3 text-xs flex items-center justify-between gap-3 ${holdExpired ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    <span><strong>{holdExpired ? 'Ticket hold expired' : 'Tickets temporarily reserved'}</strong>{!holdExpired ? ` · ${hold.holdReference}` : ''}</span>
                    {holdExpired
                      ? <button type="button" className="font-bold underline" onClick={() => window.location.reload()}>Recheck availability</button>
                      : <span className="font-mono font-bold">{holdCountdown}</span>}
                  </div>
                )}
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold">Cancellation policy</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{quote.cancellation}</p>
                </div>
              </SectionCard>

              <SectionCard num={2} title="Lead Traveller">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label className="text-xs">Guest name *</Label><Input className="mt-1.5 h-11" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Guest full name" /></div>
                  <div><Label className="text-xs">Nationality</Label><Input className="mt-1.5 h-11" value={nationality} onChange={e => setNationality(e.target.value)} placeholder="e.g. Indian" /></div>
                </div>
              </SectionCard>

              <SectionCard num={3} title="Agency Credit Account">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-bold">{partner.agencyName}</p><p className="text-xs text-muted-foreground mt-1">{partner.agencyEmail}</p></div>
                    <Badge variant={wallet?.creditStatus === 'Approved' ? 'default' : 'outline'}>{wallet?.creditStatus || partner.creditStatus}</Badge>
                  </div>
                </div>
                {wallet && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="border rounded-lg p-3"><p className="text-[10px] uppercase text-muted-foreground">Limit</p><p className="font-bold mt-1">AED {wallet.creditLimit.toLocaleString()}</p></div>
                    <div className="border rounded-lg p-3"><p className="text-[10px] uppercase text-muted-foreground">Used</p><p className="font-bold mt-1">AED {wallet.creditUsed.toLocaleString()}</p></div>
                    <div className={`border rounded-lg p-3 ${insufficient ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}><p className="text-[10px] uppercase text-muted-foreground">Available</p><p className={`font-bold mt-1 ${insufficient ? 'text-red-700':'text-emerald-700'}`}>AED {wallet.creditAvailable.toLocaleString()}</p></div>
                    <div className="border rounded-lg p-3 bg-primary/[0.035]"><p className="text-[10px] uppercase text-muted-foreground">After booking</p><p className="font-bold mt-1">AED {Math.max(0, wallet.creditAvailable - quote.netTotal).toLocaleString()}</p></div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> No payment gateway. Settlement is offline against the shared agency credit facility.</p>
                {blocked && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    {holdExpired
                      ? 'Your ticket hold expired. Recheck availability before booking.'
                      : insufficient && wallet
                        ? `Insufficient credit: AED ${wallet.creditAvailable.toLocaleString()} available, AED ${quote.netTotal.toLocaleString()} required.`
                        : 'Booking is blocked until agency credit is approved, sufficient and free of overdue exposure.'}
                  </div>
                )}
              </SectionCard>

              <SectionCard num={4} title="Booking Notes">
                <Label className="text-xs">Special requests</Label>
                <Textarea className="mt-1.5" rows={4} value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Accessibility, pickup or operational notes…" />
              </SectionCard>

              <SectionCard num={5} title="Declaration">
                <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-4">
                  <Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(!!v)} id="att-declare" className="mt-0.5" />
                  <Label htmlFor="att-declare" className="text-sm leading-relaxed cursor-pointer">
                    I confirm the traveller details are correct and accept the ticket and cancellation conditions. I understand that AED {quote.netTotal.toLocaleString()} will be allocated against my agency credit facility. Final admission documents are issued only after authoritative confirmation.
                  </Label>
                </div>
              </SectionCard>

              <SupportHelpCard />
            </div>

            <aside className="h-fit lg:sticky lg:top-5 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="relative h-36 overflow-hidden">
                <img src={attractionImage} alt={quote.attractionName} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                  <p className="text-[10px] uppercase tracking-wider text-white/70">Your booking</p>
                  <h3 className="font-bold mt-1 leading-tight">{quote.attractionName}</h3>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="text-sm space-y-2.5">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Ticket</span><span className="font-semibold text-right">{quote.ticketOptionName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{quote.date}{quote.slot ? ` · ${quote.slot}` : ''}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Travellers</span><span>{quote.adultCount} Adult{quote.adultCount===1?'':'s'}{quote.childCount ? ` · ${quote.childCount} Child${quote.childCount===1?'':'ren'}` : ''}</span></div>
                </div>

                <div className="border-t pt-4 space-y-2 text-sm">
                  {quote.adultCount > 0 && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Adult × {quote.adultCount}</span><span>AED {adultSubtotal.toLocaleString()}</span></div>}
                  {quote.childCount > 0 && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Child × {quote.childCount}</span><span>AED {childSubtotal.toLocaleString()}</span></div>}
                  <div className="border-t pt-3 mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-black">Total payable</p>
                      <p className="text-[10px] text-muted-foreground">Agency credit</p>
                    </div>
                    <span className="text-2xl font-black text-primary">AED {quote.netTotal.toLocaleString()}</span>
                  </div>
                </div>

                {wallet && (
                  <div className="rounded-xl bg-muted/30 border border-border p-3 text-xs space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Credit available</span><span className="font-semibold">AED {wallet.creditAvailable.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">This booking</span><span className="font-semibold">− AED {quote.netTotal.toLocaleString()}</span></div>
                    <div className="border-t pt-2 flex justify-between"><span className="font-semibold">After booking</span><span className="font-bold">AED {Math.max(0, wallet.creditAvailable - quote.netTotal).toLocaleString()}</span></div>
                  </div>
                )}

                {hold && (
                  <div className={`rounded-lg border p-3 text-xs flex items-center gap-2 ${holdExpired ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    <Clock3 className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{holdExpired ? 'Ticket hold expired' : 'Tickets reserved while you complete checkout'}</span>
                    {!holdExpired && <span className="font-mono font-bold">{holdCountdown}</span>}
                  </div>
                )}

                <div className="rounded-lg border p-3 text-xs flex gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                  <span>{quote.instantConfirmation ? 'Fast confirmation eligible. Final supplier/operations status is shown after booking.' : 'Booking will be submitted for supplier/operations confirmation.'}</span>
                </div>

                {holdExpired ? (
                  <Button type="button" className="w-full h-12 font-black" onClick={() => window.location.reload()}>
                    Recheck Availability
                  </Button>
                ) : (
                  <Button type="submit" className="w-full h-12 font-black text-base" disabled={booking || blocked || !confirmed || !guestName.trim()}>
                    {booking ? 'Submitting…' : ctaLabel}
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">No online payment. Final voucher and credit invoice follow the authoritative reservation status.</p>
              </div>
            </aside>
          </div>
        </form>
      </main>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-border px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase text-muted-foreground">Total payable</p>
            <p className="text-xl font-black text-primary">AED {quote.netTotal.toLocaleString()}</p>
            {!holdExpired && hold && <p className="text-[10px] text-amber-700 mt-0.5">Hold {holdCountdown}</p>}
          </div>
          <Button
            type="button"
            className="min-w-[190px] font-black"
            disabled={booking || (!holdExpired && (blocked || !confirmed || !guestName.trim()))}
            onClick={() => {
              if (holdExpired) {
                window.location.reload();
                return;
              }
              const form=document.querySelector('form');
              if (form) form.requestSubmit();
            }}
          >
            {booking ? 'Submitting…' : holdExpired ? 'Recheck Availability' : ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
