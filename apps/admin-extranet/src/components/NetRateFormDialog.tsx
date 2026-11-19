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
import { GetRoomTypesOutputType } from 'zitejs/api';

type RoomType = GetRoomTypesOutputType['roomTypes'][0];

interface Props {
  open: boolean;
  hotelId: string;
  roomTypes: RoomType[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
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

export default function NetRateFormDialog({ open, hotelId, roomTypes, onClose, onSave, loading }: Props) {
  const { register, handleSubmit, setValue, reset, watch } = useForm<any>();
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(addDays(new Date(), 6));

  useEffect(() => {
    if (open) {
      const today = new Date();
      setFromDate(today);
      setToDate(addDays(today, 6));
      reset({
        roomTypeId: '',
        netRatePerNight: '', singleOccupancyRate: '', tripleOccupancyRate: '',
        extraBedRate: '', childSupplementPerNight: '',
        childAgeFrom: 2, childAgeTo: 11, minNights: 1, currency: 'AED',
      });
    }
  }, [open]);

  const onSubmit = async (data: any) => {
    if (!fromDate || !toDate) return;
    const n = (v: any) => v !== '' && v != null ? Number(v) : undefined;
    await onSave({
      hotelId,
      roomTypeId: data.roomTypeId,
      startDate: format(fromDate, 'yyyy-MM-dd'),
      endDate: format(toDate, 'yyyy-MM-dd'),
      adult2Rate: Number(data.netRatePerNight),
      adult1Rate: n(data.singleOccupancyRate),
      adult3Rate: n(data.tripleOccupancyRate),
      extraBedRate: n(data.extraBedRate),
      childSupplement: n(data.childSupplementPerNight),
      minStay: n(data.minNights),
      currency: data.currency,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Net Rate</DialogTitle>
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
            <DatePickerField label="Valid From *" value={fromDate} onChange={setFromDate} />
            <DatePickerField label="Valid To *" value={toDate} onChange={setToDate} />
          </div>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Occupancy Rates (per room/night)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">SGL (1 Adult)</Label>
              <Input type="number" step="0.01" {...register('singleOccupancyRate')} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">DBL (2 Adults) *</Label>
              <Input type="number" step="0.01" {...register('netRatePerNight', { required: true })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">TPL (3 Adults)</Label>
              <Input type="number" step="0.01" {...register('tripleOccupancyRate')} placeholder="0.00" />
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
              <Input type="number" step="0.01" {...register('childSupplementPerNight')} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Child Age From</Label>
              <Input type="number" {...register('childAgeFrom')} min={0} max={17} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Child Age To</Label>
              <Input type="number" {...register('childAgeTo')} min={0} max={17} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Min Nights</Label>
              <Input type="number" {...register('minNights')} min={1} />
            </div>
          </div>

          <Separator />
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={watch('currency')} onValueChange={v => setValue('currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AED">AED</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !fromDate || !toDate}>
              {loading ? 'Saving...' : 'Save Rate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
