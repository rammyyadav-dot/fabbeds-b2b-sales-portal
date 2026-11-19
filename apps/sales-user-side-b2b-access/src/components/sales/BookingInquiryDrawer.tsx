import { useState, useEffect } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@project/components/ui/sheet';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Separator } from '@project/components/ui/separator';
import { Checkbox } from '@project/components/ui/checkbox';
import { ScrollArea } from '@project/components/ui/scroll-area';
import { toast } from 'sonner';
import { createBookingInquiry, calculateBookingPrice, CalculateBookingPriceOutputType } from 'zitejs/api';
import { useDebouncedCallback } from 'use-debounce';
import CostSummaryBox from './CostSummaryBox';
import RoomConfigRow, { RoomConfig } from './RoomConfigRow';
import { usePartnerAuth } from '@/lib/partnerAuth';

type Rate = { roomTypeId: string; roomTypeName: string; ratePlanId: string; ratePlanName: string; mealPlan: string; sellRate: number; occupancyNote?: string };

interface Props {
  open: boolean;
  onClose: () => void;
  hotel: { id: string; name: string; emirate: string; rates: Rate[] };
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultAdults?: number;
  defaultChildren?: number;
}

const PAYMENT_OPTIONS = ['Bank Transfer', 'Payment Link', 'Credit (if approved)'];
const COUNTRIES = ['UAE', 'Saudi Arabia', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'UK', 'Germany', 'France', 'India', 'Other'];
const MARKET_CODE: Record<string,string> = {
  UAE:'AE', 'Saudi Arabia':'SA', Kuwait:'KW', Qatar:'QA', Bahrain:'BH', Oman:'OM',
  UK:'GB', Germany:'DE', France:'FR', India:'IN',
};

