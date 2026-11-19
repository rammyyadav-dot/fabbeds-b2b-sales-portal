import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReservationDetail, saveReservation, GetReservationDetailOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { ArrowLeft, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ReservationFormDialog from '@/components/ReservationFormDialog';
import ReservationPipeline from '@/components/ReservationPipeline';
import ReservationWorkflowActions from '@/components/ReservationWorkflowActions';
import ReservationHistoryPanel from '@/components/ReservationHistoryPanel';
import EmailTemplateDialog, { EmailType } from '@/components/EmailTemplateDialog';

type ResDetail = GetReservationDetailOutputType;

const STATUS_COLORS: Record<string, string> = {
  'Inquiry Received': 'bg-slate-100 text-slate-700', 'Rate Validated': 'bg-blue-100 text-blue-700',
  'Awaiting Supplier Confirmation': 'bg-orange-100 text-orange-700', 'Supplier Confirmed': 'bg-purple-100 text-purple-700',
  'Confirmed': 'bg-teal-100 text-teal-700', 'Invoiced': 'bg-indigo-100 text-indigo-700',
  'Paid': 'bg-emerald-100 text-emerald-700', 'Completed': 'bg-green-100 text-green-700',
  'Rate Dispute': 'bg-amber-100 text-amber-700', 'Cancelled by Agent': 'bg-red-100 text-red-700',
  'Cancelled by Supplier': 'bg-red-100 text-red-700', 'No Show': 'bg-gray-100 text-gray-600',
};

const CANCEL_STATUSES = ['Cancelled by Agent', 'Cancelled by Supplier', 'No Show'];
const ALL_STATUSES = ['Inquiry Received','Rate Validated','Awaiting Supplier Confirmation','Supplier Confirmed','Confirmed','Invoiced','Paid','Completed','Rate Dispute','Cancelled by Agent','Cancelled by Supplier','No Show'];

const fmt = (v?: string | null) => { try { return v ? format(new Date(v), 'dd MMM yyyy') : '—'; } catch { return v ?? '—'; } };
const aed = (v?: number | null) => v != null ? `AED ${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—';

export default function ReservationDetailPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const [detail, setDetail] = useState<ResDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [emailType, setEmailType] = useState<EmailType | null>(null);
  const [notes, setNotes] = useState('');

  const load = async () => {
    if (!reservationId) return;
    setLoading(true);
    try {
      const d = await getReservationDetail({ id: reservationId });
      setDetail(d);
      setNotes(d.reservation.internalNotes ?? '');
    } catch { toast.error('Failed to load reservation'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [reservationId]);

  const handleSaveEdit = async (data: any) => {
    setSaving(true);
    try { await saveReservation(data); toast.success('Updated'); setEditOpen(false); load(); }
    catch (e: any) { toast.error(e.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleSaveNotes = async () => {
    if (!detail) return;
    setSaving(true);
    try { await saveReservation({ id: detail.reservation.id, internalNotes: notes }); toast.success('Notes saved'); }
    catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const handleStatusOverride = async (status: string) => {
    if (!detail) return;
    setSaving(true);
    try { await saveReservation({ id: detail.reservation.id, status, reason: 'Manual override' }); toast.success(`Status → ${status}`); load(); }
    catch (e: any) { toast.error(e.message ?? 'Invalid transition'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!detail) return <div className="p-6 text-center text-muted-foreground">Not found. <Link to="/reservations" className="text-primary underline">Back</Link></div>;

  const res = detail.reservation;
  const isCancelled = CANCEL_STATUSES.includes(res.status ?? '');
  const isCompleted = res.status === 'Completed';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/reservations"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{res.hotelName ?? 'Reservation'}</h1>
            <Badge className="font-mono text-xs bg-slate-800 text-white shrink-0">{res.reservationRef}</Badge>
            {res.inquiryRef && <Badge variant="outline" className="text-xs shrink-0">Inq: {res.inquiryRef}</Badge>}
            {res.isLocked && <Badge variant="outline" className="text-xs gap-1 text-orange-600 border-orange-200"><Lock className="w-3 h-3" />Locked</Badge>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLORS[res.status ?? ''] ?? 'bg-muted text-muted-foreground'}`}>{res.status}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{res.agentName}{res.agentCompany ? ` · ${res.agentCompany}` : ''}{res.destination ? ` · ${res.destination}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
          {!isCancelled && !isCompleted && (
            <Select onValueChange={handleStatusOverride}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Override status…" /></SelectTrigger>
              <SelectContent>{ALL_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Pipeline */}
      <ReservationPipeline status={res.status} />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="workflow">
            <TabsList className="mb-4">
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="history">History ({detail.statusEvents.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="workflow" className="space-y-4">
              {!isCancelled && !isCompleted && <ReservationWorkflowActions detail={detail} onRefresh={load} />}
              {(isCancelled || isCompleted) && (
                <div className={`rounded-xl border p-5 text-center text-sm font-semibold ${isCancelled ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {isCancelled ? `⚠ Reservation ${res.status}` : '✓ Reservation Completed'}
                </div>
              )}
              {/* Email templates */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Email Templates</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEmailType('availability_request')}>Availability Request</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEmailType('lpo')}>LPO Email</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEmailType('voucher')}>Voucher Email</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEmailType('invoice')}>Invoice Email</Button>
                </div>
              </div>
              {/* Internal Notes */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-sm font-semibold">Internal Notes</p>
                <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes, follow-up actions…" />
                <Button size="sm" disabled={saving} onClick={handleSaveNotes}>Save Notes</Button>
              </div>
            </TabsContent>

            <TabsContent value="details">
              <BookingDetailsPanel res={res} />
            </TabsContent>

            <TabsContent value="finance">
              <FinancePanel detail={detail} />
            </TabsContent>

            <TabsContent value="history">
              <div className="rounded-xl border border-border bg-card p-5">
                <ReservationHistoryPanel events={detail.statusEvents} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <FinancialSummaryCard res={res} />
          <AgentCard res={res} />
          <DocumentStatusCard detail={detail} />
          {!isCancelled && !isCompleted && (
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full text-xs text-red-600 border-red-200" disabled={saving} onClick={() => handleStatusOverride('Cancelled by Agent')}>Cancel by Agent</Button>
              <Button variant="outline" size="sm" className="w-full text-xs text-red-600 border-red-200" disabled={saving} onClick={() => handleStatusOverride('Cancelled by Supplier')}>Cancel by Supplier</Button>
            </div>
          )}
        </div>
      </div>

      <ReservationFormDialog open={editOpen} reservation={res as any} onClose={() => setEditOpen(false)} onSave={handleSaveEdit} saving={saving} />
      {emailType && <EmailTemplateDialog open={!!emailType} type={emailType} reservation={res as any} onClose={() => setEmailType(null)} />}
    </div>
  );
}

