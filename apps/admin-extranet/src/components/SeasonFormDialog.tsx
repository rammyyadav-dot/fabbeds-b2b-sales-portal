import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { GetSeasonsOutputType } from 'zitejs/api';
import DatePickerInput from '@/components/DatePickerInput';

type Season = GetSeasonsOutputType['seasons'][0];

interface Props {
  open: boolean;
  season?: Season | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
}

const SEASON_TYPES = ['Peak', 'High', 'Shoulder', 'Low'];

export default function SeasonFormDialog({ open, season, onClose, onSave, loading }: Props) {
  const { register, handleSubmit, setValue, reset, watch } = useForm<any>();

  useEffect(() => {
    if (season) {
      reset({ seasonName: season.seasonName, startDate: season.startDate, endDate: season.endDate, seasonType: season.seasonType, year: season.year });
    } else {
      reset({ seasonName: '', startDate: '', endDate: '', seasonType: '', year: new Date().getFullYear() });
    }
  }, [season, open]);

  const onSubmit = async (data: any) => {
    await onSave({ ...data, id: season?.id, year: Number(data.year) });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{season ? 'Edit Season' : 'Add Season'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Season Name *</Label>
            <Input {...register('seasonName', { required: true })} placeholder="e.g. Peak Season 2025" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Season Type</Label>
              <Select value={watch('seasonType')} onValueChange={v => setValue('seasonType', v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{SEASON_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" {...register('year')} min={2024} max={2030} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <DatePickerInput value={watch('startDate') || ''} onChange={v => setValue('startDate', v)} placeholder="Start date" />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <DatePickerInput value={watch('endDate') || ''} onChange={v => setValue('endDate', v)} placeholder="End date" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Season'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
