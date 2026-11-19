import { useState, useEffect } from 'react';
import { validateProperty, ValidatePropertyOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Progress } from '@project/components/ui/progress';
import { CheckCircle2, AlertTriangle, Circle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type ValidationResult = ValidatePropertyOutputType;

interface Props {
  hotelId: string;
  hotelName?: string;
  lifecycleStatus?: string;
}

export default function PropertyReadinessStrip({ hotelId, hotelName, lifecycleStatus }: Props) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [running, setRunning] = useState(false);

  const runCheck = async () => {
    setRunning(true);
    try {
      const r = await validateProperty({ hotelId });
      setResult(r);
      if (r.issues.length === 0) toast.success('Property is ready!');
      else toast.info(`${r.issues.length} issue(s) found`);
    } catch { toast.error('Validation failed'); }
    finally { setRunning(false); }
  };

  useEffect(() => { runCheck(); }, [hotelId]);

  const pct = result ? Math.round((result.completedCount / result.totalSteps) * 100) : 0;

  return (
    <div className="border border-border rounded-xl bg-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Property</p>
          <h2 className="text-lg font-semibold">{hotelName ?? 'Hotel'}</h2>
        </div>
        <div className="flex items-center gap-2">
          {lifecycleStatus && (
            <Badge variant="secondary" className="text-xs uppercase">{lifecycleStatus}</Badge>
          )}
          <Button size="sm" variant="outline" onClick={runCheck} disabled={running}>
            {running ? 'Checking...' : 'Run Property Check'}
          </Button>
        </div>
      </div>

      {result && (
        <>
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium">Property Readiness: {result.completedCount} / {result.totalSteps} complete</span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-xs">
            {result.steps.map((step, i) => (
              <div key={i} className={`rounded-lg border px-2 py-2 ${step.complete ? 'border-border' : 'border-border bg-muted'}`}>
                {step.complete
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 mb-1" />
                  : <Circle className="w-4 h-4 text-muted-foreground mb-1" />}
                <p className="text-[11px]">{step.label}</p>
              </div>
            ))}
          </div>

          {result.issues.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''} need attention
              </h3>
              <div className="divide-y divide-border border border-border rounded-lg">
                {result.issues.map((issue, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-start gap-2">
                      {issue.severity === 'error'
                        ? <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        : <ShieldCheck className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                      <div>
                        <p className="text-sm font-medium">{issue.message}</p>
                        <p className="text-xs text-muted-foreground font-mono">{issue.code}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
