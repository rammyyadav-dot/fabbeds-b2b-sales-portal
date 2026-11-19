import { Accessibility, BadgeCheck, Clock3, Luggage, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';

interface VehicleCardProps {
  vehicle: {
    id: string;
    name: string;
    models: string;
    maxPax: number;
    maxLuggage: number;
    tier: string;
    wheelchair: boolean;
    imageUrl?: string;
  };
  routeLabel: string;
  price: number;
  midnightSurcharge: number;
  tollsIncluded: boolean;
  waitingGraceMinutes: number;
  isNight: boolean;
  selected: boolean;
  recommended?: boolean;
  onSelect: () => void;
}

const TIER_COLORS: Record<string, string> = {
  Economy: 'bg-slate-100 text-slate-700',
  Standard: 'bg-sky-50 text-sky-700',
  Business: 'bg-emerald-50 text-emerald-700',
  Luxury: 'bg-amber-50 text-amber-700',
  VIP: 'bg-purple-50 text-purple-700',
};

export default function VehicleCard({
  vehicle,
  routeLabel,
  price,
  midnightSurcharge,
  tollsIncluded,
  waitingGraceMinutes,
  isNight,
  selected,
  recommended,
  onSelect,
}: VehicleCardProps) {
  const totalPrice = price + (isNight ? midnightSurcharge : 0);

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg ${selected ? 'border-primary shadow-md' : 'border-border'}`}>
      <div className="flex flex-col md:flex-row">
        <div className="relative h-44 md:h-auto md:w-[230px] bg-muted shrink-0 overflow-hidden">
          {vehicle.imageUrl ? (
            <img src={vehicle.imageUrl} alt={vehicle.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.04]" />
          ) : (
            <div className="w-full h-full min-h-[150px] bg-gradient-to-br from-slate-900 to-slate-600 flex items-center justify-center text-5xl">🚘</div>
          )}
          <div className="absolute left-3 top-3 flex gap-2">
            {recommended && <Badge className="bg-[#D71921] text-white border-0">Recommended</Badge>}
            <Badge variant="secondary" className={`border-0 text-[10px] ${TIER_COLORS[vehicle.tier] || ''}`}>{vehicle.tier}</Badge>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-5">
          <div>
            <h3 className="font-black text-lg text-foreground">{vehicle.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{vehicle.models || 'Private transfer vehicle or similar'}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-2">{routeLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-muted rounded-full px-2.5 py-1">
              <Users className="w-3.5 h-3.5" /> Up to {vehicle.maxPax}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-muted rounded-full px-2.5 py-1">
              <Luggage className="w-3.5 h-3.5" /> {vehicle.maxLuggage} bags
            </span>
            {vehicle.wheelchair && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-muted rounded-full px-2.5 py-1">
                <Accessibility className="w-3.5 h-3.5" /> Accessible
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground">
            {tollsIncluded && <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Tolls included</span>}
            {waitingGraceMinutes > 0 && <span className="inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5 text-sky-600" /> {waitingGraceMinutes} min waiting grace</span>}
            <span className="inline-flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-primary" /> Authoritative recheck before booking</span>
          </div>
        </div>

        <div className="md:w-[210px] border-t md:border-t-0 md:border-l border-border p-4 md:p-5 flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3">
          <div className="text-left md:text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Net from</p>
            <p className="text-2xl font-black text-primary mt-1">AED {totalPrice.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">per private vehicle · one way</p>
            {isNight && midnightSurcharge > 0 && (
              <p className="text-[10px] text-amber-700 mt-1">Includes AED {midnightSurcharge.toFixed(0)} night surcharge</p>
            )}
          </div>
          <Button size="sm" className="min-w-[110px] font-bold" onClick={onSelect}>
            Select
          </Button>
        </div>
      </div>
    </article>
  );
}
