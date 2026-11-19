import { useEffect, useMemo, useState } from 'react';
import { bulkSaveDailyRates, getRatePlans, type GetRatePlansOutputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Switch } from '@project/components/ui/switch';
import { Badge } from '@project/components/ui/badge';
import { Upload, Lock } from 'lucide-react';
import DatePickerInput from '@/components/DatePickerInput';
import { toast } from 'sonner';

interface RoomType { id: string; roomTypeName?: string; }
type RatePlan = GetRatePlansOutputType['ratePlans'][0];
interface Props {
  open: boolean;
  onClose: () => void;
  roomType: RoomType;
  hotelId: string;
  onDone: () => void;
}

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
];

function ids(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

export default function BulkRateLoader({ open, onClose, roomType, hotelId, onDone }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [adult1, setAdult1] = useState('');
  const [adult2, setAdult2] = useState('');
  const [adult3, setAdult3] = useState('');
  const [child, setChild] = useState('');
  const [extraBed, setExtraBed] = useState('');
  const [minStay, setMinStay] = useState('1');
  const [allocation, setAllocation] = useState('10');
  const [status, setStatus] = useState('Free Sale');
  const [upliftType, setUpliftType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [upliftValue, setUpliftValue] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [skipExisting, setSkipExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [ratePlanId, setRatePlanId] = useState('');

  useEffect(() => {
    if (!open) return;
    getRatePlans({ hotelId, roomTypeId: roomType.id })
      .then(res => {
        const active = res.ratePlans.filter(p => p.status === 'Active');
        setRatePlans(active);
        const current = active.find(p => p.id === ratePlanId) || active[0];
        setRatePlanId(current?.id || '');
      })
      .catch(() => setRatePlans([]));
  }, [open, hotelId, roomType.id]);

  const plan = useMemo(() => ratePlans.find(p => p.id === ratePlanId), [ratePlans, ratePlanId]);

  const marketSummary = useMemo(() => {
    if (!plan) return 'Select a Rate Plan';
    const basis = plan.marketEligibilityType || 'Guest Nationality';
    const applicability = plan.marketApplicability || 'Worldwide';
    if (applicability === 'Selected Markets') return `${basis} · Selected Markets · ${ids(plan.sourceMarkets).length} profile(s)`;
    if (applicability === 'Selected Countries') return `${basis} · Selected Countries · ${ids(plan.includedCountries).length} country(ies)`;
    return `${basis} · Worldwide`;
  }, [plan]);

  const toggleDay = (d: number) => setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleApply = async () => {
    if (!startDate || !endDate) { toast.error('Select a date range'); return; }
    if (!ratePlanId) { toast.error('Select an active Rate Plan'); return; }
    if (!plan) { toast.error('Selected Rate Plan could not be resolved'); return; }

    if (plan.marketApplicability === 'Selected Markets' && ids(plan.sourceMarkets).length === 0) {
      toast.error('Rate Plan has no Source Market profile. Fix the Rate Plan first.');
      return;
    }
    if (plan.marketApplicability === 'Selected Countries' && ids(plan.includedCountries).length === 0) {
      toast.error('Rate Plan has no included countries. Fix the Rate Plan first.');
      return;
    }

    const a2 = parseFloat(adult2);
    const a1 = parseFloat(adult1);
    const a3 = parseFloat(adult3);
    if (!isNaN(a1) && !isNaN(a2) && a1 > a2) { toast.error('Adult 1 rate cannot exceed Adult 2 rate'); return; }
    if (!isNaN(a2) && !isNaN(a3) && a2 > a3) { toast.error('Adult 2 rate cannot exceed Adult 3 rate'); return; }

    setLoading(true);
    try {
      const res = await bulkSaveDailyRates({
        roomTypeId: roomType.id,
        hotelId,
        startDate,
        endDate,
        adult1Rate: adult1 ? parseFloat(adult1) : undefined,
        adult2Rate: adult2 ? parseFloat(adult2) : undefined,
        adult3Rate: adult3 ? parseFloat(adult3) : undefined,
        childSupplement: child ? parseFloat(child) : undefined,
        extraBedRate: extraBed ? parseFloat(extraBed) : undefined,
        minStay: parseInt(minStay) || 1,
        allocation: parseInt(allocation) || 10,
        status,
        upliftType: upliftType === 'none' ? undefined : upliftType,
        upliftValue: upliftValue ? parseFloat(upliftValue) : undefined,
        daysOfWeek: selectedDays.length > 0 ? selectedDays : undefined,
        skipExisting,
        ratePlanId,
        source: 'Bulk Loader',
      });
      toast.success(`${res.count} dates loaded successfully`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Bulk load failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Bulk Rate Loader — {roomType.roomTypeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rate Plan *</Label>
              <Select value={ratePlanId} onValueChange={setRatePlanId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select active rate plan" /></SelectTrigger>
                <SelectContent>
                  {ratePlans.map(p => <SelectItem key={p.id} value={p.id}>{p.ratePlanCode ? `[${p.ratePlanCode}] ` : ''}{p.ratePlanName}</SelectItem>)}
                </SelectContent>
              </Select>
              {ratePlans.length === 0 && <p className="text-[11px] text-destructive">No active Rate Plan exists for this Room Type.</p>}
            </div>

            <div className="rounded-md border bg-background px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold">Inherited market eligibility</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{marketSummary}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Daily Rates cannot override nationality/source-market eligibility. Edit the Rate Plan to change market access.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5"><Label className="text-xs">Start Date</Label><DatePickerInput value={startDate} onChange={setStartDate} /></div>
            <div className="flex-1 space-y-1.5"><Label className="text-xs">End Date</Label><DatePickerInput value={endDate} onChange={setEndDate} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">1 Adult</Label><Input type="number" min={0} value={adult1} onChange={e => setAdult1(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">2 Adults</Label><Input type="number" min={0} value={adult2} onChange={e => setAdult2(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">3 Adults</Label><Input type="number" min={0} value={adult3} onChange={e => setAdult3(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Child Supplement</Label><Input type="number" min={0} value={child} onChange={e => setChild(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Extra Bed</Label><Input type="number" min={0} value={extraBed} onChange={e => setExtraBed(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Min Stay</Label><Input type="number" min={1} value={minStay} onChange={e => setMinStay(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Allocation</Label><Input type="number" min={0} value={allocation} onChange={e => setAllocation(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Availability</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Free Sale">Free Sale</SelectItem>
                  <SelectItem value="Limited">Limited</SelectItem>
                  <SelectItem value="On Request">On Request</SelectItem>
                  <SelectItem value="Stop Sale">Stop Sale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Apply to days (all if none selected)</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_OF_WEEK.map(({ label, value }) => (
                <Badge key={value} variant={selectedDays.includes(value) ? 'default' : 'outline'} className="cursor-pointer select-none" onClick={() => toggleDay(value)}>{label}</Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between"><Label className="text-xs">Skip existing dates</Label><Switch checked={skipExisting} onCheckedChange={setSkipExisting} /></div>
            <div className="flex items-center gap-2">
              <Select value={upliftType} onValueChange={(v: any) => setUpliftType(v)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No uplift</SelectItem><SelectItem value="percentage">Percentage uplift</SelectItem><SelectItem value="fixed">Fixed AED uplift</SelectItem></SelectContent>
              </Select>
              {upliftType !== 'none' && <Input type="number" className="w-28" value={upliftValue} onChange={e => setUpliftValue(e.target.value)} />}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={loading || !ratePlanId}>{loading ? 'Applying...' : 'Apply Rates'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
