import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { getCommercialIntegrity, type GetCommercialIntegrityOutputType } from 'zitejs/api';

export default function CommercialIntegrityPanel({ hotelId }: { hotelId: string }) {
  const [data, setData] = useState<GetCommercialIntegrityOutputType | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!hotelId) return;
    setLoading(true);
    getCommercialIntegrity({ hotelId })
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [hotelId]);

  if (!data && loading) {
    return <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Checking commercial integrity…</div>;
  }
  if (!data) return null;

  const metrics = [
    ['Room Types', data.roomTypes],
    ['Active Rate Plans', data.activeRatePlans],
    ['Meal Issues', data.mealMappingIssues],
    ['Valid Daily Rates', data.validDailyRates],
    ['Quarantined', data.quarantinedRates],
    ['Duplicates', data.duplicateRates],
    ['Currency Issues', data.currencyIssues],
    ['Event Issues', data.eventIssues],
  ];

  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-bold">Commercial Integrity</h3>
            <p className="text-xs text-muted-foreground">Room, Rate Plan, Meal, Daily Rate and event readiness</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.issueCount === 0 && data.sellableNext30Days ? 'default' : 'destructive'}>
            {data.issueCount === 0 && data.sellableNext30Days ? 'Ready' : `${data.issueCount} issue${data.issueCount === 1 ? '' : 's'}`}
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-border">
        {metrics.map(([label, value]) => (
          <div key={String(label)} className="bg-card px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {data.sellableNext30Days ? (
            <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sellable inventory exists in the next 30 days</>
          ) : (
            <><AlertTriangle className="h-4 w-4 text-amber-600" /> No confirmed sellable inventory in the next 30 days</>
          )}
        </div>
        {data.issues.length > 0 && (
          <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
            {data.issues.slice(0, 6).map(issue => <li key={issue}>• {issue}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
