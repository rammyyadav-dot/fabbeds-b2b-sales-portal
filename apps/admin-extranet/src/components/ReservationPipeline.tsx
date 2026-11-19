import { CheckCircle2, Circle } from 'lucide-react';

const PIPELINE_STAGES = [
  { label: 'Inquiry', status: 'Inquiry Received', color: 'bg-slate-500' },
  { label: 'Rate Validated', status: 'Rate Validated', color: 'bg-blue-500' },
  { label: 'LPO Sent', status: 'Awaiting Supplier Confirmation', color: 'bg-orange-500' },
  { label: 'Supplier Confirmed', status: 'Supplier Confirmed', color: 'bg-purple-500' },
  { label: 'Confirmed', status: 'Confirmed', color: 'bg-teal-500' },
  { label: 'Invoiced', status: 'Invoiced', color: 'bg-indigo-500' },
  { label: 'Paid', status: 'Paid', color: 'bg-emerald-500' },
  { label: 'Completed', status: 'Completed', color: 'bg-green-600' },
];

const TERMINAL_STATUSES = ['Cancelled by Agent', 'Cancelled by Supplier', 'No Show', 'Rate Dispute'];

const TERMINAL_COLORS: Record<string, string> = {
  'Cancelled by Agent':    'bg-red-100 text-red-700 border-red-200',
  'Cancelled by Supplier': 'bg-red-100 text-red-700 border-red-200',
  'No Show':               'bg-gray-100 text-gray-600 border-gray-200',
  'Rate Dispute':          'bg-amber-100 text-amber-700 border-amber-200',
};

interface Props { status: string | null; }

export default function ReservationPipeline({ status }: Props) {
  if (TERMINAL_STATUSES.includes(status ?? '')) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <span className={`text-sm px-3 py-1.5 rounded-full font-bold border ${TERMINAL_COLORS[status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
          ⚠ {status}
        </span>
        <span className="text-xs text-muted-foreground">This reservation has reached a terminal state.</span>
      </div>
    );
  }

  const currentIdx = PIPELINE_STAGES.findIndex(s => s.status === status);

  return (
    <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {PIPELINE_STAGES.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.status} className="flex items-center">
              <div className={`flex flex-col items-center gap-1 ${active ? 'opacity-100' : done ? 'opacity-80' : 'opacity-25'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${active || done ? s.color : 'bg-muted'}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-semibold text-center leading-tight max-w-[60px] ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className={`w-10 h-0.5 mx-1 mb-4 ${i < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
