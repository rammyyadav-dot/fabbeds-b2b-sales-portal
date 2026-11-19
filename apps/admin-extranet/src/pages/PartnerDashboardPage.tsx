import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPartnerAlerts, GetPartnerAlertsOutputType } from 'zitejs/api';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Badge } from '@project/components/ui/badge';
import { AlertTriangle, XCircle, CheckCircle2, RefreshCw, CalendarDays, Boxes, BedDouble, FileText, TrendingUp, Clock, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@project/components/lib/utils';

type Alert = GetPartnerAlertsOutputType['alerts'][0];
type Stats = GetPartnerAlertsOutputType['stats'];

const ALERT_STYLES = {
  error: { icon: XCircle, cls: 'border-destructive/40 bg-destructive/10 text-destructive', badge: 'bg-red-100 text-red-700 border-red-200' },
  warning: { icon: AlertTriangle, cls: 'border-amber-500/40 bg-amber-500/10 text-amber-400', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  info: { icon: CheckCircle2, cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

function AlertCard({ alert }: { alert: Alert }) {
  const { icon: Icon, cls, badge } = ALERT_STYLES[alert.type];
  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-xl border', cls)}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-sm text-foreground">{alert.title}</p>
          {alert.count != null && <Badge variant="outline" className={`text-[10px] font-bold ${badge}`}>{alert.count}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.message}</p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: number | string; sub?: string; color: string }) {
  return (
    <Card className="border-border">
      <CardContent className="pt-5 pb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-2xl font-black text-foreground">{value}</p>
        <p className="text-xs font-semibold text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function PartnerDashboardPage() {
  const { user } = usePartnerAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<GetPartnerAlertsOutputType | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await getPartnerAlerts({})); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const s: Stats | undefined = data?.stats;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground">{greeting}, {user?.fullName?.split(' ')[0] || 'Partner'} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's your hotel status for today</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Updated {format(new Date(data.lastUpdated), 'HH:mm')}
            </div>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText} label="Active Hotels" value={s.totalHotels} color="bg-primary/10 text-primary" />
          <StatCard icon={BedDouble} label="Room Types" value={s.activeRoomTypes} color="bg-indigo-500/10 text-indigo-400" />
          <StatCard icon={TrendingUp} label="Rate Plans" value={s.activeRatePlans} color="bg-violet-500/10 text-violet-400" />
          <StatCard icon={CalendarDays} label="Rates Loaded" value={s.ratesLoadedNext30} sub="next 30 days" color="bg-emerald-500/10 text-emerald-400" />
        </div>
      )}

      {/* Alerts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground text-sm">System Alerts</h2>
          {data && <Badge variant="outline" className="text-[10px]">{data.alerts.length} alert{data.alerts.length !== 1 ? 's' : ''}</Badge>}
        </div>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {data?.alerts.map((alert, i) => <AlertCard key={i} alert={alert} />)}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-bold text-foreground text-sm mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Manage My Hotel', icon: Building2, href: '/partner/hotel', color: 'bg-primary text-primary-foreground' },
            { label: 'Update Rates', icon: CalendarDays, href: '/partner/rates', color: 'bg-indigo-600 text-white' },
            { label: 'Update Inventory', icon: Boxes, href: '/partner/inventory', color: 'bg-violet-600 text-white' },
            { label: 'View Rate Sync', icon: TrendingUp, href: '/rate-sync', color: 'bg-card border border-border text-foreground' },
          ].map(({ label, icon: Icon, href, color }) => (
            <button key={label} onClick={() => navigate(href)}
              className={cn('flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90', color)}>
              <Icon className="w-4 h-4 shrink-0" /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
