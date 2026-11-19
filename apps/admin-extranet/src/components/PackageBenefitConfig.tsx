import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Input } from '@project/components/ui/input';
import { Checkbox } from '@project/components/ui/checkbox';
import { Label } from '@project/components/ui/label';

export type PackageBenefit = {
  benefitType?: string;
  benefitScope?: string;
  creditAmount?: number;
  creditDepartment?: string;
  upgradeFromRoom?: string;
  upgradeToRoom?: string;
  upgradeSubjectToAvailability?: boolean;
  mealUpgradeFrom?: string;
  mealUpgradeTo?: string;
  freeNightBreakfastOnly?: boolean;
};

const BENEFIT_TYPES = [
  { value: 'FreeBreakfast', label: 'Free Breakfast' },
  { value: 'MealPlanUpgrade', label: 'Meal Plan Upgrade' },
  { value: 'RoomUpgrade', label: 'Room Upgrade' },
  { value: 'AirportTransfer', label: 'Airport Transfer' },
  { value: 'SpaCredit', label: 'Spa Credit' },
  { value: 'FnBCredit', label: 'F&B Credit' },
  { value: 'ExtraBed', label: 'Extra Bed' },
  { value: 'Parking', label: 'Parking' },
  { value: 'LateCheckout', label: 'Late Checkout' },
  { value: 'CustomAddOn', label: 'Custom Add-On' },
];

const MEAL_PLANS = ['RO', 'BB', 'HB', 'FB', 'AI'];
const SCOPES = ['Per stay', 'Per night', 'Per room', 'Per guest'];
const DEPARTMENTS = ['Spa', 'F&B', 'Resort'];

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-bold text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Props {
  value: PackageBenefit;
  onChange: (v: PackageBenefit) => void;
}

export default function PackageBenefitConfig({ value, onChange }: Props) {
  const set = (field: keyof PackageBenefit, val: unknown) => onChange({ ...value, [field]: val });
  const bt = value.benefitType;

  const isCreditType = bt === 'SpaCredit' || bt === 'FnBCredit';
  const isRoomUpgrade = bt === 'RoomUpgrade';
  const isMealUpgrade = bt === 'MealPlanUpgrade';
  const isFreeNight = bt === 'FreeNight';
  const hasScope = bt && !['AirportTransfer', 'Parking', 'LateCheckout'].includes(bt);

  return (
    <div className="space-y-4">
      {/* Row 1: Benefit Type + Scope */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Benefit Type" required>
          <Select value={value.benefitType ?? ''} onValueChange={v => onChange({ benefitType: v })}>
            <SelectTrigger className="font-semibold"><SelectValue placeholder="Select benefit…" /></SelectTrigger>
            <SelectContent>
              {BENEFIT_TYPES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        {hasScope && (
          <Field label="Benefit Scope">
            <Select value={value.benefitScope ?? ''} onValueChange={v => set('benefitScope', v)}>
              <SelectTrigger className="font-semibold"><SelectValue placeholder="Select scope…" /></SelectTrigger>
              <SelectContent>
                {SCOPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      {/* Credit config */}
      {isCreditType && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Credit Amount (AED)" required>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} value={value.creditAmount ?? ''} onChange={e => set('creditAmount', Number(e.target.value))} placeholder="0" className="font-bold" />
              <span className="text-sm font-bold text-muted-foreground shrink-0">AED</span>
            </div>
          </Field>
          <Field label="Department">
            <Select value={value.creditDepartment ?? ''} onValueChange={v => set('creditDepartment', v)}>
              <SelectTrigger className="font-semibold"><SelectValue placeholder="Select department…" /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      {/* Room Upgrade config */}
      {isRoomUpgrade && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="From Room Type">
              <Input value={value.upgradeFromRoom ?? ''} onChange={e => set('upgradeFromRoom', e.target.value)} placeholder="e.g. Deluxe Room" />
            </Field>
            <Field label="To Room Type">
              <Input value={value.upgradeToRoom ?? ''} onChange={e => set('upgradeToRoom', e.target.value)} placeholder="e.g. Junior Suite" />
            </Field>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={!!value.upgradeSubjectToAvailability} onCheckedChange={v => set('upgradeSubjectToAvailability', !!v)} />
            <div>
              <p className="text-sm font-bold">Subject to availability</p>
              <p className="text-xs text-muted-foreground">Upgrade confirmed only if upgraded room is available</p>
            </div>
          </label>
        </div>
      )}

      {/* Meal Plan Upgrade config */}
      {isMealUpgrade && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="From Meal Plan">
            <Select value={value.mealUpgradeFrom ?? ''} onValueChange={v => set('mealUpgradeFrom', v)}>
              <SelectTrigger className="font-semibold"><SelectValue placeholder="e.g. RO" /></SelectTrigger>
              <SelectContent>
                {MEAL_PLANS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="To Meal Plan">
            <Select value={value.mealUpgradeTo ?? ''} onValueChange={v => set('mealUpgradeTo', v)}>
              <SelectTrigger className="font-semibold"><SelectValue placeholder="e.g. BB" /></SelectTrigger>
              <SelectContent>
                {MEAL_PLANS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      {/* Free Night config */}
      {isFreeNight && (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={!!value.freeNightBreakfastOnly} onCheckedChange={v => set('freeNightBreakfastOnly', !!v)} />
          <div>
            <p className="text-sm font-bold">Include breakfast only for the free night</p>
            <p className="text-xs text-muted-foreground">Breakfast is included only on the complimentary night</p>
          </div>
        </label>
      )}
    </div>
  );
}
