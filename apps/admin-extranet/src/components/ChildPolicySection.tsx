import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Checkbox } from '@project/components/ui/checkbox';
import { Baby, Bed, Users } from 'lucide-react';
import AgeBandEngine, { AgeBand } from './AgeBandEngine';

interface Props {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
}

function SubSection({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 space-y-4 ${color}`}>
      <p className="text-sm font-extrabold flex items-center gap-2">{icon}{title}</p>
      {children}
    </div>
  );
}

export default function ChildPolicySection({ register, watch, setValue }: Props) {
  const childAllowed = !!watch('childAllowed');
  const extraBedAllowed = !!watch('extraBedAllowed');
  const adultExtraBedAvailable = !!watch('adultExtraBedAvailable');
  const maxOccupancy = Number(watch('maxOccupancy') ?? 4);
  const sharingBedAllowed = !!watch('sharingBedAllowed');

  const ageBandsJson: string = watch('ageBandsJson') ?? '[]';
  const ageBands: AgeBand[] = (() => { try { return JSON.parse(ageBandsJson); } catch { return []; } })();

  return (
    <div className="space-y-5">

      {/* Section 1 — Age Band Engine */}
      <SubSection
        icon={<Baby className="w-4 h-4 text-purple-600" />}
        title="Step 1 — Age Band Engine"
        color="border-purple-100 bg-purple-50/40"
      >
        <p className="text-xs text-muted-foreground -mt-2">
          Define structured age categories with pricing rules. System validates for gaps, overlaps, and occupancy limits.
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={childAllowed} onCheckedChange={v => setValue('childAllowed', v)} />
          <div>
            <p className="text-sm font-bold">Children Allowed in This Room</p>
            <p className="text-xs text-muted-foreground">Enable child guest bookings for this room type</p>
          </div>
        </label>

        {childAllowed && (
          <AgeBandEngine
            value={ageBands}
            onChange={bands => setValue('ageBandsJson', JSON.stringify(bands))}
            maxOccupancy={maxOccupancy}
          />
        )}
      </SubSection>

      {/* Section 2 — Bed & Occupancy Logic */}
      {childAllowed && (
        <SubSection
          icon={<Bed className="w-4 h-4 text-indigo-600" />}
          title="Step 2 — Bed & Occupancy Logic"
          color="border-indigo-100 bg-indigo-50/40"
        >
          <p className="text-xs text-muted-foreground -mt-2">
            Link child policy to bed availability and extra bed pricing. These rules interact with the Occupancy Rules section above.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Max Children Per Room</Label>
              <Input type="number" {...register('maxChildren')} min={0} max={10} className="font-semibold" />
              <p className="text-xs text-muted-foreground">Capped by max total occupancy ({maxOccupancy})</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Max Extra Beds</Label>
              <Input type="number" {...register('maxExtraBeds')} min={0} max={5} placeholder="0" className="font-semibold" />
              <p className="text-xs text-muted-foreground">0 = no extra beds allowed</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={sharingBedAllowed} onCheckedChange={v => setValue('sharingBedAllowed', v)} />
              <div>
                <p className="text-sm font-bold">Sharing Bed Allowed</p>
                <p className="text-xs text-muted-foreground">Child can share bed with adult at no extra charge</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={extraBedAllowed} onCheckedChange={v => setValue('extraBedAllowed', v)} />
              <div>
                <p className="text-sm font-bold">Extra Bed Allowed</p>
                <p className="text-xs text-muted-foreground">Allow rollaway / extra bed for children</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={adultExtraBedAvailable} onCheckedChange={v => setValue('adultExtraBedAvailable', v)} />
              <div>
                <p className="text-sm font-bold">Adult Extra Bed Available</p>
                <p className="text-xs text-muted-foreground">Allow additional adult guests with extra bed</p>
              </div>
            </label>
          </div>

          {/* Occupancy validation summary */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-1">
            <p className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Occupancy Compatibility
            </p>
            <p className="text-xs text-indigo-700">
              Room max occupancy: <strong>{maxOccupancy} guests</strong>. Child policy will be capped to this limit at booking time.
            </p>
            <p className="text-xs text-indigo-700">
              Sharing bed: <strong>{sharingBedAllowed ? 'Yes — child sharing counts 0 toward occupancy' : 'No — each child counts toward total occupancy'}</strong>
            </p>
          </div>
        </SubSection>
      )}
    </div>
  );
}
