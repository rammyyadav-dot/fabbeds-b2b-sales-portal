import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Checkbox } from '@project/components/ui/checkbox';
import { CheckCircle2, Send, FileText, Receipt, CreditCard, Star, AlertTriangle, Mail, Download } from 'lucide-react';
import { printDocument, buildVoucherHtml, buildInvoiceHtml } from '@/utils/printDocument';
import {
  saveReservation, createLpo, recordSupplierConfirmation,
  createInvoice, recordPayment, GetReservationDetailOutputType,
} from 'zitejs/api';
import { toast } from 'sonner';
import EmailTemplateDialog, { EmailType } from '@/components/EmailTemplateDialog';
import { GetReservationsOutputType } from 'zitejs/api';

type ResDetail = GetReservationDetailOutputType;
type Reservation = GetReservationsOutputType['reservations'][0];

interface Props { detail: ResDetail; onRefresh: () => void; }

export default function ReservationWorkflowActions({ detail, onRefresh }: Props) {
  const { reservation: res, invoices, lpos } = detail;
  const status = res.status ?? '';
  const [busy, setBusy] = useState(false);
  const [emailType, setEmailType] = useState<EmailType | null>(null);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); onRefresh(); }
    catch (e: any) { toast.error(e.message ?? 'Action failed'); }
    finally { setBusy(false); }
  };

  return (
    <>
      {status === 'Inquiry Received' && <InquiryReceivedPanel res={res} busy={busy} act={act} onEmailTemplate={setEmailType} />}
      {status === 'Rate Validated' && <SendLpoPanel res={res} lpos={lpos} busy={busy} act={act} onEmailTemplate={setEmailType} />}
      {status === 'Awaiting Supplier Confirmation' && <SupplierConfirmPanel res={res} busy={busy} act={act} />}
      {status === 'Rate Dispute' && <RateDisputePanel res={res} busy={busy} act={act} />}
      {status === 'Supplier Confirmed' && <IssueVoucherPanel res={res} busy={busy} act={act} onEmailTemplate={setEmailType} />}
      {status === 'Confirmed' && <CreateInvoicePanel res={res} busy={busy} act={act} onEmailTemplate={setEmailType} />}
      {status === 'Invoiced' && <RecordPaymentPanel res={res} invoices={invoices} busy={busy} act={act} />}
      {status === 'Paid' && (
        <ActionCard icon={Star} title="Step 7 — Mark as Completed" color="emerald">
          <Button disabled={busy} onClick={() => act(() => saveReservation({ id: res.id, status: 'Completed', reason: 'Reservation completed' }).then(() => { toast.success('Completed!'); }))}>
            Mark Completed
          </Button>
        </ActionCard>
      )}
      {status === 'Completed' && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-700 font-semibold text-sm">✓ Reservation Completed</div>}
      {!['Inquiry Received','Rate Validated','Awaiting Supplier Confirmation','Rate Dispute','Supplier Confirmed','Confirmed','Invoiced','Paid','Completed'].includes(status) && (
        <div className="rounded-xl border border-border bg-card p-5 text-center text-muted-foreground text-sm">No actions available for this status.</div>
      )}
      {emailType && <EmailTemplateDialog open={!!emailType} type={emailType} reservation={res as unknown as Reservation} onClose={() => setEmailType(null)} />}
    </>
  );
}

