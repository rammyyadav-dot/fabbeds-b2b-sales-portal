import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { validateRateImportJob, ValidateRateImportJobOutputType } from 'zitejs/api';
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react';

type ValidationResult = ValidateRateImportJobOutputType;

interface Props {
  jobId: string;
  onNext: (result: ValidationResult) => void;
  onBack: () => void;
}

export default function StepValidate({ jobId, onNext, onBack }: Props) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runValidation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await validateRateImportJob({ jobId });
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {!result && !loading && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">Click below to run validation on all {' '}
            <strong>rate lines</strong>. This checks for missing mappings, invalid dates, and rate conflicts.
          </p>
          <Button onClick={runValidation} size="lg">Run Validation</Button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Validating all rate lines...</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <XCircle className="w-4 h-4 mt-0.5" />{error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-700">{result.okCount}</p>
              <p className="text-xs text-green-600">Valid lines</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <AlertCircle className="w-6 h-6 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-700">{result.warnCount}</p>
              <p className="text-xs text-amber-600">Warnings</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700">{result.errorCount}</p>
              <p className="text-xs text-red-600">Errors</p>
            </div>
          </div>

          {result.canCommit ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4" />
              All lines are valid. You can proceed to commit.
              {result.warnCount > 0 && <span className="text-amber-600">(with {result.warnCount} warnings)</span>}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <XCircle className="w-4 h-4 mt-0.5" />
              {result.errorCount} error{result.errorCount !== 1 ? 's' : ''} must be fixed before committing.
              Go back to Mapping and correct the unmapped items.
            </div>
          )}

          <Button variant="outline" size="sm" onClick={runValidation} disabled={loading}>
            Re-run Validation
          </Button>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Back to Mapping</Button>
        <Button
          disabled={!result?.canCommit}
          onClick={() => result && onNext(result)}
        >
          Next: Commit →
        </Button>
      </div>
    </div>
  );
}
