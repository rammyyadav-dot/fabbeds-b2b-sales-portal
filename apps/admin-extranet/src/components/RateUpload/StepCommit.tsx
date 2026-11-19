import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { commitRateImportJob, CommitRateImportJobOutputType } from 'zitejs/api';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { ValidateRateImportJobOutputType } from 'zitejs/api';

type CommitResult = CommitRateImportJobOutputType;
type ValidationResult = ValidateRateImportJobOutputType;

interface Props {
  jobId: string;
  jobName: string;
  validationResult: ValidationResult;
  onBack: () => void;
  onDone: () => void;
}

export default function StepCommit({ jobId, jobName, validationResult, onBack, onDone }: Props) {
  const [result, setResult] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await commitRateImportJob({ jobId });
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? 'Commit failed');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <div>
            <p className="font-bold text-foreground">Import Committed Successfully!</p>
            <p className="text-xs text-muted-foreground">{jobName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Rate Plans Created', value: result.ratePlansCreated, color: 'text-primary' },
            { label: 'Rate Plans Reused', value: result.ratePlansReused, color: 'text-blue-600' },
            { label: 'Daily Rates Written', value: result.dailyRatesWritten, color: 'text-green-600' },
            { label: 'Skipped', value: result.skipped, color: 'text-amber-600' },
            { label: 'Errors', value: result.errors, color: 'text-destructive' },
          ].map(s => (
            <div key={s.label} className="bg-muted/30 rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {result.errors > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Some lines had errors during commit. Review the import job for details.
          </p>
        )}

        <div className="flex gap-3">
          <Button onClick={onDone} className="flex-1">Done — View Import History</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-3">
        <p className="font-semibold text-sm">Ready to Commit</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Valid lines to commit</p>
            <p className="font-bold text-green-600">{validationResult.okCount + validationResult.warnCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Warnings (will commit)</p>
            <p className="font-bold text-amber-600">{validationResult.warnCount}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          This will upsert RatePlans and write DailyRates to the database.
          The action cannot be undone automatically.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <XCircle className="w-4 h-4 mt-0.5" />{error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Committing rates to database...</p>
          <p className="text-xs text-muted-foreground">This may take a moment for large files</p>
        </div>
      )}

      {!loading && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button onClick={handleCommit} className="bg-green-600 hover:bg-green-700 text-white gap-2">
            <CheckCircle2 className="w-4 h-4" /> Commit Import
          </Button>
        </div>
      )}
    </div>
  );
}
