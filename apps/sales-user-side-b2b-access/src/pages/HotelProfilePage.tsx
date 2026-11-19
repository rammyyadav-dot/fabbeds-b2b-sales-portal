import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getHotelProfile, GetHotelProfileOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertCircle, ArrowLeft, CalendarCheck } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import SalesHeader from '@/components/sales/SalesHeader';
import HotelProfileHeader from '@/components/sales/HotelProfileHeader';
import RateCalendar from '@/components/sales/RateCalendar';
import type { AvailabilitySearchParams } from '@/components/sales/RateCalendar';

interface Props { onLogout: () => void; }

function ProfileSkeleton() {
  return (
    <div className="mt-4 space-y-4">
      <Skeleton className="h-52 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

export default function HotelProfilePage({ onLogout }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<GetHotelProfileOutputType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const adults = parseInt(searchParams.get('adults') || '2');
  const children = parseInt(searchParams.get('children') || '0');
  const rooms = parseInt(searchParams.get('rooms') || '1');
  const checkIn = searchParams.get('checkIn') || '';
  const checkOut = searchParams.get('checkOut') || '';
  const childAgesRaw = searchParams.get('childAges') || '';
  const childAges = childAgesRaw ? childAgesRaw.split(',').map(Number).filter(n => !isNaN(n)) : [];
  const roomConfigsRaw = searchParams.get('roomConfigs') || '';
  const roomConfigs = (() => {
    if (!roomConfigsRaw) return [];
    try {
      const parsed = JSON.parse(decodeURIComponent(roomConfigsRaw));
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  })();
  const nationality = (searchParams.get('nationality') || 'IN').toUpperCase();
  const extraMarkupPct = Math.min(50, Math.max(0, Number(searchParams.get('extraMarkupPct') || 0) || 0));

  // nights = 0 means no dates selected — RateCalendar shows per-night pricing in that case
  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut + 'T00:00:00').getTime() - new Date(checkIn + 'T00:00:00').getTime()) / 86400000))
    : 0;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getHotelProfile({
      hotelId: id, adults, children, rooms,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      childAges: childAges.length > 0 ? childAges : undefined,
      nationality,
      extraMarkupPct,
    })
      .then(setData)
      .catch(() => setError('Failed to load hotel profile. Please try again.'))
      .finally(() => setLoading(false));
  }, [id, adults, children, rooms, checkIn, checkOut, childAgesRaw, nationality, extraMarkupPct]);

  const hasCompleteRate = useMemo(() => {
    if (!data || !checkIn || !checkOut || nights <= 0) return false;
    const dates: string[] = [];
    const day = new Date(checkIn + 'T00:00:00Z');
    for (let i = 0; i < nights; i++) {
      dates.push(day.toISOString().slice(0, 10));
      day.setUTCDate(day.getUTCDate() + 1);
    }
    const plans = new Map<string, Set<string>>();
    for (const rate of data.dailyRates) {
      if (rate.status === 'Stop Sale' || rate.displayRate <= 0) continue;
      const key = `${rate.roomTypeId}|${rate.ratePlanId}`;
      const covered = plans.get(key) ?? new Set<string>();
      covered.add(rate.date);
      plans.set(key, covered);
    }
    return [...plans.values()].some(covered => dates.every(date => covered.has(date)));
  }, [data, checkIn, checkOut, nights]);

  const handleRequestBooking = (roomTypeId?: string, qty?: number, ratePlanId?: string) => {
    const params = new URLSearchParams({
      checkIn, checkOut,
      adults: String(adults),
      children: String(children),
      rooms: String(qty ?? rooms),
      nationality,
      ...(roomConfigs.length ? { roomConfigs: encodeURIComponent(JSON.stringify(roomConfigs)) } : {}),
      ...(extraMarkupPct > 0 ? { extraMarkupPct: String(extraMarkupPct) } : {}),
    });
    if (roomTypeId) params.set('roomTypeId', roomTypeId);
    if (ratePlanId) params.set('ratePlanId', ratePlanId);
    navigate(`/hotel/${id}/checkout?${params}`);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />
      <main className="container mx-auto px-4 py-6 pb-28 max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" /> Back to Search
          </Button>
          {data && hasCompleteRate && (
            <Button size="sm" className="gap-2" onClick={() => handleRequestBooking()}>
              <CalendarCheck className="w-4 h-4" /> Request Booking
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <ProfileSkeleton />
        ) : data ? (
          <div className="mt-2 space-y-5">
            <HotelProfileHeader hotel={data.hotel} />
            <RateCalendar
              roomTypes={data.roomTypes}
              dailyRates={data.dailyRates}
              adults={adults}
              children={children}
              rooms={rooms}
              nights={nights}
              checkIn={checkIn || undefined}
              checkOut={checkOut || undefined}
              onRequest={(roomTypeId, qty, ratePlanId) => handleRequestBooking(roomTypeId, qty, ratePlanId)}
              childAges={childAges}
              onChangeSearch={(p: AvailabilitySearchParams) => setSearchParams({
                checkIn: p.checkIn, checkOut: p.checkOut,
                adults: String(p.adults), children: String(p.children), rooms: String(p.rooms),
                nationality,
                ...(extraMarkupPct > 0 ? { extraMarkupPct: String(extraMarkupPct) } : {}),
                ...(p.childAges.length > 0 ? { childAges: p.childAges.join(',') } : {}),
              })}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
