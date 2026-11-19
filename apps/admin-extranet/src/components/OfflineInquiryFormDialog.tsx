import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Separator } from '@project/components/ui/separator';
import { Loader2 } from 'lucide-react';
import DatePickerInput from '@/components/DatePickerInput';
import { GetSpecialInquiriesOutputType } from 'zitejs/api';

type Inquiry = GetSpecialInquiriesOutputType['inquiries'][0];

interface Props {
  open: boolean;
  inquiry?: Inquiry | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  saving?: boolean;
}

const STATUSES = ['Pending Review','In Review','Awaiting Hotel','Quoted','Approved','Rejected','Confirmed','Cancelled','Closed'];
const BOARD_BASIS = ['Room Only','Bed & Breakfast','Half Board','Full Board','All Inclusive'];
const STAR_PREFS = ['3 Star','4 Star','5 Star','Any'];
const MEAL_PLANS = ['Room Only','Bed & Breakfast','Half Board','Full Board','All Inclusive'];

export default function OfflineInquiryFormDialog({ open, inquiry, onClose, onSave, saving }: Props) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    setForm(inquiry ? { ...inquiry } : { inquiryType: 'Offline Request', status: 'Pending Review' });
  }, [inquiry, open]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const n = (v: string) => v ? parseFloat(v) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...form, id: inquiry?.id });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inquiry ? `Edit ${inquiry.inquiryRef ?? 'Inquiry'}` : 'New Offline Inquiry'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Inquiry Type</Label>
              <Select value={form.inquiryType ?? 'Offline Request'} onValueChange={v => set('inquiryType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Offline Request">Offline Request</SelectItem>
                  <SelectItem value="Price Match">Price Match</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? 'Pending Review'} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stay Details</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hotel Name</Label>
              <Input value={form.hotelName ?? ''} onChange={e => set('hotelName', e.target.value)} placeholder="Hotel name" />
            </div>
            <div className="space-y-1.5">
              <Label>Destination</Label>
              <Input value={form.destination ?? ''} onChange={e => set('destination', e.target.value)} placeholder="City / Country" />
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
              <Label>Rooms</Label>
              <Input type="number" min={1} value={form.rooms ?? ''} onChange={e => set('rooms', n(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Adults</Label>
              <Input type="number" min={1} value={form.adults ?? ''} onChange={e => set('adults', n(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Children</Label>
              <Input type="number" min={0} value={form.children ?? ''} onChange={e => set('children', n(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Star Preference</Label>
              <Select value={form.starPreference ?? ''} onValueChange={v => set('starPreference', v)}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{STAR_PREFS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Room Type</Label>
              <Input value={form.roomType ?? ''} onChange={e => set('roomType', e.target.value)} placeholder="e.g. Deluxe, Suite" />
            </div>
            <div className="space-y-1.5">
              <Label>Board Basis</Label>
              <Select value={form.boardBasis ?? ''} onValueChange={v => set('boardBasis', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{BOARD_BASIS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Meal Plan</Label>
              <Select value={form.mealPlan ?? ''} onValueChange={v => set('mealPlan', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{MEAL_PLANS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Budget Range</Label>
              <Input value={form.budgetRange ?? ''} onChange={e => set('budgetRange', e.target.value)} placeholder="e.g. AED 500–800/night" />
            </div>
          </div>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Our Rate (AED)</Label>
              <Input type="number" min={0} step="0.01" value={form.ourRateAed ?? ''} onChange={e => set('ourRateAed', n(e.target.value))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Competitor Price (AED)</Label>
              <Input type="number" min={0} step="0.01" value={form.competitorPriceAed ?? ''} onChange={e => set('competitorPriceAed', n(e.target.value))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Competitor Source URL</Label>
              <Input value={form.competitorSourceUrl ?? ''} onChange={e => set('competitorSourceUrl', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agent Info</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Agent Name</Label>
              <Input value={form.agentName ?? ''} onChange={e => set('agentName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Agent Company</Label>
              <Input value={form.agentCompany ?? ''} onChange={e => set('agentCompany', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Agent Email</Label>
              <Input type="email" value={form.agentEmail ?? ''} onChange={e => set('agentEmail', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Agent WhatsApp</Label>
              <Input value={form.agentWhatsApp ?? ''} onChange={e => set('agentWhatsApp', e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Switch checked={!!form.urgentWithin72H} onCheckedChange={v => set('urgentWithin72H', v)} />
            <Label className="font-normal cursor-pointer">Urgent (within 72h)</Label>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="Client requirements, special requests..." />
          </div>
          <div className="space-y-1.5">
            <Label>Admin Notes</Label>
            <Textarea rows={2} value={form.adminNotes ?? ''} onChange={e => set('adminNotes', e.target.value)} placeholder="Internal notes..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Inquiry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
