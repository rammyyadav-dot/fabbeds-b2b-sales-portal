import { useState, type FormEvent, type ElementType, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitGroupInquiry } from 'zitejs/api';
import { toast } from 'sonner';
import {
  ArrowLeft, Users2, CheckCircle2, Clock, Star, Shield, ChevronRight,
  Building2, Calendar, Utensils, Plane, Globe
} from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Checkbox } from '@project/components/ui/checkbox';
import SalesHeader from '@/components/sales/SalesHeader';
import DateRangePicker from '@/components/sales/DateRangePicker';

interface Props { onLogout: () => void; }

const INQUIRY_TYPES = ['Group Leisure', 'MICE / Conference', 'Corporate Group', 'Crew / Long Stay', 'Wedding / Social'] as const;
const DESTINATIONS = ['Dubai', 'Abu Dhabi', 'Sharjah', 'RAK', 'Fujairah', 'Ajman'];
const MEAL_PLANS = ['RO – Room Only', 'BB – Bed & Breakfast', 'HB – Half Board', 'FB – Full Board', 'AI – All Inclusive'];
const SETUP_STYLES = ['Theatre', 'Classroom', 'U-shape', 'Boardroom', 'Banquet'];
const FLEX_OPTIONS = ['No flexibility', '± 1 day', '± 3 days', '± 1 week'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionCard({ num, icon: Icon, title, subtitle, children }: { num: number; icon: ElementType; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">{num}</div>
        <Icon className="w-4 h-4 text-primary" />
        <div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

export default function GroupInquiryPage({ onLogout }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNum, setRefNum] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [whatsApp, setWhatsApp] = useState('');
  const [country, setCountry] = useState('');
  const [inquiryType, setInquiryType] = useState<typeof INQUIRY_TYPES[number] | ''>('');
  const [destination, setDestination] = useState('');
  const [preferredHotel, setPreferredHotel] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [flexDates, setFlexDates] = useState('');
  const [rooms, setRooms] = useState('');
  const [nationality, setNationality] = useState('');
  const [singleRooms, setSingleRooms] = useState('');
  const [doubleRooms, setDoubleRooms] = useState('');
  const [tripleRooms, setTripleRooms] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [mealPlan, setMealPlan] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [delegates, setDelegates] = useState('');
  const [meetingDays, setMeetingDays] = useState('');
  const [setupStyle, setSetupStyle] = useState('');
  const [breakoutRooms, setBreakoutRooms] = useState('');
  const [galaDinner, setGalaDinner] = useState(false);
  const [siteInspection, setSiteInspection] = useState(false);
  const [decisionDeadline, setDecisionDeadline] = useState('');
  const [airportTransfers, setAirportTransfers] = useState(false);
  const [tours, setTours] = useState(false);
  const [visaSupport, setVisaSupport] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');
  const [consent, setConsent] = useState(false);

  const isMICE = inquiryType === 'MICE / Conference';
  const roomCount = parseInt(rooms) || 0;
  const today = todayStr();
  const nights = checkIn && checkOut ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000) : 0;
  const roomsWarning = roomCount > 0 && roomCount < 10;
  const canSubmit = companyName && contactPerson && email && inquiryType && destination && checkIn && checkOut && rooms && consent && !(isMICE && !delegates);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await submitGroupInquiry({
        companyName, contactPerson, email,
        whatsApp: whatsApp || undefined, country: country || undefined,
        inquiryType: inquiryType as typeof INQUIRY_TYPES[number],
        destination, preferredHotel: preferredHotel || undefined,
        checkIn, checkOut, flexDates: flexDates || undefined,
        rooms: roomCount, nationality: nationality || undefined,
        singleRooms: parseInt(singleRooms) || undefined,
        doubleRooms: parseInt(doubleRooms) || undefined,
        tripleRooms: parseInt(tripleRooms) || undefined,
        adults: parseInt(adults) || undefined,
        children: parseInt(children) || undefined,
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
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { toast.error('Submission failed. Please try again.'); }
    finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SalesHeader onLogout={onLogout} hotelCount={0} />
        <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
          <div className="bg-card border border-border rounded-2xl p-10 shadow-sm space-y-5">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Request Submitted!</h2>
              <p className="text-muted-foreground mt-1">Your Group / MICE inquiry has been received.</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-left space-y-2">
              <p className="text-sm font-semibold text-foreground">Reference: <span className="text-primary font-bold">GRP-{refNum}</span></p>
              <p className="text-sm text-muted-foreground">Our Group Desk will prepare a tailored proposal and contact you <span className="font-semibold text-foreground">within 60 minutes</span>.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center pt-2">
              {[
                { icon: Clock, label: '60-min response', color: 'text-primary' },
                { icon: Star, label: 'Best contracted rates', color: 'text-amber-500' },
                { icon: Shield, label: 'No obligation', color: 'text-green-600' },
              ].map(({ icon: I, label, color }) => (
                <div key={label} className="bg-muted/40 rounded-lg p-3">
                  <I className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => navigate('/')}>Back to Hotel Search</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />

      {/* Hero Banner */}
      <div className="bg-primary py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Search
          </button>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Users2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary-foreground leading-tight">
                Groups & MICE —{' '}
                <span className="bg-amber-400 text-primary px-2 py-0.5 rounded-md font-extrabold">
                  Tailored Proposal in 60 Minutes
                </span>
              </h1>
              <p className="text-primary-foreground/80 text-sm mt-2 max-w-xl">
                Submit your requirements. We source the best contracted options across UAE hotels and deliver a ready-to-book proposal — fast.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                {['✓ No obligation', '✓ Contracted group rates', '✓ MICE packages included', '✓ UAE-wide coverage'].map(t => (
                  <span key={t} className="text-xs text-primary-foreground/90 bg-white/10 border border-white/20 px-2.5 py-1 rounded-full font-medium">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <form id="group-inquiry-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT: Form */}
            <div className="lg:col-span-2 space-y-5">

              {/* Section 1 — Contact */}
              <SectionCard num={1} icon={Users2} title="Contact & Company" subtitle="Your details for proposal delivery">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Company / Agency Name" required>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Registered company name" className="h-11" required />
                  </Field>
                  <Field label="Contact Person" required>
                    <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Full name" className="h-11" required />
                  </Field>
                  <Field label="Official Email" required>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" className="h-11" required />
                  </Field>
                  <Field label="Mobile / WhatsApp">
                    <Input value={whatsApp} onChange={e => setWhatsApp(e.target.value)} placeholder="+971 50 xxx xxxx" className="h-11" />
                  </Field>
                  <Field label="Country">
                    <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country of company" className="h-11" />
                  </Field>
                </div>
              </SectionCard>

              {/* Section 2 — Event Basics */}
              <SectionCard num={2} icon={Calendar} title="Event / Group Basics" subtitle="Tell us about your group requirements">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Inquiry Type" required>
                    <Select value={inquiryType} onValueChange={v => setInquiryType(v as typeof INQUIRY_TYPES[number])}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select group type" /></SelectTrigger>
                      <SelectContent>{INQUIRY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Destination" required>
                    <Select value={destination} onValueChange={setDestination}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select emirate" /></SelectTrigger>
                      <SelectContent>{DESTINATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Preferred Hotel / Area">
                    <Input value={preferredHotel} onChange={e => setPreferredHotel(e.target.value)} placeholder="Hotel name or preferred area" className="h-11" />
                  </Field>
                  <Field label="Nationality / Source Market">
                    <Input value={nationality} onChange={e => setNationality(e.target.value)} placeholder="e.g. Indian, British, GCC" className="h-11" />
                  </Field>
                </div>
                <Field label="Check-in & Check-out Dates" required>
                  <DateRangePicker
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onCheckInChange={setCheckIn}
                    onCheckOutChange={setCheckOut}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Number of Rooms (total)" required hint={roomsWarning ? '⚠ Group rates typically apply for 10+ rooms.' : undefined}>
                    <Input type="number" min={1} value={rooms} onChange={e => setRooms(e.target.value)} placeholder="Total rooms required" className="h-11" required />
                  </Field>
                  <Field label="Flexible Dates?">
                    <Select value={flexDates} onValueChange={setFlexDates}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select flexibility" /></SelectTrigger>
                      <SelectContent>{FLEX_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
              </SectionCard>

              {/* Section 3 — Rooming & Meal Plan */}
              <SectionCard num={3} icon={Utensils} title="Rooming & Meal Plan" subtitle="Help us source the right room mix">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Single Rooms">
                    <Input type="number" min={0} value={singleRooms} onChange={e => setSingleRooms(e.target.value)} placeholder="0" className="h-11" />
                  </Field>
                  <Field label="Double / Twin">
                    <Input type="number" min={0} value={doubleRooms} onChange={e => setDoubleRooms(e.target.value)} placeholder="0" className="h-11" />
                  </Field>
                  <Field label="Triple Rooms">
                    <Input type="number" min={0} value={tripleRooms} onChange={e => setTripleRooms(e.target.value)} placeholder="0" className="h-11" />
                  </Field>
                  <Field label="Total Adults">
                    <Input type="number" min={0} value={adults} onChange={e => setAdults(e.target.value)} placeholder="0" className="h-11" />
                  </Field>
                  <Field label="Total Children">
                    <Input type="number" min={0} value={children} onChange={e => setChildren(e.target.value)} placeholder="0" className="h-11" />
                  </Field>
                  <Field label="Meal Plan">
                    <Select value={mealPlan} onValueChange={setMealPlan}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{MEAL_PLANS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Budget Range (AED per room / night)" hint={!budgetRange ? '💡 Sharing a budget range helps us quote faster and more accurately.' : undefined}>
                  <Input value={budgetRange} onChange={e => setBudgetRange(e.target.value)} placeholder="e.g. AED 400 – 600 per room/night" className="h-11" />
                </Field>
              </SectionCard>

              {/* Section 4 — MICE (conditional) */}
              {isMICE && (
                <SectionCard num={4} icon={Building2} title="Meeting & Event Requirements" subtitle="Only for MICE / Conference inquiries">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Expected Delegates / Day" required>
                      <Input type="number" min={1} value={delegates} onChange={e => setDelegates(e.target.value)} placeholder="Number of delegates" className="h-11" required />
                    </Field>
                    <Field label="Number of Meeting Days">
                      <Input type="number" min={1} value={meetingDays} onChange={e => setMeetingDays(e.target.value)} placeholder="Days" className="h-11" />
                    </Field>
                    <Field label="Setup Style">
                      <Select value={setupStyle} onValueChange={setSetupStyle}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select setup" /></SelectTrigger>
                        <SelectContent>{SETUP_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Breakout Rooms Needed">
                      <Input type="number" min={0} value={breakoutRooms} onChange={e => setBreakoutRooms(e.target.value)} placeholder="Qty" className="h-11" />
                    </Field>
                    <Field label="Decision Deadline">
                      <Input type="date" value={decisionDeadline} onChange={e => setDecisionDeadline(e.target.value)} className="h-11" />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-5 pt-1">
                    {[
                      { id: 'gala', label: 'Gala Dinner / Banquet', checked: galaDinner, set: setGalaDinner },
                      { id: 'site', label: 'Site Inspection Required', checked: siteInspection, set: setSiteInspection },
                    ].map(({ id, label, checked, set }) => (
                      <div key={id} className="flex items-center gap-2">
                        <Checkbox id={id} checked={checked} onCheckedChange={v => set(!!v)} />
                        <Label htmlFor={id} className="text-sm text-foreground cursor-pointer">{label}</Label>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Section 5 — Add-ons */}
              <SectionCard num={isMICE ? 5 : 4} icon={Plane} title="Optional Add-ons" subtitle="Additional services we can arrange">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'transfers', label: '✈ Airport Transfers', checked: airportTransfers, set: setAirportTransfers },
                    { id: 'tours', label: '🗺 Tours & Excursions', checked: tours, set: setTours },
                    { id: 'visa', label: '📋 Visa Support', checked: visaSupport, set: setVisaSupport },
                  ].map(({ id, label, checked, set }) => (
                    <label key={id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'bg-primary/5 border-primary/40' : 'bg-muted/30 border-border'}`}>
                      <Checkbox id={id} checked={checked} onCheckedChange={v => set(!!v)} />
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </label>
                  ))}
                </div>
              </SectionCard>

              {/* Section 6 — Notes & Consent */}
              <SectionCard num={isMICE ? 6 : 5} icon={Globe} title="Special Requests & Consent">
                <Field label="Special Requests / Must-haves">
                  <Textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
                    placeholder="Room preferences, dietary requirements, branding needs, agenda highlights, accessibility..." rows={4} />
                </Field>
                <div className="flex items-start gap-3 bg-muted/40 rounded-lg p-4 mt-2">
                  <Checkbox id="consent" checked={consent} onCheckedChange={v => setConsent(!!v)} className="mt-0.5" />
                  <Label htmlFor="consent" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to be contacted by the Group Desk team regarding this inquiry. Details will be used solely for sourcing and quoting purposes.
                  </Label>
                </div>
              </SectionCard>

              {/* Mobile submit */}
              <div className="lg:hidden">
                <Button type="submit" form="group-inquiry-form" className="w-full h-12 font-semibold text-base" disabled={loading || !canSubmit}>
                  {loading ? 'Submitting…' : '🏨 Get Tailored Group Proposal'}
                </Button>
              </div>
            </div>

            {/* RIGHT: Info Sidebar */}
            <div className="hidden lg:block lg:col-span-1 space-y-4">

              {/* Submit CTA */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3 sticky top-4">
                <div className="text-center pb-2 border-b border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Your Proposal</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="bg-amber-400 text-primary text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Ready in 60 Minutes
                    </span>
                  </div>
                </div>
                <Button type="submit" form="group-inquiry-form" className="w-full h-12 font-bold text-base" disabled={loading || !canSubmit}>
                  {loading ? 'Submitting…' : '🏨 Get Tailored Proposal'}
                </Button>
                {!canSubmit && <p className="text-xs text-muted-foreground text-center">Fill required fields to submit</p>}

                {/* Trust badges */}
                <div className="space-y-2 pt-2 border-t border-border">
                  {[
                    { icon: Shield, text: 'No obligation — free inquiry', color: 'text-green-600' },
                    { icon: Clock, text: 'Response within 60 minutes', color: 'text-primary' },
                    { icon: Star, text: 'Best contracted group rates', color: 'text-amber-500' },
                    { icon: Building2, text: 'UAE-wide hotel network', color: 'text-blue-500' },
                  ].map(({ icon: I, text, color }) => (
                    <div key={text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <I className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                      {text}
                    </div>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">How It Works</p>
                <div className="space-y-3">
                  {[
                    { step: '1', title: 'Submit Requirements', desc: 'Fill in your group details' },
                    { step: '2', title: 'We Source Hotels', desc: 'Group Desk contacts UAE hotels' },
                    { step: '3', title: 'Receive Proposal', desc: '3–5 options with rates & terms' },
                    { step: '4', title: 'Confirm & Book', desc: 'Select, confirm, receive vouchers' },
                  ].map(({ step, title, desc }, i, arr) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{step}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{title}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 mt-1 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Group types */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">We Handle</p>
                <div className="space-y-1.5">
                  {['Group Leisure (10+ rooms)', 'MICE & Conferences', 'Corporate Groups', 'Crew & Long Stay', 'Weddings & Social Events'].map(t => (
                    <div key={t} className="flex items-center gap-2 text-xs text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />{t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
