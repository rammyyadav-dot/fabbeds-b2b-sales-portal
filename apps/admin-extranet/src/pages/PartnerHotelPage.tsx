import { useEffect, useRef, useState } from 'react';
import {
  getHotels, getRoomTypes, getSeasons, getMealPlanSupplements,
  getBlackoutDates, saveRoomType, deleteRoomType,
  saveMealPlanSupplement, deleteMealPlanSupplement,
  saveBlackoutDate, deleteBlackoutDate,
  getRatePlans, getPromotions, deletePromotion,
  GetHotelsOutputType, GetRoomTypesOutputType, GetSeasonsOutputType,
  GetMealPlanSupplementsOutputType, GetBlackoutDatesOutputType, GetRatePlansOutputType, GetPromotionsOutputType,
} from 'zitejs/api';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';
import { Button } from '@project/components/ui/button';
import { Card, CardContent } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import RoomTypeFormDialog from '@/components/RoomTypeFormDialog';
import RateGridTab from '@/components/RateGridTab';
import MealPlanTab from '@/components/MealPlanTab';
import RoomAvailabilityCalendar from '@/components/RoomAvailabilityCalendar';
import HotelProfileTab from '@/components/HotelProfileTab';
import BlackoutDatesTab from '@/components/BlackoutDatesTab';
import OccupancyRateGrid from '@/components/OccupancyRateGrid';
import RatePlansTab from '@/components/RatePlansTab';
import EventMasterTab from '@/components/EventMasterTab';
import RoomAllocationTab from '@/components/RoomAllocationTab';
import PromotionsTab from '@/components/PromotionsTab';
import { Plus, Edit2, Trash2, Star, MapPin, Lock, Hotel, RefreshCw, Wifi } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type HotelType = GetHotelsOutputType['hotels'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];
type Season = GetSeasonsOutputType['seasons'][0];
type Supplement = GetMealPlanSupplementsOutputType['supplements'][0];
type BlackoutDate = GetBlackoutDatesOutputType['blackoutDates'][0];
type RatePlan = GetRatePlansOutputType['ratePlans'][0];

const TAB_CLASS = 'font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md';

