import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Separator } from '@project/components/ui/separator';
import { Checkbox } from '@project/components/ui/checkbox';
import { getRoomTypes, getRatePlans, GetEventMasterOutputType, GetRoomTypesOutputType, GetRatePlansOutputType } from 'zitejs/api';
import DateRangePicker from '@/components/DateRangePicker';

type Event = GetEventMasterOutputType['events'][0];

interface Props {
  open: boolean;
  event?: Event | null;
  hotelId: string;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
}

export default function EventMasterFormDialog({ open, event, hotelId, onClose, onSave, loading }: Props) {
  const { register, handleSubmit, setValue, watch, reset } = useForm<any>();
  const [roomTypes, setRoomTypes] = useState<GetRoomTypesOutputType['roomTypes']>([]);
  const [ratePlans, setRatePlans] = useState<GetRatePlansOutputType['ratePlans']>([]);

  useEffect(() => {
    if (open) {
      reset({
        eventName: event?.eventName ?? '',
        startDate: event?.startDate ?? '',
        endDate: event?.endDate ?? '',
        supplementType: event?.supplementType ?? 'Per Room Per Night',
        supplementAmount: event?.supplementAmount ?? '',
        scope: event?.scope ?? 'Entire Property',
        mlos: event?.mlos ?? '',
        releasePeriodDays: event?.releasePeriodDays ?? '',
        notes: event?.notes ?? '',
        status: event?.status ?? 'Active',
        applicableRoomTypeIds: event?.applicableRoomTypes ?? [],
        applicableRatePlanIds: event?.applicableRatePlans ?? [],
        applicableWeekdays: event?.applicableWeekdays?.length ? event.applicableWeekdays : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        stackRule: event?.stackRule ?? 'Add All Matching Events',
        taxesIncluded: event?.taxesIncluded ?? true,
      });
      Promise.all([
        getRoomTypes({ hotelId }),
        getRatePlans({ hotelId }),
      ]).then(([rooms, plans]) => {
        setRoomTypes(rooms.roomTypes.filter(r => r.status !== 'Inactive'));
        setRatePlans(plans.ratePlans.filter(p => p.status !== 'Inactive'));
      }).catch(() => {
        setRoomTypes([]);
        setRatePlans([]);
      });
    }
  }, [open, event, hotelId]);

  const onSubmit = async (data: any) => {
    await onSave({
      ...data,
      id: event?.id,
      hotelId,
      supplementAmount: data.supplementAmount ? Number(data.supplementAmount) : undefined,
      mlos: data.mlos ? Number(data.mlos) : undefined,
      releasePeriodDays: data.releasePeriodDays ? Number(data.releasePeriodDays) : undefined,
    });
  };

  const toggleArrayValue = (field: 'applicableRoomTypeIds'|'applicableRatePlanIds'|'applicableWeekdays', value: string) => {
    const current = (watch(field) || []) as string[];
    setValue(field, current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Add Event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Event Setup */}
          <SectionTitle>Event Setup</SectionTitle>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Event Name *</Label>
              <Input {...register('eventName', { required: true })} placeholder='e.g. Arab Health 2026' />
            </div>
            <div className="space-y-1.5">
              <Label>Event Dates</Label>
              <DateRangePicker
                checkin={watch('startDate') || ''}
                checkout={watch('endDate') || ''}
                onCheckinChange={v => setValue('startDate', v)}
                onCheckoutChange={v => setValue('endDate', v)}
                allowPast
                startLabel="Event Start"
                endLabel="Event End"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={watch('status')} onValueChange={v => setValue('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Supplement Rule */}
          <SectionTitle>Supplement Rule</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Supplement Type</Label>
              <Select value={watch('supplementType')} onValueChange={v => setValue('supplementType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Per Room Per Night">Per Room Per Night</SelectItem>
                  <SelectItem value="Per Person Per Night">Per Person Per Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Supplement Amount (AED)</Label>
              <Input {...register('supplementAmount')} type="number" min="0" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={watch('scope')} onValueChange={v => setValue('scope', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entire Property">Entire Property</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <SectionTitle>Applicability & Frontend Pricing</SectionTitle>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Applicable Room Types</Label>
              <div className="rounded-lg border divide-y max-h-40 overflow-auto">
                {roomTypes.map(room => {
                  const checked = (watch('applicableRoomTypeIds') || []).includes(room.id);
                  return <label key={room.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                    <Checkbox checked={checked} onCheckedChange={() => toggleArrayValue('applicableRoomTypeIds', room.id)} />
                    <span>{room.roomTypeName}</span>
                  </label>;
                })}
                {roomTypes.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No active room types found for this hotel.</p>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Leave all unchecked to apply to every active room type in this hotel.</p>
            </div>

            <div>
              <Label className="mb-2 block">Applicable Rate Plans</Label>
              <div className="rounded-lg border divide-y max-h-40 overflow-auto">
                {ratePlans.map(plan => {
                  const checked = (watch('applicableRatePlanIds') || []).includes(plan.id);
                  return <label key={plan.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox checked={checked} onCheckedChange={() => toggleArrayValue('applicableRatePlanIds', plan.id)} />
                      <span className="truncate">{plan.ratePlanName}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{plan.mealPlan || ''}</span>
                  </label>;
                })}
                {ratePlans.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No active rate plans found for this hotel.</p>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Leave all unchecked to apply to every active rate plan for the selected rooms.</p>
            </div>

            <div>
              <Label className="mb-2 block">Applicable Weekdays</Label>
              <div className="grid grid-cols-7 gap-1">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
                  const active = (watch('applicableWeekdays') || []).includes(day);
                  return <button type="button" key={day} onClick={() => toggleArrayValue('applicableWeekdays', day)}
                    className={`rounded-md border px-1 py-2 text-[11px] font-semibold ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}>
                    {day}
                  </button>;
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stack Rule</Label>
                <Select value={watch('stackRule')} onValueChange={v => setValue('stackRule', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Add All Matching Events">Add All Matching Events</SelectItem>
                    <SelectItem value="Highest Matching Event Only">Highest Matching Event Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 border rounded-lg px-3 py-2 mt-6 text-sm">
                <Checkbox checked={!!watch('taxesIncluded')} onCheckedChange={v => setValue('taxesIncluded', !!v)} />
                Supplement includes taxes
              </label>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              The supplement is added to the hotel&apos;s authoritative Daily Rate only for matching stay nights, room types, rate plans and weekdays. The portal then applies the normal hotel markup to the combined net amount. Existing Daily Rates are never overwritten.
            </div>
          </div>

          <Separator />

          {/* Minimum Stay & Release */}
          <SectionTitle>Minimum Stay & Release</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm">
            <div className="space-y-1.5">
              <Label>MLOS (Min Length of Stay)</Label>
              <Input {...register('mlos')} type="number" min="0" placeholder="e.g. 3" />
            </div>
            <div className="space-y-1.5">
              <Label>Release Period (Days)</Label>
              <Input {...register('releasePeriodDays')} type="number" min="0" placeholder="e.g. 7" />
            </div>
          </div>

          <Separator />
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register('notes')} rows={2} placeholder="Additional notes..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Event'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-foreground">{children}</p>;
}
