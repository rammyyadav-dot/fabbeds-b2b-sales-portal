import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Separator } from '@project/components/ui/separator';
import { FileText, Send, Download, Mail } from 'lucide-react';
import { printDocument, buildLpoHtml } from '@/utils/printDocument';
import { format } from 'date-fns';
import { createLpo, GetReservationsOutputType } from 'zitejs/api';
import { toast } from 'sonner';

type Reservation = GetReservationsOutputType['reservations'][0];

interface Props {
  open: boolean;
  reservation: Reservation;
  onClose: () => void;
  onRefresh?: () => void;
}

const fmt = (v?: string | null) => { try { return v ? format(new Date(v), 'dd MMM yyyy') : '—'; } catch { return v ?? '—'; } };

export default function LpoFormDialog({ open, reservation: r, onClose, onRefresh }: Props) {
  const [supplierEmail, setSupplierEmail] = useState('');
  const [sending, setSending] = useState(false);
  const isSent = !!r.lpoSentAt;
  const lpoNum = r.lpoNumber ?? `LPO-${r.reservationRef?.replace(/^RES-/, '') ?? String(Date.now()).slice(-6)}`;

  const nights = r.checkinDate && r.checkoutDate
    ? Math.round((new Date(r.checkoutDate).getTime() - new Date(r.checkinDate).getTime()) / 86400000)
    : 0;
  const ratePerNight = nights > 0 && r.rooms ? Math.round((r.netRateAed ?? 0) / nights / r.rooms) : (r.netRateAed ?? 0);
  const netTotal = r.netRateAed ?? 0;

  const handleSend = async () => {
    setSending(true);
    try {
      await createLpo({ reservationId: r.id, lpoNumber: lpoNum, supplierEmail: supplierEmail || undefined });
      toast.success('LPO created & sent to supplier!');
      onRefresh?.();
      onClose();
    } catch (e: any) { toast.error(e.message ?? 'Failed to send LPO'); }
    finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Hotel Local Purchase Order
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Generate and send LPO to hotel reservation team</p>
        </DialogHeader>

        <LpoHeaderBar lpoNum={lpoNum} isSent={isSent} sending={sending} onSend={handleSend} onDownloadPdf={() => {
          printDocument(buildLpoHtml({
            lpoNumber: lpoNum,
            status: isSent ? 'Sent' : 'Draft',
            hotelName: r.hotelName ?? undefined,
            destination: r.destination ?? undefined,
            reservationRef: r.reservationRef ?? undefined,
            agentName: r.agentName ?? undefined,
            checkinDate: r.checkinDate ?? undefined,
            checkoutDate: r.checkoutDate ?? undefined,
            nights,
            rooms: r.rooms,
            adults: r.adults,
            children: r.children,
            roomType: r.roomType ?? undefined,
            boardBasis: r.boardBasis ?? undefined,
            netRateAed: r.netRateAed,
            ratePerNight,
            supplierEmail: supplierEmail || undefined,
          }), `LPO — ${lpoNum}`);
        }} />
        <EmailRecipientsSection supplierEmail={supplierEmail} onChange={setSupplierEmail} />

        <div className="space-y-5 text-sm">
          <LpoSection title="HOTEL DETAILS">
            <div className="rounded-lg bg-muted/20 border border-border p-3 space-y-1">
              <p className="font-bold text-base">{r.hotelName ?? '—'}</p>
              <p className="text-muted-foreground text-xs">{r.destination ?? '—'}, UAE</p>
              {supplierEmail && <p className="text-xs mt-1"><span className="font-semibold">Reservation Contact:</span> {supplierEmail}</p>}
            </div>
          </LpoSection>

          <LpoSection title="RESERVATION DETAILS">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Booking Reference', value: r.reservationRef ?? '—' },
                { label: 'Guest Name', value: r.agentName ?? '—' },
                { label: 'Check-in Date', value: fmt(r.checkinDate) },
                { label: 'Check-out Date', value: fmt(r.checkoutDate) },
                { label: 'Number of Nights', value: String(nights) },
                { label: 'Number of Rooms', value: String(r.rooms ?? '—') },
                { label: 'Adults', value: String(r.adults ?? '—') },
                { label: 'Children', value: String(r.children ?? 0) },
                { label: 'Board Basis', value: r.boardBasis ?? '—' },
                { label: 'Room Type', value: r.roomType ?? '—' },
              ].map(item => (
                <div key={item.label} className="rounded-lg bg-muted/20 p-2.5">
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className="font-semibold text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          </LpoSection>

          <LpoSection title="ROOM & RATE DETAILS">
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted/40">
                <tr>{['Description', 'Quantity', 'Rate (AED)', 'Total (AED)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold border-b border-border">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-3">
                    <p className="font-semibold">{r.roomType ?? 'Room'}</p>
                    <p className="text-xs text-muted-foreground">{r.boardBasis ?? '—'}</p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{r.rooms ?? 1} room(s) × {nights} night(s)</td>
                  <td className="px-3 py-3">{ratePerNight.toLocaleString()}</td>
                  <td className="px-3 py-3 font-bold">{netTotal.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <FinancialSummary netTotal={netTotal} />
          </LpoSection>

          <LpoSection title="TERMS & CONDITIONS">
            <ul className="space-y-1.5 text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
              {['Payment will be processed within 30 days of guest check-out',
                'Please confirm reservation via email within 24 hours',
                "Cancellation policy as per hotel's standard terms",
                'Any modifications must be communicated in writing',
                'Hotel to provide invoice after guest check-out',
              ].map((t, i) => <li key={i} className="flex items-start gap-1.5"><span className="text-primary mt-0.5">•</span>{t}</li>)}
            </ul>
          </LpoSection>

          <div className="flex justify-between items-end pt-4 border-t border-border text-xs">
            <div className="text-muted-foreground space-y-0.5">
              <p className="text-foreground font-semibold text-sm">For any queries, please contact:</p>
              <p className="font-bold text-base text-foreground">UAE Hotels TMS — Reservations Team</p>
              <p>Email: reservations@uaehotels.com</p>
              <p>Phone: +971 4 000 0000</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-foreground">Authorized Signature</p>
              <div className="border-b-2 border-foreground w-44 mt-6 mb-1" />
              <p className="text-muted-foreground">Operations Manager</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LpoHeaderBar({ lpoNum, isSent, sending, onSend, onDownloadPdf }: { lpoNum: string; isSent: boolean; sending: boolean; onSend: () => void; onDownloadPdf: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20 flex-wrap gap-3">
      <div className="flex items-center gap-6 flex-wrap">
        <div><p className="text-xs text-muted-foreground">LPO Number</p><p className="font-bold font-mono">{lpoNum}</p></div>
        <div><p className="text-xs text-muted-foreground">Status</p>
          <Badge className={isSent ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-muted text-muted-foreground border-0'}>{isSent ? 'Sent' : 'Draft'}</Badge>
        </div>
        <div><p className="text-xs text-muted-foreground">Date</p><p className="text-sm font-medium">{format(new Date(), 'dd MMM yyyy')}</p></div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onDownloadPdf}>
          <Download className="w-3.5 h-3.5" /> Download PDF
        </Button>
        {!isSent && (
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={sending} onClick={onSend}>
            <Send className="w-3.5 h-3.5" /> {sending ? 'Sending...' : 'Send LPO'}
          </Button>
        )}
      </div>
    </div>
  );
}

function EmailRecipientsSection({ supplierEmail, onChange }: { supplierEmail: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-2">
      <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" /><p className="font-semibold text-sm text-blue-800">Email Recipients</p></div>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground w-5 shrink-0">To:</Label>
        <Input className="h-7 text-sm" placeholder="reservations@hotel.com" value={supplierEmail} onChange={e => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function FinancialSummary({ netTotal }: { netTotal: number }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-2 mt-3">
      <p className="text-xs text-muted-foreground">Rates are inclusive of VAT (5%)</p>
      <Separator />
      <div className="flex justify-between font-black text-base text-primary">
        <span>NET PAYABLE TO HOTEL</span>
        <span>AED {netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}

function LpoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-bold text-sm tracking-wide text-foreground">{title}</h3>
      {children}
    </div>
  );
}
