import { useEffect, useMemo, useState } from 'react';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Button } from '@project/components/ui/button';
import { Checkbox } from '@project/components/ui/checkbox';
import { Textarea } from '@project/components/ui/textarea';
import { toast } from 'sonner';
import { createTransferBooking, recheckTransferQuote, RecheckTransferQuoteOutputType, getPartnerWallet, GetPartnerWalletOutputType } from 'zitejs/api';
import { usePartnerAuth } from '@/lib/partnerAuth';
import { BadgeCheck, CheckCircle2, Clock3, Loader2, ShieldCheck } from 'lucide-react';

interface Props {
  transferType: string;
  rateId: string;
  pickupDate: string;
  pickupTime: string;
  originZoneName: string;
  destZoneName: string;
  vehicleName: string;
  initialPax: number;
  initialLuggage: number;
  onSuccess: (ref: string) => void;
}

export default function TransferBookingForm({
  transferType,
  rateId,
  pickupDate,
  pickupTime,
  originZoneName,
  destZoneName,
  vehicleName,
  initialPax,
  initialLuggage,
  onSuccess,
}: Props) {
  const [form, setForm] = useState({
    pickupAddress: '',
    dropoffAddress: '',
    flightNumber: '',
    leadPassengerName: '',
    passengerPhone: '',
    paxCount: initialPax,
    luggageCount: initialLuggage,
    meetAndGreet: false,
    childSeat: false,
    specialNotes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ ref: string; total: number } | null>(null);
  const [quote, setQuote] = useState<RecheckTransferQuoteOutputType | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const { token, isLoading: authLoading } = usePartnerAuth();
  const [wallet, setWallet] = useState<GetPartnerWalletOutputType | null>(null);
  const loadWallet = () => { if (token) getPartnerWallet({ token }).then(setWallet).catch(() => setWallet(null)); };
  useEffect(loadWallet, [token]);
  const signInHref = `/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  const total = quote?.totalPrice ?? 0;
  const creditShort = !!wallet && wallet.valid && total > 0 && total > wallet.creditAvailable;
  const creditBlocked = !!wallet && (!wallet.valid || !wallet.canBookOnCredit || creditShort);

  const needsFlight = transferType === 'ARRIVAL' || transferType === 'DEPARTURE';

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!token) { setQuote(null); setQuoteLoading(false); setQuoteError('Sign in with your agency account to see the live fare and book on credit.'); return; }
    const timer = window.setTimeout(() => {
      setQuoteLoading(true);
      setQuoteError(null);
      recheckTransferQuote({
        partnerToken: token,
        transferType: transferType as any,
        rateId,
        pickupDate,
        pickupTime,
        paxCount: form.paxCount,
        luggageCount: form.luggageCount,
        meetAndGreet: form.meetAndGreet,
        childSeat: form.childSeat,
      })
        .then(result => {
          if (!cancelled) setQuote(result);
        })
        .catch(error => {
          if (!cancelled) {
            setQuote(null);
            setQuoteError(error instanceof Error ? error.message : 'Quote recheck failed');
          }
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    transferType,
    rateId,
    pickupDate,
    pickupTime,
    form.paxCount,
    form.luggageCount,
    form.meetAndGreet,
    form.childSeat,
    token,
    authLoading,
  ]);

  const quoteExpiry = useMemo(() => {
    if (!quote?.quoteValidUntil) return '';
    return new Date(quote.quoteValidUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [quote?.quoteValidUntil]);

  const handleSubmit = async () => {
    if (!form.leadPassengerName || !form.passengerPhone || !form.pickupAddress || !form.dropoffAddress) {
      toast.error('Please fill all required traveller and pickup details');
      return;
    }
    if (needsFlight && !form.flightNumber) {
      toast.error('Flight number is required for airport transfers');
      return;
    }
    if (!quote || quoteLoading) {
      toast.error('Please wait for the authoritative fare recheck');
      return;
    }

    setSubmitting(true);
    try {
      if (!token) { window.location.href = signInHref; return; }
      if (creditBlocked) { toast.error(wallet?.blockReason || (creditShort ? `Insufficient agency credit. Available AED ${wallet?.creditAvailable.toFixed(2)}.` : 'Credit booking is not available for this agency.')); return; }
      const res = await createTransferBooking({
        partnerToken: token,
        transferType: transferType as any,
        rateId,
        pickupAddress: form.pickupAddress.trim(),
        dropoffAddress: form.dropoffAddress.trim(),
        pickupDate,
        pickupTime,
        flightNumber: form.flightNumber.trim() || undefined,
        leadPassengerName: form.leadPassengerName.trim(),
        passengerPhone: form.passengerPhone.trim(),
        paxCount: form.paxCount,
        luggageCount: form.luggageCount,
        meetAndGreet: form.meetAndGreet,
        childSeat: form.childSeat,
        specialNotes: form.specialNotes.trim() || undefined,
        expectedTotalPrice: quote.totalPrice,
      });
      setConfirmed({ ref: res.bookingReference, total: res.totalPrice });
      onSuccess(res.bookingReference);
      loadWallet();
      toast.success(`Transfer confirmed: ${res.bookingReference}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Transfer booking failed. Please recheck and try again.');
      setQuote(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="py-6 space-y-5">
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="text-xl font-black text-foreground mt-3">Transfer Confirmed</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Reference <span className="font-mono font-black text-foreground">{confirmed.ref}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm space-y-2">
          <p className="font-bold">{originZoneName} → {destZoneName}</p>
          <p className="text-muted-foreground">{vehicleName} · {pickupDate} at {pickupTime}</p>
          <p className="text-muted-foreground">{form.paxCount} passenger(s) · {form.luggageCount} bag(s)</p>
          <div className="pt-2 border-t border-border flex justify-between font-black">
            <span>Confirmed total</span><span>AED {confirmed.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
          <p className="font-bold">Agency credit settlement</p>
          <p className="mt-1">No consumer payment gateway is required. Your confirmed transfer is recorded against the signed-in travel trade account.</p>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Need help? Contact <a href="mailto:book@fbeds.com" className="font-bold text-primary">book@fbeds.com</a>
        </div>
      </div>
    );
  }

  const set = (key: string, value: any) => setForm(previous => ({ ...previous, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#111] text-white p-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/55 font-bold">Your transfer</p>
        <p className="font-black mt-1">{originZoneName} → {destZoneName}</p>
        <p className="text-xs text-white/65 mt-1">{vehicleName} · {pickupDate} · {pickupTime}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Lead passenger name *</Label>
          <Input placeholder="Full name as per travel document" value={form.leadPassengerName} onChange={e => set('leadPassengerName', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Mobile / WhatsApp *</Label>
          <Input placeholder="+971..." value={form.passengerPhone} onChange={e => set('passengerPhone', e.target.value)} className="mt-1" />
        </div>
        {needsFlight && (
          <div>
            <Label className="text-xs">Flight number *</Label>
            <Input placeholder="EK203" value={form.flightNumber} onChange={e => set('flightNumber', e.target.value.toUpperCase())} className="mt-1" />
          </div>
        )}
        <div className={needsFlight ? 'col-span-2' : ''}>
          <Label className="text-xs">Exact pickup point *</Label>
          <Input placeholder="Hotel / terminal / address" value={form.pickupAddress} onChange={e => set('pickupAddress', e.target.value)} className="mt-1" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Exact dropoff point *</Label>
          <Input placeholder="Hotel / terminal / address" value={form.dropoffAddress} onChange={e => set('dropoffAddress', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Passengers</Label>
          <Input type="number" min={1} max={50} value={form.paxCount} onChange={e => set('paxCount', parseInt(e.target.value) || 1)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Luggage</Label>
          <Input type="number" min={0} max={30} value={form.luggageCount} onChange={e => set('luggageCount', Math.max(0, parseInt(e.target.value) || 0))} className="mt-1" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold">Optional services</p>
        <label className="flex items-center gap-3 border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/30">
          <Checkbox checked={form.meetAndGreet} onCheckedChange={v => set('meetAndGreet', !!v)} />
          <div className="flex-1">
            <p className="text-xs font-semibold">Meet &amp; Greet with name sign</p>
            <p className="text-[10px] text-muted-foreground">Arrivals-hall assistance</p>
          </div>
          <span className="text-xs font-bold">+AED 50</span>
        </label>
        <label className="flex items-center gap-3 border border-border rounded-xl p-3 cursor-pointer hover:bg-muted/30">
          <Checkbox checked={form.childSeat} onCheckedChange={v => set('childSeat', !!v)} />
          <div className="flex-1">
            <p className="text-xs font-semibold">Infant / child seat</p>
            <p className="text-[10px] text-muted-foreground">Fitted on request</p>
          </div>
          <span className="text-xs font-bold">+AED 35</span>
        </label>
      </div>

      <div>
        <Label className="text-xs">Driver notes</Label>
        <Textarea placeholder="Hotel room, terminal detail, accessibility or operational notes..." value={form.specialNotes} onChange={e => set('specialNotes', e.target.value)} className="mt-1" rows={2} />
      </div>

      <div className="rounded-2xl border border-border bg-muted/25 p-4">
        {quoteLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Rechecking live transfer fare…
          </div>
        ) : quoteError ? (
          <div className="text-sm text-destructive">{quoteError}</div>
        ) : quote ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <ShieldCheck className="w-4 h-4" /> Authoritatively rechecked
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock3 className="w-3 h-3" /> valid until {quoteExpiry}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Transfer fare</span><span>AED {quote.basePrice.toFixed(2)}</span></div>
            {quote.nightSurcharge > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Night surcharge</span><span>AED {quote.nightSurcharge.toFixed(2)}</span></div>}
            {quote.meetAndGreetPrice > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Meet &amp; Greet</span><span>AED {quote.meetAndGreetPrice.toFixed(2)}</span></div>}
            {quote.childSeatPrice > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Child seat</span><span>AED {quote.childSeatPrice.toFixed(2)}</span></div>}
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold">Agency total</p>
                <p className="text-[10px] text-muted-foreground">per vehicle · one way · AED</p>
              </div>
              <p className="text-2xl font-black">AED {quote.totalPrice.toFixed(2)}</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {quote.tollsIncluded && <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full px-2 py-1">Tolls included</span>}
              {quote.waitingGraceMinutes > 0 && <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 rounded-full px-2 py-1">{quote.waitingGraceMinutes} min waiting grace</span>}
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-full px-2 py-1">Agency credit</span>
            </div>
          </div>
        ) : null}
      </div>

      {!authLoading && !token && <a href={signInHref} className="block w-full text-center rounded-lg bg-primary text-primary-foreground font-black h-11 leading-[2.75rem]">Sign in to book on agency credit</a>}
      {wallet && wallet.valid && <div className={'rounded-lg border p-3 text-xs ' + (creditBlocked ? 'border-red-200 bg-red-50 text-red-800' : 'bg-muted/40')}>
        <div className="flex justify-between"><span>Agency credit available</span><b>AED {wallet.creditAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
        <div className="flex justify-between text-muted-foreground mt-0.5"><span>Limit AED {wallet.creditLimit.toLocaleString()} · used AED {wallet.creditUsed.toLocaleString()}</span>{total > 0 && <span>after this: AED {Math.max(0, wallet.creditAvailable - total).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}</div>
        {creditBlocked && <p className="font-semibold mt-1">{wallet.blockReason || (creditShort ? 'This transfer exceeds your available credit.' : 'Credit booking is not available for this agency.')}</p>}
      </div>}
      {token && <Button className="w-full h-11 font-black" disabled={submitting || quoteLoading || !quote || creditBlocked} onClick={handleSubmit}>
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Confirming…</>
        ) : quote ? (
          <><BadgeCheck className="w-4 h-4 mr-2" /> Confirm transfer · AED {quote.totalPrice.toFixed(0)}</>
        ) : (
          'Transfer unavailable'
        )}
      </Button>}

      <p className="text-[10px] text-center text-muted-foreground">
        Fare and route are revalidated immediately before confirmation. No consumer payment gateway.
      </p>
    </div>
  );
}
