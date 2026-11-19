import { Switch } from '@project/components/ui/switch';
import { Input } from '@project/components/ui/input';
import { cn } from '@project/components/lib/utils';

export type PriceSlabs = {
  occ1: { on: boolean; value: string };
  occ2: { on: boolean; value: string };
  occ3: { on: boolean; value: string };
  extraBed: { on: boolean; value: string };
  child1: { on: boolean; value: string };
  restChildren: { on: boolean; value: string };
};

export type OccupancyConfig = {
  maxAdults?: number;
  childAllowed?: boolean;
  extraBedAllowed?: boolean;
  maxChildren?: number;
};

interface Props {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  slabs: PriceSlabs;
  onChange: (slabs: PriceSlabs) => void;
  occupancyConfig?: OccupancyConfig;
}

function buildRows(cfg?: OccupancyConfig): { key: keyof PriceSlabs; label: string; sub: string }[] {
  const maxAdults = cfg?.maxAdults ?? 3;
  const rows: { key: keyof PriceSlabs; label: string; sub: string }[] = [];
  rows.push({ key: 'occ1', label: 'SGL', sub: '1 Adult' });
  if (maxAdults >= 2) rows.push({ key: 'occ2', label: 'DBL', sub: '2 Adults' });
  if (maxAdults >= 3) rows.push({ key: 'occ3', label: 'TPL', sub: '3 Adults' });
  if (cfg?.extraBedAllowed) rows.push({ key: 'extraBed', label: 'Extra Bed', sub: 'Per night' });
  return rows;
}

export default function PricePanel({ enabled, onToggle, slabs, onChange, occupancyConfig }: Props) {
  const rows = buildRows(occupancyConfig);

  const update = (key: keyof PriceSlabs, field: 'on' | 'value', val: boolean | string) => {
    onChange({ ...slabs, [key]: { ...slabs[key], [field]: val } });
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Price</span>
          {occupancyConfig && (
            <span className="text-[10px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
              Max {occupancyConfig.maxAdults ?? 3} adults
            </span>
          )}
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && (
        <>
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
            <span />
            <span className="text-center">Update</span>
            <span className="text-center">Value</span>
          </div>
          {rows.map(({ key, label, sub }) => (
            <div key={key} className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
              <div className="min-w-0">
                <span className="text-sm font-bold text-foreground">{label}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">({sub})</span>
              </div>
              <button
                onClick={() => update(key, 'on', !slabs[key].on)}
                className={cn(
                  'h-11 w-full rounded-lg text-sm font-bold border-2 transition-all shadow-sm',
                  slabs[key].on
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                )}
              >
                {slabs[key].on ? 'ON' : 'OFF'}
              </button>
              <Input
                type="number"
                value={slabs[key].value}
                onChange={e => update(key, 'value', e.target.value)}
                disabled={!slabs[key].on}
                className={cn(
                  'h-11 text-base font-bold text-center transition-all',
                  slabs[key].on
                    ? 'border-2 border-primary/50 bg-background shadow-sm focus-visible:border-primary'
                    : 'opacity-40'
                )}
                placeholder="0"
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
