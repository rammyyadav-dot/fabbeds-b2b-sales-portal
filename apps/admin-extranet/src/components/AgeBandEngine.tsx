import { useState, useEffect } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

export type AgeBand = {
  id: string;
  from: number;
  to: number;
  category: 'Infant' | 'Child' | 'Adult';
  pricingRule: 'free' | 'percent' | 'fixed' | 'meal_only' | 'free_sharing' | 'extra_bed_charge';
  pricingValue?: number;
  extraBedPrice?: number;
};

const CATEGORY_COLORS: Record<string, string> = {
  Infant: 'bg-green-100 text-green-800 border-green-200',
  Child: 'bg-amber-100 text-amber-800 border-amber-200',
  Adult: 'bg-blue-100 text-blue-800 border-blue-200',
};

const PRICING_LABELS: Record<string, string> = {
  free: 'Free',
  percent: '% of adult rate',
  fixed: 'Fixed AED/night',
  meal_only: 'Meal charge only',
  free_sharing: 'Free (sharing bed)',
  extra_bed_charge: 'Extra bed charge',
};

const DEFAULT_BANDS: AgeBand[] = [
  { id: '1', from: 0, to: 1, category: 'Infant', pricingRule: 'free' },
  { id: '2', from: 2, to: 11, category: 'Child', pricingRule: 'percent', pricingValue: 50 },
  { id: '3', from: 12, to: 99, category: 'Adult', pricingRule: 'free' },
];

function validate(bands: AgeBand[], maxOccupancy: number): string[] {
  const errors: string[] = [];
  const sorted = [...bands].sort((a, b) => a.from - b.from);

  if (sorted.length === 0) return ['At least one age band is required.'];
  if (sorted[0].from !== 0) errors.push('Lowest age band must start at age 0.');

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    if (curr.to >= next.from) errors.push(`Overlap: "${curr.category}" (${curr.from}–${curr.to}) overlaps "${next.category}" (${next.from}–${next.to}).`);
    if (curr.to + 1 < next.from) errors.push(`Gap: Ages ${curr.to + 1}–${next.from - 1} are not assigned to any category.`);
  }
  return errors;
}

interface Props {
  value: AgeBand[];
  onChange: (bands: AgeBand[]) => void;
  maxOccupancy?: number;
}

export default function AgeBandEngine({ value, onChange, maxOccupancy = 4 }: Props) {
  const [bands, setBands] = useState<AgeBand[]>(value.length ? value : DEFAULT_BANDS);

  useEffect(() => { onChange(bands); }, [bands]);

  const update = (id: string, field: keyof AgeBand, val: unknown) =>
    setBands(b => b.map(row => row.id === id ? { ...row, [field]: val } : row));

  const addBand = () => setBands(b => [...b, { id: Date.now().toString(), from: 0, to: 0, category: 'Child', pricingRule: 'free' }]);
  const removeBand = (id: string) => setBands(b => b.filter(r => r.id !== id));

  const errors = validate(bands, maxOccupancy);
  const isValid = errors.length === 0;

  return (
    <div className="space-y-4">
      {/* Band rows */}
      <div className="space-y-2">
        {bands.map((band) => (
          <div key={band.id} className={`rounded-lg border p-3 space-y-2 ${CATEGORY_COLORS[band.category] ?? 'bg-muted'}`}>
            <div className="grid grid-cols-12 gap-2 items-center">
              {/* Category */}
              <div className="col-span-3">
                <Select value={band.category} onValueChange={v => update(band.id, 'category', v)}>
                  <SelectTrigger className="h-8 text-xs font-bold bg-white/80"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Infant">👶 Infant</SelectItem>
                    <SelectItem value="Child">🧒 Child</SelectItem>
                    <SelectItem value="Adult">🧑 Adult</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Age From */}
              <div className="col-span-2 flex items-center gap-1">
                <span className="text-xs font-semibold">Age</span>
                <Input type="number" value={band.from} min={0} max={99}
                  onChange={e => update(band.id, 'from', Number(e.target.value))}
                  className="h-8 text-xs font-bold bg-white/80 w-full" />
              </div>
              <span className="text-xs font-bold text-center">–</span>
              {/* Age To */}
              <div className="col-span-2">
                <Input type="number" value={band.to} min={0} max={99}
                  onChange={e => update(band.id, 'to', Number(e.target.value))}
                  className="h-8 text-xs font-bold bg-white/80" />
              </div>
              {/* Pricing Rule */}
              <div className="col-span-3">
                <Select value={band.pricingRule} onValueChange={v => update(band.id, 'pricingRule', v)}>
                  <SelectTrigger className="h-8 text-xs bg-white/80"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRICING_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Delete */}
              <div className="col-span-1 flex justify-end">
                <button onClick={() => removeBand(band.id)} className="p-1.5 rounded hover:bg-black/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            </div>
            {/* Pricing value sub-row */}
            {(band.pricingRule === 'percent' || band.pricingRule === 'fixed' || band.pricingRule === 'extra_bed_charge') && (
              <div className="flex items-center gap-2 pl-1">
                {band.pricingRule === 'percent' && (
                  <>
                    <Input type="number" value={band.pricingValue ?? ''} min={0} max={100}
                      onChange={e => update(band.id, 'pricingValue', Number(e.target.value))}
                      placeholder="50" className="h-7 text-xs w-20 bg-white/80 font-bold" />
                    <span className="text-xs font-semibold">% of adult rate</span>
                  </>
                )}
                {band.pricingRule === 'fixed' && (
                  <>
                    <Input type="number" value={band.pricingValue ?? ''} min={0}
                      onChange={e => update(band.id, 'pricingValue', Number(e.target.value))}
                      placeholder="0" className="h-7 text-xs w-24 bg-white/80 font-bold" />
                    <span className="text-xs font-semibold">AED / night</span>
                  </>
                )}
                {band.pricingRule === 'extra_bed_charge' && (
                  <>
                    <span className="text-xs">Extra bed:</span>
                    <Input type="number" value={band.extraBedPrice ?? ''} min={0}
                      onChange={e => update(band.id, 'extraBedPrice', Number(e.target.value))}
                      placeholder="150" className="h-7 text-xs w-24 bg-white/80 font-bold" />
                    <span className="text-xs font-semibold">AED / night</span>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addBand} className="gap-1.5 text-xs font-bold">
        <Plus className="w-3.5 h-3.5" /> Add Age Band
      </Button>

      {/* Validation */}
      {errors.length > 0 ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
          <p className="text-xs font-bold text-destructive flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Validation Errors</p>
          {errors.map((e, i) => <p key={i} className="text-xs text-destructive">• {e}</p>)}
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
          <p className="text-xs font-bold text-green-800 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Age Band Preview</p>
          {[...bands].sort((a, b) => a.from - b.from).map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded font-bold border ${CATEGORY_COLORS[b.category]}`}>{b.category.toUpperCase()}</span>
              <span className="text-xs text-green-800">Ages {b.from}–{b.to === 99 ? '99+' : b.to}</span>
              <span className="text-xs text-green-600">· {PRICING_LABELS[b.pricingRule]}{b.pricingRule === 'percent' ? ` (${b.pricingValue ?? 0}%)` : ''}{b.pricingRule === 'fixed' ? ` (AED ${b.pricingValue ?? 0})` : ''}{b.pricingRule === 'extra_bed_charge' ? ` (AED ${b.extraBedPrice ?? 0}/extra bed)` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
