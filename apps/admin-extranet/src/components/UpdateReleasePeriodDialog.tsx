import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (days: number) => void;
  dateCount: number;
}

export default function UpdateReleasePeriodDialog({ open, onClose, onApply, dateCount }: Props) {
  const [days, setDays] = useState('0');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Release Period</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Set release period for all <span className="font-semibold text-foreground">{dateCount}</span> dates in the current view.
          </p>
          <div className="space-y-1.5">
            <Label>Release Days Before Arrival</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>{i} day{i !== 1 ? 's' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onApply(Number(days))}>Apply to All Dates</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