function BookingDetailsPanel({ res }: { res: ResDetail['reservation'] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">Booking Details</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        {[
          { label: 'Check-in', value: fmt(res.checkinDate) },
          { label: 'Check-out', value: fmt(res.checkoutDate) },
          { label: 'Rooms', value: res.rooms?.toString() ?? '—' },
          { label: 'Adults', value: res.adults?.toString() ?? '—' },
          { label: 'Children', value: res.children?.toString() ?? '—' },
          { label: 'Room Type', value: res.roomType ?? '—' },
          { label: 'Board Basis', value: res.boardBasis ?? '—' },
          { label: 'Currency', value: res.currencyCode ?? 'AED' },
          { label: 'Agent Ref', value: res.agentReference ?? '—' },
          { label: 'Supplier Ref', value: res.supplierReference ?? '—' },
        ].map(item => (
          <div key={item.label}><p className="text-xs text-muted-foreground">{item.label}</p><p className="font-semibold">{item.value}</p></div>
        ))}
      </div>
      {res.specialRequests && (
        <div className="pt-3 border-t border-border"><p className="text-xs text-muted-foreground mb-1">Special Requests</p><p className="text-sm">{res.specialRequests}</p></div>
      )}
      {res.notesToSupplier && (
        <div className="pt-3 border-t border-border"><p className="text-xs text-muted-foreground mb-1">Notes to Supplier</p><p className="text-sm">{res.notesToSupplier}</p></div>
      )}
      {res.notesToAgent && (
        <div className="pt-3 border-t border-border"><p className="text-xs text-muted-foreground mb-1">Notes to Agent</p><p className="text-sm">{res.notesToAgent}</p></div>
      )}
    </div>
  );
}

