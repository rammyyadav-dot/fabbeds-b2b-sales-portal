import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@project/components/ui/button';
import { Save, X, BedDouble, Users, Baby, Info } from 'lucide-react';
import { GetRoomTypesOutputType } from 'zitejs/api';
import RoomTypeCoreSection from './RoomTypeCoreSection';
import OccupancyConfigSection from './OccupancyConfigSection';
import ChildPolicySection from './ChildPolicySection';

type RoomType = GetRoomTypesOutputType['roomTypes'][0];

interface Props {
  open: boolean;
  roomType?: RoomType | null;
  hotelId: string;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
}

function SectionHeader({ icon, title, subtitle, color }: { icon: React.ReactNode; title: string; subtitle: string; color: string }) {
  return (
    <div className={`flex items-center gap-3 px-6 py-4 rounded-xl mb-5 ${color}`}>
      <div className="p-2 bg-white/70 rounded-lg">{icon}</div>
      <div>
        <h2 className="font-extrabold text-base">{title}</h2>
        <p className="text-xs opacity-70 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

export default function RoomTypeFormDialog({ open, roomType, hotelId, onClose, onSave, loading }: Props) {
  const { register, handleSubmit, setValue, reset, watch } = useForm<any>();

  useEffect(() => {
    if (open) {
      reset({
        roomTypeName: roomType?.roomTypeName || '',
        internalCode: roomType?.internalCode || '',
        maxOccupancy: roomType?.maxOccupancy ?? 4,
        mealPlan: roomType?.mealPlan || '',
        description: roomType?.description || '',
        beddingType: roomType?.beddingType || '',
        views: roomType?.views || '',
        inclusions: roomType?.inclusions || '',
        sellEnabled: roomType?.sellEnabled !== false,
        onRequestOnly: roomType?.onRequestOnly || false,
        maxAdults: roomType?.maxAdults ?? 3,
        maxChildren: roomType?.maxChildren ?? 2,
        maxAdultsWithChildren: roomType?.maxAdultsWithChildren ?? 2,
        minTotalOccupancy: roomType?.minTotalOccupancy ?? 1,
        minAdultsRequired: roomType?.minAdultsRequired ?? 1,
        extraBedCountsTowardTotal: roomType?.extraBedCountsTowardTotal ?? false,
        maxExtraBeds: roomType?.maxExtraBeds ?? 0,
        eventMaxOccupancy: roomType?.eventMaxOccupancy ?? '',
        lockAfterBooking: roomType?.lockAfterBooking ?? false,
        childAllowed: roomType?.childAllowed ?? true,
        childAgeFrom: roomType?.childAgeFrom ?? 2,
        childAgeTo: roomType?.childAgeTo ?? 11,
        childAgeFreeUpTo: roomType?.childAgeFreeUpTo ?? 5,
        childAgeAdultFrom: roomType?.childAgeAdultFrom ?? 12,
        extraBedAllowed: roomType?.extraBedAllowed || false,
        adultExtraBedAvailable: roomType?.adultExtraBedAvailable || false,
        sharingBedAllowed: (roomType as any)?.sharingBedAllowed || false,
        ageBandsJson: (roomType as any)?.ageBandsJson || '[]',
        roomTypeCode: roomType?.roomTypeCode || '',
        baseOccupancy: roomType?.baseOccupancy ?? 2,
        childPolicyId: roomType?.childPolicyId || '',
        status: roomType?.status || 'Active',
      });
    }
  }, [roomType, open]);

  const onSubmit = async (data: any) => {
    await onSave({
      ...data,
      id: roomType?.id,
      hotelId,
      maxOccupancy: Number(data.maxOccupancy),
      maxAdults: Number(data.maxAdults),
      maxChildren: Number(data.maxChildren),
      maxAdultsWithChildren: Number(data.maxAdultsWithChildren),
      minTotalOccupancy: Number(data.minTotalOccupancy),
      minAdultsRequired: data.minAdultsRequired ? Number(data.minAdultsRequired) : undefined,
      maxExtraBeds: data.maxExtraBeds ? Number(data.maxExtraBeds) : undefined,
      eventMaxOccupancy: data.eventMaxOccupancy ? Number(data.eventMaxOccupancy) : undefined,
      childAgeFrom: data.childAgeFrom ? Number(data.childAgeFrom) : undefined,
      childAgeTo: data.childAgeTo ? Number(data.childAgeTo) : undefined,
      childAgeFreeUpTo: data.childAgeFreeUpTo ? Number(data.childAgeFreeUpTo) : undefined,
      childAgeAdultFrom: data.childAgeAdultFrom ? Number(data.childAgeAdultFrom) : undefined,
      ageBandsJson: data.ageBandsJson,
      sharingBedAllowed: data.sharingBedAllowed,
      roomTypeCode: data.roomTypeCode || undefined,
      baseOccupancy: data.baseOccupancy ? Number(data.baseOccupancy) : undefined,
      childPolicyId: data.childPolicyId || undefined,
      status: data.status || 'Active',
    });
  };

  if (!open) return null;

  const isEdit = !!roomType;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">
      {/* Sticky top bar */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">
              {isEdit ? `Edit: ${roomType.roomTypeName}` : 'Create Room Type'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Configure all room details, occupancy rules, and child policy</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" type="button" onClick={onClose} className="font-bold">Cancel</Button>
          <Button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={loading}
            className="gap-2 font-bold"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Room Type'}
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">

            {/* Section 1 – Room Details */}
            <div>
              <SectionHeader
                icon={<BedDouble className="w-5 h-5 text-indigo-700" />}
                title="Room Details"
                subtitle="Basic information, amenities, and commercial settings"
                color="bg-indigo-50 text-indigo-900 border border-indigo-100"
              />
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <RoomTypeCoreSection register={register} watch={watch} setValue={setValue} />
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <Info className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Section 2 – Occupancy Rules */}
            <div>
              <SectionHeader
                icon={<Users className="w-5 h-5 text-teal-700" />}
                title="Occupancy Rules"
                subtitle="Define max/min guests, adult & children limits, and extra bed capacity"
                color="bg-teal-50 text-teal-900 border border-teal-100"
              />
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <OccupancyConfigSection register={register} watch={watch} setValue={setValue} />
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <Info className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Section 3 – Child Policy & Extra Bed */}
            <div>
              <SectionHeader
                icon={<Baby className="w-5 h-5 text-purple-700" />}
                title="Child Policy & Extra Bed"
                subtitle="Age brackets, child pricing tiers, and extra bed availability"
                color="bg-purple-50 text-purple-900 border border-purple-100"
              />
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <ChildPolicySection register={register} watch={watch} setValue={setValue} />
              </div>
            </div>

            {/* Bottom save bar */}
            <div className="flex items-center justify-between py-6 border-t border-border">
              <Button variant="outline" type="button" onClick={onClose} className="font-bold">Cancel</Button>
              <Button type="submit" disabled={loading} className="gap-2 font-bold px-8">
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Room Type'}
              </Button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
