import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Plus, CheckCircle2, Star } from 'lucide-react';
import { GetSupplierResponsesOutputType } from 'zitejs/api';

type Response = GetSupplierResponsesOutputType['responses'][0];

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-gray-100 text-gray-700',
  Received: 'bg-green-100 text-green-700',
  Declined: 'bg-red-100 text-red-700',
  Selected: 'bg-purple-100 text-purple-700',
};

interface Props {
  responses: Response[];
  leadId: string;
  onSave: (data: any) => Promise<void>;
  saving?: boolean;
}

export default function SupplierResponseGrid({ responses, leadId, onSave, saving }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Response | null>(null);
  const [form, setForm] = useState<any>({});

  const openForm = (r?: Response) => {
    setEditing(r ?? null);
    setForm(r ? { ...r } : { responseStatus: 'Pending' });
    setOpen(true);
  };
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const n = (v: string) => v ? parseFloat(v) : undefined;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...form, id: editing?.id, leadId });
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold text-foreground">Supplier Responses ({responses.length})</p>
        <Button size="sm" onClick={() => openForm()} className="gap-1.5"><Plus className="w-3.5 h-3.5" />Add Hotel</Button>
      </div>
      {responses.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
          No supplier responses yet. Add hotels to track RFQ responses.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                {['Hotel','Net Rate','Allocation','Cut-off','Mtg Pkg','Commission','Status',''].map(h => (
                  <th key={h} className="py-2.5 px-3 text-left font-semibold text-xs text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {responses.map(r => (
                <tr key={r.id} className={`border-b border-border last:border-0 hover:bg-muted/10 ${r.clientSelected ? 'bg-purple-50/50' : ''}`}>
                  <td className="py-2.5 px-3 font-medium flex items-center gap-1.5">
                    {r.clientSelected && <Star className="w-3.5 h-3.5 text-purple-500 fill-purple-500" />}
                    {r.hotelName}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs">{r.offeredNetRate != null ? `AED ${r.offeredNetRate.toFixed(2)}` : '—'}</td>
                  <td className="py-2.5 px-3">{r.allocation ?? '—'}</td>
                  <td className="py-2.5 px-3 text-xs">{r.cutoffDate ?? '—'}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">{r.meetingPackageRate != null ? `AED ${r.meetingPackageRate.toFixed(2)}` : '—'}</td>
                  <td className="py-2.5 px-3">{r.commission != null ? `${r.commission}%` : '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.responseStatus ?? 'Pending']}`}>
                      {r.responseStatus ?? 'Pending'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openForm(r)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier Response' : 'Add Supplier Response'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5"><Label>Hotel Name *</Label><Input required value={form.hotelName ?? ''} onChange={e => set('hotelName', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Offered Net Rate (AED)</Label><Input type="number" step="0.01" value={form.offeredNetRate ?? ''} onChange={e => set('offeredNetRate', n(e.target.value))} placeholder="0.00" /></div>
              <div className="space-y-1.5"><Label>Allocation (Rooms)</Label><Input type="number" value={form.allocation ?? ''} onChange={e => set('allocation', n(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Cut-off Date</Label><Input type="date" value={form.cutoffDate ?? ''} onChange={e => set('cutoffDate', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Meeting Pkg Rate (AED)</Label><Input type="number" step="0.01" value={form.meetingPackageRate ?? ''} onChange={e => set('meetingPackageRate', n(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Commission (%)</Label><Input type="number" step="0.1" value={form.commission ?? ''} onChange={e => set('commission', n(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={form.responseStatus ?? 'Pending'} onValueChange={v => set('responseStatus', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Pending','Received','Declined','Selected'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Attrition Terms</Label><Textarea rows={2} value={form.attritionTerms ?? ''} onChange={e => set('attritionTerms', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Cancellation Terms</Label><Textarea rows={2} value={form.cancellationTerms ?? ''} onChange={e => set('cancellationTerms', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="clientSelected" checked={!!form.clientSelected} onChange={e => set('clientSelected', e.target.checked)} className="rounded" />
              <Label htmlFor="clientSelected" className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />Client Selected This Option</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
