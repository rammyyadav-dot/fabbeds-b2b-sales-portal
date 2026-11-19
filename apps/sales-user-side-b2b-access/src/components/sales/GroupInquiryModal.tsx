import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@project/components/ui/sheet';
import { Button } from '@project/components/ui/button';
import { ScrollArea } from '@project/components/ui/scroll-area';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Checkbox } from '@project/components/ui/checkbox';
import { CheckCircle2, Users2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { submitGroupInquiry } from 'zitejs/api';

interface Props { open: boolean; onClose: () => void; }

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-1.5 mt-2">{label}</p>;
}

const INQUIRY_TYPES = ['Group Leisure', 'MICE / Conference', 'Corporate Group', 'Crew / Long Stay', 'Wedding / Social'] as const;
const DESTINATIONS = ['Dubai', 'Abu Dhabi', 'Sharjah', 'RAK', 'Fujairah', 'Ajman'];
const MEAL_PLANS = ['RO', 'BB', 'HB', 'FB', 'AI'];
const SETUP_STYLES = ['Theatre', 'Classroom', 'U-shape', 'Boardroom', 'Banquet'];
const FLEX_OPTIONS = ['No flexibility', '± 1 day', '± 3 days', '± 1 week'];

function todayStr() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function GroupInquiryModal({ open, onClose }: Props) {
  const [step, setStep] = useState<'form'|'success'>('form');
  const [refNum, setRefNum] = useState('');
  const [loading, setLoading] = useState(false);

  // Section A
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [whatsApp, setWhatsApp] = useState('');
  const [country, setCountry] = useState('');
  // Section B
  const [inquiryType, setInquiryType] = useState<typeof INQUIRY_TYPES[number] | ''>('');
  const [destination, setDestination] = useState('');
  const [preferredHotel, setPreferredHotel] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [flexDates, setFlexDates] = useState('');
  const [rooms, setRooms] = useState('');
  const [nationality, setNationality] = useState('');
  // Section C
  const [singleRooms, setSingleRooms] = useState('');
  const [doubleRooms, setDoubleRooms] = useState('');
  const [tripleRooms, setTripleRooms] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [mealPlan, setMealPlan] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  // Section D (MICE)
  const [delegates, setDelegates] = useState('');
  const [meetingDays, setMeetingDays] = useState('');
  const [setupStyle, setSetupStyle] = useState('');
  const [breakoutRooms, setBreakoutRooms] = useState('');
  const [galaDinner, setGalaDinner] = useState(false);
  const [siteInspection, setSiteInspection] = useState(false);
  const [decisionDeadline, setDecisionDeadline] = useState('');
  // Section E
  const [airportTransfers, setAirportTransfers] = useState(false);
  const [tours, setTours] = useState(false);
  const [visaSupport, setVisaSupport] = useState(false);
  // Section F
  const [specialRequests, setSpecialRequests] = useState('');
  const [consent, setConsent] = useState(false);

  const isMICE = inquiryType === 'MICE / Conference';
  const roomCount = parseInt(rooms) || 0;
  const nights = checkIn && checkOut ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000) : 0;
  const today = todayStr();

  const checkInPast = checkIn && checkIn < today;
  const roomsWarning = roomCount > 0 && roomCount < 10;
  const missingDelegates = isMICE && !delegates;
  const canSubmit = companyName && contactPerson && email && inquiryType && destination && checkIn && checkOut && rooms && consent && !checkInPast && !missingDelegates;

  const handleClose = () => { setStep('form'); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await submitGroupInquiry({
        companyName, contactPerson, email, whatsApp: whatsApp || undefined, country: country || undefined,
        inquiryType: inquiryType as typeof INQUIRY_TYPES[number],
        destination, preferredHotel: preferredHotel || undefined,
        checkIn, checkOut, flexDates: flexDates || undefined,
        rooms: roomCount, nationality: nationality || undefined,
        singleRooms: parseInt(singleRooms) || undefined, doubleRooms: parseInt(doubleRooms) || undefined, tripleRooms: parseInt(tripleRooms) || undefined,
        adults: parseInt(adults) || undefined, children: parseInt(children) || undefined,
        mealPlan: mealPlan || undefined, budgetRange: budgetRange || undefined,
        delegates: isMICE && delegates ? parseInt(delegates) : undefined,
        meetingDays: isMICE && meetingDays ? parseInt(meetingDays) : undefined,
        setupStyle: isMICE ? setupStyle || undefined : undefined,
        breakoutRooms: isMICE && breakoutRooms ? parseInt(breakoutRooms) : undefined,
        galaDinner: isMICE ? galaDinner : undefined,
        siteInspection: isMICE ? siteInspection : undefined,
        decisionDeadline: isMICE && decisionDeadline ? decisionDeadline : undefined,
        airportTransfers, tours, visaSupport,
        specialRequests: specialRequests || undefined,
      });
      setRefNum(res.inquiryRef);
      setStep('success');
    } catch { toast.error('Submission failed. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold">Group & MICE Inquiry</SheetTitle>
              <SheetDescription className="text-xs mt-0.5">UAE Hotels · Group Rates in 60 Minutes</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {step === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Request Submitted!</h3>
              <p className="text-sm text-muted-foreground mt-1">Ref: <span className="font-semibold text-foreground">GRP-{refNum}</span></p>
              <p className="text-sm text-muted-foreground mt-1">Our Group Desk will prepare offers and respond within 60 minutes.</p>
            </div>
            <Button onClick={handleClose} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 overflow-y-auto">
              <form id="group-form" onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

                {/* Section A */}
                <SectionHeader label="Section A — Contact & Company" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Company Name" required>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company / agency" className="h-10" required />
                  </Field>
                  <Field label="Contact Person" required>
                    <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Full name" className="h-10" required />
                  </Field>
                  <Field label="Official Email" required>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" className="h-10" required />
                  </Field>
                  <Field label="Mobile / WhatsApp">
                    <Input value={whatsApp} onChange={e => setWhatsApp(e.target.value)} placeholder="+971 50 xxx xxxx" className="h-10" />
                  </Field>
                  <Field label="Country">
                    <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country of company" className="h-10" />
                  </Field>
                </div>

                {/* Section B */}
                <SectionHeader label="Section B — Event / Group Basics" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Inquiry Type" required>
                    <Select value={inquiryType} onValueChange={v => setInquiryType(v as typeof INQUIRY_TYPES[number])}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>{INQUIRY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Destination" required>
                    <Select value={destination} onValueChange={setDestination}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select emirate" /></SelectTrigger>
                      <SelectContent>{DESTINATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Preferred Hotel / Area">
                    <Input value={preferredHotel} onChange={e => setPreferredHotel(e.target.value)} placeholder="Hotel name or area" className="h-10" />
                  </Field>
                  <Field label="Nationality / Source Market">
                    <Input value={nationality} onChange={e => setNationality(e.target.value)} placeholder="e.g. Indian, British" className="h-10" />
                  </Field>
                  <Field label="Check-in Date" required>
                    <Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="h-10" min={today} required />
                  </Field>
                  <Field label="Check-out Date" required>
                    <Input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="h-10" min={checkIn || today} required />
                  </Field>
                  {checkIn && checkOut && nights > 0 && (
                    <p className="text-xs text-muted-foreground col-span-2">✓ {nights} night{nights !== 1 ? 's' : ''}</p>
                  )}
                  {checkInPast && <p className="text-xs text-destructive col-span-2">⚠ Check-in date cannot be in the past.</p>}
                  <Field label="Flexible Dates?">
                    <Select value={flexDates} onValueChange={setFlexDates}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select flexibility" /></SelectTrigger>
                      <SelectContent>{FLEX_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Number of Rooms (total)" required>
                    <Input type="number" min={1} value={rooms} onChange={e => setRooms(e.target.value)} placeholder="Min 10 for group rates" className="h-10" required />
                  </Field>
                </div>
                {roomsWarning && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Group rates apply for 10+ rooms. We'll handle smaller groups too — just note rates may vary.
                  </div>
                )}
                {!budgetRange && (
                  <p className="text-xs text-muted-foreground italic">💡 Tip: Adding a budget range helps us quote faster.</p>
                )}

                {/* Section C */}
                <SectionHeader label="Section C — Rooming & Meal Plan" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Single Rooms">
                    <Input type="number" min={0} value={singleRooms} onChange={e => setSingleRooms(e.target.value)} placeholder="0" className="h-10" />
                  </Field>
                  <Field label="Double / Twin Rooms">
                    <Input type="number" min={0} value={doubleRooms} onChange={e => setDoubleRooms(e.target.value)} placeholder="0" className="h-10" />
                  </Field>
                  <Field label="Triple Rooms">
                    <Input type="number" min={0} value={tripleRooms} onChange={e => setTripleRooms(e.target.value)} placeholder="0" className="h-10" />
                  </Field>
                  <Field label="Adults">
                    <Input type="number" min={0} value={adults} onChange={e => setAdults(e.target.value)} placeholder="Total adults" className="h-10" />
                  </Field>
                  <Field label="Children">
                    <Input type="number" min={0} value={children} onChange={e => setChildren(e.target.value)} placeholder="Total children" className="h-10" />
                  </Field>
                  <Field label="Meal Plan">
                    <Select value={mealPlan} onValueChange={setMealPlan}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{MEAL_PLANS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <div className="col-span-2 sm:col-span-3">
                    <Field label="Budget Range (AED per room / night)">
                      <Input value={budgetRange} onChange={e => setBudgetRange(e.target.value)} placeholder="e.g. AED 400–600" className="h-10" />
                    </Field>
                  </div>
                </div>

                {/* Section D — MICE only */}
                {isMICE && (
                  <>
                    <SectionHeader label="Section D — Meeting & Event Requirements" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Expected Delegates / Day" required>
                        <Input type="number" min={1} value={delegates} onChange={e => setDelegates(e.target.value)} placeholder="Number of delegates" className="h-10" required />
                      </Field>
                      <Field label="Number of Meeting Days">
                        <Input type="number" min={1} value={meetingDays} onChange={e => setMeetingDays(e.target.value)} placeholder="Days" className="h-10" />
                      </Field>
                      <Field label="Setup Style">
                        <Select value={setupStyle} onValueChange={setSetupStyle}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Select setup" /></SelectTrigger>
                          <SelectContent>{SETUP_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                      <Field label="Breakout Rooms Needed">
                        <Input type="number" min={0} value={breakoutRooms} onChange={e => setBreakoutRooms(e.target.value)} placeholder="Qty" className="h-10" />
                      </Field>
                      <Field label="Decision Deadline">
                        <Input type="date" value={decisionDeadline} onChange={e => setDecisionDeadline(e.target.value)} className="h-10" />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-4 pt-1">
                      {[
                        { id: 'gala', label: 'Gala Dinner / Banquet', checked: galaDinner, onChange: setGalaDinner },
                        { id: 'site', label: 'Site Inspection Required', checked: siteInspection, onChange: setSiteInspection },
                      ].map(({ id, label, checked, onChange }) => (
                        <div key={id} className="flex items-center gap-2">
                          <Checkbox id={id} checked={checked} onCheckedChange={v => onChange(!!v)} />
                          <Label htmlFor={id} className="text-xs text-muted-foreground cursor-pointer">{label}</Label>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Section E */}
                <SectionHeader label="Section E — Optional Add-ons" />
                <div className="flex flex-wrap gap-4">
                  {[
                    { id: 'transfers', label: 'Airport Transfers', checked: airportTransfers, onChange: setAirportTransfers },
                    { id: 'tours', label: 'Tours / Excursions', checked: tours, onChange: setTours },
                    { id: 'visa', label: 'Visa Support', checked: visaSupport, onChange: setVisaSupport },
                  ].map(({ id, label, checked, onChange }) => (
                    <div key={id} className="flex items-center gap-2">
                      <Checkbox id={id} checked={checked} onCheckedChange={v => onChange(!!v)} />
                      <Label htmlFor={id} className="text-xs text-muted-foreground cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>

                {/* Section F */}
                <SectionHeader label="Section F — Notes & Consent" />
                <Field label="Special Requests / Must-haves">
                  <Textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
                    placeholder="Room preferences, dietary needs, branding requirements, agenda highlights..." rows={3} />
                </Field>
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox id="consent" checked={consent} onCheckedChange={v => setConsent(!!v)} className="mt-0.5" />
                  <Label htmlFor="consent" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to be contacted by the Group Desk team regarding this inquiry. Submitted details will be used solely for sourcing and quoting purposes.
                  </Label>
                </div>
              </form>
            </ScrollArea>

            <div className="px-6 py-4 border-t border-border shrink-0 flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
              <Button type="submit" form="group-form" className="flex-1" disabled={loading || !canSubmit}>
                {loading ? 'Submitting…' : '🏨 Get Group Offers'}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
