import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';

interface Props {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
}

const BEDDING_TYPES = ['King', 'Twin', 'Double', 'Triple', 'Suite'];

export default function RoomTypeCoreSection({ register, watch, setValue }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Room Type Name *</Label>
        <Input {...register('roomTypeName', { required: true })} placeholder="e.g. Deluxe Sea View" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Base Occupancy</Label>
          <Input type="number" min={1} {...register('baseOccupancy', { valueAsNumber: true })} placeholder="e.g. 2" />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={watch('status') || 'Active'} onValueChange={v => setValue('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Bedding Type</Label>
          <Select value={watch('beddingType') || ''} onValueChange={v => setValue('beddingType', v)}>
            <SelectTrigger><SelectValue placeholder="Select bedding" /></SelectTrigger>
            <SelectContent>{BEDDING_TYPES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Views</Label>
          <Input {...register('views')} placeholder="e.g. Sea View, Garden View" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Inclusions</Label>
        <Input {...register('inclusions')} placeholder="e.g. Waterpark access, Beach access" />
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea {...register('description')} rows={2} placeholder="Room description..." />
      </div>

    </div>
  );
}
