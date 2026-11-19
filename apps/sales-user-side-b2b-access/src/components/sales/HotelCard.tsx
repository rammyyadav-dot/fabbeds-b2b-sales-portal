import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import {
  MapPin, BedDouble, Utensils, CalendarDays, AlertTriangle, TrendingDown,
  LayoutGrid, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck, Star,
  BadgeCheck, Clock3, ArrowRight
} from 'lucide-react';
import { GetSalesPortalDataOutputType } from 'zitejs/api';
import StarRating from './StarRating';
import AvailabilityBadge from './AvailabilityBadge';
import PriceMatchModal from './PriceMatchModal';
import TariffCalendarModal from './TariffCalendarModal';
import OfflineInquiryModal from './OfflineInquiryModal';
import { UAE_DESTINATIONS } from '@/lib/homeContent';
import type { RoomConfig } from './SearchFilters';

type SalesHotel = GetSalesPortalDataOutputType['hotels'][0];
type SalesRate = SalesHotel['rates'][0];

interface HotelCardProps {
  hotel: SalesHotel;
  mealPlanFilter: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  rooms?: number;
  roomConfigs?: RoomConfig[];
  nationality?: string;
  extraMarkupPct?: number;
}

function statusStyle(status: string) {
  if (status === 'Free Sale') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Limited') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
}

function fallbackImage(emirate: string) {
  return UAE_DESTINATIONS.find(d => d.name === emirate)?.image || UAE_DESTINATIONS[0].image;
}

function isRefundable(rate: SalesRate) {
  const value = (rate.cancellationSummary || '').toLowerCase();
  return value.includes('free cancellation') || (value.length > 0 && !value.includes('non-refundable'));
}

