import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock3, Copy, Download, FileText,
  Hotel, RefreshCw, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import {
  getHotelBookingDetails,
  generateHotelInvoice,
  generateHotelVoucher,
  type GetHotelBookingDetailsOutputType
} from 'zitejs/api';
import SalesHeader from '@/components/sales/SalesHeader';
import { usePartnerAuth } from '@/lib/partnerAuth';

function fmtDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return value;
  }
}

function statusCopy(status: string) {
  if (status === 'Confirmed') return {
    title: 'Hotel booking confirmed',
    subtitle: 'Your hotel voucher is ready to download.',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  if (status === 'Rejected' || status === 'Cancelled') return {
    title: status === 'Rejected' ? 'Reservation rejected' : 'Reservation cancelled',
    subtitle: 'This booking is no longer active.',
    className: 'bg-red-50 text-red-700 border-red-200',
  };
  if (status === 'Awaiting Hotel' || status === 'Approved') return {
    title: 'Awaiting hotel confirmation',
    subtitle: 'The reservation is active on your agency credit and is being confirmed with the hotel.',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return {
    title: 'Reservation request received',
    subtitle: 'Your booking reference is confirmed. Hotel confirmation is still pending.',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  };
}

export default function HotelBookingConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { partner, token } = usePartnerAuth();
  const [booking, setBooking] = useState<GetHotelBookingDetailsOutputType | null>(null);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState<'invoice' | 'voucher' | null>(null);

  const load = useCallback(async () => {
    if (!bookingId || !token) return;
    setLoading(true);
    try {
      setBooking(await getHotelBookingDetails({ token, bookingId }));
    } catch (err: any) {
      toast.error(err?.message || 'Unable to load reservation.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, token]);

  useEffect(() => {
    if (!partner || !token) {
      navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname)}`, { replace: true });
      return;
    }
    load();
  }, [partner, token, navigate, load]);

  const downloadInvoice = async () => {
    if (!bookingId || !token) return;
    setDocLoading('invoice');
    try {
      const res = await generateHotelInvoice({ token, bookingId });
      window.open(res.url, '_blank', 'noopener,noreferrer');
      toast.success(`${res.documentType} ready`, { description: res.invoiceNumber });
    } catch (err: any) {
      toast.error(err?.message || 'Unable to generate invoice.');
    } finally {
      setDocLoading(null);
    }
  };

  const downloadVoucher = async () => {
    if (!bookingId || !token) return;
    setDocLoading('voucher');
    try {
      const res = await generateHotelVoucher({ token, bookingId });
      window.open(res.url, '_blank', 'noopener,noreferrer');
      toast.success('Hotel voucher ready', { description: res.bookingReference });
    } catch (err: any) {
      toast.error(err?.message || 'Voucher is not available yet.');
    } finally {
      setDocLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SalesHeader onLogout={() => {}} />
        <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!booking) return null;
  const state = statusCopy(booking.status);

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={() => {}} />
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-5">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate('/my-bookings')}>
            <ArrowLeft className="w-4 h-4" /> My bookings
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={load}>
            <RefreshCw className="w-4 h-4" /> Refresh status
          </Button>
        </div>

        <section className={`rounded-2xl border p-6 ${state.className}`}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/70 flex items-center justify-center shrink-0">
              {booking.status === 'Confirmed'
                ? <CheckCircle2 className="w-7 h-7" />
                : <Clock3 className="w-7 h-7" />}
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider font-semibold">Hotel reservation</p>
              <h1 className="text-2xl font-extrabold mt-1">{state.title}</h1>
              <p className="text-sm mt-1 opacity-80">{state.subtitle}</p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="bg-white/70 border border-current/10 rounded-lg px-3 py-2 font-mono font-bold">
                  {booking.bookingReference}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(booking.bookingReference);
                    toast.success('Booking reference copied');
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" /> Copy
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
          <section className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-bold">Reservation details</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Hotel</p><p className="font-semibold mt-1">{booking.hotelName}</p><p className="text-xs text-muted-foreground">{booking.hotelLocation}</p></div>
              <div><p className="text-xs text-muted-foreground">Guest</p><p className="font-semibold mt-1">{booking.guestName}</p></div>
              <div><p className="text-xs text-muted-foreground">Room type</p><p className="font-semibold mt-1">{booking.roomTypeName}</p></div>
              <div><p className="text-xs text-muted-foreground">Rate plan / meal</p><p className="font-semibold mt-1">{booking.ratePlanName}</p><p className="text-xs text-muted-foreground">{booking.mealPlan}</p></div>
              <div><p className="text-xs text-muted-foreground">Stay</p><p className="font-semibold mt-1">{fmtDate(booking.checkIn)} – {fmtDate(booking.checkOut)}</p></div>
              <div><p className="text-xs text-muted-foreground">Occupancy</p><p className="font-semibold mt-1">{booking.rooms} room(s) · {booking.adults} adult(s){booking.children ? ` · ${booking.children} child(ren)` : ''}</p></div>
              <div><p className="text-xs text-muted-foreground">Cancellation</p><p className="font-semibold mt-1">{booking.cancellationSummary || 'As per booked rate plan'}</p></div>
              <div><p className="text-xs text-muted-foreground">Hotel confirmation</p><p className="font-semibold mt-1">{booking.hotelConfirmationNo || 'Pending'}</p></div>
            </div>
            {booking.specialRequests && (
              <div className="mx-5 mb-5 rounded-lg bg-muted/30 border border-border p-3">
                <p className="text-xs text-muted-foreground">Special requests</p>
                <p className="text-sm mt-1">{booking.specialRequests}</p>
              </div>
            )}
          </section>

          <section className="bg-card border border-border rounded-2xl p-5 h-fit">
            <h2 className="font-bold">Commercial summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Agency</span><span className="font-semibold text-right">{booking.companyName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reservation total</span><span className="font-bold">AED {booking.sellTotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Credit exposure</span><span>{booking.creditSettlementStatus || 'Open'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Credit due</span><span>{fmtDate(booking.creditDueDate)}</span></div>
            </div>

            <div className="border-t border-border mt-5 pt-5 space-y-2">
              <Button variant="outline" className="w-full gap-2" onClick={downloadInvoice} disabled={docLoading !== null}>
                <FileText className="w-4 h-4" />
                {docLoading === 'invoice' ? 'Generating…' : `Download ${booking.invoiceLabel}`}
              </Button>
              <Button className="w-full gap-2" onClick={downloadVoucher} disabled={!booking.voucherAvailable || docLoading !== null}>
                <Download className="w-4 h-4" />
                {docLoading === 'voucher' ? 'Generating…' : 'Download Hotel Voucher'}
              </Button>
              {!booking.voucherAvailable && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Voucher unlocks only after hotel confirmation is recorded by reservations.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="bg-card border border-border rounded-2xl p-5 mt-5">
          <h2 className="font-bold">Reservation workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="font-semibold text-sm mt-2">1. Request received</p>
              <p className="text-xs text-muted-foreground mt-1">Reference and credit exposure created.</p>
            </div>
            <div className={`rounded-lg border p-3 ${booking.status !== 'Pending' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <ShieldCheck className="w-4 h-4" />
              <p className="font-semibold text-sm mt-2">2. Reservation review</p>
              <p className="text-xs text-muted-foreground mt-1">Rate, room and credit controls validated.</p>
            </div>
            <div className={`rounded-lg border p-3 ${booking.status === 'Confirmed' ? 'border-emerald-200 bg-emerald-50' : 'border-border'}`}>
              <Hotel className="w-4 h-4" />
              <p className="font-semibold text-sm mt-2">3. Hotel confirmation</p>
              <p className="text-xs text-muted-foreground mt-1">Reservations records the hotel confirmation number.</p>
            </div>
            <div className={`rounded-lg border p-3 ${booking.voucherAvailable ? 'border-emerald-200 bg-emerald-50' : 'border-border'}`}>
              <Download className="w-4 h-4" />
              <p className="font-semibold text-sm mt-2">4. Voucher issued</p>
              <p className="text-xs text-muted-foreground mt-1">Guest-facing voucher becomes downloadable.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
