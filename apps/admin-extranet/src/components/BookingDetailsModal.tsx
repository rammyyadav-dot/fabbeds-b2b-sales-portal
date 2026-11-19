import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { CheckCircle, XCircle, Edit2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { GetBookingsOutputType } from 'zitejs/api';

type Booking = GetBookingsOutputType['bookings'][0];

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  'Awaiting Hotel': 'bg-blue-100 text-blue-700',
  'Awaiting Payment': 'bg-purple-100 text-purple-700',
  Confirmed: 'bg-green-100 text-green-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-500',
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate">{value ?? '—'}</span>
    </div>
  );
}

interface Props {
  booking: Booking | null;
  onClose: () => void;
  onConfirm: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  onEdit: (b: Booking) => void;
}

export default function BookingDetailsModal({ booking, onClose, onConfirm, onCancel, onEdit }: Props) {
  if (!booking) return null;

  const nights = booking.checkinDate && booking.checkoutDate
    ? Math.round((new Date(booking.checkoutDate).getTime() - new Date(booking.checkinDate).getTime()) / 86400000)
    : 0;

  const fmt = (d?: string) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd MMM yyyy'); } catch { return d; }
  };

  return (
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Booking Details</DialogTitle>
        </DialogHeader>

        {/* Header grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b">
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Booking Number</p><p className="font-mono font-bold text-sm">{booking.bookingRef || '—'}</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Status</p><Badge className={`text-xs ${STATUS_COLORS[booking.status ?? ''] ?? ''}`}>{booking.status}</Badge></div>
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Booking Date</p><p className="text-sm font-medium">{fmt(booking.createdAt)}</p></div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Supplier Ref</p>
            {booking.companyName
              ? <p className="text-sm font-medium">{booking.companyName}</p>
              : <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 rounded px-1.5 py-0.5"><AlertTriangle className="w-3 h-3" />Missing</span>
            }
          </div>
        </div>

        {/* Stay */}
        <div className="grid grid-cols-3 gap-4 pb-4 border-b">
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Check-in</p><p className="font-bold">{fmt(booking.checkinDate)}</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Check-out</p><p className="font-bold">{fmt(booking.checkoutDate)}</p></div>
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Nights</p><p className="font-bold">{nights}</p></div>
        </div>

        {/* Hotel section */}
        <div className="bg-muted/40 rounded-lg p-4">
          <p className="font-bold text-base mb-3 pb-2 border-b border-border/40">{booking.hotelName || '—'}</p>
          <InfoRow label="Room Type" value={booking.roomTypeName} />
          <InfoRow label="Board Basis" value={booking.mealPlan} />
          <InfoRow label="Guests" value={`${booking.adults ?? 0} Adults${booking.children ? `, ${booking.children} Children` : ''}`} />
          <InfoRow label="Rooms" value={booking.rooms} />
          <InfoRow label="Guest Name" value={booking.guestName} />
          <InfoRow label="Contact Email" value={booking.contactEmail} />
          <InfoRow label="WhatsApp" value={booking.whatsAppNumber} />
        </div>

        {/* Rates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Net Total</p>
            <p className="text-xl font-bold">AED {booking.netTotal != null ? Math.round(booking.netTotal).toLocaleString() : '—'}</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Sell Total</p>
            <p className="text-xl font-bold text-primary">AED {booking.sellTotal != null ? Math.round(booking.sellTotal).toLocaleString() : '—'}</p>
          </div>
        </div>

        {booking.specialRequests && (
          <div><p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Special Requests</p>
            <p className="text-sm bg-muted/40 rounded p-2 italic">{booking.specialRequests}</p></div>
        )}
        {booking.adminNotes && (
          <div><p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Internal Notes</p>
            <p className="text-sm bg-yellow-50 border border-yellow-200 rounded p-2">{booking.adminNotes}</p></div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t flex-wrap">
          {booking.status !== 'Confirmed' && booking.status !== 'Cancelled' && (
            <Button size="sm" className="gap-1.5" onClick={() => onConfirm(booking)}><CheckCircle className="w-3.5 h-3.5" /> Confirm</Button>
          )}
          {booking.status !== 'Cancelled' && (
            <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30" onClick={() => onCancel(booking)}><XCircle className="w-3.5 h-3.5" /> Cancel</Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEdit(booking)}><Edit2 className="w-3.5 h-3.5" /> Edit / Notes</Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="ml-auto">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
