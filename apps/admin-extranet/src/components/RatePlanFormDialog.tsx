import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Separator } from '@project/components/ui/separator';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Lock, X } from 'lucide-react';
import { GetRatePlansOutputType, GetRoomTypesOutputType, getSourceMarkets, GetSourceMarketsOutputType } from 'zitejs/api';

type RatePlan = GetRatePlansOutputType['ratePlans'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];
type SourceMarket = GetSourceMarketsOutputType['markets'][0];

interface MealPlanOption { id: string; code: string; agentLabel: string }

const CANCELLATION_OPTIONS = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'non_refundable', label: 'Non-Refundable' },
  { value: 'special_conditions', label: 'Special Conditions' },
] as const;

interface Props {
  open: boolean;
  hotelId: string;
  hotelName?: string;
  roomTypes: RoomType[];
  mealPlans: MealPlanOption[];
  mealPlansLoading: boolean;
  mealPlansError: boolean;
  ratePlan: RatePlan | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
}

interface FormData {
  roomTypeId: string;
  mealPlanMasterId: string;
  cancellationType: string;
  cancellationWindowDays: string;
  ratePlanName: string;
  ratePlanCode: string;
  minStayNights: string;
  maxStayNights: string;
  childPolicy: string;
  extraBedPolicy: string;
  status: string;
  notes: string;
  marketEligibilityType: string;
  marketApplicability: string;
}

