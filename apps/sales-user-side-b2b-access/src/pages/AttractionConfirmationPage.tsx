import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Download, FileText, RefreshCw, CheckCircle2, Clock3, ArrowLeft, Copy, Ticket
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import {
  generateAttractionInvoice,
  generateAttractionVoucher,
  getAttractionBookingDetails,
  type GetAttractionBookingDetailsOutputType,
} from 'zitejs/api';
import SalesHeader from '@/components/sales/SalesHeader';
import SupportHelpCard from '@/components/attractions/SupportHelpCard';
import { usePartnerAuth } from '@/lib/partnerAuth';
import { resolveAttractionImage } from '@/lib/attractionImages';
import AttractionBookingSteps from '@/components/attractions/AttractionBookingSteps';

function fmtDate(v?: string) {
  if (!v) return '—';
  return new Date(v + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

export default function AttractionConfirmationPage({ onLogout }: { onLogout: () => void }) {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { partner, token } = usePartnerAuth();
  const [booking, setBooking] = useState<GetAttractionBookingDetailsOutputType | null>(null);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState<'invoice'|'voucher'|null>(null);

  const load = useCallback(async () => {
    if (!token || !bookingId) return;
    setLoading(true);
    try {
      setBooking(await getAttractionBookingDetails({ token, bookingId }));
    } catch (err:any) {
      toast.error(err?.message || 'Unable to load attraction reservation.');
    } finally {
      setLoading(false);
    }
  }, [token, bookingId]);

  useEffect(() => {
    if (!partner || !token) {
      navigate(`/partner/sign-in?returnTo=${encodeURIComponent(window.location.pathname)}`, { replace:true });
      return;
    }
    load();
  }, [partner, token, navigate, load]);

  const invoice = async () => {
    if (!token || !bookingId) return;
    setDocLoading('invoice');
    try {
      const r = await generateAttractionInvoice({ token, bookingId });
      window.open(r.url, '_blank', 'noopener,noreferrer');
      toast.success(`${r.documentType} ready`, { description:r.invoiceNumber });
    } catch(err:any) { toast.error(err?.message || 'Unable to generate invoice.'); }
    finally { setDocLoading(null); }
  };

  const voucher = async () => {
    if (!token || !bookingId) return;
    setDocLoading('voucher');
    try {
      const r = await generateAttractionVoucher({ token, bookingId });
      window.open(r.url, '_blank', 'noopener,noreferrer');
      toast.success('Voucher ready', { description:r.voucherNumber });
      await load();
    } catch(err:any) { toast.error(err?.message || 'Voucher is not available yet.'); }
    finally { setDocLoading(null); }
  };

  if (loading) {
    return <div className="min-h-screen bg-muted/30"><SalesHeader onLogout={onLogout} hotelCount={0}/><div className="container mx-auto max-w-5xl px-4 py-8 space-y-4"><Skeleton className="h-28 rounded-xl"/><Skeleton className="h-72 rounded-xl"/></div></div>;
  }
  if (!booking) return null;

  const confirmed = booking.status === 'Confirmed';
  const cancelled = ['Cancelled','Rejected'].includes(booking.status);
  const attractionImage = resolveAttractionImage({ title: booking.attractionName });
  const afterBookingCredit = booking.creditAvailableBefore != null
    ? Math.max(0, booking.creditAvailableBefore - booking.total)
    : null;

  return (
    <div className="min-h-screen bg-muted/30 pb-24 lg:pb-0">
      <SalesHeader onLogout={onLogout} hotelCount={0}/>
      <main className="container mx-auto max-w-5xl px-3 sm:px-4 py-4 sm:py-8">
        <AttractionBookingSteps current={3} />
        <div className="flex items-center justify-between mb-5">
          <Button variant="ghost" size="sm" onClick={() => navigate('/attractions')} className="gap-2"><ArrowLeft className="w-4 h-4"/> Attractions</Button>
          <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4"/> Refresh status</Button>
        </div>

        <section className={`rounded-2xl border p-6 ${confirmed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : cancelled ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/70 flex items-center justify-center shrink-0">
              {confirmed ? <CheckCircle2 className="w-7 h-7"/> : <Clock3 className="w-7 h-7"/>}
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider font-semibold">B2B attraction reservation</p>
              <h1 className="text-2xl font-extrabold mt-1">{confirmed ? 'Reservation confirmed' : cancelled ? booking.status : 'Awaiting confirmation'}</h1>
              <p className="text-sm mt-1 opacity-80">{confirmed ? 'The final guest voucher is available.' : cancelled ? 'This reservation is no longer active.' : 'Your agency credit exposure is reserved while operations/supplier confirmation is completed.'}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="bg-white/70 rounded-lg px-3 py-2 font-mono font-bold">{booking.bookingReference}</span>
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(booking.bookingReference); toast.success('Reference copied'); }}><Copy className="w-4 h-4 mr-1"/>Copy</Button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px] gap-4 sm:gap-5 mt-5">
          <section className="min-w-0 bg-card border border-border rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[160px_1fr] border-b border-border">
              <img src={attractionImage} alt={booking.attractionName} className="w-full h-full min-h-[120px] object-cover" />
              <div className="p-4 sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-primary font-bold">Booked experience</p>
                <h2 className="text-lg font-black mt-1">{booking.attractionName}</h2>
                <p className="text-sm text-muted-foreground mt-1">{booking.ticketOptionName}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2.5 py-1">{fmtDate(booking.targetDate)}{booking.targetSlot ? ` · ${booking.targetSlot}` : ''}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1">{booking.adultCount} Adult{booking.adultCount===1?'':'s'}{booking.childCount ? ` · ${booking.childCount} Child${booking.childCount===1?'':'ren'}` : ''}</span>
                </div>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Ticket / SKU</p><p className="font-bold mt-1">{booking.ticketOptionName}</p><p className="text-xs font-mono text-muted-foreground">{booking.sku}</p></div>
              <div><p className="text-xs text-muted-foreground">Supplier confirmation</p><p className="font-bold mt-1">{booking.supplierConfirmationNo || 'Pending'}</p></div>
              <div><p className="text-xs text-muted-foreground">Lead traveller</p><p className="font-bold mt-1">{booking.guestName}</p><p className="text-xs text-muted-foreground">{booking.guestNationality}</p></div>
              <div><p className="text-xs text-muted-foreground">Agency</p><p className="font-bold mt-1">{booking.companyName}</p><p className="text-xs text-muted-foreground">{booking.contactEmail}</p></div>
              <div className="sm:col-span-2 rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-bold">Cancellation policy</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{booking.cancellation}</p>
              </div>
            </div>
          </section>

          <aside className="bg-card border border-border rounded-2xl p-5 h-fit lg:sticky lg:top-5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">Booking summary</p>
            <div className="mt-3 pb-4 border-b">
              <p className="text-xs text-muted-foreground">Booking reference</p>
              <p className="font-mono font-black mt-1">{booking.bookingReference}</p>
            </div>

            <div className="py-4 border-b space-y-2.5 text-sm">
              <p className="font-bold">Price details</p>
              {booking.pricingBreakdownAvailable ? (
                <>
                  {booking.adultCount > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Adult × {booking.adultCount} <span className="text-[10px]">(@ AED {booking.adultUnitPrice.toLocaleString()})</span></span>
                      <span className="font-semibold">AED {booking.adultSubtotal.toLocaleString()}</span>
                    </div>
                  )}
                  {booking.childCount > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Child × {booking.childCount} <span className="text-[10px]">(@ AED {booking.childUnitPrice.toLocaleString()})</span></span>
                      <span className="font-semibold">AED {booking.childSubtotal.toLocaleString()}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Line-item pricing is unavailable for this legacy reservation; the booked total below remains authoritative.</p>
              )}
              <div className="border-t pt-3 flex items-end justify-between">
                <div>
                  <p className="font-black">Total booked</p>
                  <p className="text-[10px] text-muted-foreground">Agency credit</p>
                </div>
                <span className="text-2xl font-black text-primary">AED {booking.total.toLocaleString()}</span>
              </div>
              {booking.savingsVsRetail > 0 && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex justify-between text-xs text-emerald-800">
                  <span>Suggested retail AED {booking.retailTotal.toLocaleString()}</span>
                  <span className="font-bold">Trade value AED {booking.savingsVsRetail.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="py-4 border-b space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Credit exposure</span><span>{booking.creditSettlementStatus || 'Open'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Credit due</span><span>{fmtDate(booking.creditDueDate)}</span></div>
              {booking.creditAvailableBefore != null && <div className="flex justify-between"><span className="text-muted-foreground">Credit before</span><span>AED {booking.creditAvailableBefore.toLocaleString()}</span></div>}
              {afterBookingCredit != null && <div className="flex justify-between"><span className="font-semibold">Available after booking</span><span className="font-bold">AED {afterBookingCredit.toLocaleString()}</span></div>}
            </div>

            <div className="pt-4 space-y-2">
              <h2 className="font-bold text-sm">Commercial documents</h2>
              <Button variant="outline" className="w-full gap-2" onClick={invoice} disabled={docLoading!==null || cancelled}><FileText className="w-4 h-4"/>{docLoading==='invoice'?'Generating…':`Download ${booking.invoiceLabel}`}</Button>
              <Button className="w-full gap-2" onClick={voucher} disabled={!booking.voucherAvailable || docLoading!==null}><Download className="w-4 h-4"/>{docLoading==='voucher'?'Generating…':'Download Voucher PDF'}</Button>
              {!booking.voucherAvailable && !cancelled && <p className="text-[11px] text-center text-muted-foreground">Voucher unlocks after supplier/operations confirmation.</p>}
            </div>
          </aside>
        </div>

        <section className="bg-card border border-border rounded-2xl p-5 mt-5">
          <h2 className="font-bold">Reservation workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
            {[
              ['1. Offer rechecked','Date, slot, allocation and AED rate validated.'],
              ['2. Credit authorised','Shared agency credit exposure reserved.'],
              ['3. Confirmation','Supplier/operations reference recorded.'],
              ['4. Voucher','Guest voucher and credit invoice released.'],
            ].map(([t,d],i) => <div key={t} className={`rounded-lg border p-3 ${i < (confirmed ? 4 : 2) ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/20'}`}><p className="font-semibold text-sm">{t}</p><p className="text-xs text-muted-foreground mt-1">{d}</p></div>)}
          </div>
        </section>

        <div className="mt-5">
          <SupportHelpCard bookingReference={booking.bookingReference} />
        </div>
      </main>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-border px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={invoice} disabled={docLoading!==null || cancelled}>
            <FileText className="w-4 h-4" />
            {confirmed ? 'Invoice' : 'Proforma'}
          </Button>
          <Button className="flex-1 gap-2" onClick={voucher} disabled={!booking.voucherAvailable || docLoading!==null}>
            <Download className="w-4 h-4" />
            {booking.voucherAvailable ? 'Voucher' : 'Voucher Pending'}
          </Button>
        </div>
      </div>
    </div>
  );
}