function SectionHeader({ label }: { label: string }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-primary pt-2">{label}</p>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function BookingInquiryDrawer({
  open, onClose, hotel,
  defaultCheckIn = '', defaultCheckOut = '',
  defaultAdults = 2, defaultChildren = 0,
}: Props) {
  const { partner, token } = usePartnerAuth();
  const [selectedRateIdx, setSelectedRateIdx] = useState(0);
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [roomCount, setRoomCount] = useState(1);
  const [roomConfigs, setRoomConfigs] = useState<RoomConfig[]>([{
    adults: defaultAdults, children: defaultChildren, childAges: [],
  }]);

  const [companyName, setCompanyName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsApp, setWhatsApp] = useState('');
  const [country, setCountry] = useState('');
  const [creditAccount, setCreditAccount] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [nationality, setNationality] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [payment, setPayment] = useState('Bank Transfer');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<CalculateBookingPriceOutputType | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState(false);

  // Sync roomConfigs array size when roomCount changes
  useEffect(() => {
    setRoomConfigs(prev => {
      if (prev.length === roomCount) return prev;
      if (roomCount > prev.length) {
        return [...prev, ...Array.from({ length: roomCount - prev.length }, () => ({ adults: 2, children: 0, childAges: [] }))];
      }
      return prev.slice(0, roomCount);
    });
  }, [roomCount]);

  const rate = hotel.rates[selectedRateIdx] ?? hotel.rates[0];

  const fetchPricing = useDebouncedCallback(async (
    roomTypeId: string, ratePlanId: string, hotelId: string, ci: string, co: string, configs: RoomConfig[]
  ) => {
    if (!roomTypeId || !ratePlanId || !ci || !co) { setPricing(null); setPricingError(false); return; }
    setPricingLoading(true);
    setPricingError(false);
    try {
      const result = await calculateBookingPrice({
        roomTypeId, ratePlanId, hotelId, checkIn: ci, checkOut: co, roomConfigs: configs,
        nationality: MARKET_CODE[nationality] || undefined,
      });
      setPricing(result);
    } catch {
      setPricing(null);
      setPricingError(true);
    } finally {
      setPricingLoading(false);
    }
  }, 400);

  useEffect(() => {
    if (rate?.roomTypeId && rate?.ratePlanId && checkIn && checkOut) {
      fetchPricing(rate.roomTypeId, rate.ratePlanId, hotel.id, checkIn, checkOut, roomConfigs);
    } else {
      setPricing(null);
      setPricingError(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate?.roomTypeId, rate?.ratePlanId, hotel.id, checkIn, checkOut, JSON.stringify(roomConfigs), nationality]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!partner || !token) { toast.error('Please sign in with your partner account before booking.'); return; }
    if (!confirmed) { toast.error('Please confirm the declaration to proceed.'); return; }
    if (!rate || !pricing?.valid || pricing.ratePlanId !== rate.ratePlanId || pricingLoading || pricingError) { toast.error('A verified price for every night is required.'); return; }
    setLoading(true);
    try {
      const totalAdults = roomConfigs.reduce((s, r) => s + r.adults, 0);
      const totalChildren = roomConfigs.reduce((s, r) => s + r.children, 0);

      const pricingSnapshot = pricing ? {
        nights: pricing.nights,
        rooms: roomConfigs.length,
        netTotal: pricing.netTotal,
        sellTotal: pricing.sellTotal,
        markupLabel: pricing.markupLabel,
        markupAmount: pricing.markupAmount,
        margin: pricing.margin,
        marginPercent: pricing.marginPercent,
        rateSource: pricing.rateSource,
        ratesCoveredNights: pricing.ratesCoveredNights,
        roomBreakdown: pricing.roomBreakdown,
        eventSupplementTotal: pricing.eventSupplementTotal,
        appliedEvents: pricing.appliedEvents,
        calculatedAt: new Date().toISOString(),
      } : undefined;

      await createBookingInquiry({
        partnerToken: token,
        hotelId: hotel.id, roomTypeId: rate.roomTypeId, ratePlanId: rate.ratePlanId, roomTypeName: rate.roomTypeName,
        mealPlan: rate.mealPlan, sellRateSnapshot: pricing.sellTotal,
        checkIn: checkIn || undefined, checkOut: checkOut || undefined,
        rooms: roomConfigs.length, adults: totalAdults, children: totalChildren,
        roomConfigs,
        guestName, nationality: MARKET_CODE[nationality] || undefined,
        specialRequests: specialRequests || undefined, arrivalTime: arrivalTime || undefined,
        pricingSnapshot,
      });
      toast.success('Reservation request submitted!', { description: `${hotel.name} — our team will confirm shortly.` });
      onClose();
    } catch { toast.error('Failed to submit. Please try again.'); }
    finally { setLoading(false); }
  };

  const submitDisabled = loading || !partner || !token || !confirmed || pricingLoading || pricingError || !rate || !pricing?.valid || pricing.ratePlanId !== rate.ratePlanId;
  const nights = pricing?.nights ?? 0;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <SheetTitle>Reservation Request</SheetTitle>
          <SheetDescription>{hotel.name} · {hotel.emirate}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <form id="booking-form" onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            <SectionHeader label="Section 1 — Stay Details" />
            <Field label="Hotel"><Input value={hotel.name} readOnly className="bg-muted text-muted-foreground" /></Field>
            <Field label="Room Type">
              <Select value={String(selectedRateIdx)} onValueChange={(v) => setSelectedRateIdx(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {hotel.rates.map((r, i) => (
                    <SelectItem key={i} value={String(i)}>{r.roomTypeName} — {r.ratePlanName} · {r.mealPlan} · AED {r.sellRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}/night average</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Check-in *"><Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required /></Field>
              <Field label="Check-out *"><Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} min={checkIn || undefined} required /></Field>
            </div>

            {/* Number of rooms */}
            <Field label="Number of Rooms">
              <Select value={String(roomCount)} onValueChange={(v) => setRoomCount(Number(v))}>
                <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} Room{n > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Per-room occupancy configuration */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Configure each room's occupancy for accurate pricing:</p>
              {roomConfigs.map((config, idx) => (
                <RoomConfigRow
                  key={idx}
                  roomNo={idx + 1}
                  config={config}
                  onChange={(updated) => {
                    const next = [...roomConfigs];
                    next[idx] = updated;
                    setRoomConfigs(next);
                  }}
                />
              ))}
            </div>

            {/* Pricing breakdown — always shown */}
            <CostSummaryBox
              hotelName={hotel.name}
              roomTypeName={rate?.roomTypeName ?? ''}
              mealPlan={rate?.mealPlan ?? ''}
              checkIn={checkIn}
              checkOut={checkOut}
              pricing={pricing}
              pricingLoading={pricingLoading}
              pricingError={pricingError}
            />

            <Separator />
            <SectionHeader label="Section 2 — Agent / Company Details" />
            <Field label="Company Name" required><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Travel agency or company" required /></Field>
            <Field label="Agent Name" required><Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Your full name" required /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Contact Email" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@agency.com" required /></Field>
              <Field label="WhatsApp Number"><Input value={whatsApp} onChange={(e) => setWhatsApp(e.target.value)} placeholder="+971 50 xxx xxxx" /></Field>
            </div>
            <Field label="Country">
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox id="credit" checked={creditAccount} onCheckedChange={(v) => setCreditAccount(!!v)} />
              <Label htmlFor="credit" className="text-xs text-muted-foreground cursor-pointer">Credit account holder</Label>
            </div>

            <Separator />
            <SectionHeader label="Section 3 — Guest Details" />
            <Field label="Lead Guest Name" required><Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest full name" required /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nationality"><Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. British" /></Field>
              <Field label="Arrival Time"><Input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} /></Field>
            </div>
            <Field label="Special Requests"><Textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Room preferences, dietary needs, accessibility requirements..." rows={3} /></Field>

            <Separator />
            <SectionHeader label="Section 4 — Payment Preference" />
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_OPTIONS.map((opt) => (
                <button key={opt} type="button" onClick={() => setPayment(opt)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    payment === opt ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>

            <Separator />
            <SectionHeader label="Section 5 — Declaration" />
            <div className="flex items-start gap-3 bg-muted/40 rounded-lg p-3">
              <Checkbox id="declaration" checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} className="mt-0.5" />
              <Label htmlFor="declaration" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                I confirm this is a booking request subject to hotel confirmation and the applicable cancellation policy. Rates are valid at time of request only.
              </Label>
            </div>
          </form>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border shrink-0">
          {pricing && nights > 0 && pricing.valid && (
            <div className="mb-3 rounded-lg px-3 py-2 flex items-center justify-between bg-primary/5 border border-primary/20">
              <div>
                <p className="text-xs text-muted-foreground">Total Estimate</p>
                <p className="text-[10px] text-muted-foreground/60">
                  {nights}N · {roomConfigs.length}R ·{' '}
                  {roomConfigs.reduce((s, r) => s + r.adults, 0)}A
                  {roomConfigs.reduce((s, r) => s + r.children, 0) > 0
                    ? `+${roomConfigs.reduce((s, r) => s + r.children, 0)}C` : ''}
                </p>
              </div>
              <p className="text-base font-extrabold text-primary">
                AED {pricing.sellTotal.toLocaleString()}
              </p>
            </div>
          )}
          {pricing && !pricing.valid && (
            <div className="mb-3 rounded-lg px-3 py-2 bg-destructive/5 border border-destructive/20">
              <p className="text-xs text-destructive font-medium">⚠ Occupancy issues — please fix room configuration above</p>
            </div>
          )}
          {!confirmed && (
            <p className="text-xs text-muted-foreground mb-2 text-center">✓ Check the declaration above to enable submission</p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" form="booking-form" className="flex-1" disabled={submitDisabled}>
              {loading ? 'Submitting…' : '🚀 Submit Reservation Request'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
