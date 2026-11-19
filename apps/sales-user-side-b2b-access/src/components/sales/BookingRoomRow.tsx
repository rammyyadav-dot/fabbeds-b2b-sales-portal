import type { ReactNode } from 'react';
import { Users, CheckCircle2, XCircle, Coffee, Utensils, BedDouble, AlertTriangle } from 'lucide-react';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';

const STATUS_CFG = {
  'Free Sale':  { bg: 'bg-white', border: 'border-border', dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Free Sale' },
  'Limited':    { bg: 'bg-amber-50/50', border: 'border-amber-100', dot: 'bg-amber-500', text: 'text-amber-700', label: 'Limited' },
  'On Request': { bg: 'bg-sky-50/50', border: 'border-sky-100', dot: 'bg-sky-500', text: 'text-sky-700', label: 'On Request' },
  'Stop Sale':  { bg: 'bg-red-50/40', border: 'border-red-100', dot: 'bg-red-500', text: 'text-red-700', label: 'Stop Sale' },
  'No Data':    { bg: 'bg-muted/20', border: 'border-border', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground', label: 'No Data' },
} as const;

const MEAL_ICONS: Record<string, ReactNode> = {
  'Bed & Breakfast': <Coffee className="w-3 h-3" />,
  'Half Board':      <Utensils className="w-3 h-3" />,
  'Full Board':      <Utensils className="w-3 h-3" />,
  'All Inclusive':   <Utensils className="w-3 h-3" />,
  'Room Only':       <BedDouble className="w-3 h-3" />,
};

interface Props {
  name: string;
  mealPlan: string;
  beddingType?: string;
  maxOccStr: string;
  minRate: number | null;
  maxRate: number | null;
  stayTotal?: number | null;
  dominantStatus: string;
  nights: number;
  rooms: number;           // rooms from search (used for default total price)
  adultsPerRoom: number;
  childrenPerRoom: number;
  quantity: number;        // user-selected room quantity (0 = not selected)
  occupancyWarning?: string | null;
  onQuantityChange: (qty: number) => void;
  onReserve?: (qty: number) => void;
}

export default function BookingRoomRow({
  name, mealPlan, beddingType, adultsPerRoom, childrenPerRoom, rooms,
  minRate, maxRate, stayTotal, dominantStatus, nights, quantity, occupancyWarning,
  onQuantityChange, onReserve,
}: Props) {
  const cfg = STATUS_CFG[dominantStatus as keyof typeof STATUS_CFG] ?? STATUS_CFG['No Data'];
  const isStopSale = dominantStatus === 'Stop Sale';
  const isOnRequest = dominantStatus === 'On Request';
  const ratePerNight = typeof minRate === 'number' ? minRate : 0;
  const hasDates = nights > 0;

  // Price per room per night (the unit rate)
  const unitRate = ratePerNight;

  // Default total = rate × rooms (from search) × nights
  const defaultTotal = unitRate > 0
    ? (hasDates ? (stayTotal ?? 0) * rooms : unitRate * rooms)
    : 0;

  // Selected total = rate × quantity (user-selected) × nights
  const selectedTotal = quantity > 0
    ? (hasDates ? (stayTotal ?? 0) * quantity : unitRate * quantity)
    : null;

  // Show selected total only when it differs from the default
  const showSelectedOverride = selectedTotal !== null && selectedTotal !== defaultTotal;

  return (
    <div className={`grid grid-cols-12 border-b border-border last:border-0 ${cfg.bg} hover:bg-primary/5 transition-colors`}>

      {/* Room Type */}
      <div className="col-span-4 px-4 py-4 border-r border-border/40">
        <p className="text-sm font-bold text-primary leading-tight">{name}</p>
        {beddingType && <p className="text-xs text-muted-foreground mt-0.5">{beddingType}</p>}
        <div className="flex items-center gap-1 mt-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 font-medium">
            {MEAL_ICONS[mealPlan] ?? <BedDouble className="w-3 h-3" />}
            {mealPlan}
          </span>
        </div>
        <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">
          {adultsPerRoom} adult{adultsPerRoom !== 1 ? 's' : ''}{childrenPerRoom > 0 ? ` + ${childrenPerRoom} child${childrenPerRoom !== 1 ? 'ren' : ''}` : ''} / room
        </p>
        {occupancyWarning && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-medium">
            <AlertTriangle className="w-3 h-3 shrink-0" /> {occupancyWarning}
          </div>
        )}
      </div>

      {/* Number of guests */}
      <div className="col-span-1 px-2 py-4 border-r border-border/40 flex flex-col items-center justify-center gap-1">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: Math.min(adultsPerRoom, 4) }).map((_, i) => (
            <Users key={i} className="w-3.5 h-3.5 text-muted-foreground" />
          ))}
        </div>
        {childrenPerRoom > 0 && (
          <span className="text-[10px] text-muted-foreground">+{childrenPerRoom} child</span>
        )}
      </div>

      {/* Price column — total for searched rooms × nights */}
      <div className="col-span-2 px-3 py-4 border-r border-border/40 flex flex-col items-center justify-center text-center">
        {unitRate > 0 ? (
          <>
            <p className="text-xl font-extrabold text-foreground leading-tight">
              AED {defaultTotal.toLocaleString()}
            </p>
            {hasDates && (
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                AED {unitRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}/room/night average<br />
                {rooms} room{rooms !== 1 ? 's' : ''} · {nights} night{nights !== 1 ? 's' : ''}
              </p>
            )}
            {!hasDates && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                AED {unitRate.toLocaleString()}/room/night
              </p>
            )}
            {showSelectedOverride && (
              <p className="text-[11px] font-bold text-primary mt-1">
                {quantity} rooms = AED {selectedTotal!.toLocaleString()}
              </p>
            )}
          </>
        ) : isStopSale ? (
          <span className="text-red-500 text-xs font-semibold">Unavailable</span>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </div>

      {/* Your choices */}
      <div className="col-span-3 px-4 py-4 border-r border-border/40 flex flex-col justify-center gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <Coffee className="w-3 h-3 shrink-0 text-amber-600" />
          <span className="font-medium">{mealPlan}</span>
        </div>
        {isStopSale ? (
          <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <XCircle className="w-3 h-3 shrink-0" /> Stop Sale — not available
          </div>
        ) : isOnRequest ? (
          <div className="flex items-center gap-1.5 text-xs text-sky-700 font-medium">
            <CheckCircle2 className="w-3 h-3 shrink-0 text-sky-500" /> On Request
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500" /> FabBeds Exclusive Deals
          </div>
        )}
        <Badge variant="outline" className={`self-start text-[10px] px-2 py-0 border ${cfg.border} ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1`} />
          {cfg.label}
        </Badge>
      </div>

      {/* Select rooms */}
      <div className="col-span-1 px-2 py-4 border-r border-border/40 flex items-center justify-center">
        {!isStopSale && unitRate > 0 ? (
          <Select value={String(quantity)} onValueChange={(v) => onQuantityChange(parseInt(v, 10))}>
            <SelectTrigger className="w-16 h-8 text-sm font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <SelectItem key={n} value={String(n)}>{n === 0 ? '0' : String(n)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">—</span>
        )}
      </div>

      {/* Reserve button */}
      <div className="col-span-1 px-2 py-4 flex items-center justify-center">
        {!isStopSale && unitRate > 0 ? (
          <Button
            size="sm"
            className="text-xs px-3 py-1.5 h-auto whitespace-nowrap"
            disabled={quantity === 0}
            onClick={() => quantity > 0 && onReserve?.(quantity)}
          >
            I'll reserve
          </Button>
        ) : null}
      </div>
    </div>
  );
}
