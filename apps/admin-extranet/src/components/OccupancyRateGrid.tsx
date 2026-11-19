import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { getDailyRates, getRatePlans, saveDailyRate, GetDailyRatesOutputType, GetRatePlansOutputType } from 'zitejs/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Upload, CheckCircle2, AlertCircle, Clock, Ban, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import BulkRateLoader from '@/components/BulkRateLoader';
import { format, isToday as isTodayFn } from 'date-fns';

type DailyRate = GetDailyRatesOutputType['rates'][0];
interface RoomType { id: string; roomTypeName?: string; maxOccupancy?: number; mealPlan?: string; }
interface Props { roomType: RoomType; hotelId: string; }

const STATUS_CONFIG: Record<string, { icon: ReactNode }> = {
  'Free Sale':  { icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
  'Limited':    { icon: <AlertCircle  className="w-5 h-5 text-orange-500" /> },
  'On Request': { icon: <Clock        className="w-5 h-5 text-yellow-500" /> },
  'Stop Sale':  { icon: <Ban          className="w-5 h-5 text-red-500" /> },
};
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthDates(year: number, month: number): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const startDay = isCurrentMonth ? today.getDate() : 1;
  for (let day = startDay; day <= daysInMonth; day++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    days.push(`${year}-${mm}-${dd}`);
  }
  return days;
}

function RateCell({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(value != null ? String(value) : '');
  useEffect(() => { setLocal(value != null ? String(value) : ''); }, [value]);
  return (
    <input
      type="number" min={0}
      className="w-16 text-center border border-border rounded-lg px-2 py-1.5 text-sm font-medium text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder:text-muted-foreground/40"
      value={local}
      placeholder="—"
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { const n = parseFloat(local); if (!isNaN(n)) onChange(n); }}
    />
  );
}

