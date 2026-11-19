import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Layers, Clock, Copy, Save } from 'lucide-react';
import BulkAllocationDialog from './BulkAllocationDialog';
import UpdateReleasePeriodDialog from './UpdateReleasePeriodDialog';
import CopyToDateRangeDialog from './CopyToDateRangeDialog';

interface Props {
  dateCount: number;
  currentAllocation: number;
  currentReleaseDays: number;
  onBulkAllocation: (value: number) => void;
  onUpdateRelease: (days: number) => void;
  onCopyToRange: (targetStart: string, targetEnd: string, allocation: number, releaseDays: number) => void;
  onSaveAll: () => void;
  saving: boolean;
}

export default function QuickActionsBar({
  dateCount, currentAllocation, currentReleaseDays,
  onBulkAllocation, onUpdateRelease, onCopyToRange, onSaveAll, saving
}: Props) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Quick Actions</p>
      <div className="flex gap-2 flex-wrap items-center">
        <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="flex items-center gap-1.5 text-xs h-8">
          <Layers className="w-3.5 h-3.5" /> Bulk Update Allocation
        </Button>
        <Button variant="outline" size="sm" onClick={() => setReleaseOpen(true)} className="flex items-center gap-1.5 text-xs h-8">
          <Clock className="w-3.5 h-3.5" /> Update Release Period
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)} className="flex items-center gap-1.5 text-xs h-8">
          <Copy className="w-3.5 h-3.5" /> Copy to Date Range
        </Button>
        <Button size="sm" onClick={onSaveAll} disabled={saving}
          className="ml-auto flex items-center gap-1.5 text-xs h-8 bg-green-500 hover:bg-green-600 text-white border-0">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      <BulkAllocationDialog open={bulkOpen} onClose={() => setBulkOpen(false)} dateCount={dateCount}
        onApply={v => { onBulkAllocation(v); setBulkOpen(false); }} />
      <UpdateReleasePeriodDialog open={releaseOpen} onClose={() => setReleaseOpen(false)} dateCount={dateCount}
        onApply={d => { onUpdateRelease(d); setReleaseOpen(false); }} />
      <CopyToDateRangeDialog open={copyOpen} onClose={() => setCopyOpen(false)}
        currentAllocation={currentAllocation} currentReleaseDays={currentReleaseDays}
        onApply={(s, e, a, r) => { onCopyToRange(s, e, a, r); setCopyOpen(false); }} />
    </div>
  );
}
