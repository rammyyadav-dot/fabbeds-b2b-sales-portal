import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Minus, Plus, Search, Trash2, Baby } from 'lucide-react';
import DateRangeCalendar from './DateRangeCalendar';

interface DailyRate { date: string; displayRate: number; status: string; }

interface RoomConfig { adults: number; children: number; childAges: string[]; }

interface SearchParams {
  checkIn: string; checkOut: string;
  adults: number; children: number; rooms: number; childAges: number[];
}

interface Props {
  initial: SearchParams;
  onApply: (p: SearchParams) => void;
  onCancel: () => void;
  dailyRates?: DailyRate[];
}

function Counter({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-7 h-7 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-6 text-center text-sm font-bold">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-7 h-7 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function RoomPanel({ room, index, total, onChange, onRemove }: {
  room: RoomConfig; index: number; total: number;
  onChange: (r: RoomConfig) => void; onRemove: () => void;
}) {
  const setAdults = (n: number) => onChange({ ...room, adults: n });
  const setChildren = (n: number) => {
    const ages = n > room.childAges.length
      ? [...room.childAges, ...Array(n - room.childAges.length).fill('')]
      : room.childAges.slice(0, n);
    onChange({ ...room, children: n, childAges: ages });
  };
  const setAge = (i: number, v: string) => {
    const ages = [...room.childAges]; ages[i] = v;
    onChange({ ...room, childAges: ages });
  };

  return (
    <div className="bg-white border border-border rounded-lg p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">Room {index + 1}</span>
        {total > 1 && (
          <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Adults</p>
          <p className="text-[10px] text-muted-foreground">Age 18+</p>
        </div>
        <Counter value={room.adults} min={1} max={8} onChange={setAdults} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Children</p>
          <p className="text-[10px] text-muted-foreground">Age 0–17</p>
        </div>
        <Counter value={room.children} min={0} max={6} onChange={setChildren} />
      </div>

      {room.children > 0 && (
        <div className="pt-1 border-t border-border/40 space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
            <Baby className="w-3 h-3" /> Child ages <span className="text-destructive">*</span>
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: room.children }).map((_, i) => (
              <Select key={i} value={room.childAges[i] ?? ''} onValueChange={(v) => setAge(i, v)}>
                <SelectTrigger className={`h-7 text-xs ${!room.childAges[i] ? 'border-destructive/50' : ''}`}>
                  <SelectValue placeholder="Age?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">&lt;1 yr</SelectItem>
                  {Array.from({ length: 17 }, (_, a) => a + 1).map(a => (
                    <SelectItem key={a} value={String(a)}>{a} yr</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function initRooms(p: SearchParams): RoomConfig[] {
  const perRoom = Math.max(1, Math.round(p.adults / Math.max(1, p.rooms)));
  return Array.from({ length: Math.max(1, p.rooms) }, (_, i) => ({
    adults: perRoom,
    children: i === 0 ? p.children : 0,
    childAges: i === 0 ? (p.childAges || []).map(String) : [],
  }));
}

export default function AvailabilitySearchForm({ initial, onApply, onCancel, dailyRates = [] }: Props) {
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [rooms, setRooms] = useState<RoomConfig[]>(() => initRooms(initial));
  const [calendarOpen, setCalendarOpen] = useState(!initial.checkIn || !initial.checkOut);

  const allAgesFilled = rooms.every(r => r.children === 0 || r.childAges.slice(0, r.children).every(a => a !== ''));
  const datesValid = !!checkIn && !!checkOut && checkIn < checkOut;
  const isValid = datesValid && allAgesFilled;

  const totalAdults = rooms.reduce((s, r) => s + r.adults, 0);
  const totalChildren = rooms.reduce((s, r) => s + r.children, 0);
  const allChildAges = rooms.flatMap(r => r.childAges.slice(0, r.children).map(Number).filter(n => !isNaN(n)));

  const toParams = (ci: string, co: string): SearchParams => ({
    checkIn: ci, checkOut: co,
    adults: totalAdults, children: totalChildren,
    rooms: rooms.length, childAges: allChildAges,
  });

  const updateRoom = (i: number, r: RoomConfig) => setRooms(prev => prev.map((x, j) => j === i ? r : x));
  const removeRoom = (i: number) => setRooms(prev => prev.filter((_, j) => j !== i));
  const addRoom = () => setRooms(prev => [...prev, { adults: 2, children: 0, childAges: [] }]);

  return (
    <div className="border-t border-amber-300 bg-amber-50/40 px-4 py-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start">

        {/* Compact calendar */}
        <div className="shrink-0">
          {calendarOpen ? (
            <>
              {!datesValid && (
                <p className="text-[10px] text-amber-700 font-medium mb-1">← Select check-in & check-out dates</p>
              )}
              <DateRangeCalendar
                startDate={checkIn} endDate={checkOut}
                onSelect={(s, e) => { setCheckIn(s); setCheckOut(e); setCalendarOpen(false); }}
                dailyRates={dailyRates}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="bg-white border border-border rounded-lg shadow-sm p-3 w-[280px] text-left hover:border-primary/60 transition-colors"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Dates</p>
              <p className="text-sm font-semibold text-foreground">
                {checkIn && checkOut
                  ? `${new Date(checkIn + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → ${new Date(checkOut + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Select dates'}
              </p>
              <p className="text-[10px] text-primary mt-1">Tap to change</p>
            </button>
          )}
        </div>

        {/* Per-room guest config */}
        <div className="flex-1 flex flex-col gap-2 min-w-[220px] max-h-[320px] overflow-y-auto pr-1">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide sticky top-0 bg-amber-50/80 pb-1">
            Guests & Rooms
            <span className="ml-2 font-normal text-muted-foreground normal-case">
              {totalAdults} adult{totalAdults !== 1 ? 's' : ''}{totalChildren > 0 ? `, ${totalChildren} child${totalChildren !== 1 ? 'ren' : ''}` : ''} · {rooms.length} room{rooms.length !== 1 ? 's' : ''}
            </span>
          </p>

          {rooms.map((room, i) => (
            <RoomPanel key={i} room={room} index={i} total={rooms.length}
              onChange={(r) => updateRoom(i, r)} onRemove={() => removeRoom(i)} />
          ))}

          {rooms.length < 8 && (
            <button type="button" onClick={addRoom}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline py-1">
              <Plus className="w-3.5 h-3.5" /> Add another room
            </button>
          )}

          <div className="flex gap-2 pt-1 sticky bottom-0 bg-amber-50/80">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs gap-1"
              onClick={() => onApply(toParams(checkIn, checkOut))}
              disabled={!isValid}
            >
              <Search className="w-3 h-3" /> Search
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