export default function PartnerHotelPage() {
  const { user } = usePartnerAuth();
  const hotelId = user?.hotelId;

  const [hotel, setHotel] = useState<HotelType | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [promotions, setPromotions] = useState<GetPromotionsOutputType['promotions']>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [rtFormOpen, setRtFormOpen] = useState(false);
  const [editRt, setEditRt] = useState<RoomType | null>(null);
  const [deleteRtId, setDeleteRtId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (silent = false) => {
    if (!hotelId) return;
    if (!silent) setLoading(true); else setSyncing(true);
    try {
      const [hotelsRes, rtRes, seasonsRes, suppRes, blackoutRes, ratePlansRes, promoRes] = await Promise.all([
        getHotels({}), getRoomTypes({ hotelId }), getSeasons({}),
        getMealPlanSupplements({ hotelId }),
        getBlackoutDates({ hotelId }),
        getRatePlans({ hotelId }),
        getPromotions({ hotelId }),
      ]);
      setHotel(hotelsRes.hotels.find(h => h.id === hotelId) || null);
      setRoomTypes(rtRes.roomTypes);
      setSeasons(seasonsRes.seasons);
      setSupplements(suppRes.supplements);
      setBlackoutDates(blackoutRes.blackoutDates);
      setRatePlans(ratePlansRes.ratePlans);
      setPromotions(promoRes.promotions);
      setLastSynced(new Date());
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  // Initial load + auto-poll every 30s
  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hotelId]);

  const handleSaveRt = async (data: any) => {
    setSaving(true);
    try { await saveRoomType(data); toast.success(data.id ? 'Updated' : 'Added'); setRtFormOpen(false); setEditRt(null); load(true); }
    catch (e: any) { toast.error(e?.message || 'Failed to save room type'); }
    finally { setSaving(false); }
  };

  const handleSaveSupplement = async (data: any) => {
    setSaving(true);
    try { await saveMealPlanSupplement(data); toast.success('Supplement saved'); load(true); }
    catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDeleteSupplement = async (id: string) => {
    try { await deleteMealPlanSupplement({ id }); toast.success('Deleted'); load(true); }
    catch { toast.error('Failed to delete'); }
  };

  const handleSaveBlackout = async (data: any) => {
    setSaving(true);
    try { await saveBlackoutDate(data); toast.success(data.id ? 'Updated' : 'Added'); load(true); }
    catch { toast.error('Failed to save blackout date'); }
    finally { setSaving(false); }
  };

  const handleDeleteBlackout = async (id: string) => {
    try { await deleteBlackoutDate({ id }); toast.success('Deleted'); load(true); }
    catch { toast.error('Failed to delete'); }
  };

  if (!hotelId) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">No Hotel Assigned</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Your account has not been linked to a hotel yet. Please contact your TMS administrator to assign your property.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        <Hotel className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Hotel not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header — hotel name is fixed/read-only */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">{hotel.hotelName}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
            {hotel.emirate && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{hotel.emirate}</span>}
            {hotel.starRating && <span className="flex items-center gap-1"><Star className="w-3 h-3" />{hotel.starRating}</span>}
            <Badge variant={hotel.status === 'Active' ? 'default' : 'secondary'}>{hotel.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Live sync status */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg border border-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Wifi className="w-3 h-3 text-emerald-500" />
            <span className="font-medium text-emerald-600">Live</span>
            {lastSynced && <span className="text-muted-foreground">· {format(lastSynced, 'HH:mm:ss')}</span>}
          </div>
          <Button size="sm" variant="outline" onClick={() => load(true)} disabled={syncing} className="gap-1.5 h-8 text-xs">
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
          <Badge variant="outline" className="flex items-center gap-1.5 text-xs shrink-0">
            <Lock className="w-3 h-3" /> Property fixed by admin
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto gap-1 p-1.5 bg-muted/60 border border-border rounded-xl">
          <TabsTrigger value="profile" className={TAB_CLASS}>Hotel Setup</TabsTrigger>
          <TabsTrigger value="room-types" className={TAB_CLASS}>Room Types ({roomTypes.length})</TabsTrigger>
          <TabsTrigger value="rate-plans" className={TAB_CLASS}>Rate Plans ({ratePlans.length})</TabsTrigger>
          <TabsTrigger value="promotions" className={TAB_CLASS}>Deals & Promos ({promotions.length})</TabsTrigger>
          <TabsTrigger value="rate-grid" className={TAB_CLASS}>Rate Grid</TabsTrigger>
          <TabsTrigger value="event-master" className={TAB_CLASS}>Event Master</TabsTrigger>
          <TabsTrigger value="meal-plans" className={TAB_CLASS}>Meal Plans</TabsTrigger>
          <TabsTrigger value="blackout" className={TAB_CLASS}>Blackout Dates</TabsTrigger>
          <TabsTrigger value="allocation" className={TAB_CLASS}>Allocation Mgmt</TabsTrigger>
          <TabsTrigger value="allotment" className={TAB_CLASS}>Room Availability</TabsTrigger>
          <TabsTrigger value="rate-calendar" className={TAB_CLASS}>Rate Calendar</TabsTrigger>
        </TabsList>

        {/* Hotel Setup — READ ONLY for partners */}
        <TabsContent value="profile" className="mt-4">
          <HotelProfileTab hotel={hotel} onSave={async () => {}} saving={false} readOnly />
        </TabsContent>

        {/* Room Types */}
        <TabsContent value="room-types" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">Manage room types for this hotel</p>
            <Button size="sm" onClick={() => { setEditRt(null); setRtFormOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Add Room Type
            </Button>
          </div>
          {roomTypes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <p className="font-medium">No room types yet</p>
              <p className="text-sm">Add room types to start entering rates</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roomTypes.map(rt => (
                <Card key={rt.id} className={rt.sellEnabled === false ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-semibold text-sm">{rt.roomTypeName}</h4>
                          {rt.sellEnabled === false && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                          {rt.onRequestOnly && <Badge variant="secondary" className="text-xs">On Request</Badge>}
                        </div>
                        {rt.internalCode && <p className="text-xs text-muted-foreground font-mono">{rt.internalCode}</p>}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rt.mealPlan && <Badge variant="outline" className="text-xs">{rt.mealPlan}</Badge>}
                          {rt.beddingType && <Badge variant="outline" className="text-xs">{rt.beddingType}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                          {rt.maxOccupancy && <p>Max {rt.maxOccupancy} guests ({rt.maxAdults ?? '?'} adults, {rt.maxChildren ?? '?'} children)</p>}
                          {rt.childAllowed && rt.childAgeFrom != null && <p>Children: {rt.childAgeFrom}–{rt.childAgeTo} yrs</p>}
                          {rt.views && <p>View: {rt.views}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditRt(rt); setRtFormOpen(true); }}><Edit2 className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteRtId(rt.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rate-plans" className="mt-4">
          <RatePlansTab hotelId={hotelId} ratePlans={ratePlans} roomTypes={roomTypes} onRefresh={load} />
        </TabsContent>

        <TabsContent value="promotions" className="mt-4">
          <PromotionsTab
            hotelId={hotelId}
            promotions={promotions}
            onRefresh={load}
            onDelete={async (pid) => { await deletePromotion({ id: pid }); toast.success('Promotion deleted'); load(true); }}
          />
        </TabsContent>

        <TabsContent value="rate-grid" className="mt-4">
          <RateGridTab hotelId={hotelId} roomTypes={roomTypes} />
        </TabsContent>

        <TabsContent value="event-master" className="mt-4">
          <EventMasterTab hotelId={hotelId} />
        </TabsContent>

        <TabsContent value="meal-plans" className="mt-4">
          <MealPlanTab
            hotelId={hotelId} supplements={supplements} seasons={seasons}
            onSave={handleSaveSupplement} onDelete={handleDeleteSupplement} saving={saving}
          />
        </TabsContent>

        <TabsContent value="blackout" className="mt-4">
          <BlackoutDatesTab
            hotelId={hotelId}
            blackoutDates={blackoutDates}
            roomTypes={roomTypes}
            onSave={handleSaveBlackout}
            onDelete={handleDeleteBlackout}
            saving={saving}
          />
        </TabsContent>

        <TabsContent value="allocation" className="mt-4">
          <RoomAllocationTab hotelId={hotelId} />
        </TabsContent>

        <TabsContent value="allotment" className="mt-4">
          <RoomAvailabilityCalendar hotelId={hotelId} />
        </TabsContent>

        <TabsContent value="rate-calendar" className="mt-4">
          {roomTypes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <p className="font-medium">No room types yet</p>
              <p className="text-sm">Add room types first to use the Rate Calendar</p>
            </div>
          ) : (
            <div className="space-y-6">
              {roomTypes.map(rt => (
                <OccupancyRateGrid key={rt.id} roomType={rt} hotelId={hotelId} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RoomTypeFormDialog
        open={rtFormOpen}
        roomType={editRt}
        hotelId={hotelId}
        onClose={() => { setRtFormOpen(false); setEditRt(null); }}
        onSave={handleSaveRt}
        loading={saving}
      />

      <AlertDialog open={!!deleteRtId} onOpenChange={() => setDeleteRtId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room Type?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this room type and all associated data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { await deleteRoomType({ id: deleteRtId! }); setDeleteRtId(null); load(true); toast.success('Deleted'); }}
              className="bg-destructive text-destructive-foreground"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