export default function HotelCard({
  hotel,
  mealPlanFilter,
  checkIn,
  checkOut,
  adults = 2,
  children = 0,
  rooms = 1,
  roomConfigs = [],
  nationality = 'IN',
  extraMarkupPct = 0,
}: HotelCardProps) {
  const [priceMatchOpen, setPriceMatchOpen] = useState(false);
  const [tariffCalOpen, setTariffCalOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const starNum = parseInt(hotel.starRating) || 0;

  const profileParams = new URLSearchParams({
    adults: String(adults),
    children: String(children),
    rooms: String(rooms),
    ...(checkIn ? { checkIn } : {}),
    ...(checkOut ? { checkOut } : {}),
    nationality,
    ...(roomConfigs.length ? { roomConfigs: encodeURIComponent(JSON.stringify(roomConfigs)) } : {}),
    ...(extraMarkupPct > 0 ? { extraMarkupPct: String(extraMarkupPct) } : {}),
  }).toString();
  const profileUrl = `/hotel/${hotel.id}?${profileParams}`;

  const allRates = hotel.rates.filter(r => mealPlanFilter === 'All' || r.mealPlan === mealPlanFilter);
  const fitRates = allRates.filter(r => r.occupancyFit !== false);
  const hasOccupancyIssue = allRates.length > 0 && fitRates.length === 0;
  const displayRates = fitRates;

  const pricedRates = useMemo(
    () => displayRates
      .filter(r => r.displaySellRate > 0 && r.displayStaySellTotal > 0)
      .sort((a, b) => {
        if (a.displayStaySellTotal !== b.displayStaySellTotal) return a.displayStaySellTotal - b.displayStaySellTotal;
        if (a.status === 'Free Sale' && b.status !== 'Free Sale') return -1;
        if (b.status === 'Free Sale' && a.status !== 'Free Sale') return 1;
        return a.ratePlanName.localeCompare(b.ratePlanName);
      }),
    [displayRates]
  );

  const authoritativeBest = hotel.bestValidOffer;
  const noRates = pricedRates.length === 0 && !authoritativeBest;
  const bestRate = pricedRates[0] ?? null;
  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
    : 0;
  const totalPrice = authoritativeBest?.finalDisplayQuote ?? (nights > 0 && bestRate ? bestRate.displayStaySellTotal : null);
  const fromPrice = authoritativeBest?.averagePerRoomNight ?? bestRate?.displaySellRate ?? 0;
  const bestStatus = authoritativeBest?.status ?? bestRate?.status ?? 'On Request';
  const mixedAssignments = authoritativeBest?.roomCombination.map(item => ({
    requestedRoomNo: item.requestedRoomNo,
    roomTypeId: item.roomTypeId,
    ratePlanId: item.ratePlanId,
  })) ?? [];
  const mixedSignature = mixedAssignments.map(a => `${a.requestedRoomNo}:${a.roomTypeId}:${a.ratePlanId}`).join('|');
  const multiRoomUrl = authoritativeBest?.mixedRoomTypes && checkIn && checkOut && roomConfigs.length
    ? `/hotel/${hotel.id}/multi-room-checkout?${new URLSearchParams({
        checkIn,
        checkOut,
        nationality,
        roomConfigs: encodeURIComponent(JSON.stringify(roomConfigs)),
        assignments: encodeURIComponent(JSON.stringify(mixedAssignments)),
        expectedSellTotal: String(authoritativeBest.finalDisplayQuote),
        expectedSignature: mixedSignature,
        ...(extraMarkupPct > 0 ? { extraMarkupPct: String(extraMarkupPct) } : {}),
      }).toString()}`
    : profileUrl;

  const previewRates = (showAllOffers ? pricedRates : pricedRates.slice(0, 3));
  const hiddenOfferCount = Math.max(0, pricedRates.length - previewRates.length);
  const onRequestCount = displayRates.filter(r => r.status === 'On Request').length;
  const freeSaleCount = displayRates.filter(r => r.status === 'Free Sale').length;
  const refundableCount = displayRates.filter(isRefundable).length;
  const hotelImage = hotel.imageUrl || fallbackImage(hotel.emirate);
  const hasReviews = !!hotel.guestRating && hotel.reviewCount > 0;

  return (
    <>
      <article className={`bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${hasOccupancyIssue ? 'border-amber-300' : 'border-border'}`}>
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_190px]">
          {/* Hotel media */}
          <Link to={profileUrl} className="relative h-52 md:h-full min-h-[230px] overflow-hidden bg-muted group">
            <img
              src={hotelImage}
              alt={hotel.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <div className="absolute top-3 left-3">
              <AvailabilityBadge status={noRates ? 'On Request' : hasOccupancyIssue ? 'On Request' : 'Available'} />
            </div>
            {!hotel.imageUrl && (
              <span className="absolute bottom-2 left-2 text-[10px] bg-black/55 text-white rounded px-2 py-1">
                Destination image
              </span>
            )}
          </Link>

          {/* Identity + offer previews */}
          <div className="p-4 md:p-5 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <Link to={profileUrl} className="font-extrabold text-lg leading-tight hover:text-primary transition-colors">
                    {hotel.name}
                  </Link>
                  {!noRates && (
                    <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${statusStyle(bestStatus)}`}>
                      {bestStatus}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  <StarRating stars={starNum} />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {hotel.location || hotel.emirate}
                  </span>
                </div>
              </div>

              {hasReviews && (
                <div className="shrink-0 flex items-center gap-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold">{hotel.reviewLabel || 'Guest rated'}</p>
                    <p className="text-[10px] text-muted-foreground">{hotel.reviewCount.toLocaleString()} reviews</p>
                  </div>
                  <span className="rounded-lg bg-primary text-primary-foreground text-sm font-extrabold px-2.5 py-1.5">
                    {hotel.guestRating?.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-3">
              {freeSaleCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                  <BadgeCheck className="w-3 h-3 mr-1" /> {freeSaleCount} Free Sale
                </Badge>
              )}
              {refundableCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Refundable options
                </Badge>
              )}
              {onRequestCount > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  <Clock3 className="w-3 h-3 mr-1" /> {onRequestCount} On Request
                </Badge>
              )}
              {displayRates.length > 0 && (
                <Badge variant="outline" className="text-[10px]">{displayRates.length} total offers</Badge>
              )}
              {authoritativeBest?.mixedRoomTypes && (
                <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">Mixed room combination</Badge>
              )}
              {authoritativeBest?.mixedCancellation && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Mixed cancellation policy</Badge>
              )}
              {authoritativeBest?.childPricingIncluded && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Child pricing included</Badge>
              )}
              {authoritativeBest?.extraBedIncluded && (
                <Badge variant="outline" className="text-[10px]">Extra bed included</Badge>
              )}
            </div>

            {hasOccupancyIssue && !authoritativeBest && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Current room inventory may not fit the searched occupancy.
              </div>
            )}

            {authoritativeBest?.completeStayPricing && authoritativeBest.mixedRoomTypes && (
              <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                <p className="text-[10px] uppercase tracking-wide font-extrabold text-violet-700">Authoritative room combination</p>
                <div className="mt-2 grid gap-1.5">
                  {authoritativeBest.roomCombination.map(item => (
                    <div key={item.requestedRoomNo} className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-bold">Room {item.requestedRoomNo}</span>
                        <span className="text-muted-foreground"> · {item.roomTypeName} · {item.mealPlan}</span>
                        {item.childSummary && <span className="block text-[10px] text-emerald-700 mt-0.5">{item.childSummary}</span>}
                      </div>
                      <span className="font-extrabold text-primary whitespace-nowrap">AED {item.roomStayDisplayPrice.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OTA-style lead offers */}
            <div className="mt-4 space-y-2">
              {previewRates.length > 0 ? previewRates.map((rate, index) => (
                <Link
                  key={`${rate.roomTypeId}-${rate.ratePlanId}`}
                  to={profileUrl}
                  className={`block rounded-xl border p-3 transition-colors ${index === 0 ? 'border-primary/25 bg-primary/[0.035]' : 'border-border hover:bg-muted/30'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {index === 0 && <span className="text-[9px] uppercase tracking-wide font-bold text-primary">Lead offer</span>}
                        <span className={`text-[9px] rounded-full px-1.5 py-0.5 border font-semibold ${statusStyle(rate.status)}`}>{rate.status}</span>
                      </div>
                      <p className="font-bold text-sm mt-1 truncate">{rate.roomTypeName}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Utensils className="w-3 h-3" />{rate.mealPlan}</span>
                        <span>{rate.ratePlanName}</span>
                        {rate.cancellationSummary && (
                          <span className={isRefundable(rate) ? 'text-emerald-700' : 'text-red-600'}>
                            {rate.cancellationSummary}
                          </span>
                        )}
                        {rate.eventSupplementTotal > 0 && (
                          <span className="text-violet-700 font-semibold">
                            Event supplement included{rate.appliedEvents.length ? ` · ${rate.appliedEvents.join(', ')}` : ''}
                          </span>
                        )}
                        <span className="text-muted-foreground">Market: {rate.sourceMarketProfile === 'ALL' ? 'All markets' : rate.sourceMarketProfile}</span>
                        {rate.publicMarkupPct > 0 && <span className="text-amber-700 font-semibold">Customer quote +{rate.publicMarkupPct}%</span>}
                        {rate.promotionCode && <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-extrabold text-red-700">{rate.promotionName || rate.promotionCode}{rate.promotionDiscountAmount ? ` · Save AED ${Math.round(rate.promotionDiscountAmount)}` : ''}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-sm text-primary">AED {Math.round(rate.displayStaySellTotal).toLocaleString('en-AE', { maximumFractionDigits: 0 })}</p>
                      <p className="text-[10px] text-muted-foreground">total stay</p>
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
                  <p className="text-sm font-semibold">Tariff available on request</p>
                  <p className="text-xs text-muted-foreground mt-1">Open the Tariff Calendar to review room and rate-plan setup for this property.</p>
                </div>
              )}
            </div>

            {pricedRates.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllOffers(v => !v)}
                className="inline-flex items-center text-xs font-semibold text-primary mt-2 hover:underline"
              >
                {showAllOffers ? <>Show fewer offers <ChevronUp className="w-3.5 h-3.5 ml-1" /></> :
                  <>View {hiddenOfferCount} more room option{hiddenOfferCount !== 1 ? 's' : ''} <ChevronDown className="w-3.5 h-3.5 ml-1" /></>}
              </button>
            )}
          </div>

          {/* Commercial action column */}
          <div className="border-t md:border-t-0 md:border-l border-border p-4 flex flex-col justify-between gap-4 bg-muted/[0.12]">
            <div className="text-right">
              {(authoritativeBest || bestRate) ? (
                <>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Best valid offer</p>
                  <p className="text-2xl font-black text-primary leading-tight mt-1">
                    AED {Math.round(totalPrice ?? 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nights > 0 ? `total · ${nights} night${nights !== 1 ? 's' : ''} · ${rooms} room${rooms !== 1 ? 's' : ''}` : 'total stay'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border">
                    AED {Math.round(fromPrice).toLocaleString('en-AE', { maximumFractionDigits: 0 })} / room / night
                  </p>
                  {authoritativeBest?.completeStayPricing ? (
                    <p className="text-[10px] font-semibold text-emerald-700 mt-1">✓ Complete stay pricing</p>
                  ) : (
                    <p className="text-[10px] font-semibold text-amber-700 mt-1">Same-offer pricing</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-bold">On Request</p>
                  <p className="text-xs text-muted-foreground mt-1">No complete positive sell price for the selected stay.</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              {noRates ? (
                <Button
                  size="sm"
                  className="w-full text-xs gap-1"
                  onClick={() => setTariffCalOpen(true)}
                >
                  <LayoutGrid className="w-3 h-3" /> View Tariff
                </Button>
              ) : (
                <>
                  <Link to={multiRoomUrl} className="block">
                    <Button size="sm" className="w-full gap-1.5 font-bold">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {authoritativeBest?.mixedRoomTypes
                        ? 'View Room Combination'
                        : bestStatus === 'On Request' ? 'Request Booking' : 'Book Now'}
                    </Button>
                  </Link>

                  <Link to={profileUrl} className="block">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <BedDouble className="w-3.5 h-3.5" /> View Rooms
                    </Button>
                  </Link>

                  {/* Tariff Calendar workflow intentionally unchanged */}
                  <Button
                    size="sm"
                    className="w-full text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setTariffCalOpen(true)}
                  >
                    <LayoutGrid className="w-3 h-3" /> Tariff Calendar
                  </Button>

                  <button
                    onClick={() => setPriceMatchOpen(true)}
                    className="w-full flex items-center justify-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors font-medium py-0.5"
                  >
                    <TrendingDown className="w-3 h-3" /> Price Match
                  </button>
                </>
              )}

              <Link to={profileUrl} className="flex items-center justify-center text-[11px] text-muted-foreground hover:text-primary">
                Hotel details <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </article>

      <PriceMatchModal
        open={priceMatchOpen}
        onClose={() => setPriceMatchOpen(false)}
        hotel={{ id: hotel.id, name: hotel.name, emirate: hotel.emirate }}
        checkIn={checkIn}
        checkOut={checkOut}
        adults={adults}
        children={children}
        rooms={rooms}
        ourRate={fromPrice}
      />

      {/* Existing tariff modal props and behavior intentionally unchanged */}
      <TariffCalendarModal
        open={tariffCalOpen}
        onClose={() => setTariffCalOpen(false)}
        hotelId={hotel.id}
        hotelName={hotel.name}
        adults={adults}
        children={children}
        rooms={rooms}
      />

      <OfflineInquiryModal
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        defaultCheckIn={checkIn}
        defaultCheckOut={checkOut}
      />
    </>
  );
}
