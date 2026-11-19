import { useState } from 'react';
import { Switch } from '@project/components/ui/switch';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { Settings2 } from 'lucide-react';
import CancellationPolicyDialog, { summaryLabel, defaultRules } from './CancellationPolicyDialog';

export type RestrictionsData = {
  minStay: { on: boolean; value: string };
  maxStay: { on: boolean; value: string };
  checkIn: { on: boolean; value: string };
  checkOut: { on: boolean; value: string };
  leadPeriod: { on: boolean; value: string };
  cancellationPolicy: { on: boolean; value: string };
};

interface Props {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  data: RestrictionsData;
  onChange: (d: RestrictionsData) => void;
}

type SimpleRow = { key: Exclude<keyof RestrictionsData, 'cancellationPolicy'>; label: string; type: 'number' | 'select'; opts?: string[] };
const SIMPLE_ROWS: SimpleRow[] = [
  { key: 'minStay', label: 'Minimum stay', type: 'select', opts: ['None', '1', '2', '3', '5', '7'] },
  { key: 'maxStay', label: 'Maximum stay', type: 'select', opts: ['None', '7', '14', '21', '30'] },
  { key: 'checkIn', label: 'Check-in', type: 'select', opts: ['No', 'Yes'] },
  { key: 'checkOut', label: 'Check-out', type: 'select', opts: ['No', 'Yes'] },
  { key: 'leadPeriod', label: 'Lead Period', type: 'number' },
];

export default function RestrictionsPanel({ enabled, onToggle, data, onChange }: Props) {
  const [policyOpen, setPolicyOpen] = useState(false);

  const update = (key: keyof RestrictionsData, field: 'on' | 'value', val: boolean | string) => {
    onChange({ ...data, [key]: { ...data[key], [field]: val } });
  };

  const cp = data.cancellationPolicy;
  const policyValue = cp.value && cp.value !== 'None' ? cp.value : JSON.stringify(defaultRules());

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b">
        <span className="font-semibold text-sm">Restrictions & Conditions</span>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
            <span />
            <span className="text-center">Update</span>
            <span className="text-center">Value</span>
          </div>

          {/* Simple rows */}
          {SIMPLE_ROWS.map(({ key, label, type, opts }) => (
            <div key={key} className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
              <span className="text-sm font-semibold text-foreground leading-tight">{label}</span>
              <button
                onClick={() => update(key, 'on', !data[key].on)}
                className={cn(
                  'h-11 w-full rounded-lg text-sm font-bold border-2 transition-all shadow-sm',
                  data[key].on
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                )}
              >
                {data[key].on ? 'ON' : 'OFF'}
              </button>
              {type === 'select' && opts ? (
                <Select value={data[key].value} onValueChange={v => update(key, 'value', v)} disabled={!data[key].on}>
                  <SelectTrigger className={cn('h-11 text-sm font-bold transition-all', data[key].on ? 'border-2 border-primary/40 bg-background shadow-sm' : 'opacity-40')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  value={data[key].value}
                  onChange={e => update(key, 'value', e.target.value)}
                  disabled={!data[key].on}
                  className={cn('h-11 text-base font-bold text-center transition-all', data[key].on ? 'border-2 border-primary/50 bg-background shadow-sm focus-visible:border-primary' : 'opacity-40')}
                  placeholder="0"
                />
              )}
            </div>
          ))}

          {/* Cancellation Policy row */}
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
            <span className="text-sm font-semibold text-foreground leading-tight">Cancellation Policy</span>
            <button
              onClick={() => update('cancellationPolicy', 'on', !cp.on)}
              className={cn(
                'h-11 w-full rounded-lg text-sm font-bold border-2 transition-all shadow-sm',
                cp.on ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
              )}
            >
              {cp.on ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => { if (!cp.on) update('cancellationPolicy', 'on', true); setPolicyOpen(true); }}
              className={cn(
                'h-11 w-full rounded-lg text-xs font-semibold border-2 transition-all shadow-sm flex items-center justify-center gap-1',
                cp.on ? 'border-primary/40 bg-background text-primary hover:bg-primary/5' : 'border-border bg-muted text-muted-foreground hover:border-primary/40'
              )}
              title="Configure cancellation policy"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{cp.on ? summaryLabel(policyValue) : 'Set'}</span>
            </button>
          </div>

          <CancellationPolicyDialog
            open={policyOpen}
            onClose={() => setPolicyOpen(false)}
            value={policyValue}
            onSave={v => update('cancellationPolicy', 'value', v)}
          />
        </>
      )}
    </div>
  );
}
