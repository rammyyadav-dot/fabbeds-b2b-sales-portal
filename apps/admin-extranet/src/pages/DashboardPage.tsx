import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getRecentActivities, GetDashboardStatsOutputType, GetRecentActivitiesOutputType } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { Badge } from '@project/components/ui/badge';
import { Building2, BedDouble, CalendarDays, TrendingUp, ClipboardList, Moon, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@project/components/ui/button';

type Stats = GetDashboardStatsOutputType;
type Activity = GetRecentActivitiesOutputType[0];

type Period = 'today' | 'week' | 'month' | 'year';

const PERIOD_LABELS: Record<Period, string> = { today: 'Today', week: 'This week', month: 'This month', year: 'This year' };

function isInPeriod(dateStr: string | undefined, period: Period) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  if (period === 'today') return d.toDateString() === now.toDateString();
  if (period === 'week') { const s = new Date(now); s.setDate(now.getDate() - 7); return d >= s; }
  if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return d.getFullYear() === now.getFullYear();
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');

  const load = () => {
    setLoading(true);
    getDashboardStats({}).then(setStats).finally(() => setLoading(false));
    getRecentActivities({ limit: 30 }).then(setActivities);
  };

  useEffect(() => { load(); }, []);

  const periodActivities = activities.filter(a => isInPeriod(a.createdAt, period));
  const bookingsGenerated = periodActivities.filter(a => a.eventType?.includes('Status changed')).length;

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) :
          stats && [
            { label: 'Hotels', value: stats.activeHotels, sub: `${stats.totalHotels} total`, icon: Building2, href: '/hotels' },
            { label: 'Room Types', value: stats.totalRoomTypes, sub: 'configured', icon: BedDouble, href: '/hotels' },
            { label: 'Bookings', value: stats.totalBookings, sub: `${stats.pendingBookings} pending`, icon: ClipboardList, href: '/bookings' },
            { label: 'Confirmed', value: stats.confirmedBookings, sub: 'bookings', icon: CheckCircle2, href: '/bookings' },
            { label: 'Room Nights', value: stats.totalRoomNights, sub: 'all time', icon: Moon, href: '/bookings' },
          ].map(({ label, value, sub, icon: Icon, href }) => (
            <Link key={label} to={href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-3">
                  <Icon className="w-4 h-4 text-primary mb-2" />
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>

      {/* Statistics — full width */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold">Statistics</CardTitle>
            <div className="flex gap-1 flex-wrap">
              {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg col-span-1">
              <div>
                <div className="text-2xl font-bold text-primary">{bookingsGenerated}</div>
                <div className="flex items-center gap-1.5 mt-0.5"><ClipboardList className="w-3.5 h-3.5 text-primary" /><span className="text-xs font-medium">Bookings Generated</span></div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg col-span-1">
              <div>
                <div className="text-2xl font-bold text-orange-500">{stats?.totalRoomNights ?? 0}</div>
                <div className="flex items-center gap-1.5 mt-0.5"><Moon className="w-3.5 h-3.5 text-orange-500" /><span className="text-xs font-medium">Room Nights</span></div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg col-span-1">
              <div>
                <div className="text-2xl font-bold text-green-600">{stats?.confirmedBookings ?? 0}</div>
                <div className="flex items-center gap-1.5 mt-0.5"><TrendingUp className="w-3.5 h-3.5 text-green-600" /><span className="text-xs font-medium">Confirmed</span></div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg col-span-1">
              <div>
                <div className="text-2xl font-bold text-foreground">{stats?.activeHotels ?? 0}</div>
                <div className="flex items-center gap-1.5 mt-0.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-medium">Active Hotels</span></div>
              </div>
            </div>
            {stats?.pendingBookings ? (
              <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg col-span-1">
                <div>
                  <Badge className="bg-yellow-500 text-white text-base px-2 py-0.5">{stats.pendingBookings}</Badge>
                  <div className="text-xs font-medium text-yellow-700 mt-1">Pending Review</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg col-span-1">
                <div>
                  <div className="text-2xl font-bold text-foreground">{stats?.totalRates ?? 0}</div>
                  <div className="text-xs font-medium text-muted-foreground mt-0.5">Rate Entries</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/hotels', label: 'Hotels & Rooms', icon: Building2 },
          { href: '/quick-update', label: 'Quick Update', icon: CalendarDays },
          { href: '/rate-sheet', label: 'Rate Sheet', icon: TrendingUp },
          { href: '/bookings', label: 'Booking Enquiries', icon: ClipboardList },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} to={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="p-3 flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-medium">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
