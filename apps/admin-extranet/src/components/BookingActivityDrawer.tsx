import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Separator } from '@project/components/ui/separator';
import { Skeleton } from '@project/components/ui/skeleton';
import { getBookingActivities, addBookingActivity, GetBookingsOutputType } from 'zitejs/api';
import { toast } from 'sonner';
import { CheckCircle2, Clock, FileText, CreditCard, DollarSign, FileCheck, Ticket, PlusCircle, Mail, Phone, Calendar, Users } from 'lucide-react';

type Booking = GetBookingsOutputType['bookings'][0];
type Activity = { id: string; eventType?: string; notes?: string; createdAt?: string; createdBy?: string };

const EVENT_TYPES = [
  { label: 'Inquiry received',        icon: Mail,        color: 'text-blue-500' },
  { label: 'Admin edited',            icon: FileText,    color: 'text-gray-500' },
  { label: 'Quote sent',              icon: FileCheck,   color: 'text-purple-500' },
  { label: 'Payment link generated',  icon: CreditCard,  color: 'text-orange-500' },
  { label: 'Payment received',        icon: DollarSign,  color: 'text-green-500' },
  { label: 'LPO sent',                icon: FileText,    color: 'text-indigo-500' },
  { label: 'Voucher issued',          icon: Ticket,      color: 'text-emerald-500' },
];

const EVENT_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = Object.fromEntries(
  EVENT_TYPES.map(e => [e.label, { icon: e.icon, color: e.color }])
);

const STATUS_BADGE: Record<string, string> = {
  'Pending': 'bg-yellow-100 text-yellow-700',
  'Awaiting Hotel': 'bg-blue-100 text-blue-700',
  'Awaiting Payment': 'bg-purple-100 text-purple-700',
  'Confirmed': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-gray-100 text-gray-600',
};

interface Props {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
}

export default function BookingActivityDrawer({ booking, open, onClose }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (open && booking) {
      setLoading(true);
      getBookingActivities({ bookingId: booking.id })
        .then(setActivities)
        .finally(() => setLoading(false));
    }
  }, [open, booking]);

  const handleAddEvent = async (eventType: string) => {
    if (!booking) return;
    setAdding(eventType);
    try {
      await addBookingActivity({ bookingId: booking.id, eventType });
      const updated = await getBookingActivities({ bookingId: booking.id });
      setActivities(updated);
      toast.success(`"${eventType}" logged`);
    } catch { toast.error('Failed to log activity'); }
    finally { setAdding(null); }
  };

  const nights = () => {
    if (!booking?.checkinDate || !booking?.checkoutDate) return 0;
    return Math.round((new Date(booking.checkoutDate).getTime() - new Date(booking.checkinDate).getTime()) / 86400000);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="text-base">{booking?.guestName}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{booking?.hotelName}</p>
            </div>
            {booking?.status && (
              <Badge className={`text-xs shrink-0 ${STATUS_BADGE[booking.status] ?? 'bg-muted text-muted-foreground'}`}>
                {booking.status}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
            {booking?.checkinDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{booking.checkinDate} · {nights()}n</span>}
            {booking?.adults && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{booking.adults}A · {booking.rooms}rm</span>}
            {booking?.contactEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{booking.contactEmail}</span>}
            {booking?.whatsAppNumber && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{booking.whatsAppNumber}</span>}
          </div>
        </SheetHeader>

        {/* Quick Actions */}
        <div className="px-5 py-3 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Log Activity</p>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map(({ label, icon: Icon, color }) => (
              <Button key={label} size="sm" variant="outline" className="h-7 text-xs gap-1"
                disabled={adding === label}
                onClick={() => handleAddEvent(label)}>
                <Icon className={`w-3 h-3 ${color}`} />
                {adding === label ? '...' : label}
              </Button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="px-5 py-4 flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Activity Timeline</p>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground/50">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No activities yet</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {activities.map(act => {
                  const cfg = EVENT_ICON_MAP[act.eventType ?? ''] ?? { icon: CheckCircle2, color: 'text-primary' };
                  const Icon = cfg.icon;
                  return (
                    <div key={act.id} className="flex gap-3 relative">
                      <div className={`w-7 h-7 rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0 z-10 ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm font-medium text-foreground leading-tight">{act.eventType}</p>
                        {act.notes && <p className="text-xs text-muted-foreground mt-0.5">{act.notes}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {act.createdAt ? new Date(act.createdAt).toLocaleString() : ''}
                          {act.createdBy ? ` · ${act.createdBy}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
