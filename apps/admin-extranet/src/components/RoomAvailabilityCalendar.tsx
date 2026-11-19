import { useState, useEffect, useRef, useCallback } from 'react';
import { addDays, format, startOfDay, differenceInCalendarDays } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Skeleton } from '@project/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { Calendar } from '@project/components/ui/calendar';
import { ChevronLeft, ChevronRight, CalendarDays, Check, X, HelpCircle, AlertTriangle, Info, CalendarRange, PaintBucket } from 'lucide-react';
import { getRoomTypes, getDailyRates, saveAvailabilityStatus, GetRoomTypesOutputType } from 'zitejs/api';
import { toast } from 'sonner';
import AvailabilityPaintToolbar, { PaintStatus } from './AvailabilityPaintToolbar';
import type { DateRange } from 'react-day-picker';

type RoomType = GetRoomTypesOutputType['roomTypes'][0];

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  'Free Sale':  { bg: 'bg-green-500',  text: 'text-white', icon: <Check className="w-4 h-4" /> },
  'Stop Sale':  { bg: 'bg-red-500',    text: 'text-white', icon: <X className="w-4 h-4" /> },
  'On Request': { bg: 'bg-yellow-400', text: 'text-white', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  'Limited':    { bg: 'bg-orange-500', text: 'text-white', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

interface Props { hotelId: string; }

export default function RoomAvailabilityCalendar({ hotelId }: Props) {
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [daysToShow, setDaysToShow] = useState(28);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [savedMap, setSavedMap] = useState<Map<string, string>>(new Map());
  const [undoStack, setUndoStack] = useState<Map<string, string>[]>([]);
  const [paintMode, setPaintMode] = useState<PaintStatus>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const isPainting = useRef(false);

  const dates = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));
  const endDate = dates[dates.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rtRes = await getRoomTypes({ hotelId });
      setRoomTypes(rtRes.roomTypes);
      const map = new Map<string, string>();
      await Promise.all(rtRes.roomTypes.map(async rt => {
        const ratesRes = await getDailyRates({
          roomTypeId: rt.id,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
        });
        for (const r of ratesRes.rates) {
          if (r.rateDate && r.status) map.set(`${rt.id}:${r.rateDate}`, r.status);
        }
      }));
      setStatusMap(new Map(map));
      setSavedMap(new Map(map));
      setUndoStack([]);
    } finally { setLoading(false); }
  }, [hotelId, startDate.toISOString(), daysToShow]);

  useEffect(() => { load(); }, [load]);

  const paintCell = (rtId: string, date: string) => {
    if (!paintMode) return;
    setStatusMap(prev => { const next = new Map(prev); next.set(`${rtId}:${date}`, paintMode); return next; });
  };

  const handleMouseDown = (rtId: string, date: string) => {
    if (!paintMode) return;
    setUndoStack(s => [...s, new Map(statusMap)]);
    isPainting.current = true;
    paintCell(rtId, date);
  };
  const handleMouseEnter = (rtId: string, date: string) => { if (!isPainting.current || !paintMode) return; paintCell(rtId, date); };
  const handleMouseUp = () => { isPainting.current = false; };
  const handleUndo = () => { if (undoStack.length === 0) return; setStatusMap(new Map(undoStack[undoStack.length - 1])); setUndoStack(s => s.slice(0, -1)); };
  const handleReset = () => { setStatusMap(new Map(savedMap)); setUndoStack([]); };

  const hasChanges = [...statusMap.entries()].some(([k, v]) => savedMap.get(k) !== v) ||
    [...savedMap.entries()].some(([k, v]) => statusMap.get(k) !== v);

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes: { roomTypeId: string; date: string; status: string }[] = [];
      for (const [key, status] of statusMap.entries()) {
        if (savedMap.get(key) !== status) {
          const [roomTypeId, date] = key.split(':');
          changes.push({ roomTypeId, date, status });
        }
      }
      if (changes.length === 0) { toast.info('No changes to save'); return; }
      await saveAvailabilityStatus({ hotelId, changes });
      setSavedMap(new Map(statusMap));
      setUndoStack([]);
      toast.success(`Saved ${changes.length} changes`);
    } catch (error: any) { toast.error(error?.message || 'Failed to save changes'); }
    finally { setSaving(false); }
  };

  // Apply current paint mode to all room types × all dates in the selected range
  const handleFillRange = () => {
    if (!paintMode) { toast.error('Select a paint mode first'); return; }
    if (!dateRange?.from || !dateRange?.to) { toast.error('Select a date range first'); return; }
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    const rangeDates = Array.from({ length: days }, (_, i) => format(addDays(dateRange.from!, i), 'yyyy-MM-dd'));
    setUndoStack(s => [...s, new Map(statusMap)]);
    setStatusMap(prev => {
      const next = new Map(prev);
      for (const rt of roomTypes) {
        for (const d of rangeDates) {
          next.set(`${rt.id}:${d}`, paintMode);
        }
      }
      return next;
    });
    toast.success(`Applied "${paintMode}" to ${roomTypes.length} room types × ${days} dates`);
  };

  // Apply selected range to the grid view
  const applyRangeToView = () => {
    if (!dateRange?.from || !dateRange?.to) return;
    const days = Math.min(90, Math.max(differenceInCalendarDays(dateRange.to, dateRange.from) + 1, 7));
    setStartDate(startOfDay(dateRange.from));
    setDaysToShow(days);
    setPickerOpen(false);
  };

  const rangeLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'dd MMM')} – ${format(dateRange.to, 'dd MMM yyyy')} (${differenceInCalendarDays(dateRange.to, dateRange.from) + 1} nights)`
    : null;

  return (
    <div className="space-y-4" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" /> Room Availability Calendar</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Paint-based availability management across all room types</p>
      </div>

      {/* Paint Toolbar */}
      <div className="rounded-xl border border-border p-4 bg-card space-y-3">
        <AvailabilityPaintToolbar paintMode={paintMode} onPaintMode={setPaintMode} onUndo={handleUndo} onReset={handleReset} onSave={handleSave} saving={saving} hasChanges={hasChanges} />
      </div>

      {/* Booking.com Style Date Range Picker */}
      <div className="rounded-xl border-2 border-primary/20 bg-card overflow-hidden shadow-sm">
        <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Date Range Filter & Bulk Apply</span>
        </div>
        <div className="p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <div className="flex-1 flex items-stretch border-2 border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/40 transition-colors bg-background">
                {/* Check-in */}
                <div className="flex-1 px-4 py-2.5 border-r border-border hover:bg-muted/30 transition-colors">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Check-in</p>
                  <p className={`text-sm font-bold mt-0.5 ${dateRange?.from ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {dateRange?.from ? format(dateRange.from, 'EEE, dd MMM yyyy') : 'Select date'}
                  </p>
                </div>
                {/* Arrow */}
                <div className="flex items-center px-2 text-muted-foreground text-xs font-bold">→</div>
                {/* Check-out */}
                <div className="flex-1 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Check-out</p>
                  <p className={`text-sm font-bold mt-0.5 ${dateRange?.to ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {dateRange?.to ? format(dateRange.to, 'EEE, dd MMM yyyy') : 'Select date'}
                  </p>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                defaultMonth={startDate}
                className="rounded-t-lg"
              />
              <div className="p-3 border-t bg-muted/30 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {rangeLabel ?? 'Select check-in and check-out dates'}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setDateRange(undefined); setPickerOpen(false); }}>Clear</Button>
                  <Button size="sm" disabled={!dateRange?.from || !dateRange?.to} onClick={applyRangeToView}>
                    View Range
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Fill Range Button */}
          <Button
            onClick={handleFillRange}
            disabled={!dateRange?.from || !dateRange?.to || !paintMode}
            className="gap-2 shrink-0 h-auto py-2.5"
            variant={paintMode ? 'default' : 'outline'}
          >
            <PaintBucket className="w-4 h-4" />
            <span className="text-xs font-bold leading-tight text-center">
              Fill Range<br />
              <span className="text-[10px] opacity-80">{paintMode ? `(${paintMode})` : 'Select paint mode'}</span>
            </span>
          </Button>
        </div>
        {rangeLabel && (
          <div className="px-4 pb-3">
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full">{rangeLabel}</span>
          </div>
        )}
      </div>

      {/* Navigation Bar */}
      <div className="rounded-xl border border-border p-3 bg-card flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setStartDate(d => addDays(d, -daysToShow))}><ChevronLeft className="w-4 h-4" /></Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setStartDate(startOfDay(new Date()))}>Today</Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setStartDate(d => addDays(d, daysToShow))}><ChevronRight className="w-4 h-4" /></Button>
        <span className="text-sm text-muted-foreground">Days to Show:</span>
        <Select value={String(daysToShow)} onValueChange={v => setDaysToShow(Number(v))}>
          <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[14, 28, 60, 90].map(d => <SelectItem key={d} value={String(d)}>{d} Days</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{format(startDate, 'MMM d, yyyy')} – {format(endDate, 'MMM d, yyyy')}</span>
      </div>

      {/* Legend */}
      <div className="rounded-xl border border-border p-3 bg-card flex items-center gap-4 flex-wrap text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground"><Info className="w-4 h-4" /> Status Legend:</span>
        {Object.entries(STATUS_CONFIG).map(([s, c]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded flex items-center justify-center ${c.bg} ${c.text}`}>{c.icon}</span>
            <span className="text-sm">{s}</span>
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      {loading ? <Skeleton className="h-64 w-full rounded-xl" /> : (
        <div className="rounded-xl border border-border overflow-auto bg-card">
          <table className="text-xs border-collapse w-full" style={{ userSelect: 'none' }}>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-semibold text-foreground min-w-[200px] sticky left-0 bg-card z-10 border-r border-border">Room Type</th>
                {dates.map(d => {
                  const isInRange = dateRange?.from && dateRange?.to &&
                    d >= startOfDay(dateRange.from) && d <= startOfDay(dateRange.to);
                  return (
                    <th key={d.toISOString()} className={`p-1 text-center font-medium min-w-[48px] ${isInRange ? 'bg-primary/8' : ''}`}>
                      <div className="text-muted-foreground">{format(d, 'EEE')}</div>
                      <div className={`font-bold text-sm ${isInRange ? 'text-primary' : 'text-foreground'}`}>{format(d, 'd')}</div>
                      <div className="text-muted-foreground">{format(d, 'MMM')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roomTypes.map(rt => (
                <tr key={rt.id} className="border-b border-border last:border-0">
                  <td className="p-3 sticky left-0 bg-card z-10 border-r border-border">
                    <p className="font-semibold text-foreground text-sm">{rt.roomTypeName}</p>
                    <p className="text-muted-foreground text-xs">Max {rt.maxOccupancy ?? '?'} guests{rt.maxAdults ? ` | ${rt.maxAdults} adults` : ''}</p>
                  </td>
                  {dates.map(d => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const status = statusMap.get(`${rt.id}:${dateStr}`) || 'Free Sale';
                    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['Free Sale'];
                    const isInRange = dateRange?.from && dateRange?.to &&
                      d >= startOfDay(dateRange.from) && d <= startOfDay(dateRange.to);
                    return (
                      <td key={dateStr} className={`p-0.5 ${isInRange ? 'bg-primary/5' : ''}`}
                        onMouseDown={() => handleMouseDown(rt.id, dateStr)}
                        onMouseEnter={() => handleMouseEnter(rt.id, dateStr)}
                      >
                        <div className={`w-full h-10 rounded flex items-center justify-center cursor-pointer ${cfg.bg} ${cfg.text} ${paintMode ? 'hover:opacity-80' : ''} transition-opacity ${isInRange ? 'ring-1 ring-primary/30' : ''}`}>
                          {cfg.icon}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
