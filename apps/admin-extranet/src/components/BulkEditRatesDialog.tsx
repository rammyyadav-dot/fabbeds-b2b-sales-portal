import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Checkbox } from '@project/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@project/components/ui/radio-group';
import { CalendarDays, X } from 'lucide-react';
import DatePickerInput from '@/components/DatePickerInput';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (data: BulkEditData) => Promise<void>;
  loading?: boolean;
}

export interface BulkEditData {
  startDate: string;
  endDate: string;
  days: boolean[];
  adjustmentType: 'set' | 'increase' | 'decrease';
  adult2Rate?: number;
  adult3Rate?: number;
  minStay?: number;
  allocation?: number;
}

export default function BulkEditRatesDialog({ open, onClose, onApply, loading }: Props) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState<boolean[]>(Array(7).fill(true));
  const [adjustmentType, setAdjustmentType] = useState<'set' | 'increase' | 'decrease'>('set');
  const [adult2Rate, setAdult2Rate] = useState('');
  const [adult3Rate, setAdult3Rate] = useState('');
  const [minStay, setMinStay] = useState('1');
  const [allocation, setAllocation] = useState('10');

  const toggleDay = (i: number) => setDays(prev => prev.map((v, idx) => idx === i ? !v : v));

  const selectedDays = days.filter(Boolean).length;

  const handleApply = async () => {
    await onApply({
      startDate, endDate, days, adjustmentType,
      adult2Rate: adult2Rate ? Number(adult2Rate) : undefined,
      adult3Rate: adult3Rate ? Number(adult3Rate) : undefined,
      minStay: minStay ? Number(minStay) : undefined,
      allocation: allocation ? Number(allocation) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Bulk Edit Rates
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Date Range */}
          <div className="space-y-1.5">
            <Label>Date Range <span className="text-destructive">*</span></Label>
            <div className="flex items-center gap-2">
              <DatePickerInput value={startDate} onChange={setStartDate} placeholder="Start date" />
              <span className="text-muted-foreground text-sm">—</span>
              <DatePickerInput value={endDate} onChange={setEndDate} placeholder="End date" />
            </div>
            {startDate && endDate && (
              <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {selectedDays} day(s) selected
              </span>
            )}
          </div>

          {/* Days of Week */}
          <div className="space-y-2">
            <Label>Days of the week</Label>
            <div className="flex gap-3 flex-wrap">
              {DAYS.map((d, i) => (
                <label key={d} className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={days[i]} onCheckedChange={() => toggleDay(i)} />
                  <span className="text-sm">{d}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <RadioGroup value={adjustmentType} onValueChange={v => setAdjustmentType(v as any)} className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer"><RadioGroupItem value="set" /><span className="text-sm">Set Rate</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><RadioGroupItem value="increase" /><span className="text-sm">Increase By</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><RadioGroupItem value="decrease" /><span className="text-sm">Decrease By</span></label>
            </RadioGroup>
          </div>

          {/* Rate Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Adult 2 Rate (AED)</Label>
              <Input type="number" placeholder="189" value={adult2Rate} onChange={e => setAdult2Rate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Adult 3 Rate (AED)</Label>
              <Input type="number" placeholder="249" value={adult3Rate} onChange={e => setAdult3Rate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stay (nights)</Label>
              <Input type="number" placeholder="1" value={minStay} onChange={e => setMinStay(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Allocation (rooms)</Label>
              <Input type="number" placeholder="10" value={allocation} onChange={e => setAllocation(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={loading || !startDate || !endDate} className="gap-2">
            <CalendarDays className="w-4 h-4" />
            {loading ? 'Applying...' : 'Apply Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
