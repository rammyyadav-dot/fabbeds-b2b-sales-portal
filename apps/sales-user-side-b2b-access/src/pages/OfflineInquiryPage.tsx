import { useState, useMemo } from 'react';
import type { ReactNode, ElementType, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Building2, CheckCircle2, Lock, Zap, Moon } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Switch } from '@project/components/ui/switch';
import { Badge } from '@project/components/ui/badge';
import { Separator } from '@project/components/ui/separator';
import SalesHeader from '@/components/sales/SalesHeader';
import ChildAgesInput from '@/components/sales/ChildAgesInput';
import { submitSpecialInquiry } from 'zitejs/api';
import { usePartnerAuth } from '@/lib/partnerAuth';

interface Props { onLogout: () => void; }

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Fujairah', 'Ajman', 'Umm Al Quwain'];
const MEAL_PLANS = ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All Inclusive'];
const STAR_OPTS = ['Any', '3 Star', '4 Star', '5 Star'];

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

function LockedField({ label, value, icon: Icon }: { label: string; value: string; icon?: ElementType }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        {Icon ? <Icon className="w-3 h-3" /> : <Lock className="w-3 h-3" />}{label}
      </Label>
      <div className="h-10 px-3 flex items-center bg-primary/5 border border-primary/20 rounded-md text-sm font-semibold text-primary">{value}</div>
    </div>
  );
}

export default function OfflineInquiryPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { partner } = usePartnerAuth();

  const paramCheckIn = searchParams.get('checkIn') || '';
  const paramCheckOut = searchParams.get('checkOut') || '';

  const [emirate, setEmirate] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [checkIn] = useState(paramCheckIn);
  const [checkOut] = useState(paramCheckOut);
  const [rooms, setRooms] = useState('1');
  const [adults, setAdults] = useState('2');
  const [children, setChildren] = useState('0');
  const [childAges, setChildAges] = useState<string[]>([]);

  const handleChildrenChange = (val: string) => {
    setChildren(val);
    const n = parseInt(val);
    setChildAges(prev => Array.from({ length: n }, (_, i) => prev[i] ?? ''));
  };
  const [starPref, setStarPref] = useState('');
  const [boardBasis, setBoardBasis] = useState('');
  const [budget, setBudget] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNum, setRefNum] = useState('');

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const diff = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    return diff > 0 ? diff : null;
  }, [checkIn, checkOut]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!partner) {
      navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!emirate) return;
    setLoading(true);
    try {
      const res = await submitSpecialInquiry({
        inquiryType: 'OFFLINE_REQUEST',
        hotelName: hotelName || undefined,
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        rooms: parseInt(rooms),
        adults: parseInt(adults),
        children: parseInt(children),
        boardBasis: boardBasis || undefined,
        destination: emirate,
        starPreference: starPref || undefined,
        budgetRange: budget || undefined,
        urgent,
        notes: notes || undefined,
        agentCompany: partner.agencyName,
        agentName: partner.agencyName,
        agentEmail: partner.agencyEmail,
        agentWhatsApp: partner.agencyMobile || undefined,
      });
      setRefNum(res.inquiryRef);
      setSubmitted(true);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 mb-5" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </Button>

        <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-lg">🏨 Offline Hotel Inquiry</h1>
            <p className="text-sm text-muted-foreground">Don't see the hotel you need? Our team will source the best rate.</p>
          </div>
        </div>

        {submitted ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center shadow-sm flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Inquiry Submitted!</h3>
              <p className="text-sm text-muted-foreground mt-1">Ref: <span className="font-semibold text-foreground">#{refNum}</span></p>
              <p className="text-sm text-muted-foreground mt-1">Our team will source the best available rate and respond shortly.</p>
            </div>
            <Button onClick={() => navigate('/')} className="mt-2">Back to Search</Button>
          </div>
        ) : !partner ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
            <h3 className="text-lg font-bold text-foreground">Partner sign in required</h3>
            <p className="text-sm text-muted-foreground mt-2">Sign in to request any UAE hotel. Your agency details will be attached automatically.</p>
            <Button className="mt-5" onClick={() => navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>
              Sign in to continue
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Locked dates */}
            {(checkIn || checkOut) && (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <h3 className="font-semibold text-foreground text-sm">Your Dates</h3>
                  <Badge variant="outline" className="text-[10px] ml-auto flex items-center gap-1 text-muted-foreground"><Lock className="w-2.5 h-2.5" />From search</Badge>
                </div>
                <div className="px-6 py-5 grid grid-cols-3 gap-4">
                  {checkIn && <LockedField label="Check-in" value={checkIn} />}
                  {checkOut && <LockedField label="Check-out" value={checkOut} />}
                  {nights !== null && <LockedField icon={Moon} label="Nights" value={`${nights} night${nights !== 1 ? 's' : ''}`} />}
                </div>
              </div>
            )}

            {/* Hotel & Stay Details */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">{checkIn || checkOut ? 2 : 1}</div>
                <h3 className="font-semibold text-foreground text-sm">Hotel & Stay Details</h3>
              </div>
              <div className="px-6 py-5 space-y-4">
                <Field label="Emirate / Destination" required>
                  <Select value={emirate} onValueChange={setEmirate}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select emirate..." /></SelectTrigger>
                    <SelectContent>
                      {EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Hotel Name (if specific)">
                  <Input placeholder="Leave blank if flexible" value={hotelName} onChange={e => setHotelName(e.target.value)} className="h-11" />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Rooms">
                    <Select value={rooms} onValueChange={setRooms}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Adults">
                    <Select value={adults} onValueChange={setAdults}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Children">
                    <Select value={children} onValueChange={handleChildrenChange}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <ChildAgesInput count={parseInt(children)} ages={childAges} onChange={setChildAges} />
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Star Preference">
                    <Select value={starPref} onValueChange={setStarPref}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>{STAR_OPTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Board Basis">
                    <Select value={boardBasis} onValueChange={setBoardBasis}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>{MEAL_PLANS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Budget/night">
                    <Input className="h-10 text-sm" placeholder="e.g. 500–900" value={budget} onChange={e => setBudget(e.target.value)} />
                  </Field>
                </div>
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-3">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-800">Urgent Request (within 72h)</p>
                    <p className="text-[10px] text-amber-600">Mark as urgent if you need a response within 72 hours</p>
                  </div>
                  <Switch checked={urgent} onCheckedChange={setUrgent} />
                </div>
                <Field label="Special Requests / Notes">
                  <Textarea rows={3} placeholder="Room preferences, dietary needs, special occasions, accessibility..." value={notes} onChange={e => setNotes(e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-primary">Submitting as {partner.agencyName}</p>
              <p className="text-xs text-muted-foreground">{partner.agencyEmail}</p>
            </div>

            <Separator />
            <div className="flex gap-3 pb-6">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/')}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={loading || !emirate || childAges.slice(0, parseInt(children)).some(a => !a)}>
                {loading ? 'Submitting…' : '🏨 Submit Inquiry'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
