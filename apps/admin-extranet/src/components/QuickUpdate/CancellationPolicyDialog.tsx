import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

export type CancellationRule = {
  id: string;
  trigger: 'CANCEL_AMEND' | 'NO_SHOW';
  basis: 'FROM_BOOKING_TIME' | 'BEFORE_CHECKIN';
  penaltyValue: string;
  penaltyUnit: 'PERCENT' | 'NIGHTS' | 'FIXED';
};

export const defaultRules = (): CancellationRule[] => [
  { id: crypto.randomUUID(), trigger: 'CANCEL_AMEND', basis: 'FROM_BOOKING_TIME', penaltyValue: '0', penaltyUnit: 'PERCENT' },
  { id: crypto.randomUUID(), trigger: 'NO_SHOW', basis: 'BEFORE_CHECKIN', penaltyValue: '100', penaltyUnit: 'PERCENT' },
];

export function parsePolicyRules(value: string): CancellationRule[] {
  try { const r = JSON.parse(value); return Array.isArray(r) ? r : defaultRules(); }
  catch { return defaultRules(); }
}

export function summaryLabel(value: string): string {
  const rules = parsePolicyRules(value);
  if (!rules.length) return 'No rules';
  return `${rules.length} rule${rules.length > 1 ? 's' : ''}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  value: string;
  onSave: (value: string) => void;
}

const TRIGGER_OPTS = [
  { value: 'CANCEL_AMEND', label: 'Cancel/Amend' },
  { value: 'NO_SHOW', label: 'No Show' },
];
const BASIS_OPTS = [
  { value: 'FROM_BOOKING_TIME', label: 'From Booking Time' },
  { value: 'BEFORE_CHECKIN', label: 'Before Check-in' },
];
const UNIT_OPTS = [
  { value: 'PERCENT', label: '% (Percent)' },
  { value: 'NIGHTS', label: 'Nights' },
  { value: 'FIXED', label: 'Fixed Amount' },
];

export default function CancellationPolicyDialog({ open, onClose, value, onSave }: Props) {
  const [rules, setRules] = useState<CancellationRule[]>(() => parsePolicyRules(value));

  const updateRule = (id: string, field: keyof CancellationRule, val: string) => {
    setRules(r => r.map(rule => rule.id === id ? { ...rule, [field]: val } : rule));
  };

  const addRule = () => {
    setRules(r => [...r, { id: crypto.randomUUID(), trigger: 'CANCEL_AMEND', basis: 'FROM_BOOKING_TIME', penaltyValue: '0', penaltyUnit: 'PERCENT' }]);
  };

  const removeRule = (id: string) => {
    setRules(r => r.filter(rule => rule.id !== id));
  };

  const handleSave = () => {
    onSave(JSON.stringify(rules));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Cancellation Policy:</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {rules.map((rule, idx) => (
            <RuleRow key={rule.id} rule={rule} index={idx} onChange={updateRule} onRemove={removeRule} canRemove={rules.length > 1} />
          ))}

          <button
            onClick={addRule}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors shadow-sm"
            title="Add rule"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={handleSave} className="bg-destructive hover:bg-destructive/90 text-white px-6">
            Update
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RuleRow({ rule, onRemove, onChange, canRemove }: {
  rule: CancellationRule;
  index: number;
  onChange: (id: string, field: keyof CancellationRule, val: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border">
      {/* Trigger */}
      <Select value={rule.trigger} onValueChange={v => onChange(rule.id, 'trigger', v)}>
        <SelectTrigger className="h-9 w-36 text-sm font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRIGGER_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Basis */}
      <Select value={rule.basis} onValueChange={v => onChange(rule.id, 'basis', v)}>
        <SelectTrigger className="h-9 w-44 text-sm font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BASIS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <span className="text-sm text-muted-foreground whitespace-nowrap">Will attract a penalty of</span>

      {/* Penalty value */}
      <Input
        type="number"
        value={rule.penaltyValue}
        onChange={e => onChange(rule.id, 'penaltyValue', e.target.value)}
        className="h-9 w-20 text-sm font-bold text-center border-2 border-border"
        placeholder="0"
        min="0"
        max={rule.penaltyUnit === 'PERCENT' ? 100 : undefined}
      />

      {/* Penalty unit */}
      <Select value={rule.penaltyUnit} onValueChange={v => onChange(rule.id, 'penaltyUnit', v)}>
        <SelectTrigger className="h-9 w-36 text-sm font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNIT_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {canRemove && (
        <button onClick={() => onRemove(rule.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors ml-auto">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
