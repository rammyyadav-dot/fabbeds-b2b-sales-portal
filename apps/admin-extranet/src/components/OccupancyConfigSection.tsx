import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Checkbox } from '@project/components/ui/checkbox';
import { Info, Zap, Lock, AlertTriangle } from 'lucide-react';
import OccupancyMatrix from './OccupancyMatrix';

interface Props {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{msg}</p>;
}

function SectionLabel({ label, color = 'text-blue-700' }: { label: string; color?: string }) {
  return <p className={`text-sm font-extrabold ${color} mb-2`}>{label}</p>;
}

export default function OccupancyConfigSection({ register, watch, setValue }: Props) {
  const maxTotal = Number(watch('maxOccupancy') || 0);
  const maxAdults = Number(watch('maxAdults') || 0);
  const maxChildren = Number(watch('maxChildren') || 0);
  const maxAdultsWithKids = Number(watch('maxAdultsWithChildren') || 0);
  const minTotal = Number(watch('minTotalOccupancy') || 1);
  const minAdults = Number(watch('minAdultsRequired') || 1);
  const maxExtraBeds = Number(watch('maxExtraBeds') || 0);
  const extraBedCountsTowardTotal = !!watch('extraBedCountsTowardTotal');
  const lockAfterBooking = !!watch('lockAfterBooking');
  const eventMax = Number(watch('eventMaxOccupancy') || 0);

  // Validation rules
  const errors = {
    maxAdults: maxAdults > maxTotal ? `Max Adults (${maxAdults}) cannot exceed Max Total (${maxTotal})` : undefined,
    maxChildren: maxChildren > maxTotal ? `Max Children (${maxChildren}) cannot exceed Max Total (${maxTotal})` : undefined,
    minTotal: minTotal > maxTotal ? `Min Total (${minTotal}) cannot exceed Max Total (${maxTotal})` : undefined,
    maxAdultsWithKids: maxAdultsWithKids > maxAdults ? `Max Adults w/ Children (${maxAdultsWithKids}) cannot exceed Max Adults (${maxAdults})` : undefined,
    minAdults: minAdults > maxAdults ? `Min Adults Required (${minAdults}) cannot exceed Max Adults (${maxAdults})` : undefined,
    eventMax: eventMax > 0 && eventMax < maxTotal ? `Event Max (${eventMax}) must be ≥ Max Total (${maxTotal}) to act as an override` : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-blue-700">
        <Info className="w-4 h-4" />
        <h3 className="font-extrabold text-sm">Occupancy Configuration</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">Rules enforced during search and booking. Invalid combos are blocked automatically.</p>

      {hasErrors && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
          <p className="text-xs font-bold text-destructive flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Fix validation errors before saving</p>
          {Object.values(errors).filter(Boolean).map((e, i) => <p key={i} className="text-xs text-destructive">• {e}</p>)}
        </div>
      )}

      {/* A. Maximum */}
      <div className="space-y-3">
        <SectionLabel label="A. Maximum Occupancy Rules" />
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-bold">Max Total Occupancy *</Label>
            <Input type="number" {...register('maxOccupancy')} min={1} max={20} />
            <p className="text-xs text-muted-foreground">Physical room limit</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold">Max Adults *</Label>
            <Input type="number" {...register('maxAdults')} min={1} max={10} />
            <p className="text-xs text-muted-foreground">Adult-only scenario</p>
            <FieldError msg={errors.maxAdults} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold">Max Children *</Label>
            <Input type="number" {...register('maxChildren')} min={0} max={10} />
            <p className="text-xs text-muted-foreground">Child-only cap</p>
            <FieldError msg={errors.maxChildren} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold">Max Adults (when traveling with children)</Label>
          <Input type="number" {...register('maxAdultsWithChildren')} min={0} max={10} className="max-w-[160px]" />
          <p className="text-xs text-muted-foreground">Mixed occupancy control — e.g., max 2 adults when children are present</p>
          <FieldError msg={errors.maxAdultsWithKids} />
        </div>
      </div>

      {/* B. Minimum */}
      <div className="space-y-3">
        <SectionLabel label="B. Minimum Occupancy Rules" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-bold">Min Total Occupancy *</Label>
            <Input type="number" {...register('minTotalOccupancy')} min={1} max={10} />
            <p className="text-xs text-muted-foreground">Prevent under-booking large suites</p>
            <FieldError msg={errors.minTotal} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold">Min Adults Required</Label>
            <Input type="number" {...register('minAdultsRequired')} min={1} max={10} />
            <p className="text-xs text-muted-foreground">Blocks child-only bookings (e.g., Suite = 2 adults min)</p>
            <FieldError msg={errors.minAdults} />
          </div>
        </div>
      </div>

      {/* C. Extra Bed */}
      <div className="space-y-3">
        <SectionLabel label="C. Extra Bed Capacity" />
        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="space-y-1">
            <Label className="text-xs font-bold">Max Extra Beds</Label>
            <Input type="number" {...register('maxExtraBeds')} min={0} max={5} placeholder="0" />
            <p className="text-xs text-muted-foreground">0 = no extra beds allowed</p>
          </div>
          <label className="flex items-start gap-2 cursor-pointer pt-5">
            <Checkbox checked={extraBedCountsTowardTotal} onCheckedChange={v => setValue('extraBedCountsTowardTotal', v)} />
            <div>
              <p className="text-sm font-bold">Extra Bed Counts Toward Max</p>
              <p className="text-xs text-muted-foreground">Guests + extra bed ≤ max total occupancy</p>
            </div>
          </label>
        </div>
      </div>

      {/* D. Event Override */}
      <div className="space-y-2">
        <SectionLabel label="D. Event Override Capacity" color="text-orange-600" />
        <div className="space-y-1">
          <Label className="text-xs font-bold">Event Max Occupancy (optional)</Label>
          <Input type="number" {...register('eventMaxOccupancy')} min={1} max={30} placeholder="Leave blank for standard max" className="max-w-[220px]" />
          <p className="text-xs text-muted-foreground">Must be ≥ Max Total to loosen capacity during events/exhibitions</p>
          <FieldError msg={errors.eventMax} />
        </div>
      </div>

      {/* E. Governance */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
        <p className="text-sm font-extrabold text-amber-800 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> E. Admin Governance
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={lockAfterBooking} onCheckedChange={v => setValue('lockAfterBooking', v)} />
          <div>
            <p className="text-sm font-bold text-amber-900">Lock After First Booking</p>
            <p className="text-xs text-amber-700">Prevents reducing occupancy limits once confirmed bookings exist</p>
          </div>
        </label>
      </div>

      {/* F. Occupancy Matrix */}
      {maxTotal > 0 && maxAdults > 0 && !hasErrors && (
        <OccupancyMatrix
          maxAdults={maxAdults}
          maxChildren={maxChildren}
          maxTotal={maxTotal}
          maxAdultsWithKids={maxAdultsWithKids}
          minTotal={minTotal}
          minAdults={minAdults}
          extraBeds={maxExtraBeds}
          extraBedCountsTowardMax={extraBedCountsTowardTotal}
        />
      )}
    </div>
  );
}
