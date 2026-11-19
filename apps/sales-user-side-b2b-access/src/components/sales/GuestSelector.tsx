import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Button } from '@project/components/ui/button';
import { ChevronDown, ChevronUp, AlertTriangle, Users } from 'lucide-react';
import { Filters, RoomConfig } from './SearchFilters';

const MAX_ROOMS = 6;
const MAX_ADULTS_PER_ROOM = 3;
const MAX_CHILDREN_PER_ROOM = 2;
const MAX_GUESTS_PER_ROOM = 4; // adults + children combined

function childAgeLabel(age: number) {
  if (age === 0) return 'Under 1 yr';
  if (age <= 4) return `${age} yr${age > 1 ? 's' : ''} (free)`;
  if (age <= 11) return `${age} yrs`;
  return `${age} yrs (teen)`;
}

function deriveFlat(configs: RoomConfig[]) {
  return {
    adults: configs.reduce((s, r) => s + r.adults, 0),
    children: configs.reduce((s, r) => s + r.children, 0),
    childAges: configs.flatMap(r => r.childAges),
    rooms: configs.length,
  };
}

interface RoomRowProps {
  room: RoomConfig;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<RoomConfig>) => void;
  onSetChildAge: (ci: number, age: number) => void;
}

function RoomRow({ room, index, expanded, onToggle, onChange, onSetChildAge }: RoomRowProps) {
  const maxChildrenAllowed = Math.min(MAX_CHILDREN_PER_ROOM, MAX_GUESTS_PER_ROOM - room.adults);
  const maxAdultsAllowed = Math.min(MAX_ADULTS_PER_ROOM, MAX_GUESTS_PER_ROOM - room.children);
  const allAgesSet = room.children === 0 || (room.childAges.length === room.children && room.childAges.every(a => a >= 0));

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-semibold text-foreground">Room {index + 1}</span>
          <span className="text-xs text-muted-foreground">
            {room.adults} adult{room.adults !== 1 ? 's' : ''}
            {room.children > 0 ? ` · ${room.children} child${room.children !== 1 ? 'ren' : ''}` : ''}
            {!allAgesSet && <span className="text-destructive ml-1">⚠</span>}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-2.5 bg-white">
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Adults</p>
              <Select value={String(room.adults)} onValueChange={(v) => onChange({ adults: Number(v) })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxAdultsAllowed }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} Adult{n > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Children <span className="text-muted-foreground/60">(0–11)</span></p>
              <Select value={String(room.children)} onValueChange={(v) => onChange({ children: Number(v) })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxChildrenAllowed + 1 }, (_, i) => i).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} Child{n !== 1 ? 'ren' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {room.children > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2 space-y-2">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Child ages required for pricing</p>
              {Array.from({ length: room.children }, (_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-14 shrink-0">Child {j + 1} age</span>
                  <Select
                    value={(room.childAges[j] ?? -1) >= 0 ? String(room.childAges[j]) : ''}
                    onValueChange={(v) => onSetChildAge(j, Number(v))}
                  >
                    <SelectTrigger className={`flex-1 h-8 text-xs ${(room.childAges[j] ?? -1) < 0 ? 'border-destructive' : 'border-amber-300'}`}>
                      <SelectValue placeholder="Select age" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, age) => (
                        <SelectItem key={age} value={String(age)}>{childAgeLabel(age)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props { filters: Filters; onChange: (f: Filters) => void; onClose: () => void; }

export default function GuestSelector({ filters, onChange, onClose }: Props) {
  const configs: RoomConfig[] = filters.roomConfigs?.length
    ? filters.roomConfigs
    : [{ adults: Math.min(filters.adults || 2, MAX_ADULTS_PER_ROOM), children: Math.min(filters.children || 0, MAX_CHILDREN_PER_ROOM), childAges: filters.childAges || [] }];

  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set([0]));

  const setConfigs = (next: RoomConfig[]) =>
    onChange({ ...filters, ...deriveFlat(next), roomConfigs: next });

  const setRoomCount = (count: number) => {
    const next = Array.from({ length: count }, (_, i) => configs[i] ?? { adults: 2, children: 0, childAges: [] });
    setConfigs(next);
    // Auto-expand the new room
    if (count > configs.length) setExpandedRooms(prev => new Set([...prev, count - 1]));
  };

  const updateRoom = (i: number, patch: Partial<RoomConfig>) => {
    setConfigs(configs.map((r, idx) => {
      if (idx !== i) return r;
      const updated = { ...r, ...patch };
      if (patch.children !== undefined)
        updated.childAges = Array.from({ length: patch.children }, (_, j) => r.childAges[j] ?? -1);
      if (patch.adults !== undefined && updated.adults + updated.children > MAX_GUESTS_PER_ROOM)
        updated.children = Math.max(0, MAX_GUESTS_PER_ROOM - updated.adults);
      return updated;
    }));
  };

  const setChildAge = (ri: number, ci: number, age: number) => {
    const ages = [...configs[ri].childAges];
    ages[ci] = age;
    updateRoom(ri, { childAges: ages });
  };

  const toggleRoom = (i: number) => {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const allAgesSet = configs.every(r => r.children === 0 || (r.childAges.length === r.children && r.childAges.every(a => a >= 0)));
  const totalGuests = configs.reduce((s, r) => s + r.adults + r.children, 0);

  return (
    <div className="space-y-3 w-[320px] max-h-[75vh] overflow-y-auto pr-1">
      {/* Room count selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground w-28 shrink-0">No. of Rooms</span>
        <Select value={String(configs.length)} onValueChange={(v) => setRoomCount(Number(v))}>
          <SelectTrigger className="flex-1 h-9 text-sm border-primary/30"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: MAX_ROOMS }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{i + 1} Room{i > 0 ? 's' : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-px bg-border" />

      {/* Per-room accordion */}
      <div className="space-y-2">
        {configs.map((room, i) => (
          <RoomRow
            key={i}
            room={room}
            index={i}
            expanded={expandedRooms.has(i)}
            onToggle={() => toggleRoom(i)}
            onChange={(patch) => updateRoom(i, patch)}
            onSetChildAge={(ci, age) => setChildAge(i, ci, age)}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground text-center">
        {totalGuests} guest{totalGuests !== 1 ? 's' : ''} · {configs.length} room{configs.length !== 1 ? 's' : ''}
        {' · '}max {MAX_ADULTS_PER_ROOM} adults, {MAX_CHILDREN_PER_ROOM} children per room
      </div>

      {!allAgesSet && (
        <p className="text-xs text-amber-700 flex items-center gap-1.5 bg-amber-50 px-2 py-1.5 rounded-md">
          <AlertTriangle className="w-3 h-3 shrink-0" /> Select all child ages to continue.
        </p>
      )}

      <Button size="sm" className="w-full" onClick={onClose} disabled={!allAgesSet}>Done</Button>
    </div>
  );
}
