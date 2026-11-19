import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { format, addDays } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
  currentAllocation: number;
  currentReleaseDays: number;
  onApply: (targetStart: string, targetEnd: string, allocation: number, releaseDays: number) => void;
}

export default function CopyToDateRangeDialog({ open, onClose, currentAllocation, currentReleaseDays, onApply }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [targetStart, setTargetStart] = useState(today);
  const [targetEnd, setTargetEnd] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [allocation, setAllocation] = useState(String(currentAllocation));
  const [releaseDays, setReleaseDays] = useState(String(currentReleaseDays));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Copy to Date Range</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Apply allocation settings to a new date range.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target Start</Label>
              <Input type="date" value={targetStart} onChange={e => setTargetStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Target End</Label>
              <Input type="date" value={targetEnd} onChange={e => setTargetEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Allocation (rooms)</Label>
              <Input type="number" min={0} value={allocation} onChange={e => setAllocation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Release Days</Label>
              <Input type="number" min={0} max={30} value={releaseDays} onChange={e => setReleaseDays(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
            💡 Changes will be staged. Click <strong>Save All Changes</strong> to persist.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onApply(targetStart, targetEnd, Number(allocation) || 0, Number(releaseDays) || 0)}>
            Copy & Stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
