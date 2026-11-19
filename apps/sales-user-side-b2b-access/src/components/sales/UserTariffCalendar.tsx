import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Users, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { GetHotelProfileOutputType } from 'zitejs/api';
import UserTariffCalendarCell, { CellData } from './UserTariffCalendarCell';

type RoomType = GetHotelProfileOutputType['roomTypes'][0];
type DailyRate = GetHotelProfileOutputType['dailyRates'][0];

interface Props {
  hotelId: string;
  roomTypes: RoomType[];
  dailyRates: DailyRate[];
  startDate: string;
  count?: number;
  markupLabel: string;
  adults?: number;
  children?: number;
  rooms?: number;
}

const STATUS_CFG = {
  'Free Sale':  { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Limited':    { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  'On Request': { dot: 'bg-sky-500',     text: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200' },
  'Stop Sale':  { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

function getDays(startDate: string, count: number): string[] {
  const days: string[] = [];
  const d = new Date(startDate + 'T00:00:00');
  for (let i = 0; i < count; i++) {
    days.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface RatePlanRow {
  roomTypeId: string;
  ratePlanId: string;
  roomTypeName: string;
  ratePlanName: string;
  mealPlan: string;
  maxOcc: number | null;
  occupancyWarning: string | null;
}

interface StaySelection {
  rowKey: string; // roomTypeId|ratePlanId
  checkIn: string;
  checkOut: string | null;
}

export default function UserTariffCalendar({ hotelId, roomTypes, dailyRates, startDate, count = 30, markupLabel, adults = 2, children = 0, rooms = 1 }: Props) {
  const navigate = useNavigate();
  const days = useMemo(() => getDays(startDate, count), [startDate, count]);
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [stay, setStay] = useState<StaySelection | null>(null);

  // Build rate map keyed by date|roomTypeId|ratePlanId
  const { rateMap, ratePlanRows, bestRate, rateChanges } = useMemo(() => {
    const map = new Map<string, CellData>();

    for (const dr of dailyRates) {
      const key = `${dr.date}|${dr.roomTypeId}|${dr.ratePlanId}`;
      const existing = map.get(key);
      if (existing && existing.displayRate <= dr.displayRate) continue;
      map.set(key, {
        ratePlanId: dr.ratePlanId,
        ratePlanName: dr.ratePlanName,
        mealPlan: dr.mealPlan,
        displayRate: dr.displayRate,
        netRate: dr.netRate,
        status: dr.status,
        rateType: dr.rateType,
        allocation: dr.allocation,
        occupancyNote: dr.occupancyNote,
        cancellationSummary: (dr as any).cancellationSummary || '',
        markupLabel,
        adult1Sell: dr.adult1Sell,
        adult2Sell: dr.adult2Sell,
        adult3Sell: dr.adult3Sell,
        childSell: dr.childSell,
        childSupplement: dr.childSupplement,
        extraBedRate: dr.extraBedRate,
        eventSupplement: (dr as any).eventSupplement || 0,
        eventNames: (dr as any).eventNames || [],
      });
    }

    // Derive unique rate plan rows
    const seen = new Set<string>();
    const rows: RatePlanRow[] = [];
    for (const dr of dailyRates) {
      const rowKey = `${dr.roomTypeId}|${dr.ratePlanId}`;
      if (seen.has(rowKey)) continue;
      seen.add(rowKey);
      const rt = roomTypes.find(r => r.id === dr.roomTypeId);
      rows.push({
        roomTypeId: dr.roomTypeId,
        ratePlanId: dr.ratePlanId,
        roomTypeName: rt?.name || '',
        ratePlanName: dr.ratePlanName,
        mealPlan: dr.mealPlan,
        maxOcc: rt?.maxOccupancy ?? rt?.maxAdults ?? null,
        occupancyWarning: rt?.occupancyWarning ?? null,
      });
    }

    // Find best (lowest) valid sell rate in visible window
    let best: number | null = null;
    let bestKey: string | null = null;
    for (const [key, cell] of map.entries()) {
      const datePart = key.split('|')[0];
      if (datePart < startDate || datePart >= getDays(startDate, count).slice(-1)[0]) continue;
      if (cell.status === 'Stop Sale' || cell.displayRate <= 0) continue;
      if (best === null || cell.displayRate < best) {
        best = cell.displayRate;
        bestKey = key;
      }
    }

    // Find rate changes per row
    const changes = new Set<string>();
    for (const row of rows) {
      let prev: number | null = null;
      for (const day of getDays(startDate, count)) {
        const cell = map.get(`${day}|${row.roomTypeId}|${row.ratePlanId}`);
        if (!cell || cell.status === 'Stop Sale' || cell.displayRate <= 0) { prev = null; continue; }
        if (prev !== null && prev !== cell.displayRate) {
          changes.add(`${day}|${row.roomTypeId}|${row.ratePlanId}`);
          break; // only first change per row
        }
        prev = cell.displayRate;
      }
    }

    // Mark best & rate changes on cells
    if (bestKey) {
      const cell = map.get(bestKey);
      if (cell) cell.isBest = true;
    }
    for (const key of changes) {
      const cell = map.get(key);
      if (cell) cell.isRateChange = true;
    }

    return { rateMap: map, ratePlanRows: rows, bestRate: best, rateChanges: changes };
  }, [dailyRates, roomTypes, markupLabel, startDate, count]);

  const handleCellClick = useCallback((date: string, roomTypeId: string, ratePlanId: string) => {
    const rowKey = `${roomTypeId}|${ratePlanId}`;
    if (!stay || stay.rowKey !== rowKey) {
      // Start new selection
      setStay({ rowKey, checkIn: date, checkOut: null });
    } else if (!stay.checkOut && date > stay.checkIn) {
      // Set check-out
      setStay({ ...stay, checkOut: date });
    } else {
      // Reset and start new selection
      setStay({ rowKey, checkIn: date, checkOut: null });
    }
  }, [stay]);

  // Compute stay total
  const stayInfo = useMemo(() => {
    if (!stay || !stay.checkOut) return null;
    const row = ratePlanRows.find(r => `${r.roomTypeId}|${r.ratePlanId}` === stay.rowKey);
    if (!row) return null;

    const ciDate = new Date(stay.checkIn + 'T00:00:00');
    const coDate = new Date(stay.checkOut + 'T00:00:00');
    const nights = Math.round((coDate.getTime() - ciDate.getTime()) / 86400000);
    if (nights <= 0) return null;

    let total = 0;
    let missingDate: string | null = null;
    let blockedDate: string | null = null;
    const d = new Date(stay.checkIn + 'T00:00:00');
    for (let i = 0; i < nights; i++) {
      const dayStr = d.toISOString().split('T')[0];
      const cell = rateMap.get(`${dayStr}|${row.roomTypeId}|${row.ratePlanId}`);
      if (!cell || cell.displayRate <= 0) {
        missingDate = dayStr;
        break;
      }
      if (cell.status === 'Stop Sale') {
        blockedDate = dayStr;
        break;
      }
      total += cell.displayRate;
      d.setDate(d.getDate() + 1);
    }

    // Get dominant status from selected nights
    const firstCell = rateMap.get(`${stay.checkIn}|${row.roomTypeId}|${row.ratePlanId}`);

    return {
      ...row,
      nights,
      total,
      avg: Math.round(total / nights),
      missingDate,
      blockedDate,
      status: firstCell?.status || 'On Request',
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
    };
  }, [stay, rateMap, ratePlanRows]);

  const handleSelectRate = useCallback(() => {
    if (!stayInfo || stayInfo.missingDate || stayInfo.blockedDate) return;
    const params = new URLSearchParams({
      checkIn: stayInfo.checkIn,
      checkOut: stayInfo.checkOut,
      adults: String(adults),
      children: String(children),
      rooms: String(rooms),
      roomTypeId: stayInfo.roomTypeId,
      ratePlanId: stayInfo.ratePlanId,
    });
    navigate(`/hotel/${hotelId}/checkout?${params}`);
  }, [stayInfo, hotelId, adults, children, rooms, navigate]);

  const isDateInStay = (date: string, rowKey: string) => {
    if (!stay || stay.rowKey !== rowKey || !stay.checkOut) return false;
    return date >= stay.checkIn && date < stay.checkOut;
  };

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(STATUS_CFG).map(([s, c]) => (
          <span key={s} className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border} font-medium`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{s}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
        <div style={{ minWidth: `${190 + days.length * 66}px` }}>
          {/* Date header */}
          <div className="flex bg-muted/60 border-b border-border sticky top-0 z-10">
            <div className="w-[190px] shrink-0 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border sticky left-0 bg-muted/60 z-20">
              Room / Rate Plan
            </div>
            {days.map((date) => {
              const d = new Date(date + 'T00:00:00');
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = date === todayStr;
              const monthChange = d.getDate() === 1;
              const monthShort = d.toLocaleDateString('en-AE', { month: 'short' }).toUpperCase();
              return (
                <div key={date} className={`w-[66px] shrink-0 text-center py-2 border-r border-border/50 ${isWeekend ? 'bg-primary/5' : ''} ${isToday ? 'bg-primary/10' : ''} ${monthChange ? 'border-l-2 border-l-primary/30' : ''}`}>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold">{DAY_LABELS[d.getDay()]}</div>
                  <div className={`text-[13px] font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{d.getDate()}</div>
                  {isToday ? (
                    <div className="text-[8px] text-primary font-bold">TODAY</div>
                  ) : monthChange ? (
                    <div className="text-[8px] text-primary/70 font-bold uppercase">{monthShort}</div>
                  ) : (
                    <div className="text-[8px] text-muted-foreground/60 uppercase">{monthShort}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Rate plan rows */}
          {ratePlanRows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No rate plans found</div>
          ) : ratePlanRows.map((row, i) => {
            const rowKey = `${row.roomTypeId}|${row.ratePlanId}`;
            const isDisabled = !!row.occupancyWarning;
            const mealShort = row.mealPlan === 'Bed & Breakfast' ? 'BB' :
              row.mealPlan === 'Half Board' ? 'HB' :
              row.mealPlan === 'Full Board' ? 'FB' :
              row.mealPlan === 'All Inclusive' ? 'AI' :
              row.mealPlan === 'Room Only' ? 'RO' : row.mealPlan;
            return (
              <div key={rowKey} className={`flex border-b border-border/50 ${i % 2 === 0 ? 'bg-card' : 'bg-muted/10'} ${isDisabled ? 'opacity-50' : ''}`}>
                {/* Sticky room label */}
                <div className="w-[190px] shrink-0 px-3 py-3 border-r border-border flex flex-col justify-center gap-0.5 sticky left-0 bg-inherit z-10">
                  <div className="text-[11px] font-bold text-foreground leading-tight uppercase">{row.roomTypeName}</div>
                  <div className="text-[10px] text-muted-foreground font-medium truncate" title={row.ratePlanName}>{row.ratePlanName}</div>
                  <div className="text-[9px] text-muted-foreground/80 font-medium">{mealShort}</div>
                  {row.maxOcc !== null && (
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                      <Users className="w-2.5 h-2.5" />
                      <span>Max {row.maxOcc}</span>
                    </div>
                  )}
                  {isDisabled && (
                    <div className="flex items-center gap-1 text-[9px] text-amber-700 mt-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" /> Not suitable
                    </div>
                  )}
                </div>

                {/* Date cells */}
                {days.map((date) => {
                  const cell = rateMap.get(`${date}|${row.roomTypeId}|${row.ratePlanId}`) ?? null;
                  const enrichedCell = cell ? { ...cell, date, roomTypeName: row.roomTypeName } : null;
                  const inStay = isDateInStay(date, rowKey);
                  const isCI = stay?.rowKey === rowKey && stay.checkIn === date;
                  const isCO = stay?.rowKey === rowKey && stay?.checkOut === date;

                  return (
                    <div key={date} className="w-[66px] shrink-0 border-r border-border/30">
                      {isDisabled ? (
                        <div className="h-[76px] bg-muted/20 border border-border/30" />
                      ) : (
                        <UserTariffCalendarCell
                          data={enrichedCell}
                          isSelected={inStay}
                          isCheckIn={isCI}
                          isCheckOut={isCO}
                          onClick={() => enrichedCell && handleCellClick(date, row.roomTypeId, row.ratePlanId)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <button className="border border-border rounded-md px-2 py-1 hover:bg-muted transition-colors">← Previous dates</button>
        <button className="border border-border rounded-md px-2 py-1 hover:bg-muted transition-colors">Today</button>
        <button className="border border-border rounded-md px-2 py-1 hover:bg-muted transition-colors">Next dates →</button>
      </div>

      {/* Stay selection footer */}
      {stay && stay.checkOut && stayInfo && (
        <StayFooter info={stayInfo} onSelect={handleSelectRate} />
      )}
      {stay && !stay.checkOut && (
        <div className="border-t border-border bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          Check-in set to <span className="font-semibold text-foreground">{formatDate(stay.checkIn)}</span> — now click a later date on the same row to set check-out.
        </div>
      )}
    </div>
  );
}

function formatDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-AE', { day: 'numeric', month: 'short' });
}

interface StayFooterProps {
  info: {
    roomTypeName: string;
    ratePlanName: string;
    mealPlan: string;
    nights: number;
    total: number;
    avg: number;
    missingDate: string | null;
    blockedDate: string | null;
    status: string;
    checkIn: string;
    checkOut: string;
  };
  onSelect: () => void;
}

function StayFooter({ info, onSelect }: StayFooterProps) {
  const mealShort = info.mealPlan === 'Bed & Breakfast' ? 'BB' :
    info.mealPlan === 'Half Board' ? 'HB' :
    info.mealPlan === 'Full Board' ? 'FB' :
    info.mealPlan === 'All Inclusive' ? 'AI' : info.mealPlan;

  if (info.missingDate) {
    return (
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-xs font-bold text-amber-800">Rate incomplete</p>
          <p className="text-xs text-amber-700 mt-0.5">No tariff available for {formatDate(info.missingDate)}. Try different dates.</p>
        </div>
      </div>
    );
  }

  if (info.blockedDate) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
        <div>
          <p className="text-xs font-bold text-red-800">Stay not available</p>
          <p className="text-xs text-red-700 mt-0.5">Stop Sale on {formatDate(info.blockedDate)}. Please change your dates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
      <div>
        <p className="text-xs font-bold text-foreground uppercase">
          {info.roomTypeName} · {mealShort} {info.ratePlanName.toLowerCase().includes('non-refundable') ? 'Non-Refundable' : 'Flexible'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDate(info.checkIn)}–{formatDate(info.checkOut)} · {info.nights} night{info.nights !== 1 ? 's' : ''}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          ● {info.status} · FabBeds Exclusive Deals
        </p>
      </div>
      <div className="text-right">
        <p className="text-xl font-bold text-foreground">AED {info.total.toLocaleString()} total</p>
        <p className="text-xs text-muted-foreground">AED {info.avg.toLocaleString()} avg / room / night</p>
      </div>
      <Button onClick={onSelect} className="shrink-0">
        Select Rate →
      </Button>
    </div>
  );
}
