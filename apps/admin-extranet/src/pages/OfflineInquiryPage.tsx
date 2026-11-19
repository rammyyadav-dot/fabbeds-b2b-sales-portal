import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSpecialInquiries, saveSpecialInquiry, GetSpecialInquiriesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Plus, Search, FileQuestion, CalendarDays, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import OfflineInquiryFormDialog from '@/components/OfflineInquiryFormDialog';

type Inquiry = GetSpecialInquiriesOutputType['inquiries'][0];

const STATUS_BADGE: Record<string, string> = {
  'Pending Review': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'In Review': 'bg-blue-100 text-blue-700 border-blue-200',
  'Awaiting Hotel': 'bg-orange-100 text-orange-700 border-orange-200',
  'Quoted': 'bg-purple-100 text-purple-700 border-purple-200',
  'Approved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Rejected': 'bg-red-100 text-red-700 border-red-200',
  'Confirmed': 'bg-green-100 text-green-700 border-green-200',
  'Cancelled': 'bg-gray-100 text-gray-500 border-gray-200',
  'Closed': 'bg-slate-100 text-slate-500 border-slate-200',
};

const QUICK_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'Pending Review' },
  { label: 'In Review', value: 'In Review' },
  { label: 'Quoted', value: 'Quoted' },
  { label: 'Confirmed', value: 'Confirmed' },
];

export default function OfflineInquiryPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editInquiry, setEditInquiry] = useState<Inquiry | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await getSpecialInquiries({}); setInquiries(res.inquiries); }
    catch { toast.error('Failed to load inquiries'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      await saveSpecialInquiry(data);
      toast.success(data.id ? 'Inquiry updated' : 'Inquiry created');
      setFormOpen(false); setEditInquiry(null); load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const filtered = inquiries.filter(i => {
    if (filter && i.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [i.inquiryRef?.toString(), i.hotelName, i.agentName, i.agentCompany, i.destination].some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const stats = {
    total: inquiries.length,
    pending: inquiries.filter(i => ['Pending Review','In Review'].includes(i.status ?? '')).length,
    urgent: inquiries.filter(i => i.urgentWithin72H).length,
    quoted: inquiries.filter(i => i.status === 'Quoted').length,
  };

  const STATS_COLS = [
    { label: 'Total Inquiries', key: 'total' as const, color: 'text-primary' },
    { label: 'Pending / In Review', key: 'pending' as const, color: 'text-orange-500' },
    { label: 'Urgent (72h)', key: 'urgent' as const, color: 'text-red-500' },
    { label: 'Quoted', key: 'quoted' as const, color: 'text-purple-500' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Offline Inquiries</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage offline & price-match requests from agents and clients</p>
        </div>
        <Button onClick={() => { setEditInquiry(null); setFormOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Inquiry
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STATS_COLS.map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{stats[s.key]}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search hotel, agent, ref..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {QUICK_FILTERS.map(f => (
            <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <FileQuestion className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No inquiries found</p>
          <p className="text-sm">Create a new offline inquiry to get started</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 border-b border-border">
              <tr>
                {['Ref','Type','Hotel / Destination','Dates','Pax','Our Rate','Comp. Rate','Agent','Status','Submitted',''].map(h => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inq => (
                <tr key={inq.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {inq.urgentWithin72H && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      <span className="font-mono text-xs font-bold text-primary">{inq.inquiryRef ?? '—'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-xs">{inq.inquiryType ?? '—'}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-foreground">{inq.hotelName ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{inq.destination ?? ''}</p>
                  </td>
                  <td className="py-3 px-4 text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      {inq.checkinDate ?? '—'} → {inq.checkoutDate ?? '—'}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-center">
                    <div>{inq.rooms ?? '—'} rm</div>
                    <div className="text-muted-foreground">{inq.adults ?? 0}A {inq.children ? `${inq.children}C` : ''}</div>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono font-semibold text-emerald-600">
                    {inq.ourRateAed != null ? `AED ${inq.ourRateAed.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                    {inq.competitorPriceAed != null ? `AED ${inq.competitorPriceAed.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-xs font-medium">{inq.agentName ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{inq.agentCompany ?? ''}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_BADGE[inq.status ?? ''] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {inq.status ?? '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                    {inq.submittedAt ? (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(inq.submittedAt), { addSuffix: true })}</span>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <Link to={`/inquiries/${inq.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                      </Link>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditInquiry(inq); setFormOpen(true); }}>Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OfflineInquiryFormDialog open={formOpen} inquiry={editInquiry} onClose={() => { setFormOpen(false); setEditInquiry(null); }} onSave={handleSave} saving={saving} />
    </div>
  );
}
