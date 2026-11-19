import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Loader2 } from 'lucide-react';
import DatePickerInput from '@/components/DatePickerInput';
import { GetGroupLeadsOutputType } from 'zitejs/api';

type Lead = GetGroupLeadsOutputType['leads'][0];

const STATUSES = ['New Group Lead','Qualified','Need Info','Sent to Suppliers','Proposal Ready','Option Selected','Pending Confirmation','Confirmed','Invoiced','Cancelled'];

interface Props {
  open: boolean;
  lead?: Lead | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  saving?: boolean;
}

export default function GroupLeadFormDialog({ open, lead, onClose, onSave, saving }: Props) {
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    setForm(lead ? { ...lead } : { status: 'New Group Lead' });
  }, [lead, open]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const n = (v: string) => v ? parseFloat(v) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...form, id: lead?.id });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? `Edit ${lead.leadId}` : 'New Group / MICE Lead'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Company Name *</Label>
              <Input required value={form.companyName ?? ''} onChange={e => set('companyName', e.target.value)} placeholder="e.g. Acme Corp" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Contact Name *</Label>
              <Input required value={form.contactName ?? ''} onChange={e => set('contactName', e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input type="email" value={form.contactEmail ?? ''} onChange={e => set('contactEmail', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Phone</Label>
              <Input value={form.contactPhone ?? ''} onChange={e => set('contactPhone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="Destination city" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? 'New Group Lead'} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check-in Date</Label>
              <DatePickerInput value={form.checkinDate ?? ''} onChange={v => set('checkinDate', v)} placeholder="Select check-in date" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check-out Date</Label>
              <DatePickerInput value={form.checkoutDate ?? ''} onChange={v => set('checkoutDate', v)} placeholder="Select check-out date" />
            </div>
            <div className="space-y-1.5">
              <Label>Rooms Required</Label>
              <Input type="number" min={1} value={form.roomsRequired ?? ''} onChange={e => set('roomsRequired', n(e.target.value))} placeholder="e.g. 25" />
            </div>
            <div className="space-y-1.5">
              <Label>Delegates</Label>
              <Input type="number" min={1} value={form.delegates ?? ''} onChange={e => set('delegates', n(e.target.value))} placeholder="e.g. 50" />
            </div>
            <div className="space-y-1.5">
              <Label>Budget (AED)</Label>
              <Input type="number" min={0} value={form.budget ?? ''} onChange={e => set('budget', n(e.target.value))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned Agent</Label>
              <Input value={form.assignedAgent ?? ''} onChange={e => set('assignedAgent', e.target.value)} placeholder="Agent name" />
            </div>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={!!form.meetingSpaceRequired} onCheckedChange={v => set('meetingSpaceRequired', v)} />
              <Label>Meeting Space Required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.flexDates} onCheckedChange={v => set('flexDates', v)} />
              <Label>Flex Dates</Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="Additional requirements, agenda, special requests..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
