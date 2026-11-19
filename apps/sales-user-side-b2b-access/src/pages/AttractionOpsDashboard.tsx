import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@project/components/lib/legacyAuth';
import { getAttractionBookings, GetAttractionBookingsOutputType, updateAttractionBookingStatus, generateAttractionVoucher } from 'zitejs/api';
import { toast } from 'sonner';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@project/components/ui/alert-dialog';
import { ArrowLeft, Search, FileText, CheckCircle, XCircle, Download, RefreshCw, Filter } from 'lucide-react';
import SalesHeader from '@/components/sales/SalesHeader';
import { usePartnerAuth } from '@/lib/partnerAuth';

interface Props { onLogout: () => void; }

type Booking = GetAttractionBookingsOutputType['bookings'][0];

const STATUS_COLORS: Record<string, string> = {
  'Initiated': 'bg-amber-100 text-amber-800',
  'Confirmed': 'bg-emerald-100 text-emerald-800',
  'Vouchered': 'bg-blue-100 text-blue-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[status] || 'bg-muted text-muted-foreground'}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function AttractionOpsDashboard({ onLogout }: Props) {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, loginWithRedirect } = useAuth();
  const { token } = usePartnerAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) loginWithRedirect({ redirectUrl: window.location.href });
  }, [authLoading, user, loginWithRedirect]);

  const loadBookings = useCallback(() => {
    if (!user) return;
    setLoading(true);
    getAttractionBookings({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: searchQuery || undefined,
      agentSearch: agentSearch || undefined,
    })
      .then(res => setBookings(res.bookings))
      .catch(() => toast.error('Failed to load bookings'))
      .finally(() => setLoading(false));
  }, [user, statusFilter, searchQuery, agentSearch]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleStatusChange = async (bookingId: string, newStatus: 'Confirmed' | 'Vouchered' | 'Cancelled') => {
    setActionLoading(bookingId);
    try {
      await updateAttractionBookingStatus({ bookingId, status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      loadBookings();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGeneratePdf = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      if (!token) throw new Error('Partner session required');
      const res = await generateAttractionVoucher({ token, bookingId });
      window.open(res.url, '_blank');
      toast.success('Voucher PDF generated');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !user) return null;

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />

      <div className="container mx-auto px-4 py-5 max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/attractions')}>
              <ArrowLeft className="w-3.5 h-3.5" /> Attractions
            </Button>
            <div>
              <h1 className="text-base font-bold text-foreground">DMC Ops Dashboard</h1>
              <p className="text-[10px] text-muted-foreground">Attraction Fulfillment · Offline Operations</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={loadBookings}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-3 mb-4 flex flex-wrap gap-2 items-center">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Initiated">Hold / Initiated</SelectItem>
              <SelectItem value="Confirmed">Confirmed</SelectItem>
              <SelectItem value="Vouchered">Vouchered</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 bg-background border border-border rounded px-2 py-1 flex-1 min-w-[160px]">
            <Search className="w-3 h-3 text-muted-foreground" />
            <input placeholder="Search voucher ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="border-0 p-0 h-auto text-xs bg-transparent outline-none w-full" />
          </div>
          <div className="flex items-center gap-1.5 bg-background border border-border rounded px-2 py-1 min-w-[140px]">
            <Search className="w-3 h-3 text-muted-foreground" />
            <input placeholder="Agent name..." value={agentSearch} onChange={e => setAgentSearch(e.target.value)}
              className="border-0 p-0 h-auto text-xs bg-transparent outline-none w-full" />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">No bookings found</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Ref</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Agent / Company</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Attraction / Ticket</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Visit Date</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Pax</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Net Rate</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-foreground whitespace-nowrap">{b.bookingReference}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-medium text-foreground">{b.agentName}</div>
                        <div className="text-[10px] text-muted-foreground">{b.companyName}</div>
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <div className="font-medium text-foreground truncate">{b.attractionName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{b.ticketOptionName}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{formatDate(b.targetDate)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {b.adultCount}A{b.childCount > 0 ? `, ${b.childCount}C` : ''}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap font-bold tabular-nums">
                        AED {b.totalNetCost.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-center"><StatusBadge status={b.bookingStatus} /></td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center gap-1 justify-end">
                          {b.bookingStatus === 'Initiated' && (
                            <Button size="sm" variant="default" className="h-6 text-[10px] px-2 gap-1"
                              disabled={actionLoading === b.id}
                              onClick={() => handleStatusChange(b.id, 'Confirmed')}>
                              <CheckCircle className="w-3 h-3" /> Confirm
                            </Button>
                          )}
                          {b.bookingStatus === 'Confirmed' && (
                            <Button size="sm" variant="default" className="h-6 text-[10px] px-2 gap-1"
                              disabled={actionLoading === b.id}
                              onClick={() => handleStatusChange(b.id, 'Vouchered')}>
                              <FileText className="w-3 h-3" /> Voucher
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1"
                            disabled={actionLoading === b.id}
                            onClick={() => handleGeneratePdf(b.id)}>
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                          {b.bookingStatus !== 'Cancelled' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-destructive hover:text-destructive">
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will cancel {b.bookingReference}. No email will be sent.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleStatusChange(b.id, 'Cancelled')}>
                                    Cancel Booking
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-[8px] text-muted-foreground text-center mt-4">
          Zero transactional emails · All status changes are audit-logged · PDF vouchers generated on demand
        </p>
      </div>
    </div>
  );
}
