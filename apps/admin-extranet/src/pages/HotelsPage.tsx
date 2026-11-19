import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getHotels, saveHotel, deleteHotel, getRoomTypes, saveRoomType, deleteRoomType,
  GetHotelsOutputType, GetRoomTypesOutputType,
} from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import HotelFormDialog from '@/components/HotelFormDialog';
import RoomTypeFormDialog from '@/components/RoomTypeFormDialog';
import { Plus, Building2, Edit2, CheckCircle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

type Hotel = GetHotelsOutputType['hotels'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string>(
    () => localStorage.getItem('selectedHotelId') ?? ''
  );
  const [loading, setLoading] = useState(true);
  const [rtLoading, setRtLoading] = useState(false);
  const [hotelFormOpen, setHotelFormOpen] = useState(false);
  const [rtFormOpen, setRtFormOpen] = useState(false);
  const [editRt, setEditRt] = useState<RoomType | null>(null);
  const [deleteRtId, setDeleteRtId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const syncFromGlobal = () => {
    const id = localStorage.getItem('selectedHotelId') ?? '';
    setSelectedHotelId(id);
  };

  const loadHotels = async () => {
    setLoading(true);
    try {
      const res = await getHotels({});
      setHotels(res.hotels);
      // Sync with global selection; fall back to first hotel only if nothing is stored
      const storedId = localStorage.getItem('selectedHotelId');
      const valid = storedId && res.hotels.find(h => h.id === storedId);
      if (!valid && res.hotels.length > 0) {
        setSelectedHotelId(res.hotels[0].id);
      }
    } finally { setLoading(false); }
  };

  const loadRoomTypes = async (hotelId: string) => {
    if (!hotelId) return;
    setRtLoading(true);
    try {
      const res = await getRoomTypes({ hotelId });
      setRoomTypes(res.roomTypes);
    } finally { setRtLoading(false); }
  };

  useEffect(() => {
    loadHotels();
    window.addEventListener('hotelChanged', syncFromGlobal);
    return () => window.removeEventListener('hotelChanged', syncFromGlobal);
  }, []);
  useEffect(() => { if (selectedHotelId) loadRoomTypes(selectedHotelId); }, [selectedHotelId]);

  const selectedHotel = hotels.find(h => h.id === selectedHotelId);

  const handleSaveHotel = async (data: any) => {
    setSaving(true);
    try {
      await saveHotel(data);
      toast.success(data.id ? 'Hotel updated' : 'Hotel created');
      setHotelFormOpen(false);
      await loadHotels();
    } catch { toast.error('Failed to save hotel'); }
    finally { setSaving(false); }
  };

  const handleSaveRt = async (data: any) => {
    setSaving(true);
    try {
      await saveRoomType(data);
      toast.success(data.id ? 'Room type updated' : 'Room type added');
      setRtFormOpen(false);
      setEditRt(null);
      loadRoomTypes(selectedHotelId);
    } catch (e: any) { toast.error(e?.message || 'Failed to save room type'); }
    finally { setSaving(false); }
  };

  const handleDeleteRt = async () => {
    if (!deleteRtId) return;
    try {
      await deleteRoomType({ id: deleteRtId });
      toast.success('Room type deleted');
      setDeleteRtId(null);
      loadRoomTypes(selectedHotelId);
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Property Setup</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedHotel && (
            <Link to={`/hotels/${selectedHotel.id}`}>
              <Button variant="outline" className="gap-2">
                <Building2 className="w-4 h-4" /> Hotel Profile
              </Button>
            </Link>
          )}
          <Button onClick={() => setHotelFormOpen(true)} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
            <Plus className="w-4 h-4" /> Add &amp; Create New Hotel
          </Button>
          <Button onClick={() => { setEditRt(null); setRtFormOpen(true); }} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white" disabled={!selectedHotelId}>
            <Plus className="w-4 h-4" /> Add Room Type
          </Button>
        </div>
      </div>

      {/* Selected Hotel (locked to global property) */}
      {loading ? (
        <Skeleton className="h-9 w-72" />
      ) : selectedHotel && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground font-medium">Selected Hotel:</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 text-sm font-medium text-foreground">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            {selectedHotel.hotelName}
          </div>
          <span className="text-xs text-muted-foreground italic">(Change via the Property selector in the header)</span>
        </div>
      )}

      {/* Room Types Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Room Types</h2>
        </div>

        {rtLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : roomTypes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-medium">No room types yet</p>
            <p className="text-sm mt-1">Click "Add Room Type" to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Room Type Name</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">Max<br/>Occupancy</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">Max<br/>Adults</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">Max<br/>Children</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">Max Adults<br/>with Children</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">Min<br/>Occupancy</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">Adult<br/>Extra Bed</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roomTypes.map(rt => (
                  <tr key={rt.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${rt.sellEnabled !== false ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <div>
                          <p className="font-medium text-foreground">{rt.roomTypeName}</p>
                          {rt.internalCode && <p className="text-xs text-muted-foreground font-mono">{rt.internalCode}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center text-foreground">{rt.maxOccupancy ?? '—'}</td>
                    <td className="py-3 px-3 text-center text-foreground">{rt.maxAdults ?? '—'}</td>
                    <td className="py-3 px-3 text-center text-foreground">{rt.maxChildren ?? '—'}</td>
                    <td className="py-3 px-3 text-center text-foreground">{rt.maxAdultsWithChildren ?? '—'}</td>
                    <td className="py-3 px-3 text-center text-foreground">{rt.minTotalOccupancy ?? '—'}</td>
                    <td className="py-3 px-3 text-center">
                      {rt.adultExtraBedAvailable
                        ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge className={`text-xs ${rt.sellEnabled !== false ? 'bg-green-600 hover:bg-green-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {rt.sellEnabled !== false ? 'Live' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => { setEditRt(rt); setRtFormOpen(true); }}>
                          <Edit2 className="w-3 h-3" /> Edit
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteRtId(rt.id)}>
                          <span className="text-base font-bold">×</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manage Hotel Link */}
      {selectedHotel && (
        <div className="flex justify-end">
          <Link to={`/hotels/${selectedHotel.id}`}>
            <Button variant="outline" className="gap-2 text-sm">
              Full Hotel Management <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}

      <HotelFormDialog open={hotelFormOpen} hotel={null} onClose={() => setHotelFormOpen(false)} onSave={handleSaveHotel} loading={saving} />

      {selectedHotelId && (
        <RoomTypeFormDialog
          open={rtFormOpen}
          roomType={editRt}
          hotelId={selectedHotelId}
          onClose={() => { setRtFormOpen(false); setEditRt(null); }}
          onSave={handleSaveRt}
          loading={saving}
        />
      )}

      <AlertDialog open={!!deleteRtId} onOpenChange={() => setDeleteRtId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room Type?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this room type.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRt} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
