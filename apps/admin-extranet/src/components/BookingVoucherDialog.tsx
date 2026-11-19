import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Separator } from '@project/components/ui/separator';
import { Download, Building2, CalendarDays, Users, FileText } from 'lucide-react';
import { GetBookingsOutputType } from 'zitejs/api';
import { printDocument, buildVoucherHtml } from '@/utils/printDocument';

type Booking = GetBookingsOutputType['bookings'][0];

const STATUS_COLORS: Record<string, string> = {
  Confirmed: 'bg-green-100 text-green-700 border-green-200',
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  'Awaiting Hotel': 'bg-blue-100 text-blue-700 border-blue-200',
  'Awaiting Payment': 'bg-purple-100 text-purple-700 border-purple-200',
};

interface Props { booking: Booking; onClose: () => void; }

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default function BookingVoucherDialog({ booking, onClose }: Props) {
  const nights = booking.checkinDate && booking.checkoutDate
    ? Math.round((new Date(booking.checkoutDate).getTime() - new Date(booking.checkinDate).getTime()) / 86400000)
    : 0;

  const handleDownloadPdf = () => {
    const html = buildVoucherHtml({
      bookingRef: booking.bookingRef ?? '—',
      status: booking.status ?? 'Pending',
      hotelName: booking.hotelName ?? '—',
      destination: undefined,
      hotelConfirmationNumber: undefined,
      roomType: booking.roomTypeName ?? undefined,
      boardBasis: booking.mealPlan ?? undefined,
      checkinDate: booking.checkinDate ?? undefined,
      checkoutDate: booking.checkoutDate ?? undefined,
      nights,
      rooms: booking.rooms,
      adults: booking.adults,
      children: booking.children,
      guestName: booking.guestName ?? undefined,
      agentCompany: booking.companyName ?? undefined,
      sellingRateAed: booking.sellTotal,
      specialRequests: booking.specialRequests,
    });
    printDocument(html, `Voucher — ${booking.bookingRef}`);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Booking Voucher
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="font-mono font-bold text-lg">#{booking.bookingRef}</p>
            </div>
            <Badge className={`border ${STATUS_COLORS[booking.status ?? ''] ?? ''}`}>{booking.status}</Badge>
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Property
            </p>
            <Row label="Hotel" value={booking.hotelName} />
            <Row label="Room Type" value={booking.roomTypeName} />
            <Row label="Meal Plan" value={booking.mealPlan} />
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Stay
            </p>
            <Row label="Check-in" value={booking.checkinDate} />
            <Row label="Check-out" value={booking.checkoutDate} />
            <Row label="Nights" value={nights} />
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Guests
            </p>
            <Row label="Guest Name" value={booking.guestName} />
            <Row label="Company" value={booking.companyName} />
            <Row label="Rooms" value={booking.rooms} />
            <Row label="Adults" value={booking.adults} />
            <Row label="Children" value={booking.children} />
          </div>

          {(booking.sellTotal || booking.netTotal) && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing</p>
                <Row label="Net Total" value={booking.netTotal ? `AED ${booking.netTotal.toLocaleString('en', { minimumFractionDigits: 2 })}` : undefined} />
                <Row label="Sell Total" value={booking.sellTotal ? `AED ${booking.sellTotal.toLocaleString('en', { minimumFractionDigits: 2 })}` : undefined} />
              </div>
            </>
          )}

          {booking.specialRequests && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Special Requests</p>
                <p className="text-sm text-muted-foreground italic">"{booking.specialRequests}"</p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={handleDownloadPdf} className="gap-2 flex-1">
            <Download className="w-4 h-4" /> Download PDF
          </Button>
          <Button onClick={onClose} className="flex-1">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
