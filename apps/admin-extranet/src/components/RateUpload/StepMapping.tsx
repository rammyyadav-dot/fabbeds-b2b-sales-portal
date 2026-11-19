import { useEffect, useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { AlertCircle, CheckCircle2, Wand2, Loader2 } from 'lucide-react';
import { ParsedRateLine } from '@/utils/rateFileParser';
import { GetRoomTypesOutputType } from 'zitejs/api';
import { autoCreateRoomTypes } from 'zitejs/api';
import { toast } from 'sonner';

type RoomType = GetRoomTypesOutputType['roomTypes'][0];

const MEAL_OPTIONS = [
  { value: 'RO', label: 'RO — Room Only' },
  { value: 'BB', label: 'BB — Bed & Breakfast' },
  { value: 'HB', label: 'HB — Half Board' },
  { value: 'HB+', label: 'HB+ — Half Board Plus' },
  { value: 'FB', label: 'FB — Full Board' },
  { value: 'AI', label: 'AI — All Inclusive' },
];

interface Props {
  lines: ParsedRateLine[];
  roomTypes: RoomType[];
  hotelId: string;
  layer?: string;
  roomMapping: Record<string, { id: string; name: string }>;
  mealMapping: Record<string, string>;
  onRoomMap: (label: string, id: string, name: string) => void;
  onMealMap: (label: string, code: string) => void;
  onRoomTypesCreated: (newRoomTypes: RoomType[]) => void;
  onNext: () => void;
  onBack: () => void;
}

function normLabel(s: string) {
  return s.toLowerCase().replace(/\s*\(.*?\)/g, '').trim();
}

function autoMatchRoom(label: string, roomTypes: RoomType[]): RoomType | undefined {
  const norm = normLabel(label);
  return roomTypes.find(rt => normLabel(rt.roomTypeName ?? '').includes(norm) || norm.includes(normLabel(rt.roomTypeName ?? '')));
}

export default function StepMapping({ lines, roomTypes, hotelId, layer, roomMapping, mealMapping, onRoomMap, onMealMap, onRoomTypesCreated, onNext, onBack }: Props) {
  const [autoCreating, setAutoCreating] = useState(false);
  const uniqueRoomLabels = [...new Set(lines.map(l => l.roomLabel))];
  const uniqueMealLabels = [...new Set(lines.map(l => l.mealLabel))];

  // Auto-suggest on mount
  useEffect(() => {
    for (const label of uniqueRoomLabels) {
      if (!roomMapping[label]) {
        const match = autoMatchRoom(label, roomTypes);
        if (match) onRoomMap(label, match.id, match.roomTypeName ?? '');
      }
    }
    for (const label of uniqueMealLabels) {
      if (!mealMapping[label]) {
        const norm = label.toUpperCase().replace(/\s+/g, '');
        const found = MEAL_OPTIONS.find(o => o.value === norm || norm.startsWith(o.value));
        if (found) onMealMap(label, found.value);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unmappedRooms = uniqueRoomLabels.filter(l => !roomMapping[l]);
  const unmappedMeals = uniqueMealLabels.filter(l => !mealMapping[l]);
  const canNext = unmappedRooms.length === 0 && unmappedMeals.length === 0;

  const handleAutoCreate = async () => {
    if (unmappedRooms.length === 0) return;
    setAutoCreating(true);
    try {
      const created = await autoCreateRoomTypes({ hotelId, labels: unmappedRooms, layer });
      // Build synthetic RoomType objects to add to the list
      const newRoomTypes: RoomType[] = created.map(c => ({
        id: c.roomTypeId,
        roomTypeName: c.roomTypeName,
      } as RoomType));
      onRoomTypesCreated(newRoomTypes);
      // Auto-map each created room type
      for (const c of created) {
        onRoomMap(c.label, c.roomTypeId, c.roomTypeName);
      }
      toast.success(`Created ${created.length} room type${created.length > 1 ? 's' : ''}. Rate plans will be created after meal mapping.`);
    } catch (e: any) {
      toast.error('Auto-create failed: ' + (e.message ?? ''));
    } finally {
      setAutoCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Room Type Mapping */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm">Room Type Mapping</h3>
          {unmappedRooms.length > 0
            ? <Badge variant="destructive" className="text-[10px]">{unmappedRooms.length} unmapped</Badge>
            : <Badge className="text-[10px] bg-green-500">All mapped ✓</Badge>}
          {unmappedRooms.length > 0 && (
            <Button size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1.5" onClick={handleAutoCreate} disabled={autoCreating}>
              {autoCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              {autoCreating ? 'Creating…' : `Auto-create ${unmappedRooms.length} new`}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {uniqueRoomLabels.map(label => (
            <div key={label} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold truncate">{label}</p>
                <p className="text-[10px] text-muted-foreground">from file</p>
              </div>
              <span className="text-muted-foreground text-sm">→</span>
              <div className="w-48">
                <Select
                  value={roomMapping[label]?.id ?? ''}
                  onValueChange={v => {
                    const rt = roomTypes.find(r => r.id === v);
                    if (rt) onRoomMap(label, rt.id, rt.roomTypeName ?? '');
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.roomTypeName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {roomMapping[label]
                ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                : <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Meal Plan Mapping */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Meal Plan Mapping</h3>
          {unmappedMeals.length > 0
            ? <Badge variant="destructive" className="text-[10px]">{unmappedMeals.length} unmapped</Badge>
            : <Badge className="text-[10px] bg-green-500">All mapped ✓</Badge>}
        </div>
        <div className="space-y-2">
          {uniqueMealLabels.map(label => (
            <div key={label} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold">{label}</p>
                <p className="text-[10px] text-muted-foreground">from file</p>
              </div>
              <span className="text-muted-foreground text-sm">→</span>
              <div className="w-48">
                <Select value={mealMapping[label] ?? ''} onValueChange={v => onMealMap(label, v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select meal plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {mealMapping[label]
                ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                : <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {!canNext && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          All room types and meal plans must be mapped before continuing.
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button disabled={!canNext} onClick={onNext}>Next: Validate →</Button>
      </div>
    </div>
  );
}
