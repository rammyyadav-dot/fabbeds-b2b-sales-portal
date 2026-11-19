import { format } from 'date-fns';
import { ArrowRight, Clock } from 'lucide-react';
import { GetReservationDetailOutputType } from 'zitejs/api';

type Event = GetReservationDetailOutputType['statusEvents'][0];

const STATUS_COLORS: Record<string, string> = {
  'Inquiry Received': 'bg-slate-100 text-slate-700',
  'Rate Validated': 'bg-blue-100 text-blue-700',
  'Awaiting Supplier Confirmation': 'bg-orange-100 text-orange-700',
  'Supplier Confirmed': 'bg-purple-100 text-purple-700',
  'Confirmed': 'bg-teal-100 text-teal-700',
  'Invoiced': 'bg-indigo-100 text-indigo-700',
  'Paid': 'bg-emerald-100 text-emerald-700',
  'Completed': 'bg-green-100 text-green-700',
  'Rate Dispute': 'bg-amber-100 text-amber-700',
  'Cancelled by Agent': 'bg-red-100 text-red-700',
  'Cancelled by Supplier': 'bg-red-100 text-red-700',
  'No Show': 'bg-gray-100 text-gray-600',
};

const fmtDT = (v?: string | null) => {
  try { return v ? format(new Date(v), 'dd MMM yyyy HH:mm') : '—'; } catch { return v ?? '—'; }
};

function StatusBadge({ s }: { s: string | null }) {
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${STATUS_COLORS[s ?? ''] ?? 'bg-muted text-muted-foreground'}`}>{s ?? '—'}</span>;
}

export default function ReservationHistoryPanel({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No status history yet.</p>;
  }
  return (
    <div className="space-y-3">
      {events.map(e => (
        <div key={e.id} className="flex gap-3 items-start">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {e.fromStatus && <><StatusBadge s={e.fromStatus} /><ArrowRight className="w-3 h-3 text-muted-foreground" /></>}
              <StatusBadge s={e.toStatus} />
            </div>
            {e.eventReason && <p className="text-xs text-muted-foreground mt-0.5">{e.eventReason}</p>}
            <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDT(e.createdAt)}{e.createdBy ? ` · ${e.createdBy}` : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
