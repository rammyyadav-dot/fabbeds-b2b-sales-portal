import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Copy, MessageCircle, Mail, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface QuoteData {
  bookingRef: string; hotelName: string; roomType: string; mealPlan?: string;
  checkIn: string; checkOut: string; nights: number;
  adults: number; children: number; rooms: number;
  guestName: string; guestEmail: string; guestPhone: string;
  baseRate: number; childSupplement?: number; ratePerRoomNight: number;
  subtotal: number; vat: number; grandTotal: number;
  // legacy compat
  ratePerNight?: number; total?: number;
}

function DocCard({ title, content, guestEmail, guestPhone }: { title: string; content: string; guestEmail: string; guestPhone: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(content); setCopied(true); toast.success('Copied'); setTimeout(() => setCopied(false), 2000); };
  const handleWhatsApp = () => window.open(`https://wa.me/${guestPhone.replace(/\D/g, '')}?text=${encodeURIComponent(content)}`, '_blank');
  const handleEmail = () => window.open(`mailto:${guestEmail}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(content)}`, '_blank');
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopy}>{copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}</Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleWhatsApp}><MessageCircle className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={handleEmail}><Mail className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded-lg p-3 leading-5">{content}</pre>
      </CardContent>
    </Card>
  );
}

export default function QuoteDocuments({ data }: { data: QuoteData }) {
  const subtotal = data.subtotal ?? data.total ?? 0;
  const ratePerRoomNight = data.ratePerRoomNight ?? data.ratePerNight ?? 0;
  const vat = data.vat;
  const grandTotal = data.grandTotal;
  const tourismFee = data.nights * data.rooms * 20;
  const paymentDeadline = new Date(new Date(data.checkIn).getTime() - 7 * 86400000).toLocaleDateString();

  const confirmation = `BOOKING CONFIRMATION / RESERVATION REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reference : ${data.bookingRef}
Status    : PENDING CONFIRMATION

PROPERTY DETAILS
Hotel     : ${data.hotelName}
Room Type : ${data.roomType}${data.mealPlan ? ` (${data.mealPlan})` : ''}
Check-in  : ${data.checkIn}
Check-out : ${data.checkOut}
Duration  : ${data.nights} night(s) × ${data.rooms} room(s)

GUEST DETAILS
Name      : ${data.guestName}
Pax       : ${data.adults} Adult(s)${data.children > 0 ? ` + ${data.children} Child(ren)` : ''}

RATE CALCULATION
Base Rate (Occ ${data.adults})  : AED ${Math.round(data.baseRate).toLocaleString()} / room / night${data.children > 0 && data.childSupplement ? `
Child Supplement × ${data.children}  : AED ${Math.round(data.childSupplement * data.children).toLocaleString()} / night` : ''}
Rate per Room/Night  : AED ${Math.round(ratePerRoomNight).toLocaleString()}
× ${data.nights} nights × ${data.rooms} room(s)  : AED ${Math.round(subtotal).toLocaleString()}
VAT (5%)             : AED ${Math.round(vat).toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL PAYABLE        : AED ${Math.round(grandTotal).toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  const invoice = `PROFORMA INVOICE (LPO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Invoice # : INV-${data.bookingRef.replace('BK-', '')}
Date      : ${new Date().toLocaleDateString()}

Bill To   : ${data.guestName}
Email     : ${data.guestEmail}
Phone     : ${data.guestPhone}

SERVICES RENDERED
Hotel     : ${data.hotelName}
Room      : ${data.roomType}${data.mealPlan ? ` — ${data.mealPlan}` : ''}
Period    : ${data.checkIn} → ${data.checkOut}
Pax       : ${data.adults} Adults${data.children > 0 ? ` + ${data.children} Children` : ''}
Rooms     : ${data.rooms}

CHARGES BREAKDOWN
Base Rate (${data.adults} pax)  AED ${Math.round(data.baseRate).toLocaleString()} × ${data.nights}N × ${data.rooms}R${data.children > 0 && data.childSupplement ? `
Child Supp × ${data.children}    AED ${Math.round(data.childSupplement * data.children).toLocaleString()} × ${data.nights}N × ${data.rooms}R` : ''}
Accommodation Sub-Total  AED ${Math.round(subtotal).toLocaleString()}
VAT (5%)                 AED ${Math.round(vat).toLocaleString()}
Tourism Dirham           AED ${tourismFee.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL DUE                AED ${Math.round(grandTotal + tourismFee).toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Payment due by: ${paymentDeadline}`;

  const cancellation = `CANCELLATION POLICY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Booking Ref : ${data.bookingRef}
Hotel       : ${data.hotelName}

TERMS
✓ FREE cancellation up to 72 hours before check-in
⚠ 50% charge within 48–72 hours of check-in
✗ 100% charge within 48 hours / No-show

Check-in Date : ${data.checkIn}
Free Cancel By: ${new Date(new Date(data.checkIn).getTime() - 3 * 86400000).toLocaleDateString()}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" /> {data.bookingRef}</Badge>
        <span className="text-xs text-muted-foreground">3 documents ready to send</span>
      </div>
      <DocCard title="Booking Confirmation / Reservation Request" content={confirmation} guestEmail={data.guestEmail} guestPhone={data.guestPhone} />
      <DocCard title="Proforma Invoice (LPO)" content={invoice} guestEmail={data.guestEmail} guestPhone={data.guestPhone} />
      <DocCard title="Cancellation Policy" content={cancellation} guestEmail={data.guestEmail} guestPhone={data.guestPhone} />
    </div>
  );
}
