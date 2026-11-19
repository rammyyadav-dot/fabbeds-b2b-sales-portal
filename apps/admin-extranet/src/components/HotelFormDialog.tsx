import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Badge } from '@project/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Textarea } from '@project/components/ui/textarea';
import { GetHotelsOutputType } from 'zitejs/api';

type Hotel = GetHotelsOutputType['hotels'][0];

interface Props {
  open: boolean;
  hotel?: Hotel | null;
  onClose: () => void;
  onSave: (data: Omit<Hotel, 'id'> & { id?: string }) => Promise<void>;
  loading?: boolean;
}

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Fujairah', 'Ajman', 'Umm Al Quwain'];
const STAR_RATINGS = ['3 Star', '4 Star', '5 Star'];

export default function HotelFormDialog({ open, hotel, onClose, onSave, loading }: Props) {
  const { register, handleSubmit, setValue, reset, watch } = useForm<any>();

  useEffect(() => {
    if (hotel) {
      reset({ hotelName: hotel.hotelName, location: hotel.location, starRating: hotel.starRating, emirate: hotel.emirate, description: hotel.description, status: hotel.status });
    } else {
      reset({ hotelName: '', location: '', starRating: '', emirate: '', description: '', status: 'Active' });
    }
  }, [hotel, open]);

  const onSubmit = async (data: any) => {
    await onSave({ ...data, id: hotel?.id });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hotel ? 'Edit Hotel' : 'Add Hotel'}
            {hotel?.hotelCode && (
              <Badge variant="secondary" className="font-mono text-xs">{hotel.hotelCode}</Badge>
            )}
            {!hotel && (
              <span className="text-xs text-muted-foreground font-normal">Code auto-assigned</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Hotel Name *</Label>
            <Input {...register('hotelName', { required: true })} placeholder="e.g. Burj Al Arab" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Emirate</Label>
              <Select value={watch('emirate')} onValueChange={v => setValue('emirate', v)}>
                <SelectTrigger><SelectValue placeholder="Select emirate" /></SelectTrigger>
                <SelectContent>{EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Star Rating</Label>
              <Select value={watch('starRating')} onValueChange={v => setValue('starRating', v)}>
                <SelectTrigger><SelectValue placeholder="Select rating" /></SelectTrigger>
                <SelectContent>{STAR_RATINGS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location / Address</Label>
            <Input {...register('location')} placeholder="e.g. Jumeirah Beach Road, Dubai" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea {...register('description')} rows={3} placeholder="Hotel description..." />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Hotel'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
