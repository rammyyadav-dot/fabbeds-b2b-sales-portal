import { useState, useEffect } from 'react';
import { getEventMaster, saveEventMaster, deleteEventMaster, GetEventMasterOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import EventMasterFormDialog from '@/components/EventMasterFormDialog';
import { format } from 'date-fns';

type Event = GetEventMasterOutputType['events'][0];

export default function EventMasterTab({ hotelId }: { hotelId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getEventMaster({ hotelId });
      setEvents(res.events);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [hotelId]);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      await saveEventMaster(data);
      toast.success(data.id ? 'Event updated' : 'Event created');
      setFormOpen(false); setEditEvent(null);
      load();
    } catch { toast.error('Failed to save event'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteEventMaster({ id: deleteId });
      toast.success('Event deleted');
      setDeleteId(null); load();
    } catch { toast.error('Failed to delete'); }
  };

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy'); } catch { return d; }
  };

  const getApplyLabel = (type?: string) => {
    if (!type) return 'Room';
    if (type.includes('Person')) return 'Person';
    return 'Room';
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Events & Exhibitions Supplements</h3>
          <p className="text-xs text-muted-foreground">Overlay supplements onto existing Daily Rates without overwriting contracted base tariffs.</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 text-xs text-blue-900">
          <strong>Pricing rule:</strong> Existing Daily Rate + matching event supplement = authoritative net. Normal hotel markup is then applied to the combined amount on search, tariff calendar and checkout.
        </div>
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
          <div>
            <h4 className="text-white font-semibold text-base">Event & Exhibition Supplements</h4>
            <p className="text-violet-200 text-xs mt-0.5">Additional charges applied during special events and exhibitions</p>
          </div>
          <Button
            size="sm"
            className="bg-white text-violet-700 hover:bg-violet-50 gap-1.5 font-semibold shadow-sm"
            onClick={() => { setEditEvent(null); setFormOpen(true); }}
          >
            <Plus className="w-4 h-4" /> Add New
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-muted/20">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">No events configured</p>
            <p className="text-xs mt-1">Add events like Arab Health, GITEX, New Year to manage special supplements</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs">Travel from</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs">Travel to</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs">Apply</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs">Rate</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs">Applicable Markets</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs">Weekdays</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs">Applicable Rooms/Rates</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, idx) => (
                  <tr key={ev.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{ev.eventName}</div>
                      {ev.status && ev.status !== 'Active' && (
                        <Badge variant="secondary" className="text-[10px] mt-0.5">{ev.status}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(ev.startDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(ev.endDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs font-medium">{getApplyLabel(ev.supplementType)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {ev.supplementAmount != null ? (
                        <div>
                          <span className="font-semibold text-foreground">{ev.supplementAmount.toLocaleString()} AED</span>
                          <span className="text-muted-foreground text-xs ml-1">(taxes included)</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground font-medium">{ev.scope === 'Entire Property' ? 'All' : (ev.scope || 'All')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground font-medium">
                        {ev.applicableWeekdays?.length ? ev.applicableWeekdays.join(', ') : 'All'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground font-medium">
                        {ev.applicableRoomTypes?.length ? `${ev.applicableRoomTypes.length} room type(s)` : 'All rooms'}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {ev.applicableRatePlans?.length ? `${ev.applicableRatePlans.length} rate plan(s)` : 'All rate plans'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors"
                          onClick={() => { setEditEvent(ev); setFormOpen(true); }}
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => setDeleteId(ev.id)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EventMasterFormDialog
        open={formOpen}
        event={editEvent}
        hotelId={hotelId}
        onClose={() => { setFormOpen(false); setEditEvent(null); }}
        onSave={handleSave}
        loading={saving}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this event and its supplement rules.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
