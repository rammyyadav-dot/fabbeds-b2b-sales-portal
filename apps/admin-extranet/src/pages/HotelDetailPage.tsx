import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getHotels, getRoomTypes, getSeasons, getMealPlanSupplements,
  getBlackoutDates, saveHotel,
  saveRoomType, deleteRoomType,
  saveMealPlanSupplement, deleteMealPlanSupplement,
  saveBlackoutDate, deleteBlackoutDate,
  getRatePlans, getPromotions, deletePromotion,
  GetHotelsOutputType, GetRoomTypesOutputType, GetSeasonsOutputType,
  GetMealPlanSupplementsOutputType, GetBlackoutDatesOutputType, GetRatePlansOutputType, GetPromotionsOutputType,
} from 'zitejs/api';
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
import PropertyReadinessStrip from '@/components/PropertyReadinessStrip';
import CommercialIntegrityPanel from '@/components/CommercialIntegrityPanel';
import { ArrowLeft, Plus, Edit2, Trash2, Star, MapPin } from 'lucide-react';
import { toast } from 'sonner';

type Hotel = GetHotelsOutputType['hotels'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];
type Season = GetSeasonsOutputType['seasons'][0];
type Supplement = GetMealPlanSupplementsOutputType['supplements'][0];
type BlackoutDate = GetBlackoutDatesOutputType['blackoutDates'][0];
type RatePlan = GetRatePlansOutputType['ratePlans'][0];

