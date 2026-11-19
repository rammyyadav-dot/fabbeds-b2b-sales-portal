import { useState, useEffect } from 'react';
import { runRateSync, RunRateSyncOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Alert, AlertDescription } from '@project/components/ui/alert';
import { Skeleton } from '@project/components/ui/skeleton';
import { ScrollArea } from '@project/components/ui/scroll-area';
import { RefreshCw, Play, GitCompare, AlertCircle, Clock, CheckCircle2, AlertTriangle, Building2, BedDouble, Database, CalendarDays, Circle, Loader2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@project/components/lib/utils';

type SyncResult = RunRateSyncOutputType;

const FLOW_STEPS = ['Trigger','Check Lock','Load Admin Rates','Load User Rates','Compare','Apply Updates','Recheck','Write Logs','Release Lock'];
const ISSUE_COLORS: Record<string, string> = {
  NULL_RATE: 'bg-red-100 text-red-700 border-red-200',
  NEGATIVE_RATE: 'bg-orange-100 text-orange-700 border-orange-200',
  MISSING_RATE_PLAN: 'bg-amber-100 text-amber-700 border-amber-200',
  NO_NET_RATE: 'bg-purple-100 text-purple-700 border-purple-200',
};

function FlowDiagram({ running, done, step }: { running: boolean; done: boolean; step: number }) {
  return (
    <div className="flex flex-col items-center gap-0 py-1">
      {FLOW_STEPS.map((s, i) => {
        const state = done ? 'done' : running && i === step ? 'active' : running && i < step ? 'done' : 'idle';
        return (
          <div key={s} className="flex flex-col items-center">
            <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              state === 'done' && 'bg-emerald-50 border-emerald-200 text-emerald-700',
              state === 'active' && 'bg-primary/10 border-primary text-primary',
              state === 'idle' && 'bg-muted border-border text-muted-foreground',
            )}>
              {state === 'done' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {state === 'active' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {state === 'idle' && <Circle className="w-3.5 h-3.5" />}
              {s}
            </div>
            {i < FLOW_STEPS.length - 1 && <div className={cn('w-px h-3', state === 'done' ? 'bg-emerald-300' : 'bg-border')} />}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${color}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div>
        <p className="text-lg font-black leading-none">{value.toLocaleString()}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function RateSyncPage() {
  const [result, setResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading) { setStep(0); return; }
    const t = setInterval(() => setStep(s => Math.min(s + 1, 8)), 900);
    return () => clearInterval(t);
  }, [loading]);

  const runSync = async () => {
    setLoading(true); setStep(0);
    try { setResult(await runRateSync({})); } finally { setLoading(false); }
  };

  const duration = result ? ((new Date(result.endTime).getTime() - new Date(result.startTime).getTime()) / 1000).toFixed(1) : null;
  const s = result?.summary;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">Rate Sync & Recheck</h1>
            <p className="text-sm text-muted-foreground">Admin Rates ↔ Daily Rates · Internal DB Reconciliation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {result && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(result.checkedAt), 'dd MMM HH:mm')} · {duration}s
              <Badge variant="outline" className={result.status === 'success' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                {result.status.toUpperCase()}
              </Badge>
            </div>
          )}
          <Button onClick={runSync} disabled={loading} className="gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? 'Running Sync…' : result ? 'Re-run Sync' : 'Run Sync'}
          </Button>
        </div>
      </div>

      {/* Idle */}
      {!result && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center">
            <GitCompare className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No sync has been run yet</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Run Sync" to validate all loaded rates against the admin source</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Sync Flow</CardTitle></CardHeader><CardContent><FlowDiagram running={true} done={false} step={step} /></CardContent></Card>
        </div>
      )}

      {/* Results */}
      {result && !loading && s && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {result.validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-bold mb-1">Warnings ({result.validationErrors.length})</p>
                  <ul className="text-xs space-y-0.5">{result.validationErrors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
                </AlertDescription>
              </Alert>
            )}

            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Sync Summary · {result.runId}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon={Building2} label="Hotels" value={s.totalHotels} color="bg-sky-50 border-sky-200 text-sky-700" />
                  <StatCard icon={BedDouble} label="Room Types" value={s.totalRoomTypes} color="bg-indigo-50 border-indigo-200 text-indigo-700" />
                  <StatCard icon={Database} label="Rate Plans" value={s.totalRatePlans} color="bg-violet-50 border-violet-200 text-violet-700" />
                  <StatCard icon={CalendarDays} label="Daily Rates" value={s.totalDailyRates} color="bg-amber-50 border-amber-200 text-amber-700" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon={CheckCircle} label="Valid Records" value={s.totalValid} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
                  <StatCard icon={AlertTriangle} label="Flagged Issues" value={s.totalFlagged} color="bg-orange-50 border-orange-200 text-orange-700" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Issue Breakdown</p>
                  {[['Null Rates', s.totalNullRates], ['Negative Rates', s.totalNegativeRates], ['Missing Rate Plan', s.totalMissingRatePlan], ['No Net Rate (Admin)', s.totalNoNetRate]].map(([label, val]) => (
                    <div key={String(label)} className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-muted">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-bold ${Number(val) > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  Discrepancy Log
                  {result.discrepancies.length > 0 && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">{result.discrepancies.length} issues</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {result.discrepancies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                    <p className="font-semibold text-foreground">No discrepancies found</p>
                    <p className="text-xs text-muted-foreground mt-1">All loaded rates passed validation</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[360px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <tr>{['Hotel','Room Type','Date','Issue','Found','Expected'].map(h => <th key={h} className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wide text-[10px]">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {result.discrepancies.map((d, i) => (
                          <tr key={i} className="hover:bg-muted/40">
                            <td className="px-3 py-2 font-medium max-w-[110px] truncate">{d.hotelName}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[90px] truncate">{d.roomTypeName}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{d.date}</td>
                            <td className="px-3 py-2"><Badge variant="outline" className={`text-[10px] font-bold ${ISSUE_COLORS[d.issueType] ?? ''}`}>{d.issueType.replace(/_/g,' ')}</Badge></td>
                            <td className="px-3 py-2 text-destructive font-mono">{d.oldValue}</td>
                            <td className="px-3 py-2 text-muted-foreground">{d.newValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Sync Flow</CardTitle></CardHeader>
            <CardContent><FlowDiagram running={false} done={true} step={9} /></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
