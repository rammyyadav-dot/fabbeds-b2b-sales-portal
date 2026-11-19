import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { getPartnerBookings } from 'zitejs/api';
import SalesHeader from '@/components/sales/SalesHeader';
import { useNavigate } from 'react-router-dom';
import { usePartnerAuth } from '@/lib/partnerAuth';

type Booking = Awaited<ReturnType<typeof getPartnerBookings>>['bookings'][0];

export default function FindBookingPage() {
  const navigate = useNavigate();
  const { partner, token, isLoading: authLoading } = usePartnerAuth();
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!authLoading && (!partner || !token)) {
      navigate('/partner/sign-in', { replace: true });
    }
  }, [authLoading, partner, token, navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !partner) { navigate('/partner/sign-in', { replace: true }); return; }
    if (!reference.trim()) { toast.error('Enter a booking reference'); return; }
    setLoading(true);
    setNotFound(false);
    setBooking(null);
    try {
      const res = await getPartnerBookings({ token, reference: reference.trim() });
      if (res.bookings.length > 0) {
        setBooking(res.bookings[0]);
      } else {
        setNotFound(true);
      }
    } catch {
      toast.error('Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SalesHeader onLogout={() => {}} />
      <div className="container mx-auto px-4 max-w-2xl py-10">
        <h1 className="text-xl font-semibold text-foreground">Find a booking</h1>
        <p className="text-sm text-muted-foreground mt-1">Search only within the signed-in agency account{partner ? ` · ${partner.agencyName}` : ""}.</p>
        <form onSubmit={handleSearch} className="mt-6 flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Booking reference</label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Enter booking reference" className="mt-1" />
          </div>
          <Button type="submit" disabled={loading || authLoading || !token} className="gap-2">
            <Search className="w-4 h-4" />
            {loading ? 'Looking up…' : 'Find'}
          </Button>
        </form>

        {notFound && (
          <div className="mt-8 text-center py-10 border border-border rounded-lg bg-muted/20">
            <p className="text-muted-foreground">No booking found in this agency account for that reference.</p>
            <p className="text-xs text-muted-foreground mt-1">Check the booking reference and try again.</p>
          </div>
        )}

        {booking && (
          <div className="mt-8 border border-border rounded-lg bg-card p-6">
            <div className="flex items-center gap-6 mb-4">
              <div><div className="text-xs text-muted-foreground">Reference</div><div className="font-mono text-lg text-foreground">{booking.bookingReference}</div></div>
              <div><div className="text-xs text-muted-foreground">Status</div><div className="text-foreground">{booking.status === 'Pending' ? 'Requested' : booking.status}</div></div>
              <div><div className="text-xs text-muted-foreground">Total</div><div className="text-foreground font-medium">{booking.sellTotal != null ? `AED ${booking.sellTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</div></div>
            </div>
            <div className="border-t border-border pt-4 grid grid-cols-3 gap-4 text-sm">
              <div><div className="text-xs text-muted-foreground">Hotel</div><div className="text-foreground">{booking.hotelName || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Room type</div><div className="text-foreground">{booking.roomTypeName || '—'}</div></div>
              <div>
                <div className="text-xs text-muted-foreground">Dates</div>
                <div className="text-foreground">
                  {booking.checkinDate && booking.checkoutDate
                    ? `${format(new Date(booking.checkinDate), 'd MMM')}–${format(new Date(booking.checkoutDate), 'd MMM yyyy')}`
                    : '—'}
                </div>
              </div>
              <div><div className="text-xs text-muted-foreground">Guest</div><div className="text-foreground">{booking.guestName || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Agency</div><div className="text-foreground">{booking.companyName || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Meal plan</div><div className="text-foreground">{booking.mealPlan || '—'}</div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
