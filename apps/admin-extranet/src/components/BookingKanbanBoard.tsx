import { useState } from 'react';
import { GetBookingsOutputType, updateBookingStatus } from 'zitejs/api';
import BookingKanbanColumn, { KanbanStatus, COLUMN_CONFIG } from './BookingKanbanColumn';
import BookingActivityDrawer from './BookingActivityDrawer';
import { toast } from 'sonner';

type Booking = GetBookingsOutputType['bookings'][0];

const COLUMNS: KanbanStatus[] = ['Pending', 'Awaiting Hotel', 'Awaiting Payment', 'Confirmed', 'Cancelled'];

// Allowed transitions: from → to[]
const ALLOWED: Record<string, string[]> = {
  'Pending':          ['Awaiting Hotel', 'Cancelled'],
  'Awaiting Hotel':   ['Awaiting Payment', 'Pending', 'Cancelled'],
  'Awaiting Payment': ['Confirmed', 'Awaiting Hotel', 'Cancelled'],
  'Confirmed':        ['Cancelled'],
  'Cancelled':        ['Pending'],
  'Approved':         ['Awaiting Hotel', 'Awaiting Payment', 'Confirmed', 'Cancelled'],
  'Rejected':         ['Pending'],
};

interface Props {
  bookings: Booking[];
  onRefresh: () => void;
}

export default function BookingKanbanBoard({ bookings, onRefresh }: Props) {
  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [dragOverCol, setDragOverCol] = useState<KanbanStatus | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const getColumnBookings = (status: KanbanStatus) =>
    bookings.filter(b => {
      if (status === 'Pending') return b.status === 'Pending' || b.status === 'Approved' || !b.status;
      if (status === 'Cancelled') return b.status === 'Cancelled' || b.status === 'Rejected';
      return b.status === status;
    });

  const handleDrop = async (targetStatus: KanbanStatus) => {
    if (!draggedBooking) return;
    const from = draggedBooking.status ?? 'Pending';
    if (from === targetStatus) { setDraggedBooking(null); setDragOverCol(null); return; }

    const allowed = ALLOWED[from] ?? [];
    if (!allowed.includes(targetStatus)) {
      toast.error(`Cannot move from "${from}" to "${targetStatus}"`);
      setDraggedBooking(null); setDragOverCol(null);
      return;
    }

    try {
      await updateBookingStatus({ id: draggedBooking.id, status: targetStatus });
      toast.success(`Moved to ${COLUMN_CONFIG[targetStatus].label}`);
      onRefresh();
    } catch { toast.error('Failed to update status'); }
    setDraggedBooking(null); setDragOverCol(null);
  };

  const openDrawer = (booking: Booking) => {
    setActiveBooking(booking);
    setDrawerOpen(true);
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(status => (
          <BookingKanbanColumn
            key={status}
            status={status}
            bookings={getColumnBookings(status)}
            onDrop={handleDrop}
            onDragStart={(e, b) => { e.dataTransfer.effectAllowed = 'move'; setDraggedBooking(b); }}
            onCardClick={openDrawer}
            isDragOver={dragOverCol === status}
            onDragOver={e => { e.preventDefault(); setDragOverCol(status); }}
            onDragLeave={() => setDragOverCol(null)}
          />
        ))}
      </div>
      <BookingActivityDrawer
        booking={activeBooking}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
