import { Building2, CalendarDays, BedDouble, Loader2, AlertCircle, CalendarSearch } from 'lucide-react';
import { CalculateBookingPriceOutputType } from 'zitejs/api';
import RoomBreakdownRow from './RoomBreakdownRow';

interface Props {
  hotelName: string;
  roomTypeName: string;
  mealPlan: string;
  checkIn?: string;
  checkOut?: string;
  pricing: CalculateBookingPriceOutputType | null;
  pricingLoading: boolean;
  pricingError?: boolean;
}

const fmtDate = (s?: string) => s
  ? new Date(s + 'T00:00:00').toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const aed = (n: number) => `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function CostSummaryBox({ hotelName, roomTypeName, mealPlan, checkIn, checkOut, pricing, pricingLoading, pricingError }: Props) {
  const nights = pricing?.nights ?? 0;
  const hasRates = pricing && pricing.roomBreakdown.some(r => r.nightlyTotal > 0);
  const roomCount = pricing?.roomBreakdown.length ?? 0;
  const hasDates = !!(checkIn && checkOut);

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 overflow-hidden shadow-sm text-sm">
      {/* Header */}
      <div className="bg-primary px-4 py-2.5">
        <p className="text-primary-foreground text-[10px] font-bold uppercase tracking-widest opacity-75">Price Estimate</p>
        <p className="text-primary-foreground text-xs font-semibold">Room Pricing Breakdown</p>
      </div>

      {/* Stay details */}
      <div className="px-4 pt-3 pb-1 space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Building2 className="w-3 h-3 text-primary shrink-0" />{hotelName}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BedDouble className="w-3 h-3 shrink-0" />{roomTypeName} · {mealPlan}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="w-3 h-3 shrink-0" />
          {hasDates ? `${fmtDate(checkIn)} → ${fmtDate(checkOut)}${nights > 0 ? ` (${nights}N)` : ''}` : 'No dates selected'}
        </div>
      </div>

      {/* Per-room breakdown */}
      <div className="px-4 py-2 border-t border-amber-200/60 mt-2 space-y-2">
        {!hasDates ? (
          <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
            <CalendarSearch className="w-4 h-4 shrink-0" />
            <span className="text-xs">Enter check-in &amp; check-out dates above to see pricing</span>
          </div>
        ) : pricingLoading ? (
          <div className="flex items-center justify-center py-5 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Calculating price…</span>
          </div>
        ) : pricingError ? (
          <div className="flex items-center gap-2 py-3 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs">Unable to calculate price — please check your dates and try again</span>
          </div>
        ) : hasRates ? (
          <>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {roomCount} Room{roomCount !== 1 ? 's' : ''} · {nights} Night{nights !== 1 ? 's' : ''}
            </p>
            {pricing!.roomBreakdown.map(room => (
              <RoomBreakdownRow
                key={room.roomNo}
                room={room}
                nights={pricing!.nights}
                freeChildAge={pricing!.freeChildAge}
              />
            ))}
            {pricing!.eventSupplementTotal > 0 && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-violet-900">Event / exhibition supplement</span>
                  <span className="font-bold text-violet-900">{aed(pricing!.eventSupplementTotal)}</span>
                </div>
                {pricing!.appliedEvents.length > 0 && (
                  <p className="text-[10px] text-violet-700 mt-1">{pricing!.appliedEvents.join(' · ')}</p>
                )}
              </div>
            )}
            <div className="border-t border-amber-300/60 pt-2 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-foreground">Total Estimate</p>
                <p className="text-[10px] text-muted-foreground">Subject to hotel confirmation</p>
              </div>
              <p className="text-base font-extrabold text-primary">{aed(pricing!.sellTotal)}</p>
            </div>
          </>
        ) : pricing ? (
          <p className="text-xs text-muted-foreground text-center py-4">No rate data available for selected dates</p>
        ) : null}
      </div>

      <div className="px-4 py-2 bg-amber-100/60 border-t border-amber-200/60">
        <p className="text-[9px] text-amber-800/70">⚠ Rate valid at time of request · Subject to availability</p>
      </div>
    </div>
  );
}
