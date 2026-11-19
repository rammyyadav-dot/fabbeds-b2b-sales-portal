import { useState, useEffect, useMemo, useCallback } from 'react';
import { getRoomAllotments, getRoomTypes, saveRoomAllotment } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Skeleton } from '@project/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, parseISO, subDays, differenceInDays } from 'date-fns';
import AllocationGrid, { AllotmentMap, AllotmentEntry } from './AllocationGrid';
import AllocationDatePicker from './AllocationDatePicker';
import QuickActionsBar from './QuickActionsBar';

interface Props { hotelId: string; }

export default function RoomAllocationTab({ hotelId }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [viewDays, setViewDays] = useState(31);
  const [allotmentMap, setAllotmentMap] = useState<AllotmentMap>({});
  const [roomTypeName, setRoomTypeName] = useState('Standard Room');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedData, setEditedData] = useState<AllotmentMap>({});

  const endDate = format(addDays(parseISO(startDate), viewDays - 1), 'yyyy-MM-dd');

  const dates = useMemo(() =>
    Array.from({ length: viewDays }, (_, i) => format(addDays(parseISO(startDate), i), 'yyyy-MM-dd')),
    [startDate, viewDays]
  );

  const monthLabel = useMemo(() => {
    if (dates.length === 0) return '';
    const first = parseISO(dates[0]);
    const last = parseISO(dates[dates.length - 1]);
    const fl = format(first, 'MMMM yyyy');
    const ll = format(last, 'MMMM yyyy');
    return fl === ll ? fl : `${fl} | ${ll}`;
  }, [dates]);

  useEffect(() => {
    getRoomTypes({ hotelId }).then(r => {
      if (r.roomTypes.length > 0) setRoomTypeName(r.roomTypes[0].roomTypeName ?? 'Standard Room');
    });
  }, [hotelId]);

  const loadAllotments = useCallback(() => {
    setLoading(true);
    getRoomAllotments({ hotelId, startDate, endDate })
      .then(r => {
        const map: AllotmentMap = {};
        r.allotments.forEach(a => {
          if (a.date) {
            map[a.date.slice(0, 10)] = {
              id: a.id,
              roomsOnAllotment: a.roomsOnAllotment ?? 0,
              roomsBlocked: a.roomsBlocked ?? 0,
              releaseDays: a.releaseDays ?? 0,
              releaseHour: a.releaseHour ?? 18,
              onRequest: a.onRequest ?? 0,
              isOpen: (a.onRequest ?? 0) !== 1,
            };
          }
        });
        setAllotmentMap(map);
        setEditedData({});
      })
      .finally(() => setLoading(false));
  }, [hotelId, startDate, endDate]);

  useEffect(() => { loadAllotments(); }, [loadAllotments]);

  const handleDateApply = (start: string, end: string) => {
    setStartDate(start);
    const diff = differenceInDays(parseISO(end), parseISO(start)) + 1;
    setViewDays(Math.max(1, diff));
  };

  const navigate = (direction: 'prev' | 'next') => {
    const newStart = format(
      direction === 'prev' ? subDays(parseISO(startDate), viewDays) : addDays(parseISO(startDate), viewDays),
      'yyyy-MM-dd'
    );
    setStartDate(newStart);
  };

  const BASE: AllotmentEntry = { roomsOnAllotment: 0, roomsBlocked: 0, releaseDays: 0, releaseHour: 18, onRequest: 0, isOpen: true };

  const handleCellChange = useCallback((date: string, field: keyof AllotmentEntry, value: number | boolean) => {
    setEditedData(prev => {
      const existing = allotmentMap[date] ?? BASE;
      const current = prev[date] ?? {};
      return { ...prev, [date]: { ...BASE, ...existing, ...current, [field]: value } };
    });
  }, [allotmentMap]);

  // Bulk: set allocation for all visible dates
  const handleBulkAllocation = useCallback((value: number) => {
    setEditedData(prev => {
      const updated = { ...prev };
      dates.forEach(date => {
        const existing = allotmentMap[date] ?? BASE;
        updated[date] = { ...BASE, ...existing, ...updated[date], roomsOnAllotment: value };
      });
      return updated;
    });
    toast.success(`Allocation set to ${value} for ${dates.length} dates`);
  }, [dates, allotmentMap]);

  // Bulk: set release period for all visible dates
  const handleUpdateRelease = useCallback((days: number) => {
    setEditedData(prev => {
      const updated = { ...prev };
      dates.forEach(date => {
        const existing = allotmentMap[date] ?? BASE;
        updated[date] = { ...BASE, ...existing, ...updated[date], releaseDays: days };
      });
      return updated;
    });
    toast.success(`Release period set to ${days} day(s) for ${dates.length} dates`);
  }, [dates, allotmentMap]);

  // Copy allocation settings to a target date range
  const handleCopyToRange = useCallback((targetStart: string, targetEnd: string, allocation: number, relDays: number) => {
    const targetDates: string[] = [];
    let cur = parseISO(targetStart);
    const end = parseISO(targetEnd);
    while (cur <= end) { targetDates.push(format(cur, 'yyyy-MM-dd')); cur = addDays(cur, 1); }
    setEditedData(prev => {
      const updated = { ...prev };
      targetDates.forEach(date => {
        const existing = allotmentMap[date] ?? BASE;
        updated[date] = { ...BASE, ...existing, ...updated[date], roomsOnAllotment: allocation, releaseDays: relDays };
      });
      return updated;
    });
    toast.success(`Staged ${targetDates.length} dates — click Save All Changes to persist`);
  }, [allotmentMap]);

  const mergedMap = useMemo(() => {
    const merged = { ...allotmentMap };
    Object.entries(editedData).forEach(([date, data]) => { merged[date] = { ...merged[date], ...data }; });
    return merged;
  }, [allotmentMap, editedData]);

  const handleSave = async () => {
    const changes = Object.entries(editedData);
    if (changes.length === 0) { toast.info('No changes to save'); return; }
    setSaving(true);
    try {
      for (const [date, data] of changes) {
        await saveRoomAllotment({
          id: allotmentMap[date]?.id,
          hotelId, date,
          totalRooms: data.roomsOnAllotment,
          roomsOnAllotment: data.roomsOnAllotment,
          roomsBlocked: data.roomsBlocked,
          releaseDays: data.releaseDays,
          releaseHour: data.releaseHour,
          onRequest: data.isOpen === false ? 1 : 0,
        });
      }
      toast.success(`Saved ${changes.length} allotment(s)`);
      loadAllotments();
    } catch { toast.error('Failed to save allotments'); }
    finally { setSaving(false); }
  };

  // Representative values for dialogs (use first date's merged values)
  const firstEntry = mergedMap[dates[0]];
  const currentAllocation = firstEntry?.roomsOnAllotment ?? 20;
  const currentReleaseDays = firstEntry?.releaseDays ?? 0;

  return (
    <div className="space-y-3">
      {/* Date Range Controls */}
      <div className="flex items-end gap-4 flex-wrap border border-gray-200 rounded-lg p-3 bg-white">
        <div className="flex-1 min-w-[300px]">
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Display Date Range</label>
          <AllocationDatePicker startDate={startDate} endDate={endDate} onApply={handleDateApply} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">View Days</label>
          <div className="flex items-center gap-2">
            <Select value={String(viewDays)} onValueChange={v => setViewDays(Number(v))}>
              <SelectTrigger className="w-[110px] h-9 border-gray-300"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[7, 14, 31, 60, 90].map(d => (
                  <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setStartDate(format(new Date(), 'yyyy-MM-dd'))}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white px-4">Go</Button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActionsBar
        dateCount={dates.length}
        currentAllocation={currentAllocation}
        currentReleaseDays={currentReleaseDays}
        onBulkAllocation={handleBulkAllocation}
        onUpdateRelease={handleUpdateRelease}
        onCopyToRange={handleCopyToRange}
        onSaveAll={handleSave}
        saving={saving}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate('prev')} className="flex items-center gap-1 text-sm">
          <ChevronLeft className="w-4 h-4" /> Prev {viewDays} days
        </Button>
        <h3 className="font-semibold text-base text-gray-800">{monthLabel}</h3>
        <Button variant="outline" size="sm" onClick={() => navigate('next')} className="flex items-center gap-1 text-sm">
          Next {viewDays} days <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton className="h-72 w-full rounded-lg" />
      ) : (
        <AllocationGrid
          dates={dates}
          roomTypeName={roomTypeName}
          allotmentMap={mergedMap}
          onCellChange={handleCellChange}
        />
      )}

      {/* Save */}
      <div className="flex justify-center pt-2 pb-1">
        <Button onClick={handleSave} disabled={saving} className="px-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
          {saving ? 'Saving...' : 'Save & Update'}
        </Button>
      </div>
    </div>
  );
}
