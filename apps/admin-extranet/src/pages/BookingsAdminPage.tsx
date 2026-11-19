import { useEffect, useState, useMemo } from 'react';
import { getBookings, updateBookingStatus, GetBookingsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Switch } from '@project/components/ui/switch';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { ClipboardList, RefreshCw, Search, Printer, FileSpreadsheet, Eye, CheckCircle, XCircle, Edit2, MessageSquare, LayoutList, Kanban, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, isWithinInterval, parseISO } from 'date-fns';
import BookingKanbanBoard from '@/components/BookingKanbanBoard';
import BookingDetailsModal from '@/components/BookingDetailsModal';
import DatePickerInput from '@/components/DatePickerInput';

type Booking = GetBookingsOutputType['bookings'][0];
type QuickSearch = 'latest' | 'cancelled' | 'next7days' | 'missingsupplier' | 'custom';

const STATUS_DOT: Record<string, string> = {
  Pending: 'bg-yellow-400', 'Awaiting Hotel': 'bg-blue-400', 'Awaiting Payment': 'bg-purple-400',
  Confirmed: 'bg-green-500', Approved: 'bg-green-500', Rejected: 'bg-red-500', Cancelled: 'bg-gray-400',
};

function getNights(b: Booking) {
  if (!b.checkinDate || !b.checkoutDate) return 0;
  return Math.round((new Date(b.checkoutDate).getTime() - new Date(b.checkinDate).getTime()) / 86400000);
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yyyy'); } catch { return d; }
}

const QUICK_LABELS: Record<QuickSearch, string> = {
  latest: 'Latest Bookings', cancelled: 'Latest Cancelled',
  next7days: 'Check-in Next 7 Days', missingsupplier: 'Missing Supplier Ref', custom: 'Custom',
};

