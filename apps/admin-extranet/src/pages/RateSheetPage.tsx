import { useEffect, useState, useMemo } from 'react';
import { getTariffCalendar, GetTariffCalendarOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@project/components/ui/tooltip';
import { ChevronLeft, ChevronRight, BedDouble, Users, RefreshCw, Info } from 'lucide-react';
import { format, addMonths, parseISO, isToday } from 'date-fns';

type TariffData = GetTariffCalendarOutputType;
type RateData = {
  adult1Rate?: number;
  adult2Rate?: number;
  adult3Rate?: number;
  childSupplement?: number;
  extraBedRate?: number;
  allocation?: number;
  status?: string;
  sellRate2?: number;
  layer?: string;
  source?: string;
  ratePlanId?: string;
};

const LAYER_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  OVERRIDE: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  PROMO:    { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  BASE:     { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  FALLBACK: { bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200' },
};

const AVAIL: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'Free Sale':  { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Limited':    { bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  'On Request': { bg: 'bg-sky-50',      border: 'border-sky-200',     text: 'text-sky-700',     dot: 'bg-sky-400' },
  'Stop Sale':  { bg: 'bg-red-50',      border: 'border-red-200',     text: 'text-red-600',     dot: 'bg-red-500' },
};

function getStatus(r: RateData | undefined): string {
  if (!r) return 'Stop Sale';
  if (r.status === 'Stop Sale' || r.allocation === 0) return 'Stop Sale';
  if (r.status === 'On Request') return 'On Request';
  if (r.status === 'Limited' || (r.allocation != null && r.allocation <= 5)) return 'Limited';
  return 'Free Sale';
}

function RateRow({ label, val }: { label: string; val?: number }) {
  if (val == null) return null;
  return (
    <div className="flex justify-between gap-6 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">AED {Math.round(val).toLocaleString()}</span>
    </div>
  );
}

function TariffCell({ rate, dateLabel }: { rate: RateData | undefined; dateLabel: string }) {
  const status = getStatus(rate);
  const cfg = AVAIL[status];
  const net = rate?.adult2Rate ?? rate?.adult1Rate;
  const alloc = rate?.allocation;
  const hasData = rate != null;
  const isNetSource = rate?.source === 'net';
  const layer = (rate as any)?.layer as string | undefined;

  const inner = (
    <div className={`min-h-[58px] rounded-lg border transition-all cursor-default select-none relative
      ${hasData ? `${cfg.bg} ${cfg.border} hover:shadow-md hover:scale-[1.03]` : 'bg-muted/10 border-border/30'}
      ${isNetSource ? 'border-dashed' : ''}`}>
      <div className="p-1.5 flex flex-col h-full justify-between">
        <span className={`text-[13px] font-bold leading-tight ${hasData ? cfg.text : 'text-muted-foreground/30'}`}>
          {net != null ? Math.round(net).toLocaleString() : '—'}
        </span>
        <div className="flex items-center justify-between mt-1">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasData ? cfg.dot : 'bg-muted/30'}`} />
          <div className="flex items-center gap-1">
            {alloc != null && (
              <span className="text-[9px] font-semibold text-muted-foreground leading-none">{alloc}</span>
            )}
            {isNetSource && (
              <span className="text-[8px] font-bold text-muted-foreground/60 leading-none">S</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (!hasData) return inner;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="top" className="p-3 space-y-1.5 min-w-[180px]" sideOffset={4}>
          <p className="text-xs font-bold text-foreground border-b pb-1 mb-1">{dateLabel}</p>
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{status}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {layer && (() => {
              const ls = LAYER_STYLE[layer] ?? LAYER_STYLE.BASE;
              return (
                <span className={`inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold border ${ls.bg} ${ls.text} ${ls.border}`}>
                  {layer}
                </span>
              );
            })()}
            {isNetSource && (
              <p className="text-[10px] text-muted-foreground italic">Season net rate</p>
            )}
          </div>
          <div className="pt-1 space-y-1">
            <RateRow label="1 Adult (Net)" val={rate.adult1Rate} />
            <RateRow label="2 Adults (Net)" val={rate.adult2Rate} />
            <RateRow label="3 Adults (Net)" val={rate.adult3Rate} />
            <RateRow label="Child Supp." val={rate.childSupplement} />
            <RateRow label="Extra Bed" val={rate.extraBedRate} />
            <RateRow label="Sell (2 Adults)" val={rate.sellRate2} />
          </div>
          {alloc != null && (
            <div className="flex justify-between gap-6 text-[11px] border-t pt-1 mt-1">
              <span className="text-muted-foreground">Allocation</span>
              <span className="font-semibold">{alloc} room{alloc !== 1 ? 's' : ''}</span>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const MEAL: Record<string, string> = { 'Room Only': 'RO', 'Bed & Breakfast': 'BB', 'Half Board': 'HB', 'Full Board': 'FB', 'All Inclusive': 'AI' };

export default function RateSheetPage() {
  const [hotelId, setHotelId] = useState(() => localStorage.getItem('selectedHotelId') ?? '');
  const [tariff, setTariff] = useState<TariffData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);

  // Always start from today; span 2 months ahead
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const twoMonthsAheadStr = format(addMonths(new Date(), 2), 'yyyy-MM-dd');

  // Stay in sync with the main property selector (same-tab + cross-tab)
  useEffect(() => {
    const onHotelChange = () => {
      const id = localStorage.getItem('selectedHotelId') ?? '';
      setHotelId(id);
      setDayOffset(0);
    };
    window.addEventListener('hotelChanged', onHotelChange);
    window.addEventListener('storage', onHotelChange);
    return () => {
      window.removeEventListener('hotelChanged', onHotelChange);
      window.removeEventListener('storage', onHotelChange);
    };
  }, []);

  const load = () => {
    if (!hotelId) return;
    setLoading(true);
    setDayOffset(0);
    getTariffCalendar({ hotelId, startDate: todayStr, endDate: twoMonthsAheadStr })
      .then(setTariff)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [hotelId]);

  const allDates = tariff?.dates ?? [];
  const visibleDates = useMemo(() => allDates.slice(dayOffset, dayOffset + 14), [allDates, dayOffset]);

  return (
    <div className="p-5 space-y-4 max-w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Tariff Calendar</h1>
          <p className="text-xs text-muted-foreground">Room type × rate plan × date — exact published Daily Rates only</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">
            {format(new Date(), 'dd MMM yyyy')} → {format(addMonths(new Date(), 2), 'dd MMM yyyy')}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(AVAIL).map(([label, cfg]) => (
          <span key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />{label}
          </span>
        ))}
        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-1">
          <Info className="w-3 h-3" /> Net rate (2 adults) · Exact Daily Rate only · Hover for full breakdown
        </span>
      </div>

      {/* Day nav */}
      {allDates.length > 14 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={dayOffset === 0} onClick={() => setDayOffset(d => Math.max(0, d - 14))}>
            <ChevronLeft className="w-3 h-3" /> Prev 14 days
          </Button>
          <span className="text-xs text-muted-foreground font-medium">
            {visibleDates[0] && format(parseISO(visibleDates[0]), 'dd MMM')} – {visibleDates[visibleDates.length - 1] && format(parseISO(visibleDates[visibleDates.length - 1]), 'dd MMM')}
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={dayOffset + 14 >= allDates.length} onClick={() => setDayOffset(d => d + 14)}>
            Next 14 days <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}

      {!hotelId ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
          <BedDouble className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No property selected</p>
          <p className="text-sm mt-1">Select a property from the top bar to view the tariff calendar.</p>
        </div>
      ) : loading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : !tariff || tariff.rows.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
          <BedDouble className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No rate data found</p>
          <p className="text-sm mt-1">Use Quick Update to load rates for this hotel.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden overflow-x-auto shadow-sm">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left py-3 px-4 font-semibold text-sm w-52 sticky left-0 bg-muted/40 z-10 border-r border-border">
                  Room Type
                </th>
                {visibleDates.map(d => {
                  const date = parseISO(d);
                  const today = isToday(date);
                  const day = date.getDay();
                  const weekend = day === 5 || day === 6;
                  return (
                    <th key={d} className={`text-center py-2 px-1 min-w-[72px] ${today ? 'bg-primary/10' : weekend ? 'bg-muted/60' : ''}`}>
                      <div className={`text-[10px] font-semibold uppercase tracking-wide ${today ? 'text-primary' : weekend ? 'text-foreground/60' : 'text-muted-foreground'}`}>
                        {format(date, 'EEE')}
                      </div>
                      <div className={`text-lg font-bold leading-tight ${today ? 'text-primary' : 'text-foreground/80'}`}>
                        {format(date, 'dd')}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {tariff.rows.map((row, i) => (
                <tr key={row.id} className={`border-b ${i % 2 === 1 ? 'bg-muted/[0.03]' : ''} hover:bg-muted/10`}>
                  <td className="py-2.5 px-4 sticky left-0 bg-card z-10 border-r border-border">
                    <div className="flex items-start gap-2">
                      <BedDouble className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-[13px] leading-tight">{row.roomTypeName}</p>
                        <p className="text-[11px] font-medium text-foreground/75 mt-1 truncate">{row.ratePlanName}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary rounded font-semibold">
                            {MEAL[row.mealPlan] ?? row.mealPlan}
                          </span>
                          {row.cancellationType && (
                            <span className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground rounded font-semibold">
                              {row.cancellationType}
                            </span>
                          )}
                          {row.ratePlanCode && (
                            <span className="text-[10px] text-muted-foreground">{row.ratePlanCode}</span>
                          )}
                          {row.maxOccupancy && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Users className="w-2.5 h-2.5" />Max {row.maxOccupancy}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {visibleDates.map(d => {
                    const today = isToday(parseISO(d));
                    const weekend = parseISO(d).getDay() === 5 || parseISO(d).getDay() === 6;
                    return (
                      <td key={d} className={`py-1.5 px-1 ${today ? 'bg-primary/5' : weekend ? 'bg-muted/20' : ''}`}>
                        <TariffCell rate={row.rates[d]} dateLabel={format(parseISO(d), 'EEE, dd MMM yyyy')} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-right">
        All rates in AED · Net rates shown (pre-markup) · For internal quotation use only
      </p>
    </div>
  );
}
