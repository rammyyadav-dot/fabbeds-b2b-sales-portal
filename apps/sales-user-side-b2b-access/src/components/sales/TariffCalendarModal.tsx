import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@project/components/ui/tooltip';
import { ChevronLeft, ChevronRight, X, Info, AlertCircle } from 'lucide-react';
import { getHotelProfile, GetHotelProfileOutputType } from 'zitejs/api';
import UserTariffCalendar from './UserTariffCalendar';
import StarRating from './StarRating';

interface Props {
  open: boolean;
  onClose: () => void;
  hotelId: string;
  hotelName: string;
  adults?: number;
  children?: number;
  rooms?: number;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShort(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AE', { day: 'numeric', month: 'short' });
}

const WINDOWS = [30, 60, 90] as const;

export default function TariffCalendarModal({ open, onClose, hotelId, hotelName, adults = 2, children = 0, rooms = 1 }: Props) {
  const [data, setData] = useState<GetHotelProfileOutputType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [windowSize, setWindowSize] = useState<number>(30);

  const today = useMemo(() => todayStr(), []);
  const startDate = useMemo(() => offset === 0 ? today : addDays(today, offset), [today, offset]);
  const endDateLabel = useMemo(() => addDays(startDate, windowSize - 1), [startDate, windowSize]);

  useEffect(() => {
    if (!open || !hotelId) return;
    setLoading(true);
    setError(null);
    setOffset(0);
    getHotelProfile({ hotelId, adults, children, rooms })
      .then(setData)
      .catch(() => setError('Failed to load tariff calendar.'))
      .finally(() => setLoading(false));
  }, [open, hotelId, adults, children, rooms]);

  // Rate intelligence strip — computed from visible window
  const intelligence = useMemo(() => {
    if (!data) return null;
    const start = startDate;
    const end = addDays(start, windowSize);
    const visible = data.dailyRates.filter(r => r.date >= start && r.date < end && r.status !== 'Stop Sale');
    if (visible.length === 0) return null;

    const rates = visible.map(r => r.displayRate).filter(r => r > 0);
    const lowest = rates.length > 0 ? Math.min(...rates) : null;
    const highest = rates.length > 0 ? Math.max(...rates) : null;

    const statusCounts: Record<string, number> = {};
    const dateStatuses = new Map<string, string>();
    for (const r of data.dailyRates.filter(r => r.date >= start && r.date < end)) {
      if (!dateStatuses.has(r.date)) dateStatuses.set(r.date, r.status);
    }
    for (const s of dateStatuses.values()) {
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    // Next rate change — first date where sell rate differs from previous date for any rate plan
    let nextChange: { date: string; from: number; to: number } | null = null;
    const sortedRates = [...data.dailyRates]
      .filter(r => r.date >= start && r.date < end && r.status !== 'Stop Sale' && r.displayRate > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const prevByPlan = new Map<string, number>();
    for (const r of sortedRates) {
      const key = `${r.roomTypeId}|${r.ratePlanId}`;
      const prev = prevByPlan.get(key);
      if (prev !== undefined && prev !== r.displayRate && !nextChange) {
        nextChange = { date: r.date, from: prev, to: r.displayRate };
      }
      prevByPlan.set(key, r.displayRate);
    }

    return { lowest, highest, statusCounts, nextChange };
  }, [data, startDate, windowSize]);

  const starNum = data ? parseInt(data.hotel.starRating) || 0 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[98vw] w-full max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Compact header */}
        <div className="px-5 pt-4 pb-3 border-b border-border bg-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold tracking-wide text-foreground uppercase">
                Tariff Calendar — {hotelName}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                {starNum > 0 && <StarRating stars={starNum} />}
                <span>{data?.hotel.location || data?.hotel.emirate || ''}</span>
                <span>·</span>
                <span>AED</span>
                <span>·</span>
                <span>{adults} Adult{adults !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{rooms} Room{rooms !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOffset(Math.max(0, offset - windowSize))} disabled={offset === 0}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-sm font-semibold min-w-[160px] text-center">
              {formatShort(startDate)} – {formatShort(endDateLabel)}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOffset(offset + windowSize)} disabled={offset >= 150}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>

            {WINDOWS.map(w => (
              <button
                key={w}
                onClick={() => { setWindowSize(w); setOffset(0); }}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  windowSize === w ? 'bg-muted border-border font-semibold text-foreground' : 'border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {w === 30 ? '30 Days' : w}
              </button>
            ))}

            <button
              onClick={() => setOffset(0)}
              className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted/50"
            >
              Today
            </button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 ml-1 cursor-help">
                    <Info className="w-3 h-3" /> Calendar Guide
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  <p className="font-semibold mb-1">How to read this calendar</p>
                  <p>Pricing is based on {adults} Adult{adults !== 1 ? 's' : ''} per room. Dashed border = season rate. Click a date to set check-in, then click a later date on the same row to set check-out.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Rate intelligence strip */}
        {intelligence && (
          <div className="px-5 py-2.5 bg-muted/70 border-b border-border flex flex-wrap items-center gap-4">
            {intelligence.lowest !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500 text-sm">★</span>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Lowest</p>
                  <p className="text-sm font-bold text-emerald-700">AED {intelligence.lowest.toLocaleString()}</p>
                </div>
              </div>
            )}
            {intelligence.highest !== null && intelligence.highest !== intelligence.lowest && (
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Highest</p>
                <p className="text-sm font-bold text-foreground">AED {intelligence.highest.toLocaleString()}</p>
              </div>
            )}

            <div className="w-px h-8 bg-border hidden sm:block" />

            {(['Free Sale', 'Limited', 'On Request', 'Stop Sale'] as const).map(status => {
              const count = intelligence.statusCounts[status];
              if (!count) return null;
              const cfg: Record<string, { dot: string; text: string }> = {
                'Free Sale':  { dot: 'bg-emerald-500', text: 'text-emerald-700' },
                'Limited':    { dot: 'bg-amber-500',   text: 'text-amber-700' },
                'On Request': { dot: 'bg-sky-500',     text: 'text-sky-700' },
                'Stop Sale':  { dot: 'bg-red-500',     text: 'text-red-700' },
              };
              const c = cfg[status];
              return (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{status}</p>
                    <p className={`text-sm font-bold ${c.text}`}>{count} date{count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              );
            })}

            {intelligence.nextChange && (
              <>
                <div className="w-px h-8 bg-border hidden sm:block" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">↑</span>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Next Rate Change</p>
                    <p className="text-sm font-bold text-foreground">
                      {formatShort(intelligence.nextChange.date)} · AED {intelligence.nextChange.from.toLocaleString()} → AED {intelligence.nextChange.to.toLocaleString()}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Calendar body */}
        <div className="px-5 py-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3 mt-4">
              <div className="flex gap-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-24 rounded-full" />)}
              </div>
              <Skeleton className="h-[320px] w-full rounded-lg" />
            </div>
          ) : data ? (
            <UserTariffCalendar
              hotelId={hotelId}
              roomTypes={data.roomTypes}
              dailyRates={data.dailyRates}
              startDate={startDate}
              count={windowSize}
              markupLabel={data.markupLabel}
              adults={adults}
              children={children}
              rooms={rooms}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
