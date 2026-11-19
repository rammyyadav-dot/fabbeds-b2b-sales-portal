import { useEffect, useState } from 'react';
import { Switch } from '@project/components/ui/switch';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Badge } from '@project/components/ui/badge';
import { getRoomAllotments } from 'zitejs/api';
import { PackageOpen, Info } from 'lucide-react';

export type AvailabilityData = {
  allocation: { on: boolean; value: string; releaseDay: string; releaseHour: string };
};

interface Props {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  data: AvailabilityData;
  onChange: (d: AvailabilityData) => void;
  hotelId?: string;
}

type Row = { key: keyof AvailabilityData; label: string };
const ROWS: Row[] = [{ key: 'allocation', label: 'Allocation' }];

const DAYS = [
  { value: 'Ch', label: 'Ch' },
  ...Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}d` })),
];
const HOURS = [
  { value: 'Up', label: 'Up' },
  { value: '6', label: '06:00' },
  { value: '12', label: '12:00' },
  { value: '18', label: '18:00' },
  { value: '23', label: '23:00' },
];

type AllotmentSummary = { total: number; onAllotment: number; blocked: number; remaining: number } | null;

export default function AvailabilityPanel({ enabled, onToggle, data, onChange, hotelId }: Props) {
  const [allotment, setAllotment] = useState<AllotmentSummary>(null);

  useEffect(() => {
    if (!hotelId || !enabled) return;
    const now = new Date();
    getRoomAllotments({ hotelId, year: now.getFullYear(), month: now.getMonth() + 1 })
      .then(res => {
        const today = now.toISOString().split('T')[0];
        const todayRec = res.allotments.find(a => a.date?.startsWith(today));
        if (todayRec) {
          const total = todayRec.totalRooms ?? 0;
          const onAllotment = todayRec.roomsOnAllotment ?? 0;
          const blocked = todayRec.roomsBlocked ?? 0;
          setAllotment({ total, onAllotment, blocked, remaining: onAllotment - blocked });
        }
      }).catch(() => {});
  }, [hotelId, enabled]);

  const update = (key: keyof AvailabilityData, field: string, val: string | boolean) => {
    onChange({ ...data, [key]: { ...data[key], [field]: val } });
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b">
        <span className="font-semibold text-sm">Availability</span>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>

      {enabled && (
        <>
          {/* Allotment summary */}
          {allotment && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3 border border-border">
              <PackageOpen className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Today's Allotment</p>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs">Total: <b>{allotment.total}</b></span>
                  <span className="text-xs">On Allot.: <b>{allotment.onAllotment}</b></span>
                  <span className="text-xs">Blocked: <b>{allotment.blocked}</b></span>
                </div>
              </div>
              <Badge className={`text-sm font-bold px-3 py-1 ${allotment.remaining > 5 ? 'bg-green-100 text-green-700 border-green-200' : allotment.remaining > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                {allotment.remaining} left
              </Badge>
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
            <span />
            <span className="text-center">Update</span>
            <span className="text-center">Alloc.</span>
          </div>

          {/* Rows */}
          {ROWS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              {/* Row 1: Label + Update + Alloc */}
              <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <button
                  onClick={() => update(key, 'on', !(data[key] as { on: boolean }).on)}
                  className={`h-11 rounded-lg text-sm font-bold border-2 transition-all shadow-sm w-full ${
                    (data[key] as { on: boolean }).on
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {(data[key] as { on: boolean }).on ? 'Yes' : 'No'}
                </button>
                <Input
                  type="number"
                  value={(data[key] as { value?: string }).value ?? ''}
                  onChange={e => update(key, 'value', e.target.value)}
                  className="h-11 text-base font-bold text-center border-2 border-primary/50 bg-background shadow-sm focus-visible:border-primary"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Row 2: Release Day + Release Hr */}
              <div className="grid grid-cols-2 gap-2 pl-0">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide text-center">Release Day</p>
                  <Select value={(data[key] as { releaseDay: string }).releaseDay} onValueChange={v => update(key, 'releaseDay', v)}>
                    <SelectTrigger className="h-10 text-sm font-semibold border-2 border-primary/30 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {DAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide text-center">Release Hr</p>
                  <Select value={(data[key] as { releaseHour: string }).releaseHour} onValueChange={v => update(key, 'releaseHour', v)}>
                    <SelectTrigger className="h-10 text-sm font-semibold border-2 border-primary/30 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Hint */}
              {(() => {
                const d = (data[key] as { releaseDay: string }).releaseDay;
                return d && d !== 'Ch' ? (
                  <p className="text-[10px] text-primary/70 flex items-center gap-1">
                    <Info className="w-2.5 h-2.5 shrink-0" /> {d}d before arrival → returns to open inventory
                  </p>
                ) : null;
              })()}
            </div>
          ))}

          {/* Legend */}
          <div className="pt-1 border-t text-[10px] text-muted-foreground space-y-0.5">
            <p><b>Allocation</b> — Fixed block of rooms contracted with OTA/Bedbank</p>
            <p><b>Framed Free Sale</b> — Bookable within a capped limit</p>
            <p><b>Release Day</b> — Days before arrival unsold rooms return to open inventory</p>
          </div>
        </>
      )}
    </div>
  );
}
