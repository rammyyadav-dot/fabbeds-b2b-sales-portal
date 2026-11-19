import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Copy, Check, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { GetReservationsOutputType } from 'zitejs/api';
import { format } from 'date-fns';

type Reservation = GetReservationsOutputType['reservations'][0];
export type EmailType = 'availability_request' | 'lpo' | 'voucher' | 'invoice';

const fmt = (v?: string | null) => { try { return v ? format(new Date(v), 'dd MMM yyyy') : '—'; } catch { return v ?? '—'; } };
const aed = (v?: number | null) => v != null ? `AED ${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—';

function buildAvailabilityRequest(r: Reservation) {
  const ref = r.inquiryRef ?? r.reservationRef ?? 'PENDING';
  const subject = `Availability Request – UAE Hotels TMS – Ref ${ref}`;
  const body = `Dear ${r.hotelName ?? 'Hotel'} Reservations Team,

Kindly confirm availability for the following booking request:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABILITY REQUEST
Ref No    : ${ref}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROPERTY
Hotel       : ${r.hotelName ?? '—'}
Destination : ${r.destination ?? '—'}

STAY DETAILS
Check-in    : ${fmt(r.checkinDate)}
Check-out   : ${fmt(r.checkoutDate)}
Rooms       : ${r.rooms ?? '—'}
Adults      : ${r.adults ?? '—'}${r.children ? `\nChildren    : ${r.children}` : ''}
Room Type   : ${r.roomType ?? '—'}
Board Basis : ${r.boardBasis ?? '—'}
${r.specialRequests ? `\nSPECIAL REQUESTS\n${r.specialRequests}` : ''}

Kindly confirm rate and availability at your earliest convenience and reply with:
1. Availability (Yes / No)
2. Confirmed net rate (AED)
3. Hotel confirmation reference

Regards,
Reservation Team
UAE Hotels TMS`;
  return { subject, body };
}

function buildLPO(r: Reservation) {
  const lpoRef = r.lpoNumber ?? 'PENDING';
  const nights = r.checkinDate && r.checkoutDate
    ? Math.round((new Date(r.checkoutDate).getTime() - new Date(r.checkinDate).getTime()) / 86400000)
    : '—';
  const netTotal = r.netRateAed != null && typeof nights === 'number' ? r.netRateAed * nights : null;

  const subject = `LPO #${lpoRef} — ${r.hotelName} | ${fmt(r.checkinDate)} – ${fmt(r.checkoutDate)}`;
  const body = `Dear ${r.hotelName ?? 'Hotel'} Reservations Team,

Please find below our Local Purchase Order (LPO) for the following booking.
Kindly confirm receipt and provide your hotel confirmation number.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAE Hotels TMS — LOCAL PURCHASE ORDER
LPO No  : ${lpoRef}
Date    : ${format(new Date(), 'dd MMM yyyy')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUPPLIER DETAILS
Supplier    : ${r.hotelName ?? '—'}
Destination : ${r.destination ?? '—'}

BOOKING DETAILS
Guest Name  : ${r.agentName ?? '—'}
Check-in    : ${fmt(r.checkinDate)}
Check-out   : ${fmt(r.checkoutDate)}
Nights      : ${nights}
Room Type   : ${r.roomType ?? '—'}
Board Basis : ${r.boardBasis ?? '—'}
Guests      : ${r.adults ?? '—'} AD${r.children ? ` + ${r.children} CH` : ''}
Rooms       : ${r.rooms ?? '—'}

RATE DETAILS
Net Rate / Night : ${aed(r.netRateAed)}
Total Nights     : ${nights}
Total Net        : ${netTotal != null ? aed(netTotal) : '—'}
${r.specialRequests ? `\nSPECIAL REQUESTS\n${r.specialRequests}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This LPO confirms booking under contracted rates.
Kindly confirm booking under this reference.

Reservation Team
UAE Hotels TMS`;
  return { subject, body };
}

function buildVoucher(r: Reservation) {
  const nights = r.checkinDate && r.checkoutDate
    ? Math.round((new Date(r.checkoutDate).getTime() - new Date(r.checkinDate).getTime()) / 86400000)
    : '—';
  const subject = `Confirmation Voucher — ${r.reservationRef} | ${r.hotelName} | ${fmt(r.checkinDate)}`;
  const body = `Dear ${r.agentName ?? 'Agent'},

