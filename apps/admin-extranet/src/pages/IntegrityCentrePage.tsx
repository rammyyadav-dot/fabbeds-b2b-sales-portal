import { useState, useEffect } from 'react';
import { getIntegrityReport, GetIntegrityReportOutputType } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { ShieldCheck, AlertTriangle, Wrench, Search } from 'lucide-react';

type Report = GetIntegrityReportOutputType;

export default function IntegrityCentrePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getIntegrityReport({});
      setReport(r);
    } catch {
      setReport(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-48" />
    </div>
  );

  if (!report) return <div className="p-6 text-center text-muted-foreground">Failed to load report.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Property Integrity</h1>
          <p className="text-sm text-muted-foreground mt-1">{report.totalProperties} properties scanned</p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2"><Search className="w-4 h-4" />Re-scan</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-3xl font-bold">{report.healthy}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> Healthy
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-3xl font-bold">{report.warnings}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Warnings
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-5">
            <p className="text-3xl font-bold">{report.needsRepair}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5 text-destructive" /> Require repair
            </p>
          </CardContent>
        </Card>
      </div>

      {report.issues.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-green-600" />
          <p className="font-medium text-foreground">All properties are healthy</p>
          <p className="text-sm">No integrity issues found across the portfolio</p>
        </div>
      ) : (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Issues</h2>
          <div className="divide-y divide-border border border-border rounded-xl">
            {report.issues.map((issue, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{issue.description}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{issue.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={issue.severity === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                    {issue.count}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{issue.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
