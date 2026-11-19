import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (value: number) => void;
  dateCount: number;
}

export default function BulkAllocationDialog({ open, onClose, onApply, dateCount }: Props) {
  const [value, setValue] = useState('20');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Bulk Update Allocation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Set the same allocation for all <span className="font-semibold text-foreground">{dateCount}</span> dates in the current view.
          </p>
          <div className="space-y-1.5">
            <Label>Rooms on Allotment</Label>
            <Input type="number" min={0} value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 20" autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onApply(Number(value) || 0)}>Apply to All Dates</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
