import { useState } from 'react';
import { getBookingByRef, cancelBookingGuest, GetBookingByRefOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Separator } from '@project/components/ui/separator';
import { Textarea } from '@project/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@project/components/ui/alert-dialog';
import { Building2, CalendarDays, Users, Search, XCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

type BookingData = NonNullable<GetBookingByRefOutputType['booking']>;

const STATUS_COLORS: Record<string, string> = {
  Confirmed: 'bg-green-100 text-green-700 border-green-200',
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  'Awaiting Hotel': 'bg-blue-100 text-blue-700 border-blue-200',
  'Awaiting Payment': 'bg-purple-100 text-purple-700 border-purple-200',
};

const CANCELLABLE = ['Pending', 'Awaiting Hotel', 'Awaiting Payment'];

function BookingCard({ booking, email, onCancelled }: { booking: BookingData; email: string; onCancelled: () => void }) {
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const nights = booking.checkinDate && booking.checkoutDate
    ? Math.round((new Date(booking.checkoutDate).getTime() - new Date(booking.checkinDate).getTime()) / 86400000)
    : 0;

  const canCancel = CANCELLABLE.includes(booking.status);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await cancelBookingGuest({ bookingRef: booking.bookingRef, email, reason: reason || undefined });
      if (res.success) {
        toast.success(res.message);
        onCancelled();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Booking Reference</p>
            <CardTitle className="font-mono text-xl">#{booking.bookingRef}</CardTitle>
          </div>
          <Badge className={`border text-sm px-3 py-1 ${STATUS_COLORS[booking.status] ?? ''}`}>
            {booking.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hotel & Room */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Property
          </p>
          <p className="font-medium">{booking.hotelName}</p>
          {booking.roomTypeName && <p className="text-sm text-muted-foreground">{booking.roomTypeName}{booking.mealPlan ? ` — ${booking.mealPlan}` : ''}</p>}
        </div>

        <Separator />

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Check-in
            </p>
            <p className="font-medium">{booking.checkinDate}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Check-out
            </p>
            <p className="font-medium">{booking.checkoutDate}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{nights} night{nights !== 1 ? 's' : ''}</p>

        <Separator />

        {/* Guests */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Guests
          </p>
          <p className="font-medium">{booking.guestName}</p>
          {booking.companyName && <p className="text-sm text-muted-foreground">{booking.companyName}</p>}
          <p className="text-sm text-muted-foreground">
            {booking.rooms} room{booking.rooms !== 1 ? 's' : ''} · {booking.adults} adult{booking.adults !== 1 ? 's' : ''}
            {booking.children ? ` · ${booking.children} child${booking.children !== 1 ? 'ren' : ''}` : ''}
          </p>
        </div>

        {booking.adminNotes && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium text-xs text-muted-foreground mb-1">Message from our team</p>
            <p>{booking.adminNotes}</p>
          </div>
        )}

        {booking.specialRequests && (
          <p className="text-sm text-muted-foreground italic">Special requests: "{booking.specialRequests}"</p>
        )}

        {/* Cancel section */}
        {canCancel && (
          <div className="pt-2 border-t border-border">
            <div className="space-y-2 mb-3">
              <Label className="text-xs text-muted-foreground">Cancellation reason (optional)</Label>
              <Textarea
                placeholder="Let us know why you're cancelling..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5">
                  <XCircle className="w-4 h-4" /> Cancel This Booking
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Booking #{booking.bookingRef}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel your booking at {booking.hotelName} for {booking.checkinDate} – {booking.checkoutDate}.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {!canCancel && booking.status !== 'Cancelled' && (
          <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-700">
              This booking cannot be cancelled online. Please contact our team directly for assistance.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ManageBookingPage() {
  const [bookingRef, setBookingRef] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const handleLookup = async () => {
    if (!bookingRef.trim() || !email.trim()) {
      toast.error('Please enter your booking reference and email address');
      return;
    }
    setLoading(true);
    setNotFound(false);
    setBooking(null);
    setCancelled(false);
    try {
      const res = await getBookingByRef({ bookingRef: bookingRef.trim(), email: email.trim() });
      if (res.found && res.booking) {
        setBooking(res.booking);
      } else {
        setNotFound(true);
      }
    } catch {
      toast.error('Failed to look up booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelled = async () => {
    // Re-fetch to show updated status
    const res = await getBookingByRef({ bookingRef: bookingRef.trim(), email: email.trim() });
    if (res.found && res.booking) {
      setBooking(res.booking);
      setCancelled(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-500 text-white py-8 px-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold mb-1">Manage My Booking</h1>
          <p className="text-white/80 text-sm">Look up your booking status, view details, or cancel your reservation.</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-6">
        {/* Lookup Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" /> Find Your Booking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Booking Reference</Label>
              <Input
                placeholder="e.g. 12345"
                value={bookingRef}
                onChange={e => setBookingRef(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="The email used when booking"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
              />
            </div>
            <Button onClick={handleLookup} disabled={loading} className="w-full gap-2">
              <Search className="w-4 h-4" />
              {loading ? 'Searching...' : 'Find Booking'}
            </Button>
          </CardContent>
        </Card>

        {/* Not Found */}
        {notFound && (
          <div className="flex items-start gap-3 bg-destructive/5 border border-destructive/20 rounded-lg p-4">
            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Booking not found</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Please check your reference number and email address. If you need help, contact our team.
              </p>
            </div>
          </div>
        )}

        {/* Cancelled success banner */}
        {cancelled && (
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-green-800">Booking cancelled</p>
              <p className="text-sm text-green-700 mt-0.5">Your booking has been cancelled successfully.</p>
            </div>
          </div>
        )}

        {/* Booking Details */}
        {booking && (
          <BookingCard booking={booking} email={email} onCancelled={handleCancelled} />
        )}

        <p className="text-center text-xs text-muted-foreground">
          Want to make a new booking?{' '}
          <Link to="/book" className="text-primary hover:underline font-medium">Book here →</Link>
        </p>
      </div>
    </div>
  );
}
