import { useEffect, useState } from 'react';
import { searchHotels, createBooking, checkAvailability, calculatePrice, SearchHotelsOutputType, CalculatePriceOutputType } from 'zitejs/api';
import { useDebouncedCallback } from 'use-debounce';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Textarea } from '@project/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Separator } from '@project/components/ui/separator';
import { Building2, CalendarDays, Users, CheckCircle2, Star, Settings, AlertCircle, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import DatePickerInput from '@/components/DatePickerInput';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

type Hotel = SearchHotelsOutputType['hotels'][0];
type PriceResult = CalculatePriceOutputType;

const statusBadge = (s?: string) => {
  if (!s || s === 'Free Sale') return null;
  const map: Record<string, string> = {
    'Limited': 'bg-amber-100 text-amber-800 border-amber-300',
    'On Request': 'bg-blue-100 text-blue-800 border-blue-300',
    'Stop Sale': 'bg-red-100 text-red-800 border-red-300',
    'No Rates': 'bg-gray-100 text-gray-600 border-gray-300',
  };
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${map[s] ?? 'bg-muted text-muted-foreground border-border'}`}>{s}</span>;
};

export default function BookingPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('');
  const [step, setStep] = useState<'search' | 'form' | 'done'>('search');
  const [confirmed, setConfirmed] = useState<{ id: string; bookingRef: string; totalSell?: number; nights: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<{ available: boolean; reason?: string } | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [pricing, setPricing] = useState<PriceResult | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: '', guestName: '', checkinDate: '', checkoutDate: '',
    rooms: '1', adults: '2', children: '0',
    contactEmail: '', whatsAppNumber: '', specialRequests: '',
  });

  useEffect(() => { searchHotels({}).then(r => setHotels(r.hotels)); }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const checkAvail = useDebouncedCallback(async (hotelId: string, roomTypeId: string, ratePlanId: string, checkin: string, checkout: string, rooms: number) => {
    if (!hotelId || !roomTypeId || !ratePlanId || !checkin || !checkout || new Date(checkout) <= new Date(checkin)) { setAvailability(null); return; }
    setAvailLoading(true);
    try {
      const res = await checkAvailability({ hotelId, roomTypeId, ratePlanId, checkinDate: checkin, checkoutDate: checkout, rooms });
      setAvailability({ available: res.available, reason: res.reason });
    } catch { setAvailability(null); }
    finally { setAvailLoading(false); }
  }, 600);

  const fetchPrice = useDebouncedCallback(async (hotelId: string, roomTypeId: string, ratePlanId: string, checkin: string, checkout: string, adults: number, children: number, rooms: number) => {
    if (!hotelId || !roomTypeId || !checkin || !checkout || new Date(checkout) <= new Date(checkin)) { setPricing(null); return; }
    setPriceLoading(true);
    try {
      const res = await calculatePrice({ hotelId, roomTypeId, ratePlanId, checkinDate: checkin, checkoutDate: checkout, adults, children, rooms });
      setPricing(res);
    } catch { setPricing(null); }
    finally { setPriceLoading(false); }
  }, 600);

  useEffect(() => {
    if (!selectedHotel) return;
    setAvailability(null);
    setPricing(null);
    const rooms = parseInt(form.rooms) || 1;
    const adults = parseInt(form.adults) || 2;
    const children = parseInt(form.children) || 0;
    const selected = selectedHotel.roomTypes.find(rt => rt.id === selectedRoomTypeId);
    if (selected) {
      checkAvail(selectedHotel.id, selected.roomTypeId, selected.ratePlanId, form.checkinDate, form.checkoutDate, rooms);
      fetchPrice(selectedHotel.id, selected.roomTypeId, selected.ratePlanId, form.checkinDate, form.checkoutDate, adults, children, rooms);
    }
  }, [selectedHotel?.id, selectedRoomTypeId, form.checkinDate, form.checkoutDate, form.rooms, form.adults, form.children]);

  const handleSubmit = async () => {
    const selected = selectedHotel?.roomTypes.find(rt => rt.id === selectedRoomTypeId);
    if (!selectedHotel || !selected || !form.guestName || !form.contactEmail || !form.checkinDate || !form.checkoutDate) {
      toast.error('Please fill in all required fields'); return;
    }
    if (availability && !availability.available) {
      toast.error(availability.reason ?? 'No availability for selected dates'); return;
    }
    setLoading(true);
    try {
      const res = await createBooking({
        companyName: form.companyName,
        guestName: form.guestName,
        checkinDate: form.checkinDate,
        checkoutDate: form.checkoutDate,
        rooms: parseInt(form.rooms),
        adults: parseInt(form.adults),
        children: parseInt(form.children),
        contactEmail: form.contactEmail,
        whatsAppNumber: form.whatsAppNumber || undefined,
        hotelId: selectedHotel.id,
        roomTypeId: selected.roomTypeId,
        ratePlanId: selected.ratePlanId,
        specialRequests: form.specialRequests || undefined,
      });
      setConfirmed({ id: res.id, bookingRef: res.bookingRef, totalSell: res.totalSell, nights: res.nights });
      setStep('done');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to submit booking');
    } finally { setLoading(false); }
  };

  if (step === 'done' && confirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Booking Request Submitted!</h2>
            <p className="text-muted-foreground text-sm">Your enquiry has been received. Our team will contact you within 24 hours.</p>
            <Badge variant="outline" className="text-base px-4 py-2 font-mono">Ref: {confirmed.bookingRef}</Badge>
            {confirmed.totalSell != null && (
              <div className="bg-primary/5 rounded-lg px-4 py-3 text-sm">
                <p className="text-muted-foreground">Estimated total ({confirmed.nights} nights)</p>
                <p className="text-2xl font-bold text-primary">AED {confirmed.totalSell.toLocaleString()}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Save this reference number to manage your booking.</p>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/manage-booking"><Settings className="w-4 h-4" /> Manage My Booking</Link>
            </Button>
            <Button onClick={() => { setStep('search'); setConfirmed(null); setSelectedHotel(null); setPricing(null); }} className="w-full">
              Make Another Booking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-500 text-white py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-6 h-6" />
            <h1 className="text-2xl font-bold">UAE Hotels — B2B Booking Enquiry</h1>
          </div>
          <p className="text-white/80 text-sm">Select a hotel and submit your booking request. No login required.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Hotel Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Select Hotel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {hotels.map(h => (
                <button key={h.id} onClick={() => { setSelectedHotel(h); setSelectedRoomTypeId(''); setAvailability(null); setPricing(null); }}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${selectedHotel?.id === h.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <div className="font-medium text-sm">{h.hotelName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{h.emirate} • {h.starRating}</div>
                  {h.roomTypes.length > 0 && <div className="text-xs text-primary mt-1">{h.roomTypes.length} room type(s) available</div>}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {selectedHotel && (
          <>
            {selectedHotel.roomTypes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Star className="w-4 h-4 text-primary" />Room Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedRoomTypeId} onValueChange={setSelectedRoomTypeId}>
                    <SelectTrigger><SelectValue placeholder="Select room type (optional)" /></SelectTrigger>
                    <SelectContent>
                      {selectedHotel.roomTypes.map(rt => (
                        <SelectItem key={rt.id} value={rt.id}>
                          <span className="flex items-center gap-2">
                            {rt.roomTypeName}
                            {rt.mealPlan ? ` — ${rt.mealPlan}` : ''}
                            {rt.sellRate ? ` | AED ${rt.sellRate.toLocaleString()}/night` : ''}
                            {statusBadge(rt.availabilityStatus)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Company Name <span className="text-destructive">*</span></Label><Input placeholder="Your company" value={form.companyName} onChange={e => set('companyName', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Guest Name <span className="text-destructive">*</span></Label><Input placeholder="Lead guest name" value={form.guestName} onChange={e => set('guestName', e.target.value)} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Check-in <span className="text-destructive">*</span></Label><DatePickerInput value={form.checkinDate} onChange={v => set('checkinDate', v)} placeholder="Check-in date" /></div>
                  <div className="space-y-1.5"><Label className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Check-out <span className="text-destructive">*</span></Label><DatePickerInput value={form.checkoutDate} onChange={v => set('checkoutDate', v)} placeholder="Check-out date" /></div>
                </div>

                {/* Availability indicator */}
                {(availLoading || availability) && (
                  <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${
                    availLoading ? 'bg-muted/50 border-border text-muted-foreground' :
                    availability?.available ? 'bg-green-50 border-green-200 text-green-700' :
                    'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {availLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking availability...</>
                      : availability?.available
                        ? <><CheckCircle2 className="w-4 h-4" /> Rooms available for selected dates</>
                        : <><AlertCircle className="w-4 h-4" /> {availability?.reason ?? 'No availability'}</>
                    }
                  </div>
                )}

                <div className="grid gap-3 grid-cols-3">
                  <div className="space-y-1.5"><Label>Rooms</Label><Input type="number" min={1} value={form.rooms} onChange={e => set('rooms', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Adults</Label><Input type="number" min={1} value={form.adults} onChange={e => set('adults', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Children</Label><Input type="number" min={0} value={form.children} onChange={e => set('children', e.target.value)} /></div>
                </div>

                {/* Price breakdown */}
                {selectedRoomTypeId && (priceLoading || pricing) && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <TrendingUp className="w-4 h-4 text-primary" /> Price Estimate
                    </div>
                    {priceLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculating...</div>
                    ) : pricing?.hasRates ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Rate per room/night</span>
                          <span className="font-medium">AED {pricing.avgSellPerNight?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{pricing.nights} nights × {pricing.rooms} room(s)</span>
                          <span className="font-medium">AED {pricing.totalSell?.toLocaleString()}</span>
                        </div>
                        {pricing.availabilityStatus && pricing.availabilityStatus !== 'Free Sale' && (
                          <div className="flex items-center gap-1.5 text-xs">
                            {statusBadge(pricing.availabilityStatus)}
                            {pricing.availabilityStatus === 'Stop Sale' && <span className="text-destructive">This room is not available for the selected dates.</span>}
                            {pricing.availabilityStatus === 'On Request' && <span className="text-muted-foreground">Subject to confirmation by hotel.</span>}
                          </div>
                        )}
                        <Separator className="my-1" />
                        <div className="flex justify-between font-bold text-base">
                          <span>Estimated Total</span>
                          <span className="text-primary">AED {pricing.totalSell?.toLocaleString()}</span>
                        </div>
                        {pricing.pricingErrors.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {pricing.pricingErrors.map((e, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {e}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">{pricing?.pricingErrors[0] ?? 'No rate data available for these dates.'}</div>
                    )}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Email <span className="text-destructive">*</span></Label><Input type="email" placeholder="contact@company.com" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>WhatsApp</Label><Input placeholder="+971 50 xxx xxxx" value={form.whatsAppNumber} onChange={e => set('whatsAppNumber', e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Special Requests</Label><Textarea placeholder="Any special requirements..." value={form.specialRequests} onChange={e => set('specialRequests', e.target.value)} rows={3} /></div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading || (availability != null && !availability.available) || pricing?.availabilityStatus === 'Stop Sale'}
                  className="w-full gap-2 h-11"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : '📩 Submit Booking Request'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">Your request will be reviewed and confirmed by our team within 24 hours.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
