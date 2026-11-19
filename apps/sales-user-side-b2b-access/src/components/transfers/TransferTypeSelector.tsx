import { Plane, PlaneLanding, ArrowLeftRight, Route } from 'lucide-react';

const TYPES = [
  { value: 'ARRIVAL', label: 'Airport Arrival', desc: 'Airport → Hotel/Destination', icon: PlaneLanding, color: 'text-emerald-500' },
  { value: 'DEPARTURE', label: 'Airport Departure', desc: 'Hotel/Destination → Airport', icon: Plane, color: 'text-blue-500' },
  { value: 'POINT_TO_POINT', label: 'Point to Point', desc: 'Any location within same city', icon: ArrowLeftRight, color: 'text-amber-500' },
  { value: 'INTERCITY', label: 'Intercity', desc: 'Between different Emirates', icon: Route, color: 'text-purple-500' },
] as const;

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function TransferTypeSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {TYPES.map(t => {
        const Icon = t.icon;
        const active = value === t.value;
        return (
          <button type="button" aria-pressed={active} key={t.value} onClick={() => onChange(t.value)}
            className={`rounded-lg border px-3 py-2.5 flex items-center justify-center gap-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border/60 hover:border-primary/40 bg-white text-foreground'}`}>
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
            <p className="text-xs font-semibold">{t.label}</p>
          </button>
        );
      })}
    </div>
  );
}
