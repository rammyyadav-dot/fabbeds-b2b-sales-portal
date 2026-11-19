import { Loader2, AlertCircle, CalendarSearch, CheckCircle2, TriangleAlert } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { CalculateBookingPriceOutputType } from 'zitejs/api';
import { format } from 'date-fns';

interface Props {
  hotelName: string;
  roomTypeName: string;
  mealPlan: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  pricing: CalculateBookingPriceOutputType | null;
  pricingLoading: boolean;
  pricingError: boolean;
  submitDisabled: boolean;
  loading: boolean;
  confirmed: boolean;
}

const fmtDate = (s: string) => format(new Date(s + 'T00:00:00'), 'EEE, d MMM');
const aed = (n: number) => `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 0 })}`;

export default function CheckoutPriceSidebar({
  hotelName, roomTypeName, mealPlan, checkIn, checkOut,
  rooms, pricing, pricingLoading, pricingError, submitDisabled, loading, confirmed,
}: Props) {
  const nights = pricing?.nights ?? 0;
  const hasDates = !!(checkIn && checkOut);
  const hasPricingErrors = (pricing?.pricingErrors?.length ?? 0) > 0;
  const hasPricingWarnings = (pricing?.pricingWarnings?.length ?? 0) > 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm sticky top-4">
      {/* Header */}
      <div className="bg-primary px-5 py-4">
        <p className="text-primary-foreground/70 text-[10px] font-bold uppercase tracking-widest">Price Summary</p>
        <p className="text-primary-foreground font-bold text-sm mt-0.5">{hotelName}</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Room & dates */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">{roomTypeName}</p>
          <p className="text-xs text-muted-foreground">{mealPlan}</p>
          {hasDates && (
            <p className="text-xs text-muted-foreground">
              {fmtDate(checkIn)} → {fmtDate(checkOut)}
              {nights > 0 && ` · ${nights} night${nights !== 1 ? 's' : ''}`}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{rooms} room{rooms !== 1 ? 's' : ''}</p>
        </div>

        <div className="border-t border-border" />

        {/* Pricing */}
        {!hasDates ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <CalendarSearch className="w-4 h-4 shrink-0" />
            <p className="text-xs">Select dates to see pricing</p>
          </div>
        ) : pricingLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <p className="text-xs">Calculating…</p>
          </div>
        ) : pricingError ? (
          <div className="flex items-center gap-2 text-destructive py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs">Unable to calculate price</p>
          </div>
        ) : pricing && pricing.valid ? (
          <div className="space-y-2">
            {pricing.roomBreakdown.map((r) => (
              <div key={r.roomNo} className="space-y-0.5">
                <div className="flex justify-between text-xs font-medium text-foreground">
                  <span>Room {r.roomNo} ({r.adults}A{r.children > 0 ? `+${r.children}C` : ''})</span>
                  <span>{aed(r.sellRoomTotal || r.roomTotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                  <span>AED {(r.sellNightlyTotal || r.nightlyTotal).toLocaleString()} × {nights}N</span>
                  {r.children > 0 && r.payingChildren > 0 && (
                    <span className="text-amber-600">+child supp</span>
                  )}
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-2 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{pricing.roomBreakdown.length} room{pricing.roomBreakdown.length !== 1 ? 's' : ''} × {nights} night{nights !== 1 ? 's' : ''}</span>
                <span>{aed(pricing.sellTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold text-foreground">Total Payable</p>
                <p className="text-lg font-extrabold text-primary">{aed(pricing.sellTotal)}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Subject to hotel confirmation</p>
          </div>
        ) : pricing && !pricing.valid ? (
          <div className="flex items-center gap-2 text-amber-600 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs">Fix occupancy errors to see price</p>
          </div>
        ) : null}

        <div className="border-t border-border" />

        {/* Admin-facing pricing errors (sell < net, no rates, bad config) */}
        {hasPricingErrors && (
          <div className="space-y-1.5">
            {pricing!.pricingErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
                <TriangleAlert className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-[11px] text-destructive leading-snug">{err}</p>
              </div>
            ))}
          </div>
        )}

        {/* Admin-facing pricing warnings (no markup, partial dates) */}
        {hasPricingWarnings && (
          <div className="space-y-1.5">
            {pricing!.pricingWarnings.map((warn, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-snug">{warn}</p>
              </div>
            ))}
          </div>
        )}

        {/* Declaration reminder */}
        {!confirmed && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Confirm the declaration below to submit</p>
          </div>
        )}
        {confirmed && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700">Ready to submit</p>
          </div>
        )}

        <Button type="submit" form="checkout-form" className="w-full h-11 font-semibold" disabled={submitDisabled || hasPricingErrors}>
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
          ) : (
            '🚀 Submit Reservation'
          )}
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          Rate valid at time of request · Subject to hotel confirmation
        </p>
      </div>
    </div>
  );
}
