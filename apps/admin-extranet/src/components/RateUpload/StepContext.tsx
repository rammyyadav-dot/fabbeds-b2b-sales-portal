import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { GetHotelsOutputType } from 'zitejs/api';

type Hotel = GetHotelsOutputType['hotels'][0];

export interface WizardContext {
  hotelId: string;
  currency: string;
  layer: 'BAR' | 'WHOLESALE' | 'PROMO';
  importMode: 'SLAB' | 'DAILY';
  conflictMode: 'OVERRIDE' | 'SKIP' | 'STOP';
}

interface Props {
  hotels: Hotel[];
  ctx: WizardContext;
  onChange: (ctx: WizardContext) => void;
  onNext: () => void;
}

export default function StepContext({ hotels, ctx, onChange, onNext }: Props) {
  const set = (k: keyof WizardContext, v: any) => onChange({ ...ctx, [k]: v });
  const canNext = !!ctx.hotelId && !!ctx.currency;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Hotel / Property *</Label>
          <Select value={ctx.hotelId} onValueChange={v => set('hotelId', v)}>
            <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
            <SelectContent>
              {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.hotelName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Currency *</Label>
          <Input value={ctx.currency} onChange={e => set('currency', e.target.value)} placeholder="AED" />
        </div>
        <div className="space-y-1.5">
          <Label>Rate Layer</Label>
          <Select value={ctx.layer} onValueChange={v => set('layer', v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BAR">BAR (Best Available Rate)</SelectItem>
              <SelectItem value="WHOLESALE">WHOLESALE</SelectItem>
              <SelectItem value="PROMO">PROMO / Campaign</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Import Mode</Label>
          <Select value={ctx.importMode} onValueChange={v => set('importMode', v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SLAB">Slab — Date ranges (from/to)</SelectItem>
              <SelectItem value="DAILY">Daily — One row per date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Conflict Mode (if rates already exist)</Label>
          <Select value={ctx.conflictMode} onValueChange={v => set('conflictMode', v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OVERRIDE">Override — Replace existing rates</SelectItem>
              <SelectItem value="SKIP">Skip — Keep existing, ignore incoming</SelectItem>
              <SelectItem value="STOP">Stop — Abort if any conflict found</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button disabled={!canNext} onClick={onNext}>Next: Upload File →</Button>
      </div>
    </div>
  );
}
