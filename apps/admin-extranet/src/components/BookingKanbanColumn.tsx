import { GetBookingsOutputType } from 'zitejs/api';
import BookingKanbanCard from './BookingKanbanCard';

type Booking = GetBookingsOutputType['bookings'][0];

export type KanbanStatus = 'Pending' | 'Awaiting Hotel' | 'Awaiting Payment' | 'Confirmed' | 'Cancelled';

export const COLUMN_CONFIG: Record<KanbanStatus, { label: string; color: string; headerBg: string; dot: string }> = {
  'Pending':          { label: 'Pending',          color: 'border-yellow-300',  headerBg: 'bg-yellow-50',  dot: 'bg-yellow-400' },
  'Awaiting Hotel':   { label: 'Awaiting Hotel',   color: 'border-blue-300',    headerBg: 'bg-blue-50',    dot: 'bg-blue-400' },
  'Awaiting Payment': { label: 'Awaiting Payment', color: 'border-purple-300',  headerBg: 'bg-purple-50',  dot: 'bg-purple-400' },
  'Confirmed':        { label: 'Confirmed',         color: 'border-green-300',   headerBg: 'bg-green-50',   dot: 'bg-green-500' },
  'Cancelled':        { label: 'Cancelled',         color: 'border-gray-300',    headerBg: 'bg-gray-50',    dot: 'bg-gray-400' },
};

interface Props {
  status: KanbanStatus;
  bookings: Booking[];
  onDrop: (status: KanbanStatus) => void;
  onDragStart: (e: React.DragEvent, booking: Booking) => void;
  onCardClick: (booking: Booking) => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
}

export default function BookingKanbanColumn({ status, bookings, onDrop, onDragStart, onCardClick, isDragOver, onDragOver, onDragLeave }: Props) {
  const cfg = COLUMN_CONFIG[status];

  return (
    <div className="flex flex-col min-w-[260px] w-[260px]">
      <div className={`rounded-t-lg px-3 py-2 flex items-center gap-2 border-t border-x ${cfg.color} ${cfg.headerBg}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        <span className="font-semibold text-sm">{cfg.label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-white/60 rounded-full px-2 py-0.5">{bookings.length}</span>
      </div>
      <div
        onDrop={e => { e.preventDefault(); onDrop(status); }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`flex-1 min-h-[500px] rounded-b-lg border border-t-0 ${cfg.color} p-2 space-y-2 transition-colors ${isDragOver ? 'bg-primary/5' : 'bg-muted/20'}`}
      >
        {bookings.map(b => (
          <BookingKanbanCard key={b.id} booking={b} onClick={() => onCardClick(b)} onDragStart={onDragStart} />
        ))}
        {bookings.length === 0 && (
          <div className="h-20 flex items-center justify-center text-xs text-muted-foreground/50 border-2 border-dashed border-muted rounded-lg">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}
