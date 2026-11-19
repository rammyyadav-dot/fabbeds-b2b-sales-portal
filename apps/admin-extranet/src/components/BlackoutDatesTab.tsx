import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Card, CardContent } from '@project/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Badge } from '@project/components/ui/badge';
import { Plus, Trash2, CalendarX, Edit2 } from 'lucide-react';
import { GetBlackoutDatesOutputType, GetRoomTypesOutputType } from 'zitejs/api';
import { format } from 'date-fns';
import DatePickerInput from '@/components/DatePickerInput';

type BlackoutDate = GetBlackoutDatesOutputType['blackoutDates'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];

interface Props {
  hotelId: string;
  blackoutDates: BlackoutDate[];
  roomTypes: RoomType[];
  onSave: (data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving?: boolean;
}

export default function BlackoutDatesTab({ hotelId, blackoutDates, roomTypes, onSave, onDelete, saving }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<BlackoutDate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => { setEditItem(null); setFormOpen(true); };
  const openEdit = (item: BlackoutDate) => { setEditItem(item); setFormOpen(true); };

  const handleSave = async (data: any) => {
    const roomTypeId = data.roomTypeId === 'all' ? undefined : data.roomTypeId;
    await onSave({ ...data, roomTypeId, hotelId, id: editItem?.id });
    setFormOpen(false);
    setEditItem(null);
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy'); } catch { return d; }
  };

  const getRoomTypeName = (id?: string) => {
    if (!id) return 'All Room Types';
    return roomTypes.find(r => r.id === id)?.roomTypeName || 'Unknown';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage blackout and close-out dates for this hotel</p>
        <Button size="sm" onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" /> Add Blackout Period
        </Button>
      </div>

      {blackoutDates.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
          <CalendarX className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">No blackout dates</p>
          <p className="text-sm">Add blackout periods to block room availability</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {blackoutDates.map(item => (
            <Card key={item.id} className="border-destructive/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{item.blackoutName || 'Blackout Period'}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarX className="w-3 h-3" />
                      <span>{formatDate(item.startDate)} — {formatDate(item.endDate)}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{getRoomTypeName(item.roomTypeId)}</Badge>
                    {item.reason && <p className="text-xs text-muted-foreground">{item.reason}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BlackoutFormDialog
        open={formOpen}
        item={editItem}
        roomTypes={roomTypes}
        onClose={() => { setFormOpen(false); setEditItem(null); }}
        onSave={handleSave}
        loading={saving}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blackout Period?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this blackout period.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await onDelete(deleteId!); setDeleteId(null); }}
              className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BlackoutFormDialog({ open, item, roomTypes, onClose, onSave, loading }: {
  open: boolean; item: BlackoutDate | null; roomTypes: RoomType[];
  onClose: () => void; onSave: (d: any) => Promise<void>; loading?: boolean;
}) {
  const { register, handleSubmit, setValue, watch, reset } = useForm<any>();

  useEffect(() => {
    if (open) {
      if (item) {
        reset({ blackoutName: item.blackoutName || '', startDate: item.startDate || '', endDate: item.endDate || '', reason: item.reason || '', roomTypeId: item.roomTypeId || 'all' });
      } else {
        reset({ blackoutName: '', startDate: '', endDate: '', reason: '', roomTypeId: 'all' });
      }
    }
  }, [open, item]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Blackout Period' : 'Add Blackout Period'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name / Label *</Label>
            <Input {...register('blackoutName', { required: true })} placeholder="e.g. Eid Al Adha 2025" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date *</Label>
              <DatePickerInput value={watch('startDate') || ''} onChange={v => setValue('startDate', v)} placeholder="Start date" />
            </div>
            <div className="space-y-1.5">
              <Label>End Date *</Label>
              <DatePickerInput value={watch('endDate') || ''} onChange={v => setValue('endDate', v)} placeholder="End date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Applies To</Label>
            <Select value={watch('roomTypeId') || 'all'} onValueChange={v => setValue('roomTypeId', v)}>
              <SelectTrigger><SelectValue placeholder="All Room Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Room Types</SelectItem>
                {roomTypes.map(r => <SelectItem key={r.id} value={r.id}>{r.roomTypeName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input {...register('reason')} placeholder="e.g. Public holiday, Renovation..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
