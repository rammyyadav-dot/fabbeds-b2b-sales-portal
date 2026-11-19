import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Textarea } from '@project/components/ui/textarea';
import { GetReservationsOutputType } from 'zitejs/api';

type Reservation = GetReservationsOutputType['reservations'][0];

interface Props {
  open: boolean;
  reservation?: Reservation | null;
  prefill?: Partial<Reservation>;
  onClose: () => void;
  onSave: (data: any) => void;
  saving?: boolean;
}

export default function ReservationFormDialog({ open, reservation, prefill, onClose, onSave, saving }: Props) {
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (reservation) {
      setForm({ ...reservation });
    } else if (prefill) {
      setForm({ ...prefill, status: 'Inquiry Received' });
    } else {
      setForm({ status: 'Inquiry Received' });
    }
  }, [reservation, prefill, open]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const profit = (form.sellingRateAed ?? 0) - (form.netRateAed ?? 0);
  const margin = form.sellingRateAed > 0 ? ((profit / form.sellingRateAed) * 100).toFixed(1) : '—';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reservation ? 'Edit Reservation' : 'New Reservation'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Hotel Name *</Label>
              <Input value={form.hotelName ?? ''} onChange={e => set('hotelName', e.target.value)} placeholder="Hotel name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Destination</Label>
              <Input value={form.destination ?? ''} onChange={e => set('destination', e.target.value)} placeholder="City / Country" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Check-in Date</Label>
            <Input type="date" value={form.checkinDate ?? ''} onChange={e => set('checkinDate', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Check-out Date</Label>
            <Input type="date" value={form.checkoutDate ?? ''} onChange={e => set('checkoutDate', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rooms</Label>
            <Input type="number" value={form.rooms ?? ''} onChange={e => set('rooms', +e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Adults</Label>
            <Input type="number" value={form.adults ?? ''} onChange={e => set('adults', +e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Room Type</Label>
            <Input value={form.roomType ?? ''} onChange={e => set('roomType', e.target.value)} placeholder="e.g. Deluxe DBL" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Board Basis</Label>
            <Input value={form.boardBasis ?? ''} onChange={e => set('boardBasis', e.target.value)} placeholder="e.g. BB, HB, AI" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Agent Name</Label>
            <Input value={form.agentName ?? ''} onChange={e => set('agentName', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Agent Company</Label>
            <Input value={form.agentCompany ?? ''} onChange={e => set('agentCompany', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Agent Email</Label>
            <Input type="email" value={form.agentEmail ?? ''} onChange={e => set('agentEmail', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Agent WhatsApp</Label>
            <Input value={form.agentWhatsApp ?? ''} onChange={e => set('agentWhatsApp', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Net Rate AED (Cost)</Label>
            <Input type="number" value={form.netRateAed ?? ''} onChange={e => set('netRateAed', +e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Selling Rate AED (Client)</Label>
            <Input type="number" value={form.sellingRateAed ?? ''} onChange={e => set('sellingRateAed', +e.target.value)} />
          </div>
          {(form.sellingRateAed || form.netRateAed) ? (
            <div className="col-span-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 flex gap-6 text-sm">
              <span>Profit: <strong className="text-emerald-700">AED {profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
              <span>Margin: <strong className="text-emerald-700">{margin}%</strong></span>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs">Inquiry Ref</Label>
            <Input value={form.inquiryRef ?? ''} onChange={e => set('inquiryRef', e.target.value)} placeholder="Link to inquiry ref" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={form.status ?? 'New'} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Inquiry Received','Rate Validated','Awaiting Supplier Confirmation','Supplier Confirmed','Confirmed','Invoiced','Paid','Completed','Rate Dispute','Cancelled by Agent','Cancelled by Supplier','No Show'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Special Requests</Label>
            <Textarea rows={2} value={form.specialRequests ?? ''} onChange={e => set('specialRequests', e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Internal Notes</Label>
            <Textarea rows={2} value={form.internalNotes ?? ''} onChange={e => set('internalNotes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.hotelName}>
            {saving ? 'Saving...' : reservation ? 'Update' : 'Create Reservation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
