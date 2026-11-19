import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGroupLeads, saveGroupLead, getSupplierResponses, saveSupplierResponse, GetGroupLeadsOutputType, GetSupplierResponsesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { ArrowLeft, Building2, Users, CalendarDays, Wallet, Clock, CheckCircle2, Send, FileText, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import SupplierResponseGrid from '@/components/SupplierResponseGrid';

type Lead = GetGroupLeadsOutputType['leads'][0];
type SupplierResponse = GetSupplierResponsesOutputType['responses'][0];

const STAGES = [
  { label: 'New Lead', status: 'New Group Lead', icon: FileText, color: 'text-blue-500' },
  { label: 'Qualified', status: 'Qualified', icon: CheckCircle2, color: 'text-green-500' },
  { label: 'Sourcing', status: 'Sent to Suppliers', icon: Send, color: 'text-orange-500' },
  { label: 'Proposal', status: 'Proposal Ready', icon: FileText, color: 'text-purple-500' },
  { label: 'Confirmed', status: 'Confirmed', icon: CheckCircle2, color: 'text-emerald-500' },
  { label: 'Invoiced', status: 'Invoiced', icon: Banknote, color: 'text-cyan-500' },
];

const STATUS_BADGE: Record<string, string> = {
  'New Group Lead': 'bg-blue-100 text-blue-700',
  'Qualified': 'bg-green-100 text-green-700',
  'Need Info': 'bg-yellow-100 text-yellow-700',
  'Sent to Suppliers': 'bg-orange-100 text-orange-700',
  'Proposal Ready': 'bg-purple-100 text-purple-700',
  'Option Selected': 'bg-teal-100 text-teal-700',
  'Pending Confirmation': 'bg-indigo-100 text-indigo-700',
  'Confirmed': 'bg-emerald-100 text-emerald-700',
  'Invoiced': 'bg-cyan-100 text-cyan-700',
  'Cancelled': 'bg-red-100 text-red-700',
};

const ALL_STATUSES = ['New Group Lead','Qualified','Need Info','Sent to Suppliers','Proposal Ready','Option Selected','Pending Confirmation','Confirmed','Invoiced','Cancelled'];

export default function GroupLeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [responses, setResponses] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const [leadsRes, respRes] = await Promise.all([
        getGroupLeads({}),
        getSupplierResponses({ leadId }),
      ]);
      setLead(leadsRes.leads.find(l => l.id === leadId) ?? null);
      setResponses(respRes.responses);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [leadId]);

  const handleStatusChange = async (status: string) => {
    if (!lead) return;
    setSaving(true);
    try {
      await saveGroupLead({ id: lead.id, companyName: lead.companyName!, contactName: lead.contactName!, status });
      toast.success('Status updated');
      load();
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleSaveSupplier = async (data: any) => {
    setSaving(true);
    try { await saveSupplierResponse(data); toast.success('Saved'); load(); }
    catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!lead) return <div className="p-6 text-center text-muted-foreground">Lead not found. <Link to="/mice" className="text-primary underline">Back to MICE</Link></div>;

  const margin = lead.sellingPrice && lead.netCost ? lead.sellingPrice - lead.netCost : null;
  const sla = lead.slaDeadline ? new Date(lead.slaDeadline) : null;
  const slaExpired = sla ? sla < new Date() : false;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/mice"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold">{lead.companyName}</h1>
            <Badge className="font-mono text-xs bg-slate-800 text-white">{lead.leadId}</Badge>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[lead.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>{lead.status}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{lead.contactName}{lead.city ? ` · ${lead.city}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={lead.status ?? ''} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ALL_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Pipeline Progress */}
      <div className="flex items-center gap-0 overflow-x-auto rounded-xl border border-border bg-white p-4">
        {STAGES.map((s, i) => {
          const stageStatuses = ['New Group Lead','Qualified','Sent to Suppliers','Proposal Ready','Confirmed','Invoiced'];
          const currentIdx = stageStatuses.indexOf(lead.status ?? '');
          const stageIdx = stageStatuses.indexOf(s.status);
          const done = stageIdx < currentIdx;
          const active = stageIdx === currentIdx;
          return (
            <div key={s.label} className="flex items-center flex-1 min-w-0">
              <div className={`flex flex-col items-center flex-1 min-w-0 ${active ? 'opacity-100' : done ? 'opacity-70' : 'opacity-30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${active ? 'bg-primary text-primary-foreground' : done ? 'bg-emerald-500 text-white' : 'bg-muted'}`}>
                  <s.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium mt-1 text-center">{s.label}</span>
              </div>
              {i < STAGES.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${done || active ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Key Info */}
          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="font-semibold text-sm mb-4">Lead Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: CalendarDays, label: 'Check-in', value: lead.checkinDate ?? '—' },
                { icon: CalendarDays, label: 'Check-out', value: lead.checkoutDate ?? '—' },
                { icon: Building2, label: 'Rooms', value: lead.roomsRequired?.toString() ?? '—' },
                { icon: Users, label: 'Delegates', value: lead.delegates?.toString() ?? '—' },
                { icon: Wallet, label: 'Budget', value: lead.budget ? `AED ${lead.budget.toLocaleString()}` : '—' },
                { icon: Clock, label: 'SLA', value: sla ? format(sla, 'dd MMM HH:mm') : '—' },
              ].map(item => (
                <div key={item.label} className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <item.icon className="w-3.5 h-3.5" />{item.label}
                  </div>
                  <p className={`text-sm font-semibold ${item.label === 'SLA' && slaExpired ? 'text-red-500' : 'text-foreground'}`}>{item.value}</p>
                </div>
              ))}
            </div>
            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm text-foreground">{lead.notes}</p>
              </div>
            )}
            <div className="flex gap-3 mt-4 pt-4 border-t border-border">
              {lead.meetingSpaceRequired && <Badge variant="outline" className="text-xs">🏛 Meeting Space</Badge>}
              {lead.flexDates && <Badge variant="outline" className="text-xs">📅 Flex Dates</Badge>}
              {lead.assignedAgent && <Badge variant="secondary" className="text-xs">👤 {lead.assignedAgent}</Badge>}
            </div>
          </div>

          {/* Supplier Responses */}
          <div className="rounded-xl border border-border bg-white p-5">
            <SupplierResponseGrid responses={responses} leadId={lead.id} onSave={handleSaveSupplier} saving={saving} />
          </div>

          {/* Email Templates */}
          <div className="rounded-xl border border-border bg-white p-5 space-y-3">
            <h3 className="font-semibold text-sm">Email Templates</h3>
            <div className="space-y-2">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">Auto Acknowledgement (to Requester)</p>
                <p className="text-xs text-blue-800 font-mono">Subject: Group/MICE Request Received – {lead.leadId}</p>
                <p className="text-xs text-blue-600 mt-1">
                  "Thanks for your request. Our Group Desk is preparing offers. Reference: {lead.leadId}. If you have a rooming list or agenda, reply to this email."
                </p>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-blue-300 text-blue-700">
                  <Send className="w-3 h-3 mr-1" />Copy & Send
                </Button>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                <p className="text-xs font-semibold text-orange-700 mb-1">Supplier RFQ Template</p>
                <p className="text-xs text-orange-800 font-mono">
                  Subject: RFQ – {lead.leadId} | {lead.checkinDate ?? 'TBD'}-{lead.checkoutDate ?? 'TBD'} | {lead.roomsRequired ?? '?'} Rooms | {lead.delegates ?? '?'} Delegates
                </p>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-orange-300 text-orange-700">
                  <Send className="w-3 h-3 mr-1" />Copy & Send
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Financials */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-5 space-y-4">
            <h3 className="font-semibold text-sm">Financial Summary</h3>
            {[
              { label: 'Selling Price', value: lead.sellingPrice, color: 'text-emerald-600' },
              { label: 'Net Cost', value: lead.netCost, color: 'text-foreground' },
              { label: 'Margin', value: margin, color: margin && margin > 0 ? 'text-emerald-600' : 'text-red-500' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className={`text-sm font-bold ${item.color}`}>
                  {item.value != null ? `AED ${item.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
            ))}
            {lead.bookingReference && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Booking Ref</p>
                <p className="text-sm font-mono font-bold text-primary">{lead.bookingReference}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-gradient-to-br from-violet-50 to-indigo-50 p-5 space-y-2">
            <h3 className="font-semibold text-sm text-violet-800">Quick Actions</h3>
            {[
              { label: 'Request Clarifications', variant: 'outline' as const },
              { label: 'Send Proposal PDF', variant: 'default' as const },
              { label: 'Generate LPO', variant: 'outline' as const },
              { label: 'Create Booking', variant: 'outline' as const },
            ].map(a => (
              <Button key={a.label} size="sm" variant={a.variant} className="w-full justify-start text-xs gap-2">
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
