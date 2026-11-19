import { useEffect, useState, useMemo } from 'react';
import type { FormEvent, ElementType, ReactNode } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getHotelProfile, GetHotelProfileOutputType, createBookingInquiry, calculateBookingPrice, CalculateBookingPriceOutputType, getPartnerWallet, GetPartnerWalletOutputType } from 'zitejs/api';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { ArrowLeft, BedDouble, Building2, Users, FileText } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Skeleton } from '@project/components/ui/skeleton';
import { Checkbox } from '@project/components/ui/checkbox';
import SalesHeader from '@/components/sales/SalesHeader';
import DateRangePicker from '@/components/sales/DateRangePicker';
import CheckoutPriceSidebar from '@/components/sales/CheckoutPriceSidebar';
import RoomConfigRow, { RoomConfig } from '@/components/sales/RoomConfigRow';
import { usePartnerAuth } from '@/lib/partnerAuth';

interface Props { onLogout: () => void; }

function SectionCard({ num, icon: Icon, title, children }: { num: number; icon: ElementType; title: string; children: ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">{num}</div>
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function BookingCheckoutPage({ onLogout }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { partner, token } = usePartnerAuth();

  const [data, setData] = useState<GetHotelProfileOutputType | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Form state
  const lockedRoomTypeId = searchParams.get('roomTypeId') || '';
  const lockedRatePlanId = searchParams.get('ratePlanId') || '';
  const [selectedRateIdx, setSelectedRateIdx] = useState(() => parseInt(searchParams.get('rateIdx') || '0'));
  const [honorIncomingPlan, setHonorIncomingPlan] = useState(true);
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '');
  const initialRooms = parseInt(searchParams.get('rooms') || '1');
  const initialAdults = parseInt(searchParams.get('adults') || '2');
  const initialChildren = parseInt(searchParams.get('children') || '0');
  const nationality = (searchParams.get('nationality') || 'IN').toUpperCase();
  const initialRoomConfigs = (() => {
    const raw = searchParams.get('roomConfigs');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (!Array.isArray(parsed) || parsed.length < 1) return null;
      return parsed.map((r:any) => ({
        adults: Math.max(1, Number(r.adults) || 1),
        children: Math.max(0, Number(r.children) || 0),
        childAges: Array.isArray(r.childAges) ? r.childAges.map(Number) : [],
      })) as RoomConfig[];
    } catch { return null; }
  })();
  const [roomCount, setRoomCount] = useState(initialRoomConfigs?.length || initialRooms);
  const [roomConfigs, setRoomConfigs] = useState<RoomConfig[]>(() => {
    if (initialRoomConfigs) return initialRoomConfigs;
    const adultsPerRoom = Math.min(3, Math.max(1, Math.round(initialAdults / initialRooms)));
    return Array.from({ length: initialRooms }, (_, i) => ({
      adults: adultsPerRoom,
      children: i === 0 ? Math.min(2, initialChildren) : 0,
      childAges: [],
    }));
  });
  const [guestName, setGuestName] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<CalculateBookingPriceOutputType | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState(false);
  const [wallet, setWallet] = useState<GetPartnerWalletOutputType | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setWallet(null);
      return;
    }
    setWalletLoading(true);
    getPartnerWallet({ token })
      .then(setWallet)
      .catch(() => setWallet(null))
      .finally(() => setWalletLoading(false));
  }, [token]);

  useEffect(() => {
    if (!id) return;
    getHotelProfile({ hotelId: id, adults: parseInt(searchParams.get('adults') || '2'), children: parseInt(searchParams.get('children') || '0'), rooms: roomConfigs.length, checkIn: checkIn || undefined, checkOut: checkOut || undefined, nationality })
      .then(setData).catch(() => toast.error('Failed to load hotel data')).finally(() => setDataLoading(false));
  }, [id, checkIn, checkOut, roomConfigs.length, nationality]);

  useEffect(() => {
    setRoomConfigs(prev => {
      if (prev.length === roomCount) return prev;
      if (roomCount > prev.length) return [...prev, ...Array.from({ length: roomCount - prev.length }, () => ({ adults: 2, children: 0, childAges: [] }))];
      return prev.slice(0, roomCount);
    });
  }, [roomCount]);

  const bookableRates = useMemo(() => {
    if (!data) return [];
    const options = new Map<string, {
      roomTypeId: string; roomTypeName: string; ratePlanId: string; ratePlanName: string;
      mealPlan: string; sellRate: number; occupancyNote?: string;
    }>();

    if (!checkIn || !checkOut || checkOut <= checkIn) return [];
    const dates: string[] = [];
    const day = new Date(checkIn + 'T00:00:00Z');
    while (day.toISOString().slice(0, 10) < checkOut) {
      dates.push(day.toISOString().slice(0, 10));
      day.setUTCDate(day.getUTCDate() + 1);
    }
    const byPlan = new Map<string, typeof data.dailyRates>();
    for (const dr of data.dailyRates) {
      if (dr.date < checkIn || dr.date >= checkOut) continue;
      const key = `${dr.roomTypeId}|${dr.ratePlanId}`;
      byPlan.set(key, [...(byPlan.get(key) ?? []), dr]);
    }
    for (const [key, planRates] of byPlan) {
      const [roomTypeId, ratePlanId] = key.split('|');
      const rt = data.roomTypes.find(r => r.id === roomTypeId);
      if (!rt || !dates.every(date => planRates.some(r => r.date === date && r.status !== 'Stop Sale' && r.displayRate > 0))) continue;
      const stayTotal = dates.reduce((sum, date) => sum + planRates.find(r => r.date === date)!.displayRate, 0);
      const first = planRates[0];
      options.set(key, {
        roomTypeId, roomTypeName: rt.name, ratePlanId,
        ratePlanName: first.ratePlanName, mealPlan: first.mealPlan,
        sellRate: stayTotal / dates.length,
        occupancyNote: rt.occupancyWarning ?? undefined,
      });
    }
    return [...options.values()];
  }, [data, checkIn, checkOut]);

  // Initialise selectedRateIdx from lockedRoomTypeId when bookableRates load
  useEffect(() => {
    if (!lockedRoomTypeId || bookableRates.length === 0) return;
    const idx = bookableRates.findIndex((r) =>
      r.roomTypeId === lockedRoomTypeId &&
      (!lockedRatePlanId || r.ratePlanId === lockedRatePlanId)
    );
    if (idx >= 0) setSelectedRateIdx(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookableRates]);

  const rate = useMemo(() => {
    if (honorIncomingPlan && lockedRatePlanId && lockedRoomTypeId) {
      return bookableRates.find(r => r.ratePlanId === lockedRatePlanId && r.roomTypeId === lockedRoomTypeId);
    }
    return bookableRates[selectedRateIdx] ?? bookableRates[0];
  }, [bookableRates, selectedRateIdx, lockedRatePlanId, lockedRoomTypeId, honorIncomingPlan]);

  const fetchPricing = useDebouncedCallback(async (roomTypeId: string, ratePlanId: string, mealPlan: string, hotelId: string, ci: string, co: string, configs: RoomConfig[]) => {
    if (!roomTypeId || !ratePlanId || !ci || !co) { setPricing(null); setPricingError(false); return; }
    // Validate checkout > checkin
    const ciMs = new Date(ci + 'T00:00:00').getTime();
    const coMs = new Date(co + 'T00:00:00').getTime();
    if (isNaN(ciMs) || isNaN(coMs) || coMs <= ciMs) { setPricing(null); setPricingError(false); return; }
    setPricingLoading(true); setPricingError(false);
    try {
      const result = await calculateBookingPrice({ roomTypeId, ratePlanId, mealPlan: mealPlan as any, hotelId, checkIn: ci, checkOut: co, roomConfigs: configs, nationality });
      setPricing(result);
    } catch { setPricing(null); setPricingError(true); }
    finally { setPricingLoading(false); }
  }, 400);

  useEffect(() => {
    if (rate?.roomTypeId && rate?.ratePlanId && checkIn && checkOut) {
      setPricing(null);
      fetchPricing(rate.roomTypeId, rate.ratePlanId, rate.mealPlan, id!, checkIn, checkOut, roomConfigs);
    } else { setPricing(null); setPricingError(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate?.roomTypeId, rate?.ratePlanId, rate?.mealPlan, id, checkIn, checkOut, JSON.stringify(roomConfigs)]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!partner || !token) {
      navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!wallet?.valid || !wallet.canBookOnCredit) {
      toast.error('Your agency credit account is not currently available for booking.');
      return;
    }
    if (pricing && pricing.sellTotal > wallet.creditAvailable) {
      toast.error(`Insufficient credit. Available AED ${wallet.creditAvailable.toLocaleString()}.`);
      return;
    }
    if (!confirmed) { toast.error('Please confirm the declaration.'); return; }
    if (!rate || !pricing?.valid || pricing.ratePlanId !== rate.ratePlanId || pricingLoading || pricingError) { toast.error('A verified price for every night is required before submitting.'); return; }
    setLoading(true);
    try {
      const totalAdults = roomConfigs.reduce((s, r) => s + r.adults, 0);
      const totalChildren = roomConfigs.reduce((s, r) => s + r.children, 0);
      const result = await createBookingInquiry({
        partnerToken: token,
        hotelId: id!, roomTypeId: rate.roomTypeId, ratePlanId: rate.ratePlanId, roomTypeName: rate.roomTypeName,
        mealPlan: rate.mealPlan, sellRateSnapshot: pricing.sellTotal,
        checkIn: checkIn || undefined, checkOut: checkOut || undefined,
        rooms: roomConfigs.length, adults: totalAdults, children: totalChildren,
        roomConfigs,
        guestName, nationality,
        specialRequests: specialRequests || undefined, arrivalTime: undefined,
        pricingSnapshot: pricing ? { nights: pricing.nights, rooms: roomConfigs.length, netTotal: pricing.netTotal, sellTotal: pricing.sellTotal, markupLabel: pricing.markupLabel, markupAmount: pricing.markupAmount, margin: pricing.margin, marginPercent: pricing.marginPercent, rateSource: pricing.rateSource, ratesCoveredNights: pricing.ratesCoveredNights, roomBreakdown: pricing.roomBreakdown, eventSupplementTotal: pricing.eventSupplementTotal, appliedEvents: pricing.appliedEvents, calculatedAt: new Date().toISOString() } : undefined,
      });
      toast.success('Reservation request submitted on agency credit!', {
        description: result.creditAvailableAfter != null
          ? `Available credit after request: AED ${result.creditAvailableAfter.toLocaleString()}`
          : `${data?.hotel.name} — our team will confirm shortly.`
      });
      if (result.bookingId) navigate(`/booking/${result.bookingId}/confirmation`);
      else navigate('/my-bookings');
    } catch (err: any) {
      toast.error(err?.message || 'Booking could not be submitted. Please review your credit account and try again.');
    }
    finally { setLoading(false); }
  };

  const creditInsufficient = !!pricing && !!wallet && pricing.sellTotal > wallet.creditAvailable;
  const submitDisabled = loading || !partner || !token || walletLoading || !wallet?.canBookOnCredit || creditInsufficient ||
    !confirmed || pricingLoading || pricingError || !rate || !pricing?.valid || pricing.ratePlanId !== rate.ratePlanId;

  if (dataLoading) return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />
      <div className="container mx-auto px-4 py-6 max-w-6xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Back */}
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 mb-5" onClick={() => navigate(`/hotel/${id}`)}>
          <ArrowLeft className="w-4 h-4" /> Back to Hotel
        </Button>

        {/* Hotel Banner */}
        {data && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-foreground text-lg leading-tight truncate">{data.hotel.name}</h1>
              <p className="text-sm text-muted-foreground">{data.hotel.emirate} · {data.hotel.starRating ? `${data.hotel.starRating}★` : ''}</p>
            </div>
            <div className="hidden sm:block text-right shrink-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Booking Request</p>
              <p className="text-xs text-primary font-semibold">Wholesale DMC Rates</p>
            </div>
          </div>
        )}

        {/* 2-column layout */}
        <form id="checkout-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT: Form */}
            <div className="lg:col-span-2 space-y-5">

              {/* Section 1: Stay Details */}
              <SectionCard num={1} icon={BedDouble} title="Your Stay">
                <Field label="Room Type" required>
                  <Select value={String(selectedRateIdx)} onValueChange={(v) => { setHonorIncomingPlan(false); setSelectedRateIdx(Number(v)); setPricing(null); }}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {bookableRates.map((r, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {r.roomTypeName} — {r.ratePlanName} · {r.mealPlan} · AED {r.sellRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}/night average
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Check-in & Check-out Dates" required>
                  <DateRangePicker checkIn={checkIn} checkOut={checkOut} onCheckInChange={setCheckIn} onCheckOutChange={setCheckOut} />
                  {checkIn && checkOut && (() => {
                    const ci = new Date(checkIn + 'T00:00:00').getTime();
                    const co = new Date(checkOut + 'T00:00:00').getTime();
                    const n = Math.round((co - ci) / 86400000);
                    if (n <= 0) return <p className="text-xs text-destructive mt-1">⚠ Check-out must be after check-in</p>;
                    return <p className="text-xs text-muted-foreground mt-1">✓ {n} night{n !== 1 ? 's' : ''}</p>;
                  })()}
                </Field>

                <Field label="Number of Rooms">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setRoomCount(c => Math.max(1, c - 1))}
                      className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors">−</button>
                    <span className="w-8 text-center font-semibold text-foreground">{roomCount}</span>
                    <button type="button" onClick={() => setRoomCount(c => Math.min(10, c + 1))}
                      className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors">+</button>
                    <span className="text-xs text-muted-foreground">room{roomCount !== 1 ? 's' : ''}</span>
                  </div>
                </Field>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Room Occupancy</p>
                  {roomConfigs.map((config, idx) => (
                    <RoomConfigRow key={idx} roomNo={idx + 1} config={config}
                      onChange={(updated) => { const next = [...roomConfigs]; next[idx] = updated; setRoomConfigs(next); }} />
                  ))}
                </div>
              </SectionCard>

              {/* Section 2: Lead Traveller — guest name only */}
              <SectionCard num={2} icon={Users} title="Lead Traveller">
                <p className="text-xs text-muted-foreground -mt-1 pb-1">Guest name only — we contact your agency, not the guest.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Guest Name" required>
                    <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Guest full name" required className="h-11" />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard num={3} icon={Users} title="Agency Credit Account">
                {partner ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{partner.agencyName}</p>
                          <p className="text-muted-foreground">{partner.agencyEmail}</p>
                          {(partner.agencyMobile || partner.country) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {[partner.agencyMobile, partner.country].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <span className={`text-[11px] px-2 py-1 rounded-full border font-semibold ${wallet?.creditStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {wallet?.creditStatus || partner.creditStatus}
                        </span>
                      </div>
                    </div>

                    {walletLoading ? (
                      <div className="text-sm text-muted-foreground">Checking agency credit…</div>
                    ) : wallet ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Credit limit</p>
                          <p className="font-bold mt-1">AED {wallet.creditLimit.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Used</p>
                          <p className="font-bold mt-1">AED {wallet.creditUsed.toLocaleString()}</p>
                        </div>
                        <div className={`rounded-lg border p-3 ${creditInsufficient ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Available</p>
                          <p className={`font-bold mt-1 ${creditInsufficient ? 'text-red-700' : 'text-emerald-700'}`}>AED {wallet.creditAvailable.toLocaleString()}</p>
                        </div>
                      </div>
                    ) : null}

                    {wallet && !wallet.canBookOnCredit && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        Booking on credit is currently unavailable. Credit must be approved, have available limit, and have no overdue exposure.
                      </div>
                    )}
                    {creditInsufficient && pricing && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        This booking requires AED {pricing.sellTotal.toLocaleString()}, exceeding available credit of AED {wallet?.creditAvailable.toLocaleString()}.
                      </div>
                    )}
                    {wallet && wallet.creditTermsDays > 0 && (
                      <p className="text-xs text-muted-foreground">Credit terms: {wallet.creditTermsDays} days · No online payment gateway. Settlement is handled offline by finance.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Sign in with your travel trade account to validate agency credit before booking.</p>
                    <Button type="button" onClick={() => navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>
                      Sign in to continue
                    </Button>
                  </div>
                )}
              </SectionCard>

              {/* Section 4: Booking Notes */}
              <SectionCard num={4} icon={FileText} title="Booking Notes">
                <Field label="Special Requests">
                  <Textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
                    placeholder="Room preferences, dietary needs, accessibility requirements..." rows={3} />
                </Field>
              </SectionCard>

              {/* Section 5: Declaration */}
              <SectionCard num={5} icon={FileText} title="Declaration">
                <div className="flex items-start gap-3 bg-muted/40 rounded-lg p-4">
                  <Checkbox id="declaration" checked={confirmed} onCheckedChange={v => setConfirmed(!!v)} className="mt-0.5" />
                  <Label htmlFor="declaration" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                    I confirm this is a booking request subject to hotel confirmation and the applicable cancellation policy. Rates are valid at time of request only.
                  </Label>
                </div>
              </SectionCard>

              {/* Mobile submit */}
              <div className="lg:hidden">
                <Button type="submit" form="checkout-form" className="w-full h-12 font-semibold text-base" disabled={submitDisabled}>
                  {loading ? 'Submitting…' : 'Submit on Agency Credit'}
                </Button>
              </div>
            </div>

            {/* RIGHT: Price Sidebar */}
            <div className="hidden lg:block lg:col-span-1">
              <CheckoutPriceSidebar
                hotelName={data?.hotel.name ?? ''}
                roomTypeName={rate?.roomTypeName ?? ''}
                mealPlan={rate?.mealPlan ?? ''}
                checkIn={checkIn}
                checkOut={checkOut}
                rooms={roomCount}
                pricing={pricing}
                pricingLoading={pricingLoading}
                pricingError={pricingError}
                submitDisabled={submitDisabled}
                loading={loading}
                confirmed={confirmed}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
