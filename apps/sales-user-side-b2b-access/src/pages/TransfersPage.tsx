import { useEffect, useMemo, useState } from 'react';
import {format} from 'date-fns';
import { getTransferData, GetTransferDataOutputType } from 'zitejs/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Skeleton } from '@project/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Button } from '@project/components/ui/button';
import {
  AlertCircle,
  ArrowLeftRight,
  Car,
  Clock3,
  Luggage,
  MapPin,
  Search,
  Users,
} from 'lucide-react';
import SalesHeader from '@/components/sales/SalesHeader';
import TransferTypeSelector from '@/components/transfers/TransferTypeSelector';
import TransferDatePicker from '@/components/transfers/TransferDatePicker';
import VehicleCard from '@/components/transfers/VehicleCard';
import TransferBookingForm from '@/components/transfers/TransferBookingForm';

type Zone = GetTransferDataOutputType['zones'][0];
type Rate = GetTransferDataOutputType['rates'][0];

interface Props { onLogout: () => void; }

export default function TransfersPage({ onLogout }: Props) {
  const [transferType, setTransferType] = useState('ARRIVAL');
  const [originId, setOriginId] = useState('');
  const [destId, setDestId] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('10:00');
  const [pax, setPax] = useState(2);
  const [luggage, setLuggage] = useState(2);

  const [data, setData] = useState<GetTransferDataOutputType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setPickupDate(format(d,'yyyy-MM-dd'));
  }, []);

  const loadData = () => {
    setLoading(true);
    setError(null);
    getTransferData({
      originZoneId: originId || undefined,
      destinationZoneId: destId || undefined,
      pax,
      luggage,
    })
      .then(setData)
      .catch(() => setError('Unable to load transfer inventory. Please retry.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [originId, destId, pax, luggage]);

  const isNight = useMemo(() => {
    const hour = parseInt(pickupTime.split(':')[0], 10);
    return hour >= 23 || hour < 6;
  }, [pickupTime]);

  const zonesByType = useMemo(() => {
    if (!data) return { airports: [] as Zone[], nonAirports: [] as Zone[] };
    return {
      airports: data.zones.filter(z => z.type.toLowerCase() === 'airport'),
      nonAirports: data.zones.filter(z => z.type.toLowerCase() !== 'airport'),
    };
  }, [data]);

  const originOptions = useMemo(() => {
    if (!data) return [] as Zone[];
    if (transferType === 'ARRIVAL') return zonesByType.airports;
    if (transferType === 'DEPARTURE') return zonesByType.nonAirports;
    return data.zones;
  }, [data, transferType, zonesByType]);

  const destinationOptions = useMemo(() => {
    if (!data) return [] as Zone[];
    if (transferType === 'ARRIVAL') return zonesByType.nonAirports;
    if (transferType === 'DEPARTURE') return zonesByType.airports;
    return data.zones;
  }, [data, transferType, zonesByType]);

  const originZone = data?.zones.find(z => z.id === originId);
  const destZone = data?.zones.find(z => z.id === destId);

  const matchedRates = useMemo(() => {
    const map = new Map<string, Rate>();
    if (!data || !originId || !destId) return map;
    data.rates.forEach(rate => {
      if (rate.originZoneId === originId && rate.destinationZoneId === destId) {
        map.set(rate.vehicleCategoryId, rate);
      }
    });
    return map;
  }, [data, originId, destId]);

  const availableVehicles = useMemo(
    () => (data?.vehicles || []).filter(vehicle => matchedRates.has(vehicle.id)),
    [data, matchedRates],
  );

  const selectedRate = selectedVehicleId ? matchedRates.get(selectedVehicleId) : undefined;
  const selectedVehicle = data?.vehicles.find(vehicle => vehicle.id === selectedVehicleId);

  const waitingGraceMinutes = useMemo(() => {
    if (!originZone || !destZone) return 0;
    if (originZone.type.toLowerCase() === 'airport') return originZone.waitingGrace;
    if (destZone.type.toLowerCase() === 'airport') return destZone.waitingGrace;
    return Math.max(originZone.waitingGrace, destZone.waitingGrace);
  }, [originZone, destZone]);

  const changeType = (value: string) => {
    setTransferType(value);
    setOriginId('');
    setDestId('');
    setSelectedVehicleId('');
    setHasSearched(false);
    setSearchError(null);
  };

  const swapZones = () => {
    if (transferType === 'ARRIVAL' || transferType === 'DEPARTURE') return;
    setOriginId(destId);
    setDestId(originId);
    setSelectedVehicleId('');
    setHasSearched(false);
  };

  const validateSearch = () => {
    if (!originZone || !destZone) return 'Select both pickup and dropoff locations.';
    if (originZone.id === destZone.id) return 'Pickup and dropoff locations must be different.';
    if (!pickupDate || !pickupTime) return 'Select a pickup date and time.';
    const pickup = new Date(`${pickupDate}T${pickupTime}:00+04:00`);
    if (Number.isNaN(pickup.getTime()) || pickup.getTime() <= Date.now()) return 'Pickup date and time must be in the future.';
    if (transferType === 'POINT_TO_POINT' && originZone.emirate !== destZone.emirate) return 'Point-to-point transfers must remain within the same Emirate. Choose Intercity instead.';
    if (transferType === 'INTERCITY' && originZone.emirate === destZone.emirate) return 'Intercity transfers must travel between different Emirates.';
    return null;
  };

  const searchTransfers = () => {
    const issue = validateSearch();
    setSearchError(issue);
    if (issue) {
      setHasSearched(false);
      return;
    }
    setSelectedVehicleId('');
    setHasSearched(true);
  };

  const zoneSelectItems = (zones: Zone[]) => {
    const airport = zones.filter(z => z.type.toLowerCase() === 'airport');
    const other = zones.filter(z => z.type.toLowerCase() !== 'airport');
    return (
      <>
        {airport.length > 0 && (
          <>
            <p className="px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Airports</p>
            {airport.map(z => <SelectItem key={z.id} value={z.id}>{z.name} · {z.emirate}</SelectItem>)}
          </>
        )}
        {other.length > 0 && (
          <>
            <p className="px-2 py-1 mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Hotels, areas &amp; ports</p>
            {other.map(z => <SelectItem key={z.id} value={z.id}>{z.name} · {z.emirate}</SelectItem>)}
          </>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <SalesHeader onLogout={onLogout} hotelCount={0} />

      <section className="relative bg-primary text-white">
        <div className="relative container mx-auto max-w-6xl px-4 py-6 md:py-8">
          <h1 className="sr-only">Transfer search</h1>
          <div className="rounded-xl bg-amber-400 text-foreground shadow-xl p-1.5">
            <div className="rounded-lg bg-white p-3 md:p-4">
            <TransferTypeSelector value={transferType} onChange={changeType} />

            <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-1.5 items-end">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Pickup</Label>
                <Select value={originId} onValueChange={value => { setOriginId(value); setHasSearched(false); }}>
                  <SelectTrigger className="mt-1 h-11 rounded-lg bg-white shadow-none border-border/60"><SelectValue placeholder="Airport, hotel or zone" /></SelectTrigger>
                  <SelectContent>{zoneSelectItems(originOptions)}</SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden md:inline-flex mb-0.5"
                disabled={transferType === 'ARRIVAL' || transferType === 'DEPARTURE' || (!originId && !destId)}
                onClick={swapZones}
                aria-label="Swap pickup and dropoff"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </Button>

              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Dropoff</Label>
                <Select value={destId} onValueChange={value => { setDestId(value); setHasSearched(false); }}>
                  <SelectTrigger className="mt-1 h-11 rounded-lg bg-white shadow-none border-border/60"><SelectValue placeholder="Airport, hotel or zone" /></SelectTrigger>
                  <SelectContent>{zoneSelectItems(destinationOptions)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-1.5">
              <div>
                <Label className="text-[11px] text-muted-foreground">Pickup date</Label>
                <TransferDatePicker value={pickupDate} onChange={date => { setPickupDate(date); setHasSearched(false); setSearchError(null); }} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Pickup time</Label>
                <Input type="time" value={pickupTime} onChange={e => { setPickupTime(e.target.value); setHasSearched(false); }} className="mt-1 h-11 rounded-lg bg-white shadow-none border-border/60" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Passengers</Label>
                <div className="relative mt-1">
                  <Users className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input type="number" min={1} max={50} value={pax} onChange={e => { setPax(parseInt(e.target.value) || 1); setHasSearched(false); }} className="h-11 pl-9 rounded-lg bg-white shadow-none border-border/60" />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Luggage</Label>
                <div className="relative mt-1">
                  <Luggage className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input type="number" min={0} max={30} value={luggage} onChange={e => { setLuggage(Math.max(0, parseInt(e.target.value) || 0)); setHasSearched(false); }} className="h-11 pl-9 rounded-lg bg-white shadow-none border-border/60" />
                </div>
              </div>
              <div className="col-span-2 md:col-span-1 flex items-end">
                <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold gap-2" onClick={searchTransfers} disabled={loading}>
                  <Search className="w-4 h-4" /> Search transfers
                </Button>
              </div>
            </div>

            {isNight && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Clock3 className="w-4 h-4" /> Night pricing applies between 23:00 and 06:00 and is included in the fare shown.
              </div>
            )}
            {searchError && <p role="alert" className="mt-3 text-xs font-semibold text-destructive">{searchError}</p>}
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto max-w-6xl px-4 py-7">
        {error && (
          <div className="flex items-center justify-between text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>
            <button onClick={loadData} className="text-xs font-semibold underline hover:no-underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
          </div>
        ) : !hasSearched ? (
          <div className="rounded-2xl border border-border bg-white py-16 text-center text-muted-foreground">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-bold text-foreground">Build your transfer search</p>
            <p className="text-sm mt-1">Choose route, date, time and occupancy to see contracted B2B vehicle rates.</p>
          </div>
        ) : availableVehicles.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white py-16 text-center text-muted-foreground">
            <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-bold text-foreground">No contracted rate for this route</p>
            <p className="text-sm mt-1">Try another route, passenger count or luggage requirement. Unpriced inventory fails closed.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] font-black text-primary">Available private transfers</p>
                <h2 className="text-2xl font-black mt-1">{originZone?.name} → {destZone?.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{pickupDate} · {pickupTime} · {pax} passenger(s) · {luggage} bag(s)</p>
              </div>
              <div className="text-xs text-muted-foreground">{availableVehicles.length} sellable option{availableVehicles.length === 1 ? '' : 's'} · AED</div>
            </div>

            <div className="space-y-3">
              {availableVehicles.map((vehicle, index) => {
                const rate = matchedRates.get(vehicle.id)!;
                return (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    routeLabel={rate.routeLabel}
                    price={rate.sellingPrice}
                    midnightSurcharge={rate.midnightSurcharge}
                    tollsIncluded={rate.tollsIncluded}
                    waitingGraceMinutes={waitingGraceMinutes}
                    isNight={isNight}
                    selected={selectedVehicleId === vehicle.id}
                    recommended={index === 0}
                    onSelect={() => {
                      setSelectedVehicleId(vehicle.id);
                      setBookingOpen(true);
                    }}
                  />
                );
              })}
            </div>

            <div className="mt-5 rounded-xl bg-white border border-border p-3 text-[11px] text-muted-foreground">
              Vehicle models are representative of the selected category. Final fare, route, capacity, night surcharge and active rate are revalidated before confirmation.
            </div>
          </>
        )}
      </main>

      <Sheet open={bookingOpen} onOpenChange={setBookingOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review &amp; confirm transfer</SheetTitle>
          </SheetHeader>
          {selectedRate && selectedVehicle && (
            <div className="mt-4">
              <TransferBookingForm
                transferType={transferType}
                rateId={selectedRate.id}
                pickupDate={pickupDate}
                pickupTime={pickupTime}
                originZoneName={originZone?.name || ''}
                destZoneName={destZone?.name || ''}
                vehicleName={selectedVehicle.name}
                initialPax={pax}
                initialLuggage={luggage}
                onSuccess={() => {}}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