function FinancePanel({ detail }: { detail: ResDetail }) {
  const { reservation: res, invoices, payments } = detail;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-sm">Rate Breakdown</h3>
        {[
          { label: 'Net Rate (Cost)', value: aed(res.netRateAed) },
          { label: 'Selling Rate (Client)', value: aed(res.sellingRateAed), bold: true },
          { label: 'VAT Amount', value: aed(res.vatAmountAed) },
          { label: 'Profit', value: aed(res.profitAed), green: true },
        ].map(r => (
          <div key={r.label} className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{r.label}</span>
            <span className={`text-sm font-bold ${r.green ? 'text-emerald-600' : r.bold ? 'text-foreground' : 'text-muted-foreground'}`}>{r.value}</span>
          </div>
        ))}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Margin</span>
          <span className={`text-xl font-black ${(res.profitMargin ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{res.profitMargin != null ? `${res.profitMargin}%` : '—'}</span>
        </div>
      </div>
      {invoices.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Invoices</h3>
          {invoices.map(inv => (
            <div key={inv.id} className="text-sm space-y-1 pb-3 border-b border-border last:border-0 last:pb-0">
              <div className="flex justify-between"><span className="font-mono font-bold">{inv.invoiceNumber}</span><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${inv.invoiceStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{inv.invoiceStatus}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal: {aed(inv.subtotalAmount)}</span><span>VAT: {aed(inv.vatAmount)}</span><span className="font-bold text-foreground">Total: {aed(inv.totalAmount)}</span></div>
              {inv.dueDate && <p className="text-xs text-muted-foreground">Due: {fmt(inv.dueDate)}</p>}
            </div>
          ))}
        </div>
      )}
      {payments.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Payments</h3>
          {payments.map(p => (
            <div key={p.id} className="text-sm flex justify-between items-center">
              <div><p className="font-mono text-xs font-bold">{p.paymentReference}</p><p className="text-xs text-muted-foreground">{p.paymentMethod} · {fmt(p.receivedAt)}</p></div>
              <div className="text-right"><p className="font-bold text-emerald-600">{aed(p.amount)}</p><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.paymentStatus === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{p.paymentStatus}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinancialSummaryCard({ res }: { res: ResDetail['reservation'] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-semibold text-sm">Financial Summary</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Net</span><span className="font-mono">{aed(res.netRateAed)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sell</span><span className="font-bold">{aed(res.sellingRateAed)}</span></div>
        <div className="flex justify-between text-sm pt-2 border-t border-border"><span className="text-muted-foreground">Profit</span><span className="font-bold text-emerald-600">{aed(res.profitAed)}</span></div>
        <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Margin</span><span className={`text-2xl font-black ${(res.profitMargin ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{res.profitMargin != null ? `${res.profitMargin}%` : '—'}</span></div>
      </div>
    </div>
  );
}

function AgentCard({ res }: { res: ResDetail['reservation'] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-2">
      <h3 className="font-semibold text-sm mb-2">Agent Info</h3>
      {[{ label: 'Name', value: res.agentName }, { label: 'Company', value: res.agentCompany }, { label: 'Email', value: res.agentEmail }, { label: 'WhatsApp', value: res.agentWhatsApp }].map(i => (
        <div key={i.label}><p className="text-xs text-muted-foreground">{i.label}</p><p className="text-sm font-medium truncate">{i.value ?? '—'}</p></div>
      ))}
    </div>
  );
}

function DocumentStatusCard({ detail }: { detail: ResDetail }) {
  const { reservation: res, lpos, invoices, payments } = detail;
  const docs = [
    { label: 'LPO', done: lpos.length > 0, detail: lpos[0]?.lpoNumber },
    { label: 'Supplier Conf.', done: !!res.supplierReference, detail: res.supplierReference },
    { label: 'Voucher', done: !!res.voucherSentAt },
    { label: 'Invoice', done: invoices.length > 0, detail: invoices[0]?.invoiceNumber },
    { label: 'Payment', done: payments.some(p => p.paymentStatus === 'Received'), detail: payments[0]?.paymentReference },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-2">
      <h3 className="font-semibold text-sm mb-2">Document Status</h3>
      {docs.map(d => (
        <div key={d.label} className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">{d.label}</span>
          <div className="flex items-center gap-1.5">
            {d.detail && <span className="text-[10px] font-mono text-muted-foreground">{d.detail}</span>}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${d.done ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{d.done ? '✓' : 'Pending'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
