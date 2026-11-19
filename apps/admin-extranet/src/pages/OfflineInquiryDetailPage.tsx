import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getSpecialInquiries, saveSpecialInquiry, saveReservation, GetSpecialInquiriesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Textarea } from '@project/components/ui/textarea';
import { ArrowLeft, CalendarDays, Users, Building2, Send, CheckCircle2, Clock, FileSearch, Star, AlertTriangle, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import OfflineInquiryFormDialog from '@/components/OfflineInquiryFormDialog';

type Inquiry = GetSpecialInquiriesOutputType['inquiries'][0];

const STAGES = [
  { label: 'Pending', status: 'Pending Review', icon: FileSearch },
  { label: 'In Review', status: 'In Review', icon: Clock },
  { label: 'Awaiting Hotel', status: 'Awaiting Hotel', icon: Building2 },
  { label: 'Quoted', status: 'Quoted', icon: Star },
  { label: 'Approved', status: 'Approved', icon: CheckCircle2 },
  { label: 'Confirmed', status: 'Confirmed', icon: CheckCircle2 },
];

const STAGE_ORDER = STAGES.map(s => s.status);

const ALL_STATUSES = ['Pending Review','In Review','Awaiting Hotel','Quoted','Approved','Rejected','Confirmed','Cancelled','Closed'];

const STATUS_BADGE: Record<string, string> = {
  'Pending Review': 'bg-yellow-100 text-yellow-700',
  'In Review': 'bg-blue-100 text-blue-700',
  'Awaiting Hotel': 'bg-orange-100 text-orange-700',
  'Quoted': 'bg-purple-100 text-purple-700',
  'Approved': 'bg-emerald-100 text-emerald-700',
  'Rejected': 'bg-red-100 text-red-700',
  'Confirmed': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-gray-100 text-gray-500',
  'Closed': 'bg-slate-100 text-slate-500',
};

export default function OfflineInquiryDetailPage() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const navigate = useNavigate();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    if (!inquiryId) return;
    setLoading(true);
    try {
      const res = await getSpecialInquiries({});
      const found = res.inquiries.find(i => i.id === inquiryId) ?? null;
      setInquiry(found);
      setAdminNotes(found?.adminNotes ?? '');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [inquiryId]);

  const handleStatusChange = async (status: string) => {
    if (!inquiry) return;
    setSaving(true);
    try {
      await saveSpecialInquiry({ id: inquiry.id, status });
      toast.success('Status updated');
      load();
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleSaveNotes = async () => {
    if (!inquiry) return;
    setSaving(true);
    try {
      await saveSpecialInquiry({ id: inquiry.id, adminNotes });
      toast.success('Notes saved');
    } catch { toast.error('Failed to save notes'); }
    finally { setSaving(false); }
  };

  const handleConvertToReservation = async () => {
    if (!inquiry) return;
    setSaving(true);
    try {
      const result = await saveReservation({
        hotelName: inquiry.hotelName ?? '',
        destination: inquiry.destination ?? '',
        checkinDate: inquiry.checkinDate ?? '',
        checkoutDate: inquiry.checkoutDate ?? '',
        rooms: inquiry.rooms ?? undefined,
        adults: inquiry.adults ?? undefined,
        children: inquiry.children ?? undefined,
        roomType: inquiry.roomType ?? '',
        boardBasis: inquiry.boardBasis ?? inquiry.mealPlan ?? '',
        agentName: inquiry.agentName ?? '',
        agentCompany: inquiry.agentCompany ?? '',
        agentEmail: inquiry.agentEmail ?? '',
        agentWhatsApp: inquiry.agentWhatsApp ?? '',
        sellingRateAed: inquiry.ourRateAed ?? undefined,
        inquiryRef: inquiry.inquiryRef?.toString() ?? '',
        status: 'Inquiry Received',
      });
      await saveSpecialInquiry({ id: inquiry.id, status: 'Confirmed' });
      toast.success('Converted to reservation!');
      navigate(`/reservations/${result.id}`);
    } catch { toast.error('Failed to convert'); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async (data: any) => {
    setSaving(true);
    try {
      await saveSpecialInquiry(data);
      toast.success('Inquiry updated');
      setFormOpen(false);
      load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!inquiry) return <div className="p-6 text-center text-muted-foreground">Inquiry not found. <Link to="/inquiries" className="text-primary underline">Back</Link></div>;

  const currentIdx = STAGE_ORDER.indexOf(inquiry.status ?? '');
  const diff = inquiry.ourRateAed != null && inquiry.competitorPriceAed != null
    ? inquiry.ourRateAed - inquiry.competitorPriceAed : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/inquiries"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold">{inquiry.hotelName ?? 'Unnamed Inquiry'}</h1>
            <Badge className="font-mono text-xs bg-slate-800 text-white">{inquiry.inquiryRef ?? '—'}</Badge>
            {inquiry.urgentWithin72H && <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-xs"><AlertTriangle className="w-3 h-3" />Urgent</Badge>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[inquiry.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>{inquiry.status}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{inquiry.agentName}{inquiry.agentCompany ? ` · ${inquiry.agentCompany}` : ''}{inquiry.destination ? ` · ${inquiry.destination}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>Edit</Button>
          <Select value={inquiry.status ?? ''} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ALL_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Pipeline */}
      <div className="flex items-center overflow-x-auto rounded-xl border border-border bg-card p-4 gap-0">
        {STAGES.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.label} className="flex items-center flex-1 min-w-0">
              <div className={`flex flex-col items-center flex-1 min-w-0 transition-opacity ${active ? 'opacity-100' : done ? 'opacity-70' : 'opacity-30'}`}>
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
          {/* Stay Details */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Inquiry Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: CalendarDays, label: 'Check-in', value: inquiry.checkinDate ?? '—' },
                { icon: CalendarDays, label: 'Check-out', value: inquiry.checkoutDate ?? '—' },
                { icon: Building2, label: 'Rooms', value: inquiry.rooms?.toString() ?? '—' },
                { icon: Users, label: 'Adults', value: inquiry.adults?.toString() ?? '—' },
                { icon: Users, label: 'Children', value: inquiry.children?.toString() ?? '—' },
                { icon: Star, label: 'Star Pref.', value: inquiry.starPreference ?? '—' },
              ].map(item => (
                <div key={item.label} className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><item.icon className="w-3.5 h-3.5" />{item.label}</div>
                  <p className="text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
              {inquiry.roomType && <Badge variant="outline" className="text-xs">🛏 {inquiry.roomType}</Badge>}
              {inquiry.boardBasis && <Badge variant="outline" className="text-xs">🍽 {inquiry.boardBasis}</Badge>}
              {inquiry.mealPlan && <Badge variant="outline" className="text-xs">📋 {inquiry.mealPlan}</Badge>}
              {inquiry.budgetRange && <Badge variant="secondary" className="text-xs">💰 {inquiry.budgetRange}</Badge>}
            </div>
            {inquiry.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Client Notes</p>
                <p className="text-sm">{inquiry.notes}</p>
              </div>
            )}
          </div>

          {/* Agent Info */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-3">Agent Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{inquiry.agentName ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Company</p><p className="font-medium">{inquiry.agentCompany ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium text-primary">{inquiry.agentEmail ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">WhatsApp</p><p className="font-medium">{inquiry.agentWhatsApp ?? '—'}</p></div>
            </div>
          </div>

          {/* Email Templates */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm">Email Templates</h3>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Acknowledgement (to Agent)</p>
              <p className="text-xs text-blue-800 font-mono">Subject: Inquiry Received – {inquiry.inquiryRef}</p>
              <p className="text-xs text-blue-600 mt-1">"Thank you for your inquiry. We are reviewing your request and will revert shortly. Reference: {inquiry.inquiryRef}."</p>
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-blue-300 text-blue-700"><Send className="w-3 h-3 mr-1" />Copy & Send</Button>
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
              <p className="text-xs font-semibold text-purple-700 mb-1">Quote Response Template</p>
              <p className="text-xs text-purple-800 font-mono">Subject: Quote – {inquiry.inquiryRef} | {inquiry.hotelName ?? 'Hotel'} | {inquiry.checkinDate ?? 'TBD'}</p>
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-purple-300 text-purple-700"><Send className="w-3 h-3 mr-1" />Copy & Send</Button>
            </div>
          </div>

          {/* Admin Notes */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm">Admin Notes</h3>
            <Textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes, follow-up actions..." />
            <Button size="sm" onClick={handleSaveNotes} disabled={saving}>Save Notes</Button>
          </div>
        </div>

        {/* Right: Pricing & Actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-semibold text-sm">Rate Comparison</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Our Rate</span>
                <span className="text-sm font-bold text-emerald-600">{inquiry.ourRateAed != null ? `AED ${inquiry.ourRateAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Competitor Rate</span>
                <span className="text-sm font-bold text-foreground">{inquiry.competitorPriceAed != null ? `AED ${inquiry.competitorPriceAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
              {diff != null && (
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Difference</span>
                  <span className={`text-sm font-bold ${diff <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {diff <= 0 ? '✓ We are cheaper' : `+AED ${diff.toFixed(2)} higher`}
                  </span>
                </div>
              )}
              {inquiry.competitorSourceUrl && (
                <a href={inquiry.competitorSourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline block truncate">
                  View competitor source ↗
                </a>
              )}
            </div>
            {inquiry.submittedAt && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="text-sm font-medium">{format(new Date(inquiry.submittedAt), 'dd MMM yyyy HH:mm')}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-gradient-to-br from-violet-50 to-indigo-50 p-5 space-y-2">
            <h3 className="font-semibold text-sm text-violet-800">Quick Actions</h3>
            <Button size="sm" className="w-full justify-start text-xs gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving} onClick={handleConvertToReservation}>
              <ClipboardList className="w-3.5 h-3.5" /> Convert to Reservation
            </Button>
            {[
              { label: 'Request More Info', variant: 'outline' as const },
              { label: 'Send Quote to Agent', variant: 'default' as const },
              { label: 'Escalate to Manager', variant: 'outline' as const },
              { label: 'Mark as Confirmed', variant: 'outline' as const },
            ].map(a => (
              <Button key={a.label} size="sm" variant={a.variant} className="w-full justify-start text-xs gap-2">{a.label}</Button>
            ))}
          </div>
        </div>
      </div>

      <OfflineInquiryFormDialog open={formOpen} inquiry={inquiry} onClose={() => setFormOpen(false)} onSave={handleSaveEdit} saving={saving} />
    </div>
  );
}
