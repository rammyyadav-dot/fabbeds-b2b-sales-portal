import { useState, useEffect } from 'react';
import { getRoomTypes, getRatePlans, bulkSaveDailyRates, GetRoomTypesOutputType, GetRatePlansOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@project/components/ui/radio-group';
import { Label } from '@project/components/ui/label';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { Loader2, Lock, Save } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@project/components/ui/scroll-area';
import { cn } from '@project/components/lib/utils';
import DateRangesInput, { DateRange } from '@/components/QuickUpdate/DateRangesInput';
import DaysSelector from '@/components/QuickUpdate/DaysSelector';
import PricePanel, { PriceSlabs, OccupancyConfig } from '@/components/QuickUpdate/PricePanel';
import AvailabilityPanel, { AvailabilityData } from '@/components/QuickUpdate/AvailabilityPanel';
import RestrictionsPanel, { RestrictionsData } from '@/components/QuickUpdate/RestrictionsPanel';

type RoomType = GetRoomTypesOutputType['roomTypes'][0];
type RatePlan = GetRatePlansOutputType['ratePlans'][0];

const defaultSlabs = (): PriceSlabs => ({
  occ1: { on: false, value: '' }, occ2: { on: false, value: '' }, occ3: { on: false, value: '' },
  extraBed: { on: false, value: '' }, child1: { on: false, value: '' }, restChildren: { on: false, value: '' },
});
const defaultAvail = (): AvailabilityData => ({
  allocation: { on: false, value: '', releaseDay: 'Ch', releaseHour: 'Up' },
});
const defaultRestrictions = (): RestrictionsData => ({
  minStay: { on: false, value: 'None' }, maxStay: { on: false, value: 'None' },
  checkIn: { on: false, value: 'No' }, checkOut: { on: false, value: 'No' },
  leadPeriod: { on: false, value: '' }, cancellationPolicy: { on: false, value: '' },
});

export default function QuickUpdatePage() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [allRatePlans, setAllRatePlans] = useState<RatePlan[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [selectedRt, setSelectedRt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [ranges, setRanges] = useState<DateRange[]>([{ from: '', to: '' }]);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [updateBy, setUpdateBy] = useState('roomtype');
  const [ratePlanCode, setRatePlanCode] = useState('');
  const [priceEnabled, setPriceEnabled] = useState(true);
  const [availEnabled, setAvailEnabled] = useState(true);
  const [restrictEnabled, setRestrictEnabled] = useState(true);
  const [slabs, setSlabs] = useState<PriceSlabs>(defaultSlabs);
  const [avail, setAvail] = useState<AvailabilityData>(defaultAvail);
  const [restrictions, setRestrictions] = useState<RestrictionsData>(defaultRestrictions);
  const [hotelId, setHotelId] = useState(() => localStorage.getItem('selectedHotelId') ?? '');

  useEffect(() => {
    const onHotelChange = () => setHotelId(localStorage.getItem('selectedHotelId') ?? '');
    window.addEventListener('hotelChanged', onHotelChange);
    window.addEventListener('storage', onHotelChange);
    return () => {
      window.removeEventListener('hotelChanged', onHotelChange);
      window.removeEventListener('storage', onHotelChange);
    };
  }, []);

  // Fetch room types when hotel changes
  useEffect(() => {
    setLoading(true);
    getRoomTypes({ hotelId: hotelId || undefined }).then(r => {
      setRoomTypes(r.roomTypes);
      if (r.roomTypes.length) setSelectedRt(r.roomTypes[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [hotelId]);

  // Fetch ALL rate plans for the hotel once, filter client-side by room type
  useEffect(() => {
    if (!hotelId) return;
    getRatePlans({ hotelId }).then(r => {
      setAllRatePlans(r.ratePlans);
    }).catch(() => setAllRatePlans([]));
  }, [hotelId]);

  // Filter rate plans client-side whenever room type or allRatePlans changes
  useEffect(() => {
    setRatePlanCode('');
    const filtered = allRatePlans.filter(p => {
      if (p.status !== 'Active') return false;
      if (!selectedRt) return true;
      const rtId = Array.isArray(p.roomType) ? p.roomType[0] : p.roomType;
      return rtId === selectedRt;
    });
    setRatePlans(filtered);
  }, [selectedRt, allRatePlans]);

  const validate = () => {
    const validRanges = ranges.filter(r => r.from && r.to);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!selectedRt) { toast.error('Please select a room type'); return null; }
    if (!hotelId) { toast.error('Please select a hotel from the top bar'); return null; }
    if (updateBy === 'roomtype' && !ratePlanCode) { toast.error('Please select a Rate Plan before applying'); return null; }
    if (validRanges.length === 0) { toast.error('Please enter at least one date range'); return null; }

    for (const range of validRanges) {
      const from = new Date(range.from + 'T00:00:00');
      const to = new Date(range.to + 'T00:00:00');
      if (from < today || to < today) {
        toast.error('Back-dated Quick Updates are not allowed. Select today or a future date.');
        return null;
      }
      if (to < from) {
        toast.error('To date must be the same as or after From date.');
        return null;
      }
    }

    if (days.length === 0) { toast.error('Please select at least one day of the week'); return null; }
    return validRanges;
  };

  const runBulk = async (overrides: Parameters<typeof bulkSaveDailyRates>[0], validRanges: DateRange[]) => {
    let total = 0;
    for (const range of validRanges) {
      const res = await bulkSaveDailyRates({ ...overrides, startDate: range.from, endDate: range.to });
      total += res.count;
    }
    return total;
  };

  const handleApply = async () => {
    const validRanges = validate();
    if (!validRanges) return;
    setSaving(true);
    try {
      const base = {
        roomTypeId: selectedRt, hotelId, startDate: '', endDate: '',
        daysOfWeek: days,
        ratePlanId: ratePlanCode || undefined,
        adult1Rate: priceEnabled && slabs.occ1.on && slabs.occ1.value ? Number(slabs.occ1.value) : undefined,
        adult2Rate: priceEnabled && slabs.occ2.on && slabs.occ2.value ? Number(slabs.occ2.value) : undefined,
        adult3Rate: priceEnabled && slabs.occ3.on && slabs.occ3.value ? Number(slabs.occ3.value) : undefined,
        extraBedRate: priceEnabled && slabs.extraBed.on && slabs.extraBed.value ? Number(slabs.extraBed.value) : undefined,
        childSupplement: priceEnabled && slabs.child1.on && slabs.child1.value ? Number(slabs.child1.value) : undefined,
        allocation: availEnabled && avail.allocation.on && avail.allocation.value ? Number(avail.allocation.value) : undefined,
        minStay: restrictEnabled && restrictions.minStay.on && restrictions.minStay.value && restrictions.minStay.value !== 'None' ? Number(restrictions.minStay.value) : undefined,
        source: 'Quick Update' as const,
      };
      const total = await runBulk(base, validRanges);
      const rt = roomTypes.find(r => r.id === selectedRt);
      const rp = ratePlans.find(p => p.id === ratePlanCode);
      toast.success(`✓ Applied to ${total} dates — ${rt?.roomTypeName ?? 'room'}${rp ? ` · ${rp.ratePlanName}` : ''}`);
    } catch {
      toast.error('Failed to apply changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAndLock = async () => {
    const validRanges = validate();
    if (!validRanges) return;
    setSaving(true);
    try {
      const base = {
        roomTypeId: selectedRt, hotelId, startDate: '', endDate: '',
        daysOfWeek: days,
        ratePlanId: ratePlanCode || undefined,
        adult1Rate: priceEnabled && slabs.occ1.on && slabs.occ1.value ? Number(slabs.occ1.value) : undefined,
        adult2Rate: priceEnabled && slabs.occ2.on && slabs.occ2.value ? Number(slabs.occ2.value) : undefined,
        adult3Rate: priceEnabled && slabs.occ3.on && slabs.occ3.value ? Number(slabs.occ3.value) : undefined,
        extraBedRate: priceEnabled && slabs.extraBed.on && slabs.extraBed.value ? Number(slabs.extraBed.value) : undefined,
        childSupplement: priceEnabled && slabs.child1.on && slabs.child1.value ? Number(slabs.child1.value) : undefined,
        status: 'Stop Sale' as const, allocation: 0,
        minStay: restrictEnabled && restrictions.minStay.on && restrictions.minStay.value && restrictions.minStay.value !== 'None' ? Number(restrictions.minStay.value) : undefined,
        source: 'Quick Update' as const,
      };
      const total = await runBulk(base, validRanges);
      const rt = roomTypes.find(r => r.id === selectedRt);
      toast.success(`🔒 Applied & locked for ${total} dates — ${rt?.roomTypeName ?? 'room type'}`);
    } catch {
      toast.error('Failed to apply & lock. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLockOnly = async () => {
    const validRanges = validate();
    if (!validRanges) return;
    setLocking(true);
    try {
      const base = {
        roomTypeId: selectedRt, hotelId, startDate: '', endDate: '',
        daysOfWeek: days, status: 'Stop Sale' as const, allocation: 0,
        ratePlanId: ratePlanCode || undefined,
        source: 'Quick Update' as const,
      };
      const total = await runBulk(base, validRanges);
      const rt = roomTypes.find(r => r.id === selectedRt);
      toast.success(`🔒 Locked ${total} dates for ${rt?.roomTypeName ?? 'room type'}`);
    } catch {
      toast.error('Failed to lock dates. Please try again.');
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Quick Update</h1>
      </div>

      {/* Room Type Tabs */}
      {loading ? <Skeleton className="h-10 w-full" /> : (
        <ScrollArea className="w-full border rounded-t-lg">
          <div className="flex">
            {roomTypes.map(rt => (
              <button key={rt.id} onClick={() => setSelectedRt(rt.id)}
                className={cn('px-4 py-2.5 text-sm whitespace-nowrap border-r transition-colors',
                  selectedRt === rt.id ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50'
                )}>
                {rt.roomTypeName}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {/* Filter Form */}
      <div className="border rounded-b-lg border-t-0 p-4 space-y-4 bg-card">
        <DateRangesInput ranges={ranges} onChange={setRanges} />
        <DaysSelector selected={days} onChange={setDays} />
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-muted-foreground w-14 shrink-0">Update By</span>
          <RadioGroup value={updateBy} onValueChange={setUpdateBy} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="roomtype" id="rb-rt" />
              <Label htmlFor="rb-rt" className="text-sm cursor-pointer">Room Type and Rate Plan</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="allotment" id="rb-al" />
              <Label htmlFor="rb-al" className="text-sm cursor-pointer">Allotment Pool</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-muted-foreground w-14 shrink-0 pt-1.5">Rate Plan</span>
          <div className="space-y-1.5">
            <Select value={ratePlanCode} onValueChange={setRatePlanCode}>
              <SelectTrigger className="w-72 h-8 text-sm">
                <SelectValue placeholder="-- Select Rate Plan --" />
              </SelectTrigger>
              <SelectContent>
                {ratePlans.length === 0
                  ? <div className="px-3 py-2 text-xs text-muted-foreground italic">No active rate plans for this room type. Create a rate plan with Status = Active and a Rate Plan Code set.</div>
                  : ratePlans.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.ratePlanCode ? `[${p.ratePlanCode}] ` : ''}{p.ratePlanName}{p.layer ? ` · ${p.layer}` : ''}
                      </SelectItem>
                    ))
                }
              </SelectContent>
            </Select>
            {ratePlanCode && (
              <p className="text-[11px] text-muted-foreground">
                Source market: <strong>{ratePlans.find(p => p.id === ratePlanCode)?.nationalityMarket || 'ALL'}</strong>
                {' · '}Public search eligibility follows this Rate Plan market profile.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Three Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PricePanel enabled={priceEnabled} onToggle={setPriceEnabled} slabs={slabs} onChange={setSlabs}
          occupancyConfig={(() => {
            const rt = roomTypes.find(r => r.id === selectedRt);
            if (!rt) return undefined;
            return { maxAdults: rt.maxAdults ?? 3, childAllowed: rt.childAllowed ?? true, extraBedAllowed: rt.extraBedAllowed ?? false, maxChildren: rt.maxChildren ?? 2 } as OccupancyConfig;
          })()}
        />
        <AvailabilityPanel enabled={availEnabled} onToggle={setAvailEnabled} data={avail} onChange={setAvail} hotelId={hotelId} />
        <RestrictionsPanel enabled={restrictEnabled} onToggle={setRestrictEnabled} data={restrictions} onChange={setRestrictions} />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-border">
        <Button variant="outline" onClick={() => { setSlabs(defaultSlabs()); setAvail(defaultAvail()); setRestrictions(defaultRestrictions()); }}>
          Reset
        </Button>
        <Button variant="outline" onClick={handleLockOnly} disabled={locking || saving}
          className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
          {locking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          {locking ? 'Locking...' : 'Lock Dates'}
        </Button>
        <Button variant="outline" onClick={handleApplyAndLock} disabled={saving || locking}
          className="gap-2 border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          {saving ? 'Applying...' : 'Apply & Lock'}
        </Button>
        <Button onClick={handleApply} disabled={saving || locking} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Applying...' : 'Apply Update'}
        </Button>
      </div>
    </div>
  );
}
