import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { CalendarRange, Plus, Trash2, Pencil } from 'lucide-react';
import { GetMarkupRulesOutputType, GetHotelsOutputType } from 'zitejs/api';
import DateRangePicker from '@/components/DateRangePicker';

type Rule = GetMarkupRulesOutputType['rules'][0];
type Hotel = GetHotelsOutputType['hotels'][0];

interface Props {
  rules: Rule[];
  hotels: Hotel[];
  onSave: (data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving?: boolean;
}

const DEFAULT_FORM = { ruleName: '', markupType: 'Percentage (%)', markupValue: '', maxMarkupValue: '', startDate: '', endDate: '', appliesTo: 'Global (All Hotels)', specificHotelId: '' };

export default function EventMarkupSection({ rules, hotels, onSave, onDelete, saving }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleEdit = (rule: Rule) => {
    const hId = Array.isArray(rule.specificHotel) ? rule.specificHotel[0] : rule.specificHotel;
    setForm({
      ruleName: rule.ruleName ?? '',
      markupType: rule.markupType ?? 'Percentage (%)',
      markupValue: String(rule.markupValue ?? ''),
      maxMarkupValue: rule.maxMarkupValue != null ? String(rule.maxMarkupValue) : '',
      startDate: rule.startDate ?? '',
      endDate: rule.endDate ?? '',
      appliesTo: rule.appliesTo ?? 'Global (All Hotels)',
      specificHotelId: hId ?? '',
    });
    setEditingId(rule.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      ...(editingId ? { id: editingId } : {}),
      ...form,
      ruleCategory: 'event_override',
      markupValue: Number(form.markupValue),
      maxMarkupValue: form.maxMarkupValue ? Number(form.maxMarkupValue) : undefined,
      isActive: true,
    });
    setForm(DEFAULT_FORM);
    setShowForm(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setForm(DEFAULT_FORM);
    setEditingId(null);
  };

  const getHotelLabel = (rule: Rule) => {
    if (rule.appliesTo === 'Global (All Hotels)') return 'All Hotels';
    const hId = Array.isArray(rule.specificHotel) ? rule.specificHotel[0] : rule.specificHotel;
    const h = hotels.find(h => h.id === hId);
    return h ? `${hotels.filter(x => [rule.specificHotel].flat().includes(x.id)).length} Hotel${hotels.filter(x => [rule.specificHotel].flat().includes(x.id)).length > 1 ? 's' : ''} Selected` : '—';
  };

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <CalendarRange className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="font-bold text-sm uppercase tracking-wide text-foreground">Section 3: Event Markup Override</h2>
            <p className="text-xs text-orange-600">Event-specific markup rules with date ranges and hotel targeting</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => { if (showForm && !editingId) { handleCancel(); } else { setForm(DEFAULT_FORM); setEditingId(null); setShowForm(true); } }}>
          <Plus className="w-4 h-4" /> Add Event Markup
        </Button>
      </div>

      {/* Inline Create/Edit Form */}
      {showForm && (
        <div className="border border-border rounded-xl p-5 bg-card space-y-4">
          <p className="font-semibold text-sm">{editingId ? 'Edit Event Markup Rule' : 'Create New Event Markup Rule'}</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Event Name</Label>
                <Input required value={form.ruleName} onChange={e => set('ruleName', e.target.value)} placeholder="e.g., Dubai Expo 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Markup Method</Label>
                <Select value={form.markupType} onValueChange={v => set('markupType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Percentage (%)">% Percentage</SelectItem>
                    <SelectItem value="Fixed Amount">Flat Amount (AED)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Base Markup {form.markupType === 'Percentage (%)' ? '%' : 'AED'}</Label>
                <Input required type="number" step="0.01" min="0" value={form.markupValue} onChange={e => set('markupValue', e.target.value)} placeholder="e.g., 12" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Markup {form.markupType === 'Percentage (%)' ? '%' : 'AED'} <span className="text-muted-foreground">(optional cap)</span></Label>
                <Input type="number" step="0.01" min="0" value={form.maxMarkupValue} onChange={e => set('maxMarkupValue', e.target.value)} placeholder="e.g., 15" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Date Range</Label>
                <DateRangePicker
                  checkin={form.startDate}
                  checkout={form.endDate}
                  onCheckinChange={v => set('startDate', v)}
                  onCheckoutChange={v => set('endDate', v)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hotels</Label>
                <Select value={form.appliesTo} onValueChange={v => set('appliesTo', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Global (All Hotels)">All Hotels</SelectItem>
                    <SelectItem value="Specific Hotel">Specific Hotel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.appliesTo === 'Specific Hotel' && (
                <div className="space-y-1.5">
                  <Label>Select Hotel</Label>
                  <Select value={form.specificHotelId} onValueChange={v => set('specificHotelId', v)}>
                    <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
                    <SelectContent>{hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.hotelName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">{saving ? 'Saving...' : editingId ? 'Update Rule' : 'Create Rule'}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Rules Table */}
      {rules.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                {['Event Name', 'Base Markup', 'Date Range', 'Hotels', 'Status', 'Actions'].map(h => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <CalendarRange className="w-4 h-4 text-orange-500 shrink-0" />
                      <span className="font-semibold text-foreground">{rule.ruleName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-orange-500 text-base">
                      {rule.markupType === 'Percentage (%)' ? `${rule.markupValue}%` : `AED ${rule.markupValue}`}
                    </p>
                    {rule.maxMarkupValue != null && (
                      <p className="text-xs text-muted-foreground">Max: {rule.markupType === 'Percentage (%)' ? `${rule.maxMarkupValue}%` : `AED ${rule.maxMarkupValue}`}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {rule.startDate && rule.endDate ? (
                      <div className="flex flex-col gap-0.5">
                        <p>{new Date(rule.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        <p className="text-center text-muted-foreground/60">–</p>
                        <p>{new Date(rule.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                    ) : <span className="italic">No dates set</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold ${rule.appliesTo === 'Global (All Hotels)' ? 'text-green-600' : 'text-blue-600'}`}>
                      {getHotelLabel(rule)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${rule.isActive ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-orange-300 text-orange-600 hover:bg-orange-50"
                        onClick={() => handleEdit(rule)}>
                        <Pencil className="w-3 h-3" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                        onClick={() => onSave({ id: rule.id, ruleName: rule.ruleName!, markupType: rule.markupType!, markupValue: rule.markupValue!, appliesTo: rule.appliesTo!, isActive: !rule.isActive, ruleCategory: 'event_override', startDate: rule.startDate, endDate: rule.endDate, maxMarkupValue: rule.maxMarkupValue })}>
                        {rule.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteId(rule.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rules.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground italic px-1">No event markup overrides configured.</p>
      )}

      {/* Info note */}
      <p className="text-xs text-orange-600 flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
        <CalendarRange className="w-3.5 h-3.5 shrink-0" />
        Event markups override agent tier markups during the specified date range. They can be applied to all hotels or specific properties.
      </p>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Event Markup?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this event markup override.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { if (deleteId) { await onDelete(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