export default function OccupancyRateGrid({ roomType, hotelId }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [rateMap, setRateMap] = useState<Map<string, DailyRate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [ratePlans, setRatePlans] = useState<GetRatePlansOutputType['ratePlans']>([]);
  const [selectedRatePlanId, setSelectedRatePlanId] = useState('');

  useEffect(() => {
    setSelectedRatePlanId('');
    getRatePlans({ hotelId, roomTypeId: roomType.id })
      .then(r => {
        const active = r.ratePlans.filter(p => p.status === 'Active');
        setRatePlans(active);
        if (active.length === 1) setSelectedRatePlanId(active[0].id);
      })
      .catch(() => { setRatePlans([]); toast.error('Could not load Rate Plans'); });
  }, [hotelId, roomType.id]);

  const dates = getMonthDates(year, month);
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    if (!selectedRatePlanId) {
      setRateMap(new Map());
      setLoading(false); setRefreshing(false);
      return;
    }
    try {
      const res = await getDailyRates({ roomTypeId: roomType.id, ratePlanId: selectedRatePlanId, startDate, endDate });
      const map = new Map<string, DailyRate>();
      res.rates.forEach(r => { if (r.rateDate) map.set(r.rateDate.split('T')[0], r); });
      setRateMap(map);
    } finally { setLoading(false); setRefreshing(false); }
  }, [roomType.id, selectedRatePlanId, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (date: string, field: string, value: number | string) => {
    if (!selectedRatePlanId) { toast.error('Select a Rate Plan first'); return; }
    const existing = rateMap.get(date);
    const updated = { ...existing, [field]: value };
    setRateMap(prev => new Map(prev).set(date, { ...updated, id: existing?.id ?? '' } as DailyRate));
    setSaving(prev => new Set(prev).add(date));
    try {
      const res = await saveDailyRate({
        id: existing?.id, roomTypeId: roomType.id, hotelId, ratePlanId: selectedRatePlanId, rateDate: date,
        adult1Rate: updated.adult1Rate, adult2Rate: updated.adult2Rate, adult3Rate: updated.adult3Rate,
        childSupplement: updated.childSupplement, extraBedRate: updated.extraBedRate,
        currency: updated.currency ?? 'AED', minStay: updated.minStay ?? 1,
        allocation: updated.allocation ?? 10, status: updated.status,
      });
      setRateMap(prev => { const m = new Map(prev); m.set(date, { ...m.get(date)!, id: res.id }); return m; });
    } catch { toast.error('Failed to save rate'); }
    finally { setSaving(prev => { const s = new Set(prev); s.delete(date); return s; }); }
  };

  const prevMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    if (isCurrentMonth) return;
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };
  const monthLabel = new Date(year, month).toLocaleString('en', { month: 'long', year: 'numeric' });
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const COLS = [
    { label: 'Adult 1' }, { label: 'Adult 2' }, { label: 'Adult 3' },
    { label: 'Child 1' }, { label: 'Extrabed' },
    { label: 'MLOS' }, { label: 'Allocation' }, { label: 'Status' },
  ];

  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-md">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-500 px-6 py-4 text-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-bold text-xl tracking-tight">{roomType.roomTypeName}</h3>
            <p className="text-white/75 text-sm mt-0.5">
              Max {roomType.maxOccupancy ?? '?'} guests{roomType.mealPlan && <> | {roomType.mealPlan}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedRatePlanId} onValueChange={setSelectedRatePlanId}>
              <SelectTrigger className="w-56 bg-white text-foreground"><SelectValue placeholder="Select Rate Plan" /></SelectTrigger>
              <SelectContent>
                {ratePlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.ratePlanName ?? plan.ratePlanCode ?? plan.id}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-1.5 bg-white/20 text-white border border-white/30 hover:bg-white/30 shadow-none" onClick={() => setBulkOpen(true)}>
              <Upload className="w-3.5 h-3.5" /> Bulk Load
            </Button>
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 w-8 h-8" onClick={() => load(true)}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex items-center gap-1 bg-white/15 rounded-lg px-2 py-1">
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 w-7 h-7" onClick={prevMonth} disabled={isCurrentMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[130px] text-center">{monthLabel}</span>
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 w-7 h-7" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        {isCurrentMonth && (
          <p className="text-white/50 text-xs mt-2">Showing from today · {format(now, 'dd MMM yyyy')}</p>
        )}
      </div>

      {!selectedRatePlanId && <p className="px-6 py-3 text-sm text-amber-700 bg-amber-50">
        {ratePlans.length ? 'Select a Rate Plan to edit its daily rates.' : 'Create an active Rate Plan before editing daily rates.'}
      </p>}
      {/* Table */}
      <div className={`overflow-x-auto bg-white ${!selectedRatePlanId ? 'pointer-events-none opacity-50' : ''}`}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-border bg-muted/20">
              <th className="text-left py-3 px-5 font-bold text-foreground text-sm w-28">Date</th>
              {COLS.map(c => (
                <th key={c.label} className="py-3 px-3 font-bold text-foreground text-sm text-center">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="py-3 px-3"><Skeleton className="h-6 w-full rounded" /></td>
                  ))}
                </tr>
              ))
            ) : dates.map(date => {
              const d = new Date(date + 'T00:00:00');
              const dayName = DAYS[d.getDay()];
              const dayNum = d.getDate();
              const rate = rateMap.get(date);
              const isSaving = saving.has(date);
              const status = rate?.status ?? 'Free Sale';
              const isWeekend = d.getDay() === 5 || d.getDay() === 6;
              const todayRow = isTodayFn(d);

              return (
                <tr key={date}
                  className={`border-b border-border transition-colors ${isSaving ? 'opacity-50' : ''} ${todayRow ? 'bg-violet-50/60 border-l-4 border-l-violet-500' : isWeekend ? 'bg-amber-50/40' : 'hover:bg-muted/20'}`}>
                  {/* Date */}
                  <td className="py-2.5 px-5 whitespace-nowrap">
                    <span className={`font-bold text-base ${todayRow ? 'text-violet-600' : 'text-foreground'}`}>{dayNum}</span>
                    <span className="text-muted-foreground mx-1.5 font-light">|</span>
                    <span className={`text-xs font-semibold ${isWeekend ? 'text-orange-500' : 'text-muted-foreground'}`}>{dayName}</span>
                  </td>
                  {/* Rate cells */}
                  <td className="py-1.5 px-2"><RateCell value={rate?.adult1Rate} onChange={v => handleSave(date, 'adult1Rate', v)} /></td>
                  <td className="py-1.5 px-2"><RateCell value={rate?.adult2Rate} onChange={v => handleSave(date, 'adult2Rate', v)} /></td>
                  <td className="py-1.5 px-2"><RateCell value={rate?.adult3Rate} onChange={v => handleSave(date, 'adult3Rate', v)} /></td>
                  <td className="py-1.5 px-2"><RateCell value={rate?.childSupplement} onChange={v => handleSave(date, 'childSupplement', v)} /></td>
                  <td className="py-1.5 px-2"><RateCell value={rate?.extraBedRate} onChange={v => handleSave(date, 'extraBedRate', v)} /></td>
                  {/* MLOS */}
                  <td className="py-1 px-3 text-center">
                    <input
                      type="number" min={1} max={365}
                      className="w-16 text-center border border-border rounded-lg px-2 py-1.5 text-sm font-bold text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                      value={rate?.minStay ?? 1}
                      onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) handleSave(date, 'minStay', v); }}
                    />
                  </td>
                  {/* Allocation */}
                  <td className="py-1 px-3 text-center">
                    <input
                      type="number" min={0}
                      className="w-16 text-center border border-border rounded-lg px-2 py-1.5 text-sm font-bold text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                      value={rate?.allocation ?? 10}
                      onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) handleSave(date, 'allocation', v); }}
                    />
                  </td>
                  {/* Status */}
                  <td className="py-1.5 px-3 text-center">
                    <div className="flex items-center justify-center" title={status}>
                      {STATUS_CONFIG[status]?.icon ?? STATUS_CONFIG['Free Sale'].icon}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkRateLoader open={bulkOpen} onClose={() => setBulkOpen(false)} roomType={roomType} hotelId={hotelId} onDone={() => { setBulkOpen(false); load(); }} />
    </div>
  );
}
