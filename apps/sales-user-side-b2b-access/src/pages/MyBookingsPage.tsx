import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { Search } from 'lucide-react';
import { usePartnerAuth } from '@/lib/partnerAuth';
import { getPartnerBookings } from 'zitejs/api';
import SalesHeader from '@/components/sales/SalesHeader';

type Booking = Awaited<ReturnType<typeof getPartnerBookings>>['bookings'][0];

function statusColor(s?: string) {
  switch (s) {
    case 'Confirmed': case 'Approved': return 'text-emerald-600';
    case 'Cancelled': case 'Rejected': return 'text-muted-foreground';
    default: return 'text-foreground';
  }
}

export default function MyBookingsPage() {
  const { partner, token } = usePartnerAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!partner || !token) { navigate('/partner/sign-in'); return; }
    setLoading(true);
    getPartnerBookings({ token, statusFilter: statusFilter === 'all' ? undefined : statusFilter })
      .then(res => setBookings(res.bookings))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [partner, token, statusFilter, navigate]);

  const filtered = bookings.filter(b => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (b.bookingReference?.toLowerCase().includes(q)) || (b.hotelName?.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-background">
      <SalesHeader onLogout={() => {}} />
      <div className="container mx-auto px-4 max-w-5xl py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-foreground">My bookings</h1>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending">Requested</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search reference or hotel" className="pl-9 w-56 h-9" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No bookings found.</div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-border grid grid-cols-6 gap-3 text-xs text-muted-foreground font-medium bg-muted/30">
              <span>Reference</span><span className="col-span-2">Hotel</span><span>Dates</span><span>Status</span><span className="text-right">Total</span>
            </div>
            {filtered.map(b => (
              <div key={b.id} className="px-4 py-3 border-b border-border last:border-0 grid grid-cols-6 gap-3 text-sm items-center hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => navigate(`/booking/${b.id}/confirmation`)}>
                <span className="font-mono text-foreground">{b.bookingReference || '—'}</span>
                <span className="col-span-2 text-foreground">{b.hotelName || '—'}{b.roomTypeName ? ` · ${b.roomTypeName}` : ''}</span>
                <span className="text-muted-foreground">
                  {b.checkinDate && b.checkoutDate
                    ? `${format(new Date(b.checkinDate), 'd MMM')}–${format(new Date(b.checkoutDate), 'd MMM yyyy')}`
                    : '—'}
                </span>
                <span className={statusColor(b.status)}>{b.status === 'Pending' ? 'Requested' : b.status || '—'}</span>
                <span className="text-right text-foreground font-medium">{b.sellTotal != null ? `AED ${b.sellTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
