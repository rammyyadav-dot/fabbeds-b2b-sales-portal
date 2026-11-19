import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { Button } from '@project/components/ui/button';

export interface CellData {
  ratePlanId: string;
  ratePlanName: string;
  mealPlan: string;
  displayRate: number;
  netRate: number;
  status: string;
  rateType: string;
  allocation: number | null;
  occupancyNote: string;
  markupLabel: string;
  cancellationSummary: string;
  adult1Sell: number;
  adult2Sell: number;
  adult3Sell: number;
  childSell: number;
  childSupplement: number;
  extraBedRate: number;
  eventSupplement?: number;
  eventNames?: string[];
  isBest?: boolean;
  isRateChange?: boolean;
  rateChangeFrom?: number;
  date?: string;
  roomTypeName?: string;
}

interface Props {
  data: CellData | null;
  isSelected?: boolean;
  isCheckIn?: boolean;
  isCheckOut?: boolean;
  onClick?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'Free Sale':  { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', dot: 'text-emerald-500' },
  'Limited':    { bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-800',   dot: 'text-amber-500' },
  'On Request': { bg: 'bg-sky-50',     border: 'border-sky-300',     text: 'text-sky-800',     dot: 'text-sky-500' },
  'Stop Sale':  { bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-700',     dot: 'text-red-500' },
};

function availLine(data: CellData) {
  if (data.status === 'Stop Sale') return 'Closed';
  if (data.allocation !== null && data.allocation <= 5) return `${data.allocation} left`;
  if (data.status === 'On Request') return 'Request';
  if (data.allocation !== null) return `${data.allocation} left`;
  return '';
}

export default function UserTariffCalendarCell({ data, isSelected, isCheckIn, isCheckOut, onClick }: Props) {
  if (!data) {
    return <div className="h-[76px] bg-muted/20 border border-border/30" />;
  }

  const cfg = STATUS_COLORS[data.status] ?? STATUS_COLORS['Free Sale'];
  const isStopSale = data.status === 'Stop Sale';
  const avail = availLine(data);
  const mealShort = data.mealPlan === 'Bed & Breakfast' ? 'BB' :
    data.mealPlan === 'Half Board' ? 'HB' :
    data.mealPlan === 'Full Board' ? 'FB' :
    data.mealPlan === 'All Inclusive' ? 'AI' :
    data.mealPlan === 'Room Only' ? 'RO' : data.mealPlan.slice(0, 2).toUpperCase();

  const cellContent = (
    <div
      className={`h-[76px] border relative flex flex-col cursor-pointer transition-all
        ${cfg.bg} ${cfg.border}
        ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
        ${isCheckIn ? 'ring-2 ring-primary bg-primary/10' : ''}
        ${isCheckOut ? 'ring-2 ring-primary/60 bg-primary/5' : ''}
        ${isStopSale ? 'cursor-not-allowed opacity-50' : 'hover:brightness-95 active:scale-[0.97]'}`}
      onClick={!isStopSale ? onClick : undefined}
    >
      {isStopSale ? (
        <div className="flex flex-col items-center justify-center h-full gap-0.5">
          <span className="text-red-500 font-black text-sm">—</span>
          <span className="text-[8px] text-red-400 font-bold uppercase">Closed</span>
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-1 pt-1">
            <div className={`text-[12px] font-bold leading-none ${cfg.text}`}>
              {data.isBest ? '★ ' : ''}{data.displayRate.toLocaleString()}
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{mealShort}</div>
          </div>
          <div className="px-1 pb-1 text-center">
            {data.isRateChange ? (
              <span className="text-[8px] font-semibold text-foreground">↑ Rate change</span>
            ) : avail ? (
              <span className={`text-[8px] ${data.isBest ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {avail}{data.isBest ? ' · Best' : ''}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );

  if (isStopSale) return cellContent;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {cellContent}
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-3 space-y-2 z-50">
        <p className="text-xs font-bold text-foreground">
          {data.date ? new Date(data.date + 'T00:00:00').toLocaleDateString('en-AE', { day: '2-digit', month: 'short' }).toUpperCase() : ''} · {data.roomTypeName || ''}
        </p>
        <p className="text-[11px] text-muted-foreground">{data.ratePlanName} · {data.mealPlan}</p>
        <div className="border-t border-border pt-2 space-y-1 text-[11px]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">SGL</span>
              <span className="font-semibold">{data.adult1Sell > 0 ? `AED ${data.adult1Sell.toLocaleString()}` : '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">DBL</span>
              <span className="font-semibold">{data.adult2Sell > 0 ? `AED ${data.adult2Sell.toLocaleString()}` : '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">TPL</span>
              <span className="font-semibold">{data.adult3Sell > 0 ? `AED ${data.adult3Sell.toLocaleString()}` : '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">CNB</span>
              <span className="font-semibold">{data.childSell > 0 ? `AED ${data.childSell.toLocaleString()}` : '—'}</span>
            </div>
          </div>
          <div className="flex justify-between border-t border-border/60 pt-1">
            <span className="text-muted-foreground">Selected occupancy rate</span>
            <span className="font-semibold">AED {data.displayRate.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Room allocation</span>
            <span className="font-semibold">{data.allocation !== null ? `${data.allocation} room${data.allocation === 1 ? '' : 's'}` : 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Availability</span>
            <span className="font-semibold">{data.status}</span>
          </div>
          {data.eventSupplement && data.eventSupplement > 0 ? (
            <div className="rounded-md border border-violet-200 bg-violet-50 p-2 my-1">
              <div className="flex justify-between gap-2">
                <span className="text-violet-700">Event supplement</span>
                <span className="font-semibold text-violet-900">AED {data.eventSupplement.toLocaleString()}</span>
              </div>
              {data.eventNames && data.eventNames.length > 0 && (
                <p className="text-[10px] text-violet-700 mt-1">{data.eventNames.join(' · ')}</p>
              )}
            </div>
          ) : null}
          {data.cancellationSummary && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cancellation</span>
              <span className="font-semibold">{data.cancellationSummary}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Occupancy</span>
            <span className="font-semibold">{data.occupancyNote}</span>
          </div>
        </div>
        <Button size="sm" className="w-full text-xs" onClick={onClick}>
          Select
        </Button>
      </PopoverContent>
    </Popover>
  );
}
