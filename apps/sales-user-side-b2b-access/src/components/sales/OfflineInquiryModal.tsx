import { useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@project/components/ui/sheet';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Switch } from '@project/components/ui/switch';
import { Separator } from '@project/components/ui/separator';
import { ScrollArea } from '@project/components/ui/scroll-area';
import { toast } from 'sonner';
import { Building2, CheckCircle2, Zap } from 'lucide-react';
import { submitSpecialInquiry } from 'zitejs/api';

interface Props { open: boolean; onClose: () => void; defaultCheckIn?: string; defaultCheckOut?: string; }

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Fujairah', 'Ajman', 'Umm Al Quwain'];
const MEAL_PLANS = ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All Inclusive'];
const STAR_OPTS = ['Any', '3 Star', '4 Star', '5 Star'];

function SectionHeader({ label }: { label: string }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-primary pt-2">{label}</p>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

export default function OfflineInquiryModal({ open, onClose, defaultCheckIn = '', defaultCheckOut = '' }: Props) {
  const [emirate, setEmirate] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [rooms, setRooms] = useState('1');
  const [adults, setAdults] = useState('2');
  const [children, setChildren] = useState('0');
  const [starPref, setStarPref] = useState('');
  const [boardBasis, setBoardBasis] = useState('');
  const [budget, setBudget] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [notes, setNotes] = useState('');
  const [agentCompany, setAgentCompany] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentWhatsApp, setAgentWhatsApp] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNum, setRefNum] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emirate || !agentCompany || !agentName || !agentEmail) return;
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
        agentCompany, agentName, agentEmail,
        agentWhatsApp: agentWhatsApp || undefined,
      });
      setRefNum(res.inquiryRef);
      setSubmitted(true);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setSubmitted(false); setRefNum(''); setEmirate(''); setHotelName(''); setNotes(''); onClose(); };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <SheetTitle>Request Any UAE Hotel</SheetTitle>
              <SheetDescription>Don't see the hotel you need? Our team will source the best rate.</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {submitted ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Inquiry Submitted!</h3>
              <p className="text-sm text-muted-foreground mt-1">Ref: <span className="font-semibold text-foreground">#{refNum}</span></p>
              <p className="text-sm text-muted-foreground mt-1">Our team will source the best available rate and respond shortly.</p>
            </div>
            <Button onClick={handleClose} className="w-full max-w-xs">Close</Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 overflow-y-auto">
              <form id="offline-form" onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

                <SectionHeader label="Section 1 — Hotel & Stay Details" />

                <Field label="Emirate / Destination" required>
                  <Select value={emirate} onValueChange={setEmirate}>
                    <SelectTrigger><SelectValue placeholder="Select emirate..." /></SelectTrigger>
                    <SelectContent>
                      {EMIRATES.map(e => (
                        <SelectItem key={e} value={e}>
                          <span className="flex items-center gap-2">🇦🇪 {e}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Hotel Name (if specific)">
                  <Input placeholder="Leave blank if flexible" value={hotelName} onChange={e => setHotelName(e.target.value)} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Check-in"><Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} /></Field>
                  <Field label="Check-out"><Input type="date" value={checkOut} min={checkIn || undefined} onChange={e => setCheckOut(e.target.value)} /></Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Rooms">
                    <Select value={rooms} onValueChange={setRooms}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n} Rm</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Adults">
                    <Select value={adults} onValueChange={setAdults}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n} Ad</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Children">
                    <Select value={children} onValueChange={setChildren}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n} Ch</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Star Preference">
                    <Select value={starPref} onValueChange={setStarPref}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>{STAR_OPTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Board Basis">
                    <Select value={boardBasis} onValueChange={setBoardBasis}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>{MEAL_PLANS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Budget/night">
                    <Input className="h-9 text-sm" placeholder="e.g. 500–900" value={budget} onChange={e => setBudget(e.target.value)} />
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

                <Separator />
                <SectionHeader label="Section 2 — Your Details" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company" required><Input placeholder="Agency name" value={agentCompany} onChange={e => setAgentCompany(e.target.value)} required /></Field>
                  <Field label="Your Name" required><Input placeholder="Full name" value={agentName} onChange={e => setAgentName(e.target.value)} required /></Field>
                  <Field label="Email" required><Input type="email" placeholder="you@agency.com" value={agentEmail} onChange={e => setAgentEmail(e.target.value)} required /></Field>
                  <Field label="WhatsApp"><Input placeholder="+971 50 xxx xxxx" value={agentWhatsApp} onChange={e => setAgentWhatsApp(e.target.value)} /></Field>
                </div>
              </form>
            </ScrollArea>

            <div className="px-6 py-4 border-t border-border shrink-0 flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
              <Button type="submit" form="offline-form" className="flex-1" disabled={loading || !emirate || !agentCompany || !agentName || !agentEmail}>
                {loading ? 'Submitting…' : '🏨 Submit Inquiry'}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
