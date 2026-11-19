import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Star, MapPin, BedDouble, FileText, Users, CalendarDays } from 'lucide-react';
import { SearchHotelsOutputType } from 'zitejs/api';

type Hotel = SearchHotelsOutputType['hotels'][0];
type RoomType = Hotel['roomTypes'][0];

const STAR_COLORS: Record<string, string> = {
  '3 Star': 'text-yellow-500', '4 Star': 'text-orange-500', '5 Star': 'text-purple-500',
};
const MEAL_ABBR: Record<string, string> = {
  'Room Only': 'RO', 'Bed & Breakfast': 'BB', 'Half Board': 'HB', 'Full Board': 'FB', 'All Inclusive': 'AI',
};

interface Props {
  hotel: Hotel; nights: number; rooms: number; adults: number; children: number;
  onCreateQuote: () => void;
}

/**
 * Front display price for a room type.
 * Priority:
 *  1. rt.sellRate — per-night average (computed server-side via getFrontDisplayPrice)
 *  2. Fallback to sellRate1/2/3 when no date range was searched
 */
function getRoomDisplayRate(rt: RoomType, adults: number, children: number): number | undefined {
  // Use server-computed per-night average when available (dates were searched)
  if (rt.sellRate != null) return rt.sellRate;
  // Fallback: derive from per-occupancy rates (no date range)
  const base = adults <= 1 ? rt.sellRate1 : adults === 2 ? rt.sellRate2 : rt.sellRate3;
  if (base == null) return undefined;
  const childAdd = children > 0 && rt.childSupplementSell != null ? rt.childSupplementSell * children : 0;
  return Math.round(base + childAdd);
}

function AvailBadge({ status }: { status?: string }) {
  if (!status || status === 'Free Sale') return null;
  const color = status === 'Stop Sale' ? 'bg-red-100 text-red-700' : status === 'On Request' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700';
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>{status}</span>;
}

function RateRow({ rt, nights, rooms, adults, children }: { rt: RoomType; nights: number; rooms: number; adults: number; children: number }) {
  if (rt.onRequestOnly) return <span className="text-xs text-orange-500 font-medium">On Request</span>;
  const ratePerNight = getRoomDisplayRate(rt, adults, children);
  if (ratePerNight == null) return <span className="text-xs text-muted-foreground">No rate</span>;
  const total = nights > 0 ? ratePerNight * nights * rooms : null;
  return (
    <div className="text-right">
      <p className="text-xs font-bold text-primary">AED {Math.round(ratePerNight).toLocaleString()}<span className="font-normal text-muted-foreground">/night</span></p>
      {total != null && nights > 0 && <p className="text-xs font-semibold text-foreground">= AED {Math.round(total).toLocaleString()}</p>}
    </div>
  );
}

export default function HotelSearchCard({ hotel, nights, rooms, adults, children, onCreateQuote }: Props) {
  // Front display price: lowest per-night average among all eligible room types
  const rates = hotel.roomTypes.map(rt => getRoomDisplayRate(rt, adults, children)).filter((r): r is number => r != null);
  const minRate = rates.length > 0 ? Math.min(...rates) : null;
  const totalMin = minRate != null && nights > 0 ? minRate * nights * rooms : null;

  // Overall availability: worst-case across room types
  const allStatuses = hotel.roomTypes.map(rt => rt.availabilityStatus ?? 'Free Sale');
  const overallStatus = allStatuses.includes('Stop Sale') ? 'Stop Sale'
    : allStatuses.includes('On Request') ? 'On Request'
    : allStatuses.includes('Limited') ? 'Limited'
    : 'Free Sale';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground truncate">{hotel.hotelName}</h3>
              {hotel.hotelCode && <Badge variant="secondary" className="font-mono text-[10px] shrink-0">{hotel.hotelCode}</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {hotel.emirate && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{hotel.emirate}</span>}
              {hotel.location && <span className="text-xs text-muted-foreground">· {hotel.location}</span>}
              {hotel.starRating && (
                <span className={`flex items-center gap-0.5 text-xs font-semibold ${STAR_COLORS[hotel.starRating] || ''}`}>
                  <Star className="w-3 h-3 fill-current" />{hotel.starRating}
                </span>
              )}
              <AvailBadge status={overallStatus} />
            </div>
          </div>
          {minRate != null && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                {nights > 0 ? <><CalendarDays className="w-3 h-3" />{nights}n avg/night</> : 'from / night'}
              </p>
              <p className="text-base font-bold text-primary">AED {Math.round(minRate).toLocaleString()}</p>
              {totalMin != null && nights > 0 && <p className="text-xs font-semibold text-foreground">Total: AED {Math.round(totalMin).toLocaleString()}</p>}
            </div>
          )}
        </div>

        {hotel.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{hotel.description}</p>}

        <div className="space-y-1.5 mb-4">
          {hotel.roomTypes.slice(0, 3).map(rt => (
            <div key={rt.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <BedDouble className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium truncate">{rt.roomTypeName}</span>
                {rt.mealPlan && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{MEAL_ABBR[rt.mealPlan] || rt.mealPlan}</Badge>}
                {rt.maxAdults && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0"><Users className="w-2.5 h-2.5" />{rt.maxAdults}</span>}
                <AvailBadge status={rt.availabilityStatus} />
              </div>
              <RateRow rt={rt} nights={nights} rooms={rooms} adults={adults} children={children} />
            </div>
          ))}
          {hotel.roomTypes.length > 3 && <p className="text-xs text-muted-foreground text-center">+{hotel.roomTypes.length - 3} more room types</p>}
        </div>

        <Button size="sm" className="w-full gap-2" onClick={onCreateQuote}>
          <FileText className="w-4 h-4" /> Create Quote / Booking
        </Button>
      </CardContent>
    </Card>
  );
}