export default function BookingsAdminPage() {
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [quickSearch, setQuickSearch] = useState<QuickSearch>('latest');

  // Filters
  const [bookingRefSearch, setBookingRefSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [guestSearch, setGuestSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [checkinFrom, setCheckinFrom] = useState('');
  const [checkinTo, setCheckinTo] = useState('');
  const [missingSupplierOnly, setMissingSupplierOnly] = useState(false);

  // Modals
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [updateTarget, setUpdateTarget] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [newStatus, setNewStatus] = useState('Confirmed');
  const [adminNotes, setAdminNotes] = useState('');
  const [hotelConfirmationNo, setHotelConfirmationNo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await getBookings({}); setAllBookings(res.bookings); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filteredBookings = useMemo(() => {
    let r = [...allBookings];
    if (quickSearch === 'cancelled') r = r.filter(b => b.status === 'Cancelled');
    else if (quickSearch === 'next7days') {
      const today = new Date(); const end = addDays(today, 7);
      r = r.filter(b => { try { return b.checkinDate && isWithinInterval(parseISO(b.checkinDate), { start: today, end }); } catch { return false; } });
    } else if (quickSearch === 'missingsupplier') r = r.filter(b => !b.companyName);
    if (bookingRefSearch) r = r.filter(b => b.bookingRef?.toLowerCase().includes(bookingRefSearch.toLowerCase()));
    if (supplierSearch) r = r.filter(b => b.companyName?.toLowerCase().includes(supplierSearch.toLowerCase()));
    if (guestSearch) r = r.filter(b => b.guestName?.toLowerCase().includes(guestSearch.toLowerCase()));
    if (statusFilter && statusFilter !== 'all') r = r.filter(b => b.status === statusFilter);
    if (checkinFrom) r = r.filter(b => b.checkinDate && b.checkinDate >= checkinFrom);
    if (checkinTo) r = r.filter(b => b.checkinDate && b.checkinDate <= checkinTo);
    if (missingSupplierOnly) r = r.filter(b => !b.companyName);
    r.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return r;
  }, [allBookings, quickSearch, bookingRefSearch, supplierSearch, guestSearch, statusFilter, checkinFrom, checkinTo, missingSupplierOnly]);

  const handleQuickSearch = (type: QuickSearch) => {
    setQuickSearch(type);
    setBookingRefSearch(''); setSupplierSearch(''); setGuestSearch('');
    setStatusFilter(''); setCheckinFrom(''); setCheckinTo('');
    setMissingSupplierOnly(type === 'missingsupplier');
  };

  const handleConfirm = async (b: Booking) => {
    const confirmationNo = window.prompt('Enter the hotel confirmation number before confirming this booking:', b.hotelConfirmationNo || '');
    if (!confirmationNo?.trim()) {
      toast.error('Hotel confirmation number is required');
      return;
    }
    try {
      await updateBookingStatus({ id: b.id, status: 'Confirmed', hotelConfirmationNo: confirmationNo.trim() });
      toast.success('Booking confirmed and voucher unlocked');
      setDetailBooking(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to confirm');
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    try { await updateBookingStatus({ id: cancelTarget.id, status: 'Cancelled' }); toast.success('Booking cancelled'); setCancelTarget(null); setDetailBooking(null); load(); }
    catch { toast.error('Failed to cancel'); }
  };

  const handleUpdate = async () => {
    if (!updateTarget) return;
    setSaving(true);
    if (newStatus === 'Confirmed' && !hotelConfirmationNo.trim() && !updateTarget.hotelConfirmationNo) {
      toast.error('Hotel confirmation number is required');
      setSaving(false);
      return;
    }
    try {
      await updateBookingStatus({
        id: updateTarget.id,
        status: newStatus as any,
        adminNotes,
        hotelConfirmationNo: newStatus === 'Confirmed'
          ? (hotelConfirmationNo.trim() || updateTarget.hotelConfirmationNo)
          : undefined,
      });
      toast.success(newStatus === 'Confirmed' ? 'Booking confirmed and voucher unlocked' : 'Booking updated');
      setUpdateTarget(null);
      load();
    }
    catch (err: any) { toast.error(err?.message || 'Failed to update'); } finally { setSaving(false); }
  };

  const openEdit = (b: Booking) => {
    setUpdateTarget(b);
    setNewStatus(b.status ?? 'Confirmed');
    setAdminNotes(b.adminNotes ?? '');
    setHotelConfirmationNo(b.hotelConfirmationNo ?? '');
    setDetailBooking(null);
  };

  const exportCSV = () => {
    const H = ['Booking #', 'Status', 'Supplier Ref', 'Guest Name', 'Hotel', 'Room Type', 'Check-In', 'Check-Out', 'Nights', 'Adults', 'Children', 'Rooms', 'Net Rate', 'Sell Rate', 'Email', 'Booking Date'];
    const rows = filteredBookings.map(b => [b.bookingRef ?? '', b.status ?? '', b.companyName ?? '', b.guestName ?? '', b.hotelName ?? '', b.roomTypeName ?? '', b.checkinDate ?? '', b.checkoutDate ?? '', getNights(b), b.adults ?? 0, b.children ?? 0, b.rooms ?? 0, b.netTotal ?? '', b.sellTotal ?? '', b.contactEmail ?? '', b.createdAt ? fmtDate(b.createdAt) : '']);
    const csv = [H, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `bookings-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
  };

  const pending = allBookings.filter(b => b.status === 'Pending').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center"><ClipboardList className="w-5 h-5 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold">Booking Enquiries</h1>
              <p className="text-xs text-muted-foreground">OTA / Bedbank booking management</p>
            </div>
            {pending > 0 && <Badge className="bg-yellow-500 text-white">{pending} Pending</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              <Button size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} className="rounded-none h-8 px-3 gap-1.5" onClick={() => setViewMode('list')}><LayoutList className="w-3.5 h-3.5" /> List</Button>
              <Button size="sm" variant={viewMode === 'kanban' ? 'default' : 'ghost'} className="rounded-none h-8 px-3 gap-1.5" onClick={() => setViewMode('kanban')}><Kanban className="w-3.5 h-3.5" /> Kanban</Button>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border-b px-6 py-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Booking Number</Label><Input className="h-9 text-sm" placeholder="e.g. BK-2025-12345" value={bookingRefSearch} onChange={e => setBookingRefSearch(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Supplier Reference</Label><Input className="h-9 text-sm" placeholder="Company / Agent" value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Guest Name</Label><Input className="h-9 text-sm" placeholder="Guest name" value={guestSearch} onChange={e => setGuestSearch(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Booking Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['Pending','Awaiting Hotel','Awaiting Payment','Confirmed','Cancelled','Approved','Rejected'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Check-in From</Label><DatePickerInput value={checkinFrom} onChange={setCheckinFrom} placeholder="From date" /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Check-in To</Label><DatePickerInput value={checkinTo} onChange={setCheckinTo} placeholder="To date" /></div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={missingSupplierOnly} onCheckedChange={setMissingSupplierOnly} id="missing-supplier" />
            <Label htmlFor="missing-supplier" className="text-sm cursor-pointer">Only Missing Supplier Ref</Label>
          </div>
          <Button onClick={() => setQuickSearch('custom')} className="gap-2 ml-auto h-9"><Search className="w-4 h-4" /> Search</Button>
        </div>
      </div>

      {/* Quick Search Buttons */}
      <div className="px-6 py-3 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">Quick Search</span>
        {(['latest','cancelled','next7days','missingsupplier'] as QuickSearch[]).map(t => (
          <Button key={t} size="sm" variant={quickSearch === t ? 'default' : 'outline'} className="h-7 text-xs rounded-full" onClick={() => handleQuickSearch(t)}>
            {QUICK_LABELS[t]}
          </Button>
        ))}
      </div>

      {/* Results bar */}
      <div className="px-6 py-2.5 flex items-center justify-between flex-wrap gap-2 border-b">
        <p className="text-sm text-muted-foreground">
          Searched <span className="font-semibold text-foreground">{QUICK_LABELS[quickSearch]}</span>
          {' · '}Found <span className="font-semibold text-primary">{filteredBookings.length}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportCSV}><FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> Excel / CSV</Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /> Print</Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 pb-10">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : viewMode === 'kanban' ? (
          <BookingKanbanBoard bookings={filteredBookings} onRefresh={load} />
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="font-medium">No bookings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b">
                  {['Booking #','Status','Supplier Ref','Guest Name','Booking Date','Check-In Date','Nights','Guests','Hotel / Room Type','Rate (AED)','Actions'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${i >= 6 && i <= 7 ? 'text-center' : i === 9 ? 'text-right' : i === 10 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b, idx) => {
                  const missingSupplier = !b.companyName;
                  const missingRate = b.sellTotal == null;
                  const urgent = b.status === 'Pending' && b.checkinDate && new Date(b.checkinDate) <= addDays(new Date(), 7);
                  return (
                    <tr key={b.id} className={`border-b transition-colors group hover:bg-primary/5 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                      <td className="px-4 py-3 min-w-[140px]">
                        <button onClick={() => setDetailBooking(b)} className="font-mono font-semibold text-primary hover:underline text-sm block">{b.bookingRef || '—'}</button>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {missingSupplier && <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-600 rounded px-1.5 py-0.5 font-medium"><AlertTriangle className="w-2.5 h-2.5" />No Supplier</span>}
                          {missingRate && <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-100 text-red-600 rounded px-1.5 py-0.5 font-medium"><AlertTriangle className="w-2.5 h-2.5" />No Rate</span>}
                          {urgent && <span className="text-[10px] bg-red-500 text-white rounded px-1.5 py-0.5 font-medium">Urgent</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[b.status ?? ''] ?? 'bg-gray-300'}`} />
                          <span className="text-sm">{b.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[130px]">
                        {b.companyName
                          ? <span className="text-sm">{b.companyName}</span>
                          : <button onClick={() => openEdit(b)} className="text-[11px] text-orange-600 border border-orange-300 rounded px-2 py-0.5 hover:bg-orange-50 font-medium">ADD REFERENCE</button>
                        }
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{b.guestName || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-sm whitespace-nowrap">{fmtDate(b.createdAt)}</td>
                      <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{fmtDate(b.checkinDate)}</td>
                      <td className="px-4 py-3 text-center font-semibold">{getNights(b) || '—'}</td>
                      <td className="px-4 py-3 text-center text-sm whitespace-nowrap">{b.adults ?? 0} AD{b.children ? ` · ${b.children}C` : ''}</td>
                      <td className="px-4 py-3 min-w-[160px]">
                        <div className="font-medium text-sm truncate max-w-[180px]">{b.hotelName || '—'}</div>
                        {b.roomTypeName && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{b.roomTypeName}</div>}
                        {b.mealPlan && <div className="text-[10px] text-muted-foreground">{b.mealPlan}</div>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {b.sellTotal != null ? <span className="font-bold">{Math.round(b.sellTotal).toLocaleString()}</span> : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button title="View Details" onClick={() => setDetailBooking(b)} className="w-7 h-7 rounded flex items-center justify-center text-primary hover:bg-primary/10"><Eye className="w-3.5 h-3.5" /></button>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {b.status !== 'Confirmed' && b.status !== 'Cancelled' && (
                              <button title="Confirm" onClick={() => handleConfirm(b)} className="w-7 h-7 rounded flex items-center justify-center text-green-600 hover:bg-green-50"><CheckCircle className="w-3.5 h-3.5" /></button>
                            )}
                            {b.status !== 'Cancelled' && (
                              <button title="Cancel" onClick={() => setCancelTarget(b)} className="w-7 h-7 rounded flex items-center justify-center text-destructive hover:bg-red-50"><XCircle className="w-3.5 h-3.5" /></button>
                            )}
                            <button title="Edit / Notes" onClick={() => openEdit(b)} className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-muted"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button title="Internal Note" onClick={() => openEdit(b)} className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-muted"><MessageSquare className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      <BookingDetailsModal booking={detailBooking} onClose={() => setDetailBooking(null)} onConfirm={handleConfirm} onCancel={b => { setDetailBooking(null); setCancelTarget(b); }} onEdit={openEdit} />

      {/* Update Dialog */}
      <Dialog open={!!updateTarget} onOpenChange={() => setUpdateTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Booking — {updateTarget?.guestName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['Pending','Awaiting Hotel','Awaiting Payment','Confirmed','Approved','Rejected','Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {newStatus === 'Confirmed' && (
              <div className="space-y-1.5">
                <Label>Hotel Confirmation Number *</Label>
                <Input
                  placeholder="e.g. HTL-CONF-12345"
                  value={hotelConfirmationNo}
                  onChange={e => setHotelConfirmationNo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Required before voucher release to the travel agent.</p>
              </div>
            )}
            <div className="space-y-1.5"><Label>Internal Notes</Label><Textarea placeholder="Confirmation details, supplier ref, notes..." value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateTarget(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Update'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking #{cancelTarget?.bookingRef}?</AlertDialogTitle>
            <AlertDialogDescription>This will cancel the booking for <strong>{cancelTarget?.guestName}</strong> at <strong>{cancelTarget?.hotelName}</strong> ({fmtDate(cancelTarget?.checkinDate)} – {fmtDate(cancelTarget?.checkoutDate)}). This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground">Yes, Cancel Booking</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
