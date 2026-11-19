import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { GetMarkupRulesOutputType, GetHotelsOutputType } from 'zitejs/api';

type Rule = GetMarkupRulesOutputType['rules'][0];
type Hotel = GetHotelsOutputType['hotels'][0];

interface Props {
  open: boolean;
  rule?: Rule | null;
  hotels: Hotel[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
}

export default function MarkupRuleFormDialog({ open, rule, hotels, onClose, onSave, loading }: Props) {
  const { register, handleSubmit, setValue, reset, watch } = useForm<any>();
  const appliesTo = watch('appliesTo');

  useEffect(() => {
    if (rule) {
      const hotelId = Array.isArray(rule.specificHotel) ? rule.specificHotel[0] : rule.specificHotel;
      reset({ ruleName: rule.ruleName, markupType: rule.markupType, markupValue: rule.markupValue, appliesTo: rule.appliesTo, specificHotelId: hotelId, isActive: rule.isActive ?? true, notes: rule.notes });
    } else {
      reset({ ruleName: '', markupType: 'Percentage (%)', markupValue: '', appliesTo: 'Global (All Hotels)', specificHotelId: '', isActive: true, notes: '' });
    }
  }, [rule, open]);

  const onSubmit = async (data: any) => {
    await onSave({ ...data, id: rule?.id, markupValue: Number(data.markupValue) });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Markup Rule' : 'Add Markup Rule'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Rule Name *</Label>
            <Input {...register('ruleName', { required: true })} placeholder="e.g. Standard Global Markup" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Markup Type</Label>
              <Select value={watch('markupType')} onValueChange={v => setValue('markupType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Percentage (%)">Percentage (%)</SelectItem>
                  <SelectItem value="Fixed Amount">Fixed Amount (AED)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Markup Value *</Label>
              <Input type="number" step="0.01" {...register('markupValue', { required: true })} placeholder={watch('markupType') === 'Percentage (%)' ? '20' : '100'} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Applies To</Label>
            <Select value={watch('appliesTo')} onValueChange={v => setValue('appliesTo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Global (All Hotels)">Global (All Hotels)</SelectItem>
                <SelectItem value="Specific Hotel">Specific Hotel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {appliesTo === 'Specific Hotel' && (
            <div className="space-y-1.5">
              <Label>Select Hotel</Label>
              <Select value={watch('specificHotelId')} onValueChange={v => setValue('specificHotelId', v)}>
                <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
                <SelectContent>{hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.hotelName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register('notes')} rows={2} placeholder="Optional notes..." />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={watch('isActive')} onCheckedChange={v => setValue('isActive', v)} id="isActive" />
            <Label htmlFor="isActive">Active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Rule'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