Please find your booking confirmation voucher below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAE Hotels TMS — BOOKING CONFIRMATION VOUCHER
Booking Ref : ${r.reservationRef}
Hotel Conf# : ${r.hotelConfirmationNumber ?? 'Pending'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENT / CLIENT
Agent       : ${r.agentCompany ?? r.agentName ?? '—'}
Guest Name  : ${r.agentName ?? '—'}

HOTEL DETAILS
Hotel       : ${r.hotelName ?? '—'}
Destination : ${r.destination ?? '—'}

STAY DETAILS
Check-in    : ${fmt(r.checkinDate)}
Check-out   : ${fmt(r.checkoutDate)}
Nights      : ${nights}
Room Type   : ${r.roomType ?? '—'}
Board Basis : ${r.boardBasis ?? '—'}
Pax         : ${r.adults ?? '—'} AD${r.children ? ` + ${r.children} CH` : ''}
Rooms       : ${r.rooms ?? '—'}

RATE
Total Selling Rate : ${aed(r.sellingRateAed)}
${r.specialRequests ? `\nSPECIAL REQUESTS\n${r.specialRequests}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please present this voucher at hotel reception.
All bookings are subject to our cancellation policy.

UAE Hotels TMS`;
  return { subject, body };
}

function buildInvoice(r: Reservation) {
  const subject = `Invoice #${r.invoiceNumber ?? 'PENDING'} — ${r.reservationRef} | ${r.hotelName}`;
  const subtotal = r.sellingRateAed ?? 0;
  const vat = Math.round(subtotal * 0.05 * 100) / 100;
  const total = subtotal + vat;
  const body = `Dear ${r.agentName ?? 'Agent'},

Please find your tax invoice details below.
Kindly arrange payment at your earliest convenience.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAE Hotels TMS — TAX INVOICE
Invoice No  : ${r.invoiceNumber ?? 'PENDING'}
Invoice Date: ${format(new Date(), 'dd MMM yyyy')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BILL TO
Name        : ${r.agentName ?? '—'}
Company     : ${r.agentCompany ?? '—'}
Email       : ${r.agentEmail ?? '—'}

BOOKING DETAILS
Reservation : ${r.reservationRef}
Hotel       : ${r.hotelName ?? '—'}
Check-in    : ${fmt(r.checkinDate)}
Check-out   : ${fmt(r.checkoutDate)}
Rooms       : ${r.rooms ?? '—'} × ${r.roomType ?? 'Room'}
Board Basis : ${r.boardBasis ?? '—'}

LINE ITEMS
Hotel Stay  : ${aed(subtotal)}
VAT 5%      : ${aed(vat)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL DUE   : AED ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Payment Terms : 7 Days from invoice date
Please include the invoice number in your payment reference.

Thank you for your business,
UAE Hotels TMS`;
  return { subject, body };
}

const TYPE_CONFIG = {
  availability_request: { label: 'Availability Request', color: 'bg-blue-100 text-blue-700',   build: buildAvailabilityRequest },
  lpo:                  { label: 'LPO Email',            color: 'bg-orange-100 text-orange-700', build: buildLPO },
  voucher:              { label: 'Voucher Email',         color: 'bg-teal-100 text-teal-700',    build: buildVoucher },
  invoice:              { label: 'Invoice Email',         color: 'bg-indigo-100 text-indigo-700', build: buildInvoice },
};

interface Props {
  open: boolean;
  type: EmailType;
  reservation: Reservation;
  onClose: () => void;
}

export default function EmailTemplateDialog({ open, type, reservation, onClose }: Props) {
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  const config = TYPE_CONFIG[type];
  const { subject, body } = config.build(reservation);

  const copy = async (text: string, which: 'subject' | 'body') => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
    if (which === 'subject') { setCopiedSubject(true); setTimeout(() => setCopiedSubject(false), 2000); }
    else { setCopiedBody(true); setTimeout(() => setCopiedBody(false), 2000); }
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast.success('Full email copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Template
            <Badge className={`text-xs ${config.color} border-0`}>{config.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Subject */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject</p>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={() => copy(subject, 'subject')}>
                {copiedSubject ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                Copy
              </Button>
            </div>
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-sm font-medium">{subject}</div>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Body</p>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={() => copy(body, 'body')}>
                {copiedBody ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                Copy
              </Button>
            </div>
            <pre className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground overflow-x-auto">
              {body}
            </pre>
          </div>

          <Button className="w-full gap-2" onClick={copyAll}>
            <Copy className="w-4 h-4" /> Copy Full Email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
