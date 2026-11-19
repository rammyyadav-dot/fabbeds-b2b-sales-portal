import { useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@project/components/ui/sheet';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Separator } from '@project/components/ui/separator';
import { ScrollArea } from '@project/components/ui/scroll-area';
import { toast } from 'sonner';
import { TrendingDown, CheckCircle2 } from 'lucide-react';
import { submitSpecialInquiry } from 'zitejs/api';

interface Props {
  open: boolean;
  onClose: () => void;
  hotel?: { id: string; name: string; emirate?: string };
  checkIn?: string;
  checkOut?: string;
  roomType?: string;
  mealPlan?: string;
  adults?: number;
  children?: number;
  rooms?: number;
  ourRate?: number;
}

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

export default function PriceMatchModal({ open, onClose, hotel, checkIn, checkOut, roomType, mealPlan, adults = 2, children = 0, rooms = 1, ourRate }: Props) {
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [agentCompany, setAgentCompany] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentWhatsApp, setAgentWhatsApp] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNum, setRefNum] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!competitorPrice || !agentCompany || !agentName || !agentEmail) return;
    setLoading(true);
    try {
      const res = await submitSpecialInquiry({
        inquiryType: 'PRICE_MATCH',
        hotelName: hotel?.name,
        hotelId: hotel?.id,
        checkIn, checkOut,
        rooms, adults, children,
        roomType, mealPlan,
        ourRate,
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

  const handleClose = () => { setSubmitted(false); setRefNum(''); setCompetitorPrice(''); setCompetitorUrl(''); setNotes(''); onClose(); };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-primary" />
            </div>
            <div>
              <SheetTitle>Price Match Request</SheetTitle>
              <SheetDescription>Found a better rate? Submit proof and we'll review within 2 hours.</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {submitted ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Price Match Submitted!</h3>
              <p className="text-sm text-muted-foreground mt-1">Ref: <span className="font-semibold text-foreground">#{refNum}</span></p>
              <p className="text-sm text-muted-foreground mt-1">Our team will review and respond within 2 hours.</p>
            </div>
            <Button onClick={handleClose} className="w-full max-w-xs">Close</Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 overflow-y-auto">
              <form id="price-match-form" onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

                {/* Context banner */}
                {hotel && (
                  <div className="bg-muted/40 rounded-xl p-3 border border-border space-y-2">
                    <p className="font-semibold text-sm text-foreground">{hotel.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {checkIn && checkOut && <Badge variant="secondary" className="text-xs">{checkIn} → {checkOut}</Badge>}
                      {roomType && <Badge variant="secondary" className="text-xs">{roomType}</Badge>}
                      {mealPlan && <Badge variant="secondary" className="text-xs">{mealPlan}</Badge>}
                      <Badge variant="secondary" className="text-xs">{adults}A{children > 0 ? `+${children}C` : ''} · {rooms}R</Badge>
                      {ourRate && <Badge className="text-xs bg-primary/10 text-primary border-primary/20 border">Our rate: AED {ourRate.toLocaleString()}/night</Badge>}
                    </div>
                  </div>
                )}

                <SectionHeader label="Section 1 — Competitor Details" />
                <Field label="Competitor Price (AED/night)" required>
                  <Input type="number" min={1} placeholder="e.g. 850" value={competitorPrice} onChange={e => setCompetitorPrice(e.target.value)} required />
                </Field>
                <Field label="Competitor Source URL">
                  <Input type="url" placeholder="https://booking.com/..." value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)} />
                </Field>
                <Field label="Notes (conditions, screenshot link, policy)">
                  <Textarea rows={3} placeholder="Same room type, same dates, same board, same cancellation policy (NRF)..." value={notes} onChange={e => setNotes(e.target.value)} />
                </Field>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">✅ Price Match is accepted only if:</p>
                  <p>Same hotel · Same dates · Same room type · Same board · Same cancellation policy · Proof provided</p>
                </div>

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
              <Button type="submit" form="price-match-form" className="flex-1" disabled={loading || !competitorPrice || !agentCompany || !agentName || !agentEmail}>
                {loading ? 'Submitting…' : '🎯 Submit Price Match'}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
