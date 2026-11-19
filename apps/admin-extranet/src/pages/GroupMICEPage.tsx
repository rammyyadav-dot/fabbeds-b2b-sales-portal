import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGroupLeads, saveGroupLead, GetGroupLeadsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Plus, Search, Users, Building2, CalendarDays, Clock, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import GroupLeadFormDialog from '@/components/GroupLeadFormDialog';

type Lead = GetGroupLeadsOutputType['leads'][0];

const STATUS_BADGE: Record<string, string> = {
  'New Group Lead': 'bg-blue-100 text-blue-700 border-blue-200',
  'Qualified': 'bg-green-100 text-green-700 border-green-200',
  'Need Info': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Sent to Suppliers': 'bg-orange-100 text-orange-700 border-orange-200',
  'Proposal Ready': 'bg-purple-100 text-purple-700 border-purple-200',
  'Option Selected': 'bg-teal-100 text-teal-700 border-teal-200',
  'Pending Confirmation': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Confirmed': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Invoiced': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Cancelled': 'bg-red-100 text-red-700 border-red-200',
};

const QUICK_FILTERS = [
  { label: 'All', value: '' },
  { label: 'New Leads', value: 'New Group Lead' },
  { label: 'Awaiting Supplier', value: 'Sent to Suppliers' },
  { label: 'Proposal Ready', value: 'Proposal Ready' },
  { label: 'Confirmed', value: 'Confirmed' },
];

const STATS_COLS = [
  { label: 'Total Leads', key: 'total', color: 'text-primary' },
  { label: 'Active', key: 'active', color: 'text-orange-500' },
  { label: 'Confirmed', key: 'confirmed', color: 'text-emerald-500' },
  { label: 'High Value (50+ rooms)', key: 'highValue', color: 'text-purple-500' },
];

export default function GroupMICEPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await getGroupLeads({}); setLeads(res.leads); }
    catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      await saveGroupLead(data);
      toast.success(data.id ? 'Lead updated' : 'Lead created');
      setFormOpen(false); setEditLead(null); load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const filtered = leads.filter(l => {
    if (filter && l.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [l.companyName, l.contactName, l.leadId, l.city].some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const stats = {
    total: leads.length,
    active: leads.filter(l => !['Confirmed','Invoiced','Cancelled'].includes(l.status ?? '')).length,
    confirmed: leads.filter(l => l.status === 'Confirmed').length,
    highValue: leads.filter(l => (l.roomsRequired ?? 0) >= 50).length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Groups & MICE</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage group leads, RFQs, proposals and confirmations</p>
        </div>
        <Button onClick={() => { setEditLead(null); setFormOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />New Group Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STATS_COLS.map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{stats[s.key as keyof typeof stats]}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search company, contact, lead ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {QUICK_FILTERS.map(f => (
            <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Lead List */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No leads found</p>
          <p className="text-sm">Create a new Group/MICE lead to get started</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 border-b border-border">
              <tr>
                {['Lead ID','Company','Dates','Rooms','Delegates','Budget','Status','Assigned','SLA','Last Activity',''].map(h => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const sla = l.slaDeadline ? new Date(l.slaDeadline) : null;
                const slaExpired = sla ? sla < new Date() : false;
                return (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-bold text-primary">{l.leadId}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-foreground">{l.companyName}</p>
                      <p className="text-xs text-muted-foreground">{l.contactName}</p>
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CalendarDays className="w-3 h-3" />
                        {l.checkinDate ?? '—'} → {l.checkoutDate ?? '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold">{l.roomsRequired ?? '—'}</td>
                    <td className="py-3 px-4 text-center">{l.delegates ?? '—'}</td>
                    <td className="py-3 px-4 text-xs font-mono">{l.budget ? `AED ${l.budget.toLocaleString()}` : '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_BADGE[l.status ?? ''] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{l.assignedAgent ?? '—'}</td>
                    <td className="py-3 px-4">
                      {sla ? (
                        <span className={`text-xs font-medium ${slaExpired ? 'text-red-500' : 'text-orange-500'}`}>
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          {slaExpired ? 'Expired' : formatDistanceToNow(sla, { addSuffix: true })}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {l.lastActivity ? formatDistanceToNow(new Date(l.lastActivity), { addSuffix: true }) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <Link to={`/mice/${l.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                        </Link>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditLead(l); setFormOpen(true); }}>Edit</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <GroupLeadFormDialog open={formOpen} lead={editLead} onClose={() => { setFormOpen(false); setEditLead(null); }} onSave={handleSave} saving={saving} />
    </div>
  );
}