function ActionCard({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50/50', orange: 'border-orange-200 bg-orange-50/50',
    purple: 'border-purple-200 bg-purple-50/50', teal: 'border-teal-200 bg-teal-50/50',
    indigo: 'border-indigo-200 bg-indigo-50/50', emerald: 'border-emerald-200 bg-emerald-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
  };
  return (
    <div className={`rounded-xl border p-5 space-y-4 ${colors[color] ?? 'border-border bg-card'}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InquiryReceivedPanel({ res, busy, act, onEmailTemplate }: any) {
  const [notes, setNotes] = useState('');
  const [path, setPath] = useState<'auto' | 'manual' | null>(null);

  return (
    <ActionCard icon={CheckCircle2} title="Stage 1 — Booking Inquiry Received" color="blue">
      {/* Rate summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white/70 rounded-lg p-3 border border-blue-100">
        <div><p className="text-muted-foreground">Net Rate</p><p className="font-bold">AED {res.netRateAed?.toLocaleString() ?? '—'}</p></div>
        <div><p className="text-muted-foreground">Selling Rate</p><p className="font-bold">AED {res.sellingRateAed?.toLocaleString() ?? '—'}</p></div>
        <div><p className="text-muted-foreground">Profit</p><p className="font-bold text-emerald-600">AED {res.profitAed?.toLocaleString() ?? '—'}</p></div>
        <div><p className="text-muted-foreground">Margin</p><p className="font-bold">{res.profitMargin ?? '—'}%</p></div>
      </div>

      {/* Path selection */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Review Path</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => setPath('auto')}
            className={`rounded-lg border p-3 text-left transition-all ${path === 'auto' ? 'border-emerald-400 bg-emerald-50' : 'border-border bg-white hover:border-primary/40'}`}
          >
            <p className="text-xs font-semibold text-emerald-700">✓ Pre-Contracted (Auto)</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Rate & availability confirmed — proceed directly</p>
          </button>
          <button
            onClick={() => setPath('manual')}
            className={`rounded-lg border p-3 text-left transition-all ${path === 'manual' ? 'border-blue-400 bg-blue-50' : 'border-border bg-white hover:border-primary/40'}`}
          >
            <p className="text-xs font-semibold text-blue-700">📧 Manual Confirmation Needed</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Send availability request to hotel first</p>
          </button>
        </div>
      </div>

      {path === 'auto' && (
        <>
          <div className="space-y-1"><Label className="text-xs">Validation Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Rates confirmed against contract" /></div>
          <Button size="sm" disabled={busy} onClick={() => act(() => saveReservation({ id: res.id, status: 'Rate Validated', reason: notes || 'Rates validated (pre-contracted)' }).then(() => toast.success('Rate Validated!')))}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Validate Rates & Proceed to LPO
          </Button>
        </>
      )}

      {path === 'manual' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            <p className="font-semibold mb-1">📄 Template 1: Supplier Availability Request</p>
            <p>Subject: Availability Request – UAE Hotels TMS – Ref {res.inquiryRef ?? res.reservationRef}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onEmailTemplate('availability_request')}>
              <Mail className="w-3.5 h-3.5" /> Copy Availability Request Email
            </Button>
            <Button size="sm" disabled={busy} onClick={() => act(() => saveReservation({ id: res.id, status: 'Awaiting Supplier Confirmation', reason: 'Availability request sent to hotel' }).then(() => toast.success('Moved to Awaiting Supplier Confirmation')))}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> Mark as Sent — Await Confirmation
            </Button>
          </div>
        </div>
      )}
    </ActionCard>
  );
}

function SendLpoPanel({ res, lpos, busy, act, onEmailTemplate }: any) {
  const [lpoNum, setLpoNum] = useState(lpos[0]?.lpoNumber ?? `LPO-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`);
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState(res.notesToSupplier ?? '');
  return (
    <ActionCard icon={Send} title="Stage 2 — Send LPO to Supplier" color="orange">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">LPO Number *</Label><Input value={lpoNum} onChange={e => setLpoNum(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Supplier Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Notes to Supplier</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onEmailTemplate('lpo')}>
          <Mail className="w-3.5 h-3.5" /> Copy LPO Email
        </Button>
        <Button size="sm" disabled={busy || !lpoNum} onClick={() => act(() => createLpo({ reservationId: res.id, lpoNumber: lpoNum, supplierEmail: email || undefined, lpoNotes: notes || undefined }).then(() => toast.success('LPO created & sent!')))}>
          <Send className="w-3.5 h-3.5 mr-1.5" /> Create & Send LPO
        </Button>
      </div>
    </ActionCard>
  );
}

function SupplierConfirmPanel({ res, busy, act }: any) {
  const [ref, setRef] = useState('');
  const [netRate, setNetRate] = useState<string>('');
  const [dispute, setDispute] = useState(false);
  const [dispNotes, setDispNotes] = useState('');
  return (
    <ActionCard icon={CheckCircle2} title="Stage 3 — Record Supplier Confirmation" color="purple">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Supplier Reference *</Label><Input value={ref} onChange={e => setRef(e.target.value)} placeholder="HTL-CONF-12345" /></div>
        <div className="space-y-1"><Label className="text-xs">Confirmed Net Rate (AED)</Label><Input type="number" value={netRate} onChange={e => setNetRate(e.target.value)} placeholder={String(res.netRateAed ?? '')} /></div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="dispute" checked={dispute} onCheckedChange={v => setDispute(!!v)} />
        <Label htmlFor="dispute" className="text-xs text-amber-700 font-medium">Rate discrepancy / dispute</Label>
      </div>
      {dispute && <Textarea rows={2} value={dispNotes} onChange={e => setDispNotes(e.target.value)} placeholder="Describe the discrepancy..." />}
      <Button size="sm" disabled={busy || !ref} onClick={() => act(() => recordSupplierConfirmation({ reservationId: res.id, supplierReference: ref, confirmedNetRate: netRate ? +netRate : undefined, hasDiscrepancy: dispute, discrepancyNotes: dispNotes || undefined }).then(r => toast.success(`Status → ${r.status}`)))}>
        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {dispute ? 'Flag Rate Dispute' : 'Confirm Supplier'}
      </Button>
    </ActionCard>
  );
}

function RateDisputePanel({ res, busy, act }: any) {
  return (
    <ActionCard icon={AlertTriangle} title="Rate Dispute — Resolve" color="amber">
      <p className="text-xs text-amber-700">Supplier reference: <strong>{res.supplierReference ?? '—'}</strong></p>
      <p className="text-xs text-muted-foreground">Re-negotiate with supplier or re-validate rates to continue.</p>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => saveReservation({ id: res.id, status: 'Rate Validated', reason: 'Re-validating after dispute' }).then(() => toast.success('Sent back to Rate Validated')))}>
          Re-Validate Rates
        </Button>
        <Button size="sm" disabled={busy} onClick={() => act(() => saveReservation({ id: res.id, status: 'Awaiting Supplier Confirmation', reason: 'Re-sent to supplier for confirmation' }).then(() => toast.success('Awaiting supplier again')))}>
          Re-Send to Supplier
        </Button>
      </div>
    </ActionCard>
  );
}

function IssueVoucherPanel({ res, busy, act, onEmailTemplate }: any) {
  const [notes, setNotes] = useState('');
  const nights = res.checkinDate && res.checkoutDate
    ? Math.round((new Date(res.checkoutDate).getTime() - new Date(res.checkinDate).getTime()) / 86400000)
    : 0;
  const handleVoucherPdf = () => {
    printDocument(buildVoucherHtml({
      bookingRef: res.reservationRef ?? '—',
      status: 'Confirmed',
      hotelName: res.hotelName ?? undefined,
      destination: res.destination ?? undefined,
      hotelConfirmationNumber: res.hotelConfirmationNumber ?? undefined,
      roomType: res.roomType ?? undefined,
      boardBasis: res.boardBasis ?? undefined,
      checkinDate: res.checkinDate ?? undefined,
      checkoutDate: res.checkoutDate ?? undefined,
      nights,
      rooms: res.rooms,
      adults: res.adults,
      children: res.children,
      guestName: res.agentName ?? undefined,
      agentCompany: res.agentCompany ?? undefined,
      sellingRateAed: res.sellingRateAed,
      specialRequests: res.specialRequests,
    }), `Voucher — ${res.reservationRef}`);
  };
  return (
    <ActionCard icon={FileText} title="Stage 4 — Issue Agent Confirmation Voucher" color="teal">
      <div className="rounded-lg bg-white border border-border p-3 text-xs font-mono space-y-0.5">
        <p className="font-bold text-primary">CONFIRMATION VOUCHER — {res.reservationRef}</p>
        <p>Agent: {res.agentCompany ?? res.agentName} | Hotel Conf#: {res.hotelConfirmationNumber ?? 'Pending'}</p>
        <p>Hotel: {res.hotelName} | {res.destination}</p>
        <p>Check-in: {res.checkinDate ?? '—'} | Check-out: {res.checkoutDate ?? '—'}</p>
        <p>Rooms: {res.rooms} | Pax: {res.adults}AD{res.children ? ` + ${res.children}CH` : ''} | {res.roomType} | {res.boardBasis}</p>
        <p>Sell Rate: AED {res.sellingRateAed?.toLocaleString() ?? '—'}</p>
      </div>
      <div className="space-y-1"><Label className="text-xs">Notes to Agent</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleVoucherPdf}>
          <Download className="w-3.5 h-3.5" /> Download Voucher PDF
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onEmailTemplate('voucher')}>
          <Mail className="w-3.5 h-3.5" /> Copy Voucher Email
        </Button>
        <Button size="sm" disabled={busy} onClick={() => act(() => saveReservation({ id: res.id, status: 'Confirmed', voucherSentAt: new Date().toISOString(), notesToAgent: notes || undefined, reason: 'Voucher issued to agent' }).then(() => toast.success('Voucher issued — Confirmed!')))}>
          <FileText className="w-3.5 h-3.5 mr-1.5" /> Issue Voucher & Confirm
        </Button>
      </div>
    </ActionCard>
  );
}

function CreateInvoicePanel({ res, busy, act, onEmailTemplate }: any) {
  const subtotal = res.sellingRateAed ?? 0;
  const [invNum, setInvNum] = useState(`INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`);
  const nights = res.checkinDate && res.checkoutDate
    ? Math.round((new Date(res.checkoutDate).getTime() - new Date(res.checkinDate).getTime()) / 86400000)
    : 0;
  const [vat, setVat] = useState<string>(String(Math.round(subtotal * 0.05)));
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const total = subtotal + (+vat || 0);
  return (
    <ActionCard icon={Receipt} title="Stage 5 — Issue Agent Invoice" color="indigo">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Invoice Number *</Label><Input value={invNum} onChange={e => setInvNum(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Due Date</Label><Input type="date" value={due} onChange={e => setDue(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 rounded-lg p-3">
        <div><p className="text-muted-foreground">Subtotal</p><p className="font-bold">AED {subtotal.toLocaleString()}</p></div>
        <div><p className="text-muted-foreground">VAT (5%)</p><Input type="number" value={vat} onChange={e => setVat(e.target.value)} className="h-7 text-xs mt-0.5" /></div>
        <div><p className="text-muted-foreground">Total</p><p className="font-bold text-primary">AED {total.toLocaleString()}</p></div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Invoice Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
          printDocument(buildInvoiceHtml({
            invoiceNumber: invNum,
            reservationRef: res.reservationRef ?? '—',
            hotelName: res.hotelName ?? undefined,
            destination: res.destination ?? undefined,
            roomType: res.roomType ?? undefined,
            boardBasis: res.boardBasis ?? undefined,
            checkinDate: res.checkinDate ?? undefined,
            checkoutDate: res.checkoutDate ?? undefined,
            nights,
            rooms: res.rooms,
            adults: res.adults,
            children: res.children,
            agentName: res.agentName ?? undefined,
            agentCompany: res.agentCompany ?? undefined,
            subtotal,
            vat: +vat || 0,
            total,
            dueDate: due || undefined,
            invoiceNotes: notes || undefined,
          }), `Invoice — ${invNum}`);
        }}>
          <Download className="w-3.5 h-3.5" /> Download Invoice PDF
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onEmailTemplate('invoice')}>
          <Mail className="w-3.5 h-3.5" /> Copy Invoice Email
        </Button>
        <Button size="sm" disabled={busy || !invNum} onClick={() => act(() => createInvoice({ reservationId: res.id, invoiceNumber: invNum, subtotalAmount: subtotal, vatAmount: +vat || 0, dueDate: due || undefined, invoiceNotes: notes || undefined }).then(() => toast.success('Invoice created!')))}>
          <Receipt className="w-3.5 h-3.5 mr-1.5" /> Issue Invoice
        </Button>
      </div>
    </ActionCard>
  );
}

function RecordPaymentPanel({ res, invoices, busy, act }: any) {
  const invoice = invoices[0];
  const [ref, setRef] = useState('');
  const [method, setMethod] = useState('Bank Transfer');
  const [amount, setAmount] = useState<string>(String(invoice?.totalAmount ?? ''));
  const [notes, setNotes] = useState('');
  if (!invoice) return <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">No invoice found. Create an invoice first.</div>;
  return (
    <ActionCard icon={CreditCard} title="Stage 6 — Record Payment" color="emerald">
      <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-0.5">
        <p>Invoice: <strong>{invoice.invoiceNumber}</strong> · Status: {invoice.invoiceStatus}</p>
        <p>Total Due: <strong>AED {invoice.totalAmount?.toLocaleString()}</strong></p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Payment Reference *</Label><Input value={ref} onChange={e => setRef(e.target.value)} placeholder="TXN-12345" /></div>
        <div className="space-y-1"><Label className="text-xs">Amount (AED) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Payment Method</Label>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{['Bank Transfer','Card','Cash','Cheque'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <Button size="sm" disabled={busy || !ref || !amount} onClick={() => act(() => recordPayment({ reservationId: res.id, invoiceId: invoice.id, paymentReference: ref, paymentMethod: method, amount: +amount, paymentNotes: notes || undefined }).then(r => toast.success(`Payment recorded — ${r.newReservationStatus}`)))}>
        <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Record Payment
      </Button>
    </ActionCard>
  );
}
