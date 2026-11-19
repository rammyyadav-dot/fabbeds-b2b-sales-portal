import { useState } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Calendar } from '@project/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';

const PLANS = [
  { key: 'hbAdult', label: 'Half Board Adult', plan: 'Half Board', type: 'adult' },
  { key: 'hbChild', label: 'Half Board Child', plan: 'Half Board', type: 'child' },
  { key: 'fbAdult', label: 'Full Board Adult', plan: 'Full Board', type: 'adult' },
  { key: 'fbChild', label: 'Full Board Child', plan: 'Full Board', type: 'child' },
  { key: 'aiAdult', label: 'All Inclusive Adult', plan: 'All Inclusive', type: 'adult' },
  { key: 'aiChild', label: 'All Inclusive Child', plan: 'All Inclusive', type: 'child' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (dates: string[], rates: Record<string, number | undefined>) => void;
  saving?: boolean;
}

export default function MealPlanBulkLoader({ open, onClose, onApply, saving }: Props) {
  const [range, setRange] = useState<DateRange | undefined>();
  const [rates, setRates] = useState<Record<string, string>>({});

  const handleApply = () => {
    if (!range?.from || !range?.to) return;
    const days = eachDayOfInterval({ start: range.from, end: range.to });
    const dates = days.map(d => format(d, 'yyyy-MM-dd'));
    const parsed: Record<string, number | undefined> = {};
    for (const p of PLANS) {
      const v = parseFloat(rates[p.key]);
      parsed[p.key] = isNaN(v) ? undefined : v;
    }
    onApply(dates, parsed);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Load Rates</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {range?.from && range?.to
                    ? `${format(range.from, 'dd MMM yyyy')} – ${format(range.to, 'dd MMM yyyy')}`
                    : 'Select date range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PLANS.map(p => (
              <div key={p.key} className="space-y-1">
                <Label className="text-xs">{p.label}</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number" step="0.01" min={0} placeholder="0.00"
                    value={rates[p.key] ?? ''}
                    onChange={e => setRates(prev => ({ ...prev, [p.key]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">AED</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={!range?.from || !range?.to || saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying...</> : 'Apply to Range'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
