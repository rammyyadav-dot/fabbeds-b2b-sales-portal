import { GetBookingsOutputType } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { Eye, CheckCircle, XCircle, Edit2, MessageSquare, Calendar, Users, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

type Booking = GetBookingsOutputType['bookings'][0];

interface Props {
  booking: Booking;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, booking: Booking) => void;
  onConfirm?: (b: Booking) => void;
  onCancel?: (b: Booking) => void;
  onEdit?: (b: Booking) => void;
}

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM'); } catch { return d; }
}

export default function BookingKanbanCard({ booking, onClick, onDragStart, onConfirm, onCancel, onEdit }: Props) {
  const nights = () => {
    if (!booking.checkinDate || !booking.checkoutDate) return 0;
    return Math.round((new Date(booking.checkoutDate).getTime() - new Date(booking.checkinDate).getTime()) / 86400000);
  };

  const missingSupplier = !booking.companyName;
  const hasRate = booking.sellTotal != null;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, booking)}
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group select-none"
    >
      {/* Header: Guest Name + Booking # */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="font-bold text-sm text-foreground leading-tight">{booking.guestName || '—'}</span>
        {booking.bookingRef && <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{booking.bookingRef}</span>}
      </div>

      {/* Hotel + Room */}
      <p className="text-xs text-primary font-semibold mb-0.5 truncate">{booking.hotelName || '—'}</p>
      {booking.roomTypeName && <p className="text-[11px] text-muted-foreground mb-2 truncate">{booking.roomTypeName}{booking.mealPlan ? ` · ${booking.mealPlan}` : ''}</p>}

      {/* Stay info */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
        <Calendar className="w-3 h-3 shrink-0" />
        <span>{fmtDate(booking.checkinDate)} → {nights()}n</span>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
        <Users className="w-3 h-3 shrink-0" />
        <span>{booking.adults ?? 0}A{booking.children ? ` ${booking.children}C` : ''} · {booking.rooms ?? 1}rm</span>
      </div>

      {/* Rate */}
      {hasRate && (
        <div className="text-sm font-bold text-foreground mb-2">
          AED {Math.round(booking.sellTotal!).toLocaleString()}
        </div>
      )}

      {/* Footer: Agent + Supplier tags */}
      <div className="flex items-center gap-1 flex-wrap mb-2">
        {booking.companyName
          ? <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{booking.companyName}</Badge>
          : <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-600 rounded px-1.5 py-0.5"><AlertTriangle className="w-2.5 h-2.5" />No Supplier</span>
        }
        {!hasRate && <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-100 text-red-600 rounded px-1.5 py-0.5"><AlertTriangle className="w-2.5 h-2.5" />No Rate</span>}
      </div>

      {/* Quick action icons (show on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity border-t border-border/40 pt-2 mt-1" onClick={e => e.stopPropagation()}>
        <button title="View" onClick={onClick} className="w-6 h-6 rounded flex items-center justify-center text-primary hover:bg-primary/10"><Eye className="w-3 h-3" /></button>
        {booking.status !== 'Confirmed' && booking.status !== 'Cancelled' && onConfirm && (
          <button title="Confirm" onClick={() => onConfirm(booking)} className="w-6 h-6 rounded flex items-center justify-center text-green-600 hover:bg-green-50"><CheckCircle className="w-3 h-3" /></button>
        )}
        {booking.status !== 'Cancelled' && onCancel && (
          <button title="Cancel" onClick={() => onCancel(booking)} className="w-6 h-6 rounded flex items-center justify-center text-destructive hover:bg-red-50"><XCircle className="w-3 h-3" /></button>
        )}
        {onEdit && (
          <>
            <button title="Edit" onClick={() => onEdit(booking)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted"><Edit2 className="w-3 h-3" /></button>
            <button title="Note" onClick={() => onEdit(booking)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted"><MessageSquare className="w-3 h-3" /></button>
          </>
        )}
      </div>
    </div>
  );
}