export default function HotelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [promotions, setPromotions] = useState<GetPromotionsOutputType['promotions']>([]);
  const [loading, setLoading] = useState(true);
  const [rtFormOpen, setRtFormOpen] = useState(false);
  const [editRt, setEditRt] = useState<RoomType | null>(null);
  const [deleteRtId, setDeleteRtId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [hotelsRes, rtRes, seasonsRes, suppRes, blackoutRes, ratePlansRes, promoRes] = await Promise.all([
        getHotels({}), getRoomTypes({ hotelId: id }), getSeasons({}),
        getMealPlanSupplements({ hotelId: id }),
        getBlackoutDates({ hotelId: id }),
        getRatePlans({ hotelId: id }),
        getPromotions({ hotelId: id }),
      ]);
      setHotel(hotelsRes.hotels.find(h => h.id === id) || null);
      setRoomTypes(rtRes.roomTypes);
      setSeasons(seasonsRes.seasons);
      setSupplements(suppRes.supplements);
      setBlackoutDates(blackoutRes.blackoutDates);
      setRatePlans(ratePlansRes.ratePlans);
      setPromotions(promoRes.promotions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSaveHotel = async (data: any) => {
    setSaving(true);
    try { await saveHotel(data); toast.success('Hotel profile updated'); load(); }
    catch { toast.error('Failed to save hotel'); }
    finally { setSaving(false); }
  };

  const handleSaveRt = async (data: any) => {
    setSaving(true);
    try { await saveRoomType(data); toast.success(data.id ? 'Updated' : 'Added'); setRtFormOpen(false); setEditRt(null); load(); }
    catch (e: any) { toast.error(e?.message || 'Failed to save room type'); }
    finally { setSaving(false); }
  };

  const handleSaveSupplement = async (data: any) => {
    setSaving(true);
    try { await saveMealPlanSupplement(data); toast.success('Supplement saved'); load(); }
    catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDeleteSupplement = async (suppId: string) => {
    try { await deleteMealPlanSupplement({ id: suppId }); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleSaveBlackout = async (data: any) => {
    setSaving(true);
    try { await saveBlackoutDate(data); toast.success(data.id ? 'Blackout updated' : 'Blackout added'); load(); }
    catch { toast.error('Failed to save blackout date'); }
    finally { setSaving(false); }
  };

  const handleDeleteBlackout = async (blackoutId: string) => {
    try { await deleteBlackoutDate({ id: blackoutId }); toast.success('Blackout period deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" />
    </div>
  );

  if (!hotel) return (
    <div className="p-6 text-center text-muted-foreground">
      <p>Hotel not found.</p>
      <Link to="/hotels"><Button variant="outline" className="mt-4">Back to Hotels</Button></Link>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/hotels"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{hotel.hotelName}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
            {hotel.emirate && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{hotel.emirate}</span>}
            {hotel.starRating && <span className="flex items-center gap-1"><Star className="w-3 h-3" />{hotel.starRating}</span>}
            <Badge variant={hotel.status === 'Active' ? 'default' : 'secondary'}>{hotel.status}</Badge>
          </div>
        </div>
      </div>

      <PropertyReadinessStrip
        hotelId={id!}
        hotelName={hotel.hotelName}
        lifecycleStatus={hotel.lifecycleStatus}
      />

      <CommercialIntegrityPanel hotelId={id!} />

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto gap-1 p-1.5 bg-muted/60 border border-border rounded-xl">
          <TabsTrigger value="profile" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Hotel Setup</TabsTrigger>
          <TabsTrigger value="room-types" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Room Types ({roomTypes.length})</TabsTrigger>
          <TabsTrigger value="rate-plans" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Rate Plans ({ratePlans.length})</TabsTrigger>
          <TabsTrigger value="promotions" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Deals & Promos ({promotions.length})</TabsTrigger>
          <TabsTrigger value="rate-grid" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Rate Grid</TabsTrigger>
          <TabsTrigger value="event-master" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Event Master</TabsTrigger>
          <TabsTrigger value="meal-plans" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Meal Plans</TabsTrigger>
          <TabsTrigger value="blackout" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Blackout Dates</TabsTrigger>
          <TabsTrigger value="allocation" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Allocation Mgmt</TabsTrigger>
          <TabsTrigger value="allotment" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Room Availability</TabsTrigger>
          <TabsTrigger value="rate-calendar" className="font-extrabold text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Rate Calendar</TabsTrigger>
        </TabsList>

        {/* Hotel Setup Tab */}
        <TabsContent value="profile" className="mt-4">
          <HotelProfileTab hotel={hotel} onSave={handleSaveHotel} saving={saving} />
        </TabsContent>

        {/* Room Types Tab */}
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

        {/* Rate Plans Tab */}
        <TabsContent value="rate-plans" className="mt-4">
          <RatePlansTab hotelId={id!} hotelName={hotel.hotelName} ratePlans={ratePlans} roomTypes={roomTypes} onRefresh={load} />
        </TabsContent>

        {/* Promotions Tab */}
        <TabsContent value="promotions" className="mt-4">
          <PromotionsTab
            hotelId={id!}
            promotions={promotions}
            onRefresh={load}
            onDelete={async (pid) => { await deletePromotion({ id: pid }); toast.success('Promotion deleted'); load(); }}
          />
        </TabsContent>

        {/* Rate Grid Tab — Date-based OTA style */}
        <TabsContent value="rate-grid" className="mt-4">
          <RateGridTab hotelId={id!} roomTypes={roomTypes} ratePlans={ratePlans} />
        </TabsContent>

        {/* Event Master Tab */}
        <TabsContent value="event-master" className="mt-4">
          <EventMasterTab hotelId={id!} />
        </TabsContent>

        {/* Meal Plans Tab */}
        <TabsContent value="meal-plans" className="mt-4">
          <MealPlanTab
            hotelId={id!} supplements={supplements} seasons={seasons}
            onSave={handleSaveSupplement} onDelete={handleDeleteSupplement} saving={saving}
          />
        </TabsContent>

        {/* Blackout Dates Tab */}
        <TabsContent value="blackout" className="mt-4">
          <BlackoutDatesTab
            hotelId={id!}
            blackoutDates={blackoutDates}
            roomTypes={roomTypes}
            onSave={handleSaveBlackout}
            onDelete={handleDeleteBlackout}
            saving={saving}
          />
        </TabsContent>

        {/* Room Allocation Management Tab */}
        <TabsContent value="allocation" className="mt-4">
          <RoomAllocationTab hotelId={id!} />
        </TabsContent>

        {/* Room Availability Calendar Tab */}
        <TabsContent value="allotment" className="mt-4">
          <RoomAvailabilityCalendar hotelId={id!} />
        </TabsContent>

        {/* Rate Calendar Tab — Occupancy-Based Daily Rates */}
        <TabsContent value="rate-calendar" className="mt-4">
          {roomTypes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <p className="font-medium">No room types yet</p>
              <p className="text-sm">Add room types first to use the Rate Calendar</p>
            </div>
          ) : (
            <div className="space-y-6">
              {roomTypes.map(rt => (
                <OccupancyRateGrid key={rt.id} roomType={rt} hotelId={id!} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RoomTypeFormDialog open={rtFormOpen} roomType={editRt} hotelId={id!} onClose={() => { setRtFormOpen(false); setEditRt(null); }} onSave={handleSaveRt} loading={saving} />

      <AlertDialog open={!!deleteRtId} onOpenChange={() => setDeleteRtId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Room Type?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this room type.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                const result = await deleteRoomType({ id: deleteRtId! });
                if (!(result as any).success) {
                  toast.error((result as any).error || 'Cannot delete this room type');
                } else {
                  toast.success('Deleted');
                  load();
                }
              } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
              setDeleteRtId(null);
            }} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
