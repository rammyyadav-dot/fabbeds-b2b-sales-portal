import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Skeleton } from '@project/components/ui/skeleton';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { getRoomAllotments, saveRoomAllotment, GetRoomAllotmentsOutputType } from 'zitejs/api';
import { toast } from 'sonner';
import { format, getDaysInMonth } from 'date-fns';

type Allotment = GetRoomAllotmentsOutputType['allotments'][0];

interface Props { hotelId: string; }

export default function AllotmentCalendar({ hotelId }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [loading, setLoading] = useState(false);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState<Allotment | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();

  const load = () => {
    setLoading(true);
    getRoomAllotments({ hotelId, year, month }).then(r => setAllotments(r.allotments)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [hotelId, year, month]);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const startDay = isCurrentMonth ? today.getDate() : 1;
  const days = Array.from({ length: daysInMonth - startDay + 1 }, (_, i) => {
    const d = startDay + i;
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });

  const allotmentMap = new Map(allotments.map(a => [a.date?.slice(0, 10) ?? '', a]));

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const openEdit = (date: string) => {
    const rec = allotmentMap.get(date);
    setEditDate(date);
    setEditRecord(rec || null);
    reset({ totalRooms: rec?.totalRooms ?? '', roomsOnAllotment: rec?.roomsOnAllotment ?? '', roomsBlocked: rec?.roomsBlocked ?? 0 });
  };

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      await saveRoomAllotment({ id: editRecord?.id, hotelId, date: editDate!, totalRooms: Number(data.totalRooms), roomsOnAllotment: Number(data.roomsOnAllotment), roomsBlocked: Number(data.roomsBlocked || 0) });
      toast.success('Allotment saved');
      setEditDate(null);
      load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="font-semibold text-foreground min-w-[120px] text-center">{MONTH_NAMES[month - 1]} {year}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">Click a date to set allotment</p>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="grid grid-cols-7 sm:grid-cols-10 lg:grid-cols-14 gap-1 p-3">
            {days.map(date => {
              const a = allotmentMap.get(date);
              const day = Number(date.slice(8));
              const avail = a ? (a.totalRooms ?? 0) - (a.roomsOnAllotment ?? 0) - (a.roomsBlocked ?? 0) : null;
              const isFull = avail !== null && avail <= 0;
              const isLow = avail !== null && avail > 0 && avail <= 2;
              return (
                <button key={date} onClick={() => openEdit(date)}
                  className={`rounded-lg border p-1.5 text-center transition-colors hover:border-primary hover:bg-primary/5 ${
                    isFull ? 'border-red-300 bg-red-50' : isLow ? 'border-orange-300 bg-orange-50' : a ? 'border-green-300 bg-green-50' : 'border-border bg-background'
                  }`}>
                  <div className="text-xs font-bold text-foreground">{day}</div>
                  {a ? (
                    <>
                      <div className={`text-xs font-semibold mt-0.5 ${isFull ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-green-600'}`}>
                        {avail}/{a.totalRooms}
                      </div>
                      <div className="text-xs text-muted-foreground">avail</div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1">—</div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 px-3 pb-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 inline-block" /> Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-200 inline-block" /> Low (≤2)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> Full</span>
          </div>
        </div>
      )}

      <Dialog open={!!editDate} onOpenChange={() => setEditDate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Allotment for {editDate ? format(new Date(editDate + 'T00:00:00'), 'dd MMM yyyy') : ''}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Total Rooms *</Label>
              <Input type="number" {...register('totalRooms', { required: true })} min={0} placeholder="e.g. 10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>On Allotment</Label>
                <Input type="number" {...register('roomsOnAllotment')} min={0} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Blocked</Label>
                <Input type="number" {...register('roomsBlocked')} min={0} placeholder="0" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDate(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
