import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReservations, saveReservation, GetReservationsOutputType, getSpecialInquiries, GetSpecialInquiriesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Plus, Search, TrendingUp, FileText, AlertCircle, ArrowRight, Layers } from 'lucide-react';
import { toast } from 'sonner';
import ReservationFormDialog from '@/components/ReservationFormDialog';
import LpoFormDialog from '@/components/LpoFormDialog';
import ReservationQuickView from '@/components/ReservationQuickView';
import { printDocument, buildInvoiceHtml, buildVoucherHtml } from '@/utils/printDocument';

type Reservation = GetReservationsOutputType['reservations'][0];
type Inquiry = GetSpecialInquiriesOutputType['inquiries'][0];

const STATUS_COLORS: Record<string, string> = {
  'Inquiry Received': 'bg-slate-100 text-slate-700 border-slate-200',
  'Rate Validated': 'bg-blue-100 text-blue-700 border-blue-200',
  'Awaiting Supplier Confirmation': 'bg-orange-100 text-orange-700 border-orange-200',
  'Supplier Confirmed': 'bg-purple-100 text-purple-700 border-purple-200',
  'Confirmed': 'bg-teal-100 text-teal-700 border-teal-200',
  'Invoiced': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Paid': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Completed': 'bg-green-100 text-green-700 border-green-200',
  'Rate Dispute': 'bg-amber-100 text-amber-700 border-amber-200',
  'Cancelled by Agent': 'bg-red-100 text-red-600 border-red-200',
  'Cancelled by Supplier': 'bg-red-100 text-red-600 border-red-200',
  'No Show': 'bg-gray-100 text-gray-500 border-gray-200',
};

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Inquiry', value: 'Inquiry Received' },
  { label: 'Rate Validated', value: 'Rate Validated' },
  { label: 'Awaiting Supplier', value: 'Awaiting Supplier Confirmation' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Invoiced', value: 'Invoiced' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Completed', value: 'Completed' },
];

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editRes, setEditRes] = useState<Reservation | null>(null);
  const [saving, setSaving] = useState(false);
  const [lpoRes, setLpoRes] = useState<Reservation | null>(null);
  const [quickView, setQuickView] = useState<Reservation | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [resData, inqData] = await Promise.all([getReservations({}), getSpecialInquiries({})]);
      setReservations(resData.reservations);
      setInquiries(inqData.inquiries);
    } catch { toast.error('Failed to load reservations'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      await saveReservation(data);
      toast.success(data.id ? 'Reservation updated' : 'Reservation created');
      setFormOpen(false); setEditRes(null); load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const filtered = reservations.filter(r => {
    if (filter && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [r.reservationRef, r.hotelName, r.agentName, r.agentCompany, r.inquiryRef].some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const CANCELLED = ['Cancelled by Agent', 'Cancelled by Supplier', 'No Show'];
  const totalProfit = reservations.filter(r => !CANCELLED.includes(r.status ?? '')).reduce((s, r) => s + (r.profitAed ?? 0), 0);
  const stats = {
    total: reservations.length,
    active: reservations.filter(r => !['Completed', ...CANCELLED].includes(r.status ?? '')).length,
    completed: reservations.filter(r => r.status === 'Completed').length,
    profit: totalProfit,
  };

  const openInquiries = inquiries.filter(i => !['Confirmed', 'Cancelled', 'Closed', 'Rejected'].includes(i.status ?? ''));
  const stageCounts = {
    inquiry: reservations.filter(r => r.status === 'Inquiry Received').length + openInquiries.length,
    awaitingSupplier: reservations.filter(r => r.status === 'Awaiting Supplier Confirmation').length,
    supplierConfirmed: reservations.filter(r => r.status === 'Supplier Confirmed').length,
    lpoIssued: reservations.filter(r => r.status === 'Rate Validated').length,
    confirmed: reservations.filter(r => r.status === 'Confirmed').length,
    invoiced: reservations.filter(r => r.status === 'Invoiced').length,
    paid: reservations.filter(r => r.status === 'Paid').length,
    completed: reservations.filter(r => r.status === 'Completed').length,
  };

  const leadSources = [
    { label: 'Price Match', count: inquiries.filter(i => i.inquiryType === 'Price Match').length, color: 'bg-blue-100 text-blue-700' },
    { label: 'Offline Inquiry', count: inquiries.filter(i => i.inquiryType === 'Offline Inquiry').length, color: 'bg-purple-100 text-purple-700' },
    { label: 'Group / MICE', count: inquiries.filter(i => i.inquiryType === 'Group').length, color: 'bg-orange-100 text-orange-700' },
    { label: 'Direct Booking', count: reservations.filter(r => !r.inquiryRef).length, color: 'bg-teal-100 text-teal-700' },
    { label: 'Other', count: inquiries.filter(i => !['Price Match', 'Offline Inquiry', 'Group'].includes(i.inquiryType ?? '')).length, color: 'bg-slate-100 text-slate-600' },
  ].filter(s => s.count > 0);

  const filterCounts: Record<string, number> = { '': reservations.length };
  FILTERS.slice(1).forEach(f => { filterCounts[f.value] = reservations.filter(r => r.status === f.value).length; });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservation Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">DMC Booking Inquiry → LPO → Voucher → Invoice → Payment</p>
        </div>
        <Button onClick={() => { setEditRes(null); setFormOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Reservation
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} color="text-primary" icon={FileText} />
        <StatCard label="Active" value={stats.active} color="text-orange-500" icon={AlertCircle} />
        <StatCard label="Completed" value={stats.completed} color="text-emerald-600" icon={TrendingUp} />
        <StatCard label="Total Profit" value={`AED ${stats.profit.toLocaleString()}`} color="text-emerald-600" icon={TrendingUp} isText />
      </div>

      {/* Pipeline + Lead Source side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 overflow-x-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">DMC Workflow Pipeline</p>
          <div className="flex items-center gap-1 min-w-max">
            {[
              { label: 'New Inquiry', count: stageCounts.inquiry, color: 'bg-slate-100 text-slate-700 border-slate-200', sub: openInquiries.length > 0 ? `${openInquiries.length} offline` : undefined },
              { label: 'Awaiting Supplier', count: stageCounts.awaitingSupplier, color: 'bg-orange-100 text-orange-700 border-orange-200' },
              { label: 'Supplier Confirmed', count: stageCounts.supplierConfirmed, color: 'bg-purple-100 text-purple-700 border-purple-200' },
              { label: 'LPO Issued', count: stageCounts.lpoIssued, color: 'bg-amber-100 text-amber-700 border-amber-200' },
              { label: 'Confirmed', count: stageCounts.confirmed, color: 'bg-teal-100 text-teal-700 border-teal-200' },
              { label: 'Invoice Raised', count: stageCounts.invoiced, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
              { label: 'Paid', count: stageCounts.paid, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
              { label: 'Completed', count: stageCounts.completed, color: 'bg-green-100 text-green-700 border-green-200' },
            ].map((stage, i, arr) => (
              <div key={stage.label} className="flex items-center gap-1">
                <div className={`rounded-lg border px-3 py-2 text-center min-w-[80px] ${stage.color}`}>
                  <p className="text-lg font-black">{stage.count}</p>
                  <p className="text-[9px] font-semibold leading-tight">{stage.label}</p>
                  {'sub' in stage && stage.sub && <p className="text-[8px] opacity-70 mt-0.5">{stage.sub}</p>}
                </div>
                {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {leadSources.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead Source</p>
            </div>
            <div className="space-y-2">
              {leadSources.map(src => (
                <div key={src.label} className={`flex items-center justify-between px-3 py-2 rounded-lg ${src.color}`}>
                  <span className="text-xs font-semibold">{src.label}</span>
                  <span className="text-base font-black">{src.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search + Filter tabs */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search hotel, agent, ref..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                filter === f.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {f.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === f.value ? 'bg-white/20' : 'bg-muted'}`}>
                {filterCounts[f.value] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No reservations found</p>
          <p className="text-sm">Create a new reservation to get started</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                {['Ref', 'Hotel / Destination', 'Agent', 'Status', 'LPO', 'Actions', 'Documents'].map(h => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                  {/* Ref — clickable popup */}
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setQuickView(r)}
                      className="text-left group"
                    >
                      <p className="font-mono text-xs font-bold text-primary group-hover:underline underline-offset-2">{r.reservationRef ?? '—'}</p>
                      {r.inquiryRef && <p className="text-[10px] text-muted-foreground">{r.inquiryRef}</p>}
                    </button>
                  </td>

                  {/* Hotel */}
                  <td className="py-3 px-4 max-w-[200px]">
                    <p className="font-semibold text-sm truncate">{r.hotelName ?? '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.destination ?? ''}</p>
                  </td>

                  {/* Agent */}
                  <td className="py-3 px-4 max-w-[140px]">
                    <p className="text-xs font-medium truncate">{r.agentName ?? '—'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.agentCompany ?? ''}</p>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border whitespace-nowrap ${STATUS_COLORS[r.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
                      {r.status ?? '—'}
                    </span>
                  </td>

                  {/* LPO */}
                  <td className="py-3 px-4">
                    {r.lpoNumber ? (
                      <div className="space-y-0.5">
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] px-1.5">Sent</Badge>
                        <p className="text-[10px] font-mono text-muted-foreground">{r.lpoNumber}</p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex gap-1 items-center">
                      <Link to={`/reservations/${r.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                      </Link>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditRes(r); setFormOpen(true); }}>Edit</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-orange-200 text-orange-700" onClick={() => setLpoRes(r)}>
                        <FileText className="w-3 h-3" /> LPO
                      </Button>
                    </div>
                  </td>

                  {/* Documents — Invoice & Voucher tabs */}
                  <td className="py-3 px-4">
                    <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs">
                      <button
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border-r border-border font-semibold whitespace-nowrap"
                        onClick={() => {
                          const nights = r.checkinDate && r.checkoutDate
                            ? Math.round((new Date(r.checkoutDate).getTime() - new Date(r.checkinDate).getTime()) / 86400000)
                            : 0;
                          const subtotal = r.sellingRateAed ?? 0;
                          printDocument(buildInvoiceHtml({
                            invoiceNumber: `INV-${r.reservationRef?.replace('RES-', '') ?? Date.now()}`,
                            reservationRef: r.reservationRef ?? '—',
                            hotelName: r.hotelName ?? undefined,
                            destination: r.destination ?? undefined,
                            roomType: r.roomType ?? undefined,
                            boardBasis: r.boardBasis ?? undefined,
                            checkinDate: r.checkinDate ?? undefined,
                            checkoutDate: r.checkoutDate ?? undefined,
                            nights,
                            rooms: r.rooms,
                            adults: r.adults,
                            children: r.children,
                            agentName: r.agentName ?? undefined,
                            agentCompany: r.agentCompany ?? undefined,
                            subtotal,
                            vat: Math.round(subtotal * 0.05),
                            total: subtotal + Math.round(subtotal * 0.05),
                          }), `Invoice — ${r.reservationRef}`);
                        }}
                      >
                        <FileText className="w-3 h-3" /> Invoice
                      </button>
                      <button
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors font-semibold whitespace-nowrap"
                        onClick={() => {
                          const nights = r.checkinDate && r.checkoutDate
                            ? Math.round((new Date(r.checkoutDate).getTime() - new Date(r.checkinDate).getTime()) / 86400000)
                            : 0;
                          printDocument(buildVoucherHtml({
                            bookingRef: r.reservationRef ?? '—',
                            status: r.status ?? 'Confirmed',
                            hotelName: r.hotelName ?? '—',
                            destination: r.destination ?? undefined,
                            roomType: r.roomType ?? undefined,
                            boardBasis: r.boardBasis ?? undefined,
                            checkinDate: r.checkinDate ?? undefined,
                            checkoutDate: r.checkoutDate ?? undefined,
                            nights,
                            rooms: r.rooms,
                            adults: r.adults,
                            children: r.children,
                            guestName: r.agentName ?? undefined,
                            agentCompany: r.agentCompany ?? undefined,
                            sellingRateAed: r.sellingRateAed,
                          }), `Voucher — ${r.reservationRef}`);
                        }}
                      >
                        <FileText className="w-3 h-3" /> Voucher
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReservationFormDialog open={formOpen} reservation={editRes} onClose={() => { setFormOpen(false); setEditRes(null); }} onSave={handleSave} saving={saving} />
      {lpoRes && <LpoFormDialog open={!!lpoRes} reservation={lpoRes} onClose={() => setLpoRes(null)} onRefresh={load} />}
      <ReservationQuickView reservation={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon, isText }: { label: string; value: string | number; color: string; icon: any; isText?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`w-4 h-4 ${color} opacity-60`} />
      </div>
      <p className={`${isText ? 'text-lg' : 'text-2xl'} font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
