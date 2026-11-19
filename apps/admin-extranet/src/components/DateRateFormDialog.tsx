import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format, addDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Separator } from '@project/components/ui/separator';
import { Calendar } from '@project/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { GetRoomTypesOutputType, GetDailyRatesOutputType } from 'zitejs/api';

type RoomType = GetRoomTypesOutputType['roomTypes'][0];
type DailyRate = GetDailyRatesOutputType['rates'][0];

interface Props {
  open: boolean;
  hotelId: string;
  roomTypes: RoomType[];
  initialRoomTypeId?: string;
  initialDate?: string;
  existingRate?: DailyRate | null;
  onClose: () => void;
  onSave: (data: {
    roomTypeId: string;
    startDate: string;
    endDate: string;
    adult1Rate?: number;
    adult2Rate: number;
    adult3Rate?: number;
    childSupplement?: number;
    extraBedRate?: number;
    minStay?: number;
    allocation?: number;
    currency: string;
  }) => Promise<void>;
  loading?: boolean;
}

function DatePickerField({ label, value, onChange }: { label: string; value?: Date; onChange: (d: Date | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal text-sm h-9">
            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            {value ? format(value, 'dd MMM yyyy') : <span className="text-muted-foreground">Pick date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function DateRateFormDialog({ open, roomTypes, initialRoomTypeId, initialDate, existingRate, onClose, onSave, loading }: Props) {
  const { register, handleSubmit, setValue, reset, watch } = useForm<any>();
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  useEffect(() => {
    if (!open) return;
    const base = initialDate ? new Date(initialDate + 'T00:00:00') : new Date();
    setFromDate(base);
    setToDate(existingRate ? base : addDays(base, 6));
    reset({
      roomTypeId: initialRoomTypeId || '',
      adult1Rate: existingRate?.adult1Rate ?? '',
      adult2Rate: existingRate?.adult2Rate ?? '',
      adult3Rate: existingRate?.adult3Rate ?? '',
      childSupplement: existingRate?.childSupplement ?? '',
      extraBedRate: existingRate?.extraBedRate ?? '',
      minStay: existingRate?.minStay ?? 1,
      allocation: existingRate?.allocation ?? 10,
      currency: existingRate?.currency ?? 'AED',
    });
  }, [open, initialRoomTypeId, initialDate, existingRate]);

  const onSubmit = async (data: any) => {
    if (!fromDate || !toDate) return;
    const n = (v: any) => v !== '' && v != null ? Number(v) : undefined;
    await onSave({
      roomTypeId: data.roomTypeId,
      startDate: format(fromDate, 'yyyy-MM-dd'),
      endDate: format(toDate, 'yyyy-MM-dd'),
      adult1Rate: n(data.adult1Rate),
      adult2Rate: Number(data.adult2Rate),
      adult3Rate: n(data.adult3Rate),
      childSupplement: n(data.childSupplement),
      extraBedRate: n(data.extraBedRate),
      minStay: n(data.minStay),
      allocation: n(data.allocation),
      currency: data.currency || 'AED',
    });
  };

  const isEditing = !!existingRate;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Rate' : 'Apply Net Rates'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Room Type *</Label>
            <Select value={watch('roomTypeId')} onValueChange={v => setValue('roomTypeId', v)}>
              <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
              <SelectContent>{roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.roomTypeName}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DatePickerField label="Date From *" value={fromDate} onChange={setFromDate} />
            <DatePickerField label="Date To *" value={toDate} onChange={setToDate} />
          </div>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Occupancy Rates (per room/night)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">SGL (1 Adult)</Label>
              <Input type="number" step="0.01" {...register('adult1Rate')} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">DBL (2 Adults) *</Label>
              <Input type="number" step="0.01" {...register('adult2Rate', { required: true })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">TPL (3 Adults)</Label>
              <Input type="number" step="0.01" {...register('adult3Rate')} placeholder="0.00" />
            </div>
          </div>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Supplements & Extras</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Extra Bed / Night</Label>
              <Input type="number" step="0.01" {...register('extraBedRate')} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Child Supplement / Night</Label>
              <Input type="number" step="0.01" {...register('childSupplement')} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Min Nights</Label>
              <Input type="number" {...register('minStay')} min={1} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Allocation</Label>
              <Input type="number" {...register('allocation')} min={0} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={watch('currency')} onValueChange={v => setValue('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AED">AED</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !fromDate || !toDate}>
              {loading ? 'Saving...' : isEditing ? 'Update Rate' : 'Apply Rates'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