function ids(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

export default function RatePlanFormDialog({ open, hotelId, hotelName, roomTypes, mealPlans, mealPlansLoading, mealPlansError, ratePlan, onClose, onSave, loading }: Props) {
  const { register, handleSubmit, setValue, watch, reset } = useForm<FormData>();
  const [markets, setMarkets] = useState<SourceMarket[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [includedCountries, setIncludedCountries] = useState<string[]>([]);
  const [excludedCountries, setExcludedCountries] = useState<string[]>([]);
  const [countryQuery, setCountryQuery] = useState('');

  const roomTypeId = watch('roomTypeId');
  const mealPlanMasterId = watch('mealPlanMasterId');
  const cancellationType = watch('cancellationType');
  const marketEligibilityType = watch('marketEligibilityType') || 'Guest Nationality';
  const marketApplicability = watch('marketApplicability') || 'Worldwide';

  useEffect(() => {
    if (!open) return;
    getSourceMarkets({}).then(r => setMarkets(r.markets)).catch(() => setMarkets([]));
  }, [open]);

  const countries = useMemo(() => {
    const map = new Map<string, { id: string; name: string; iso2: string; iso3: string }>();
    for (const m of markets) for (const c of m.countries) map.set(c.id, c);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [markets]);

  useEffect(() => {
    if (!open) return;
    const linkedMealId = Array.isArray(ratePlan?.mealPlanMaster) ? ratePlan.mealPlanMaster[0] : ratePlan?.mealPlanMaster;
    const matchingMeal = mealPlans.find(mp => mp.agentLabel === ratePlan?.mealPlan && ['RO', 'BB', 'HB', 'FB', 'AI'].includes(mp.code));
    const rpMealMasterId = linkedMealId || matchingMeal?.id || '';
    const rpCancellationType = ratePlan?.cancellationType === 'Flexible' ? 'flexible'
      : ratePlan?.cancellationType === 'Non-Refundable' ? 'non_refundable'
      : ratePlan?.cancellationType === 'Special Conditions' ? 'special_conditions'
      : ratePlan?.cancellationType ?? (ratePlan ? '' : 'flexible');

    reset({
      roomTypeId: Array.isArray(ratePlan?.roomType) ? ratePlan.roomType[0] : ratePlan?.roomType ?? '',
      mealPlanMasterId: rpMealMasterId,
      cancellationType: rpCancellationType,
      cancellationWindowDays: String(ratePlan?.cancellationWindowDays ?? 3),
      ratePlanName: ratePlan?.ratePlanName ?? '',
      ratePlanCode: ratePlan?.ratePlanCode ?? '',
      minStayNights: String(ratePlan?.minStayNights ?? 1),
      maxStayNights: ratePlan?.maxStayNights ? String(ratePlan.maxStayNights) : '',
      childPolicy: ratePlan?.childPolicy ?? '',
      extraBedPolicy: ratePlan?.extraBedPolicy ?? '',
      status: ratePlan?.status ?? 'Active',
      notes: ratePlan?.notes ?? '',
      marketEligibilityType: ratePlan?.marketEligibilityType ?? 'Guest Nationality',
      marketApplicability: ratePlan?.marketApplicability ?? 'Worldwide',
    });
    setSelectedMarkets(ids(ratePlan?.sourceMarkets));
    setIncludedCountries(ids(ratePlan?.includedCountries));
    setExcludedCountries(ids(ratePlan?.excludedCountries));
    setCountryQuery('');
  }, [open, ratePlan, mealPlans, reset]);

  const selectedRoom = roomTypes.find(rt => rt.id === roomTypeId);
  const selectedMeal = mealPlans.find(mp => mp.id === mealPlanMasterId);
  const cancLabel = CANCELLATION_OPTIONS.find(c => c.value === cancellationType)?.label ?? '';

  const generatedName = useMemo(() => {
    if (!selectedRoom || !selectedMeal) return '';
    return `${selectedRoom.roomTypeName} + ${selectedMeal.code} + ${cancLabel}`;
  }, [selectedRoom, selectedMeal, cancLabel]);

  const generatedCode = useMemo(() => {
    if (!selectedRoom || !selectedMeal) return '';
    const roomCode = selectedRoom.roomTypeCode || selectedRoom.roomTypeName?.substring(0, 3).toUpperCase() || 'RM';
    const cancCode = cancellationType === 'flexible' ? 'FLEX' : cancellationType === 'non_refundable' ? 'NR' : 'SPEC';
    return `${roomCode}-${selectedMeal.code}-${cancCode}`;
  }, [selectedRoom, selectedMeal, cancellationType]);

  const filteredCountries = countries.filter(c => {
    const q = countryQuery.trim().toLowerCase();
    return !q || [c.name, c.iso2, c.iso3].some(v => v.toLowerCase().includes(q));
  }).slice(0, 30);

  const eligibleCountryIds = useMemo(() => {
    const set = new Set<string>();
    if (marketApplicability === 'Worldwide') {
      countries.forEach(c => set.add(c.id));
    } else if (marketApplicability === 'Selected Countries') {
      includedCountries.forEach(id => set.add(id));
    } else if (marketApplicability === 'Selected Markets') {
      for (const market of markets) {
        if (!selectedMarkets.includes(market.id)) continue;
        market.countries.forEach(c => set.add(c.id));
      }
    }
    excludedCountries.forEach(id => set.delete(id));
    return set;
  }, [marketApplicability, countries, includedCountries, markets, selectedMarkets, excludedCountries]);

  const selectedMarketNames = markets.filter(m => selectedMarkets.includes(m.id)).map(m => m.name);
  const excludedNames = countries.filter(c => excludedCountries.includes(c.id)).map(c => c.name);

  const onSubmit = async (data: FormData) => {
    await onSave({
      id: ratePlan?.id,
      hotelId,
      roomTypeId: data.roomTypeId,
      mealPlanMasterId: data.mealPlanMasterId,
      cancellationType: data.cancellationType,
      cancellationWindowDays: data.cancellationWindowDays ? Number(data.cancellationWindowDays) : undefined,
      ratePlanName: data.ratePlanName || undefined,
      ratePlanCode: data.ratePlanCode || undefined,
      minStayNights: data.minStayNights ? Number(data.minStayNights) : 1,
      maxStayNights: data.maxStayNights ? Number(data.maxStayNights) : undefined,
      childPolicy: data.childPolicy || undefined,
      extraBedPolicy: data.extraBedPolicy || undefined,
      status: data.status,
      notes: data.notes || undefined,
      marketEligibilityType: data.marketEligibilityType,
      marketApplicability: data.marketApplicability,
      sourceMarketIds: data.marketApplicability === 'Selected Markets' ? selectedMarkets : [],
      includedCountryIds: data.marketApplicability === 'Selected Countries' ? includedCountries : [],
      excludedCountryIds: excludedCountries,
    });
  };

  const hasMarketIdentity =
    marketApplicability === 'Worldwide' ||
    (marketApplicability === 'Selected Markets' && selectedMarkets.length > 0) ||
    (marketApplicability === 'Selected Countries' && includedCountries.length > 0);

  const hasAllIdentity = !!roomTypeId && !!mealPlans.find(mp => mp.id === mealPlanMasterId) && !!cancellationType && hasMarketIdentity;

  const toggle = (arr: string[], setArr: (v: string[]) => void, id: string) =>
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ratePlan ? 'Edit Rate Plan' : 'New Rate Plan'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Property: <strong>{hotelName ?? 'Current Hotel'}</strong></span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Step 1 · Room Type *</Label>
              <Select value={roomTypeId} onValueChange={v => setValue('roomTypeId', v)} required>
                <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                <SelectContent>{roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.roomTypeName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Step 2 · Meal Plan *</Label>
              <Select value={mealPlanMasterId} onValueChange={v => setValue('mealPlanMasterId', v)} disabled={mealPlansLoading || mealPlansError || mealPlans.length === 0} required>
                <SelectTrigger><SelectValue placeholder={mealPlansLoading ? 'Loading meal plans...' : 'Select meal plan'} /></SelectTrigger>
                <SelectContent>{mealPlans.map(mp => <SelectItem key={mp.id} value={mp.id}>{mp.code} · {mp.agentLabel}</SelectItem>)}</SelectContent>
              </Select>
              {mealPlansError && <p className="text-xs text-destructive">Could not load meal plans.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Step 3 · Cancellation *</Label>
              <Select value={cancellationType} onValueChange={v => setValue('cancellationType', v)} disabled={!mealPlanMasterId}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{CANCELLATION_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cancellation Window (days)</Label>
              <Input type="number" min={0} {...register('cancellationWindowDays')} disabled={cancellationType === 'non_refundable'} />
            </div>
          </div>

          {hasAllIdentity && (
            <div className="rounded-md border bg-muted px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Generated identity</p>
              <p className="mt-1 text-sm font-semibold">{generatedName}</p>
              <p className="text-sm font-mono text-muted-foreground">{generatedCode}</p>
            </div>
          )}

          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source Market & Guest Eligibility</p>

          <div className="space-y-1.5">
            <Label>Eligibility based on</Label>
            <Select value={marketEligibilityType} onValueChange={v => setValue('marketEligibilityType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Guest Nationality">Guest Nationality</SelectItem>
                <SelectItem value="Guest Residency">Guest Residency</SelectItem>
                <SelectItem value="Agency Source Market">Agency Source Market</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rate applicability</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                ['Worldwide','Available to all countries unless excluded'],
                ['Selected Markets','Use reusable contracting market profiles'],
                ['Selected Countries','Choose exact countries'],
              ].map(([value, help]) => (
                <button key={value} type="button" onClick={() => setValue('marketApplicability', value)}
                  className={`rounded-lg border p-3 text-left transition ${marketApplicability === value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted'}`}>
                  <div className="text-sm font-semibold">{value}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{help}</div>
                </button>
              ))}
            </div>
          </div>

          {marketApplicability === 'Selected Markets' && (
            <div className="space-y-2">
              <Label>Source Market Profiles *</Label>
              <div className="flex flex-wrap gap-2">
                {markets.filter(m => m.code !== 'WORLDWIDE').map(m => (
                  <button key={m.id} type="button" onClick={() => toggle(selectedMarkets, setSelectedMarkets, m.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedMarkets.includes(m.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>
                    {m.name} · {m.countries.length}
                  </button>
                ))}
              </div>
              {selectedMarkets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {markets.filter(m => selectedMarkets.includes(m.id)).map(m => (
                    <Badge key={m.id} variant="secondary">{m.name}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {marketApplicability === 'Selected Countries' && (
            <div className="space-y-2">
              <Label>Included Countries *</Label>
              <Input value={countryQuery} onChange={e => setCountryQuery(e.target.value)} placeholder="Search country or ISO code" />
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {filteredCountries.map(c => (
                  <button key={c.id} type="button" onClick={() => toggle(includedCountries, setIncludedCountries, c.id)}
                    className={`text-left rounded px-2 py-1.5 text-xs ${includedCountries.includes(c.id) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                    {c.iso2} · {c.name}
                  </button>
                ))}
              </div>
              {includedCountries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {countries.filter(c => includedCountries.includes(c.id)).map(c => (
                    <Badge key={c.id} variant="secondary">{c.iso2} · {c.name}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Country exclusions <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex flex-wrap gap-1.5 min-h-7">
              {excludedCountries.map(id => {
                const c = countries.find(x => x.id === id);
                return c ? <Badge key={id} variant="outline" className="gap-1">{c.iso2} · {c.name}<button type="button" onClick={() => setExcludedCountries(excludedCountries.filter(x => x !== id))}><X className="w-3 h-3" /></button></Badge> : null;
              })}
            </div>
            <Input value={countryQuery} onChange={e => setCountryQuery(e.target.value)} placeholder="Search country to exclude" />
            <div className="max-h-32 overflow-y-auto rounded-md border p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {filteredCountries.map(c => (
                <button key={c.id} type="button" onClick={() => toggle(excludedCountries, setExcludedCountries, c.id)}
                  className={`text-left rounded px-2 py-1.5 text-xs ${excludedCountries.includes(c.id) ? 'bg-destructive text-destructive-foreground' : 'hover:bg-muted'}`}>
                  {c.iso2} · {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rate Eligibility</p>
            <p className="text-sm font-semibold mt-1">
              {marketEligibilityType} · {marketApplicability === 'Selected Markets' ? (selectedMarketNames.join(' + ') || 'No market selected') : marketApplicability}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {eligibleCountryIds.size} eligible countr{eligibleCountryIds.size === 1 ? 'y' : 'ies'}
              {excludedNames.length ? ` · Excludes: ${excludedNames.join(', ')}` : ' · No exclusions'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              This rate will only appear when the booking context matches this rule.
            </p>
          </div>

          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stay & Occupancy Rules</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Min Stay</Label><Input type="number" min={1} {...register('minStayNights')} /></div>
            <div className="space-y-1.5"><Label>Max Stay</Label><Input type="number" min={1} placeholder="No limit" {...register('maxStayNights')} /></div>
            <div className="space-y-1.5"><Label>Child Policy</Label><Input {...register('childPolicy')} /></div>
            <div className="space-y-1.5"><Label>Extra Bed Policy</Label><Input {...register('extraBedPolicy')} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={watch('status')} onValueChange={v => setValue('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5"><Label>Notes</Label><Textarea {...register('notes')} rows={2} /></div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !hasAllIdentity}>{loading ? 'Saving...' : 'Save Rate Plan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
