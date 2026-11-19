import { useEffect, useState, useMemo } from 'react';
import { searchHotels, SearchHotelsOutputType } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Building2, Star, Users, BedDouble, Minus, Plus } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import HotelSearchCard from '@/components/HotelSearchCard';
import BookingQuoteDialog from '@/components/BookingQuoteDialog';
import DateRangePicker from '@/components/DateRangePicker';

type Hotel = SearchHotelsOutputType['hotels'][0];

function Counter({ label, value, onChange, min = 0, max = 10 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1 h-9 border border-border rounded-md px-2 bg-background">
        <button onClick={() => onChange(Math.max(min, value - 1))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"><Minus className="w-3 h-3" /></button>
        <span className="flex-1 text-center text-sm font-medium">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"><Plus className="w-3 h-3" /></button>
      </div>
    </div>
  );
}

export default function SalesDashboardPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const [hotelName, setHotelName] = useState('');
  const [area, setArea] = useState('');
  const [starRating, setStarRating] = useState('');
  const [mealPlan, setMealPlan] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');

  const nights = useMemo(() => {
    if (!checkin || !checkout) return 0;
    const n = Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000);
    return n > 0 ? n : 0;
  }, [checkin, checkout]);

  const doSearch = useDebouncedCallback(async () => {
    setLoading(true);
    try {
      const res = await searchHotels({
        hotelName: hotelName || undefined,
        area: area || undefined,
        starRating: starRating && starRating !== 'any' ? starRating : undefined,
        mealPlan: mealPlan && mealPlan !== 'any' ? mealPlan : undefined,
        adults: adults > 0 ? adults : undefined,
        children: children > 0 ? children : undefined,
        rooms: rooms > 0 ? rooms : undefined,
        checkinDate: checkin || undefined,
        checkoutDate: checkout || undefined,
      });
      setHotels(res.hotels);
    } finally { setLoading(false); }
  }, 400);

  useEffect(() => { doSearch(); }, [hotelName, area, starRating, mealPlan, adults, children, rooms, checkin, checkout]);

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
          <Building2 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Accommodation Search</h1>
          <p className="text-xs text-muted-foreground">Search hotels with live sell rates</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Row 1: Hotel name, Area, Star, Meal Plan */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Hotel Name</Label>
              <Input placeholder="Search hotel..." className="h-9 text-sm" value={hotelName} onChange={e => setHotelName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Area / Emirate</Label>
              <Input placeholder="Dubai, Abu Dhabi..." className="h-9 text-sm" value={area} onChange={e => setArea(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Star Rating</Label>
              <Select value={starRating} onValueChange={setStarRating}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="3 Star">3 Star</SelectItem>
                  <SelectItem value="4 Star">4 Star</SelectItem>
                  <SelectItem value="5 Star">5 Star</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Meal Plan</Label>
              <Select value={mealPlan} onValueChange={setMealPlan}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="Room Only">Room Only</SelectItem>
                  <SelectItem value="Bed & Breakfast">Bed & Breakfast</SelectItem>
                  <SelectItem value="Half Board">Half Board</SelectItem>
                  <SelectItem value="Full Board">Full Board</SelectItem>
                  <SelectItem value="All Inclusive">All Inclusive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Row 2: Date picker + pax counters */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Check-in → Check-out</Label>
              <DateRangePicker checkin={checkin} checkout={checkout} onCheckinChange={setCheckin} onCheckoutChange={setCheckout} />
            </div>
            <Counter label="Adults" value={adults} onChange={setAdults} min={1} max={10} />
            <Counter label="Children" value={children} onChange={setChildren} min={0} max={6} />
            <Counter label="Rooms" value={rooms} onChange={setRooms} min={1} max={10} />
          </div>
          {nights > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <BedDouble className="w-3.5 h-3.5 text-primary" />
              <span><strong className="text-foreground">{nights} night{nights !== 1 ? 's' : ''}</strong> · <strong className="text-foreground">{adults}</strong> adult{adults !== 1 ? 's' : ''}{children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''} · <strong className="text-foreground">{rooms}</strong> room{rooms !== 1 ? 's' : ''}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && (
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1"><Building2 className="w-3 h-3" /> {hotels.length} Hotels</Badge>
          <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1"><Star className="w-3 h-3" /> {hotels.reduce((s, h) => s + h.roomTypes.length, 0)} Room Types</Badge>
          {nights > 0 && <Badge className="gap-1.5 text-xs px-3 py-1 bg-primary">{nights} Nights · {rooms} Room{rooms > 1 ? 's' : ''}</Badge>}
          {adults > 0 && <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1"><Users className="w-3 h-3" /> {adults}A{children > 0 ? ` + ${children}C` : ''}</Badge>}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : hotels.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No hotels match your criteria</p>
          <p className="text-sm mt-1">Try adjusting your search filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hotels.map(h => (
            <HotelSearchCard key={h.id} hotel={h} nights={nights} rooms={rooms} adults={adults} children={children}
              onCreateQuote={() => { setSelectedHotel(h); setQuoteOpen(true); }} />
          ))}
        </div>
      )}

      {selectedHotel && quoteOpen && (
        <BookingQuoteDialog hotel={selectedHotel} nights={nights} rooms={rooms} adults={adults} children={children}
          checkin={checkin} checkout={checkout}
          onClose={() => { setQuoteOpen(false); setSelectedHotel(null); }} />
      )}
    </div>
  );
}
