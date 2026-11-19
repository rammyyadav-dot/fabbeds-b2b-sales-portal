import { useState, useMemo } from 'react';
import type { ElementType, ReactNode, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, TrendingDown, CheckCircle2, Hotel, MapPin, CalendarDays, Moon, Users, BedDouble, Utensils, ChevronDown } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { Calendar } from '@project/components/ui/calendar';
import { Separator } from '@project/components/ui/separator';
import SalesHeader from '@/components/sales/SalesHeader';
import ChildAgesInput from '@/components/sales/ChildAgesInput';
import { submitSpecialInquiry } from 'zitejs/api';

interface Props { onLogout: () => void; }

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Fujairah', 'Ajman', 'Umm Al Quwain'];
const BOARD_OPTIONS = [
  { value: 'Room Only', label: 'RO — Room Only' },
  { value: 'Bed & Breakfast', label: 'BB — Bed & Breakfast' },
  { value: 'Half Board', label: 'HB — Half Board' },
  { value: 'Full Board', label: 'FB — Full Board' },
  { value: 'All Inclusive', label: 'AI — All Inclusive' },
];

function Field({ icon: Icon, label, required, children }: { icon?: ElementType; label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function LockedDisplay({ icon: Icon, label, value }: { icon?: ElementType; label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </Label>
      <div className="h-11 px-3 flex items-center bg-primary/5 border border-primary/20 rounded-md text-sm font-semibold text-primary">{value}</div>
    </div>
  );
}

function DatePickerField({ icon: Icon, label, value, onChange, minDate }: {
  icon?: ElementType; label: string; value: string;
  onChange: (v: string) => void; minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + 'T00:00:00') : undefined;

  return (
    <Field icon={Icon} label={label}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="h-11 w-full flex items-center justify-between px-3 rounded-md border border-input bg-background text-sm hover:bg-muted/30 transition-colors">
            <span className={value ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {value ? format(new Date(value + 'T00:00:00'), 'EEE, dd MMM yyyy') : 'Select date...'}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 shadow-2xl border-0 rounded-2xl overflow-hidden" align="start" sideOffset={6}>
          <div className="bg-primary px-4 py-3">
            <p className="text-primary-foreground font-semibold text-sm">
              {value ? format(new Date(value + 'T00:00:00'), 'EEEE, dd MMMM yyyy') : label}
            </p>
          </div>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => { if (d) { onChange(format(d, 'yyyy-MM-dd')); setOpen(false); } }}
            disabled={(d) => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              if (d < today) return true;
              if (minDate) return d <= new Date(minDate + 'T00:00:00');
              return false;
            }}
            defaultMonth={selected ?? new Date()}
            className="p-3"
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}

export default function PriceMatchPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [hotelName, setHotelName] = useState(searchParams.get('hotel') || '');
  const [emirate, setEmirate] = useState('');
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '');
  const [adults, setAdults] = useState(searchParams.get('adults') || '2');
  const [children, setChildren] = useState(searchParams.get('children') || '0');
  const [childAges, setChildAges] = useState<string[]>([]);

  const handleChildrenChange = (val: string) => {
    setChildren(val);
    const n = parseInt(val);
    setChildAges(prev => Array.from({ length: n }, (_, i) => prev[i] ?? ''));
  };
  const [rooms, setRooms] = useState(searchParams.get('rooms') || '1');
  const [roomType, setRoomType] = useState('');
  const [boardBasis, setBoardBasis] = useState('');
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [agentCompany, setAgentCompany] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentWhatsApp, setAgentWhatsApp] = useState('');
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
    if (!competitorPrice || !agentCompany || !agentName || !agentEmail) return;
    setLoading(true);
    try {
      const res = await submitSpecialInquiry({
        inquiryType: 'PRICE_MATCH',
        hotelName: hotelName || undefined,
        destination: emirate || undefined,
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        rooms: parseInt(rooms),
        adults: parseInt(adults),
        children: parseInt(children),
        roomType: roomType || undefined,
        boardBasis: boardBasis || undefined,
        competitorPrice: parseFloat(competitorPrice),
        competitorSourceUrl: competitorUrl || undefined,
        agentCompany, agentName, agentEmail,
        agentWhatsApp: agentWhatsApp || undefined,
        notes: notes || undefined,
      });
      setRefNum(res.inquiryRef);
      setSubmitted(true);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />
      <div className="container mx-auto px-4 py-6 max-w-3xl flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Price Match Submitted!</h3>
        <p className="text-sm text-muted-foreground">Ref: <span className="font-semibold text-foreground">#{refNum}</span></p>
        <p className="text-sm text-muted-foreground">Our team will review and respond within 2 hours.</p>
        <Button onClick={() => navigate('/')} className="mt-2">Back to Search</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 mb-5" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </Button>

        <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingDown className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-lg">💰 Price Match Request</h1>
            <p className="text-sm text-muted-foreground">Found a better rate? Submit proof and we'll review within 2 hours.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Stay Details */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <h3 className="font-semibold text-foreground text-sm">Stay Details</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field icon={Hotel} label="Hotel Name">
                  <Input placeholder="e.g. Sofitel Al Hamra" value={hotelName} onChange={e => setHotelName(e.target.value)} className="h-11" />
                </Field>
                <Field icon={MapPin} label="Emirate / Location">
                  <Select value={emirate} onValueChange={setEmirate}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select emirate..." /></SelectTrigger>
                    <SelectContent>
                      {EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePickerField icon={CalendarDays} label="Check-in Date" value={checkIn} onChange={setCheckIn} />
                <DatePickerField icon={CalendarDays} label="Check-out Date" value={checkOut} onChange={v => { setCheckOut(v); }} minDate={checkIn} />
              </div>

              {nights !== null && (
                <LockedDisplay icon={Moon} label="Number of Nights (auto-calculated)" value={`${nights} night${nights !== 1 ? 's' : ''}`} />
              )}

              <div className="grid grid-cols-3 gap-3">
                <Field icon={Users} label="Adults">
                  <Select value={adults} onValueChange={setAdults}>
                    <SelectTrigger className="h-11 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n} Adult{n !== 1 ? 's' : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field icon={Users} label="Children">
                  <Select value={children} onValueChange={handleChildrenChange}>
                    <SelectTrigger className="h-11 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n} Child{n !== 1 ? 'ren' : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field icon={BedDouble} label="Rooms">
                  <Select value={rooms} onValueChange={setRooms}>
                    <SelectTrigger className="h-11 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n} Room{n !== 1 ? 's' : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <ChildAgesInput count={parseInt(children)} ages={childAges} onChange={setChildAges} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field icon={BedDouble} label="Room Type">
                  <Input placeholder="e.g. Superior Room Garden View" value={roomType} onChange={e => setRoomType(e.target.value)} className="h-11" />
                </Field>
                <Field icon={Utensils} label="Board Basis">
                  <Select value={boardBasis} onValueChange={setBoardBasis}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select board..." /></SelectTrigger>
                    <SelectContent>{BOARD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </div>

          {/* Section 2: Competitor Details */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <h3 className="font-semibold text-foreground text-sm">Competitor Details</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Total Payable Amount (AED)" required>
                <Input type="number" min={1} placeholder="e.g. 2,550" value={competitorPrice} onChange={e => setCompetitorPrice(e.target.value)} required className="h-11" />
              </Field>
              <Field label="Competitor Source URL">
                <Input type="url" placeholder="https://booking.com/..." value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)} className="h-11" />
              </Field>
              <Field label="Notes (conditions, screenshot link, policy)">
                <Textarea rows={3} placeholder="Same room type, same dates, same board, same cancellation policy (NRF)..." value={notes} onChange={e => setNotes(e.target.value)} />
              </Field>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold">✅ Price Match accepted only if:</p>
                <p>Same hotel · Same dates · Same room type · Same board · Same cancellation policy · Proof provided</p>
              </div>
            </div>
          </div>

          {/* Section 3: Agent Details */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <h3 className="font-semibold text-foreground text-sm">Your Details</h3>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Company" required><Input placeholder="Agency name" value={agentCompany} onChange={e => setAgentCompany(e.target.value)} required className="h-11" /></Field>
              <Field label="Your Name" required><Input placeholder="Full name" value={agentName} onChange={e => setAgentName(e.target.value)} required className="h-11" /></Field>
              <Field label="Email" required><Input type="email" placeholder="you@agency.com" value={agentEmail} onChange={e => setAgentEmail(e.target.value)} required className="h-11" /></Field>
              <Field label="WhatsApp"><Input placeholder="+971 50 xxx xxxx" value={agentWhatsApp} onChange={e => setAgentWhatsApp(e.target.value)} className="h-11" /></Field>
            </div>
          </div>

          <Separator />
          <div className="flex gap-3 pb-6">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/')}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading || !competitorPrice || !agentCompany || !agentName || !agentEmail || childAges.slice(0, parseInt(children)).some(a => !a)}>
              {loading ? 'Submitting…' : '🎯 Submit Price Match'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
