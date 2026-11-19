import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHotels, getRoomTypes, createRateImportJob, getRateImportJobs, applyRateImportMappings,
  GetHotelsOutputType, GetRoomTypesOutputType, GetRateImportJobsOutputType } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { ArrowLeft, Upload, History, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import WizardStepper from '@/components/RateUpload/WizardStepper';
import StepContext, { WizardContext } from '@/components/RateUpload/StepContext';
import StepUpload from '@/components/RateUpload/StepUpload';
import StepPreview from '@/components/RateUpload/StepPreview';
import StepMapping from '@/components/RateUpload/StepMapping';
import StepValidate from '@/components/RateUpload/StepValidate';
import StepCommit from '@/components/RateUpload/StepCommit';
import { ParsedRateLine } from '@/utils/rateFileParser';
import { ValidateRateImportJobOutputType } from 'zitejs/api';

type Hotel = GetHotelsOutputType['hotels'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];
type Job = GetRateImportJobsOutputType['jobs'][0];

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  Draft: { icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  Validated: { icon: AlertCircle, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  Committed: { icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  Failed: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

export default function RateUploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Wizard state
  const [ctx, setCtx] = useState<WizardContext>({ hotelId: '', currency: 'AED', layer: 'BAR', importMode: 'SLAB', conflictMode: 'OVERRIDE' });
  const [parsedLines, setParsedLines] = useState<ParsedRateLine[]>([]);
  const [fileName, setFileName] = useState('');
  const [sourceType, setSourceType] = useState<'CSV' | 'PDF'>('CSV');
  const [termsText, setTermsText] = useState<string | undefined>();
  const [roomMapping, setRoomMapping] = useState<Record<string, { id: string; name: string }>>({});
  const [mealMapping, setMealMapping] = useState<Record<string, string>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobName, setJobName] = useState('');
  const [validationResult, setValidationResult] = useState<ValidateRateImportJobOutputType | null>(null);
  const [savingJob, setSavingJob] = useState(false);

  useEffect(() => {
    Promise.all([getHotels({}), getRateImportJobs({})]).then(([h, j]) => {
      setHotels(h.hotels);
      setJobs(j.jobs);
    }).finally(() => setLoadingInit(false));
  }, []);

  useEffect(() => {
    if (ctx.hotelId) {
      getRoomTypes({ hotelId: ctx.hotelId }).then(r => setRoomTypes(r.roomTypes));
    }
  }, [ctx.hotelId]);

  const handleParsed = (lines: ParsedRateLine[], name: string, type: 'CSV' | 'PDF', terms?: string) => {
    setParsedLines(lines);
    setFileName(name);
    setSourceType(type);
    setTermsText(terms);
    setStep(2);
  };

  // Before mapping step: create the job in DB
  const handlePreviewNext = async () => {
    setSavingJob(true);
    try {
      const res = await createRateImportJob({
        hotelId: ctx.hotelId,
        fileName,
        sourceType,
        currency: ctx.currency,
        layer: ctx.layer,
        importMode: ctx.importMode,
        conflictMode: ctx.conflictMode,
        extractedTerms: termsText,
        lines: parsedLines,
      });
      setJobId(res.jobId);
      setJobName(`${fileName} — ${new Date().toLocaleDateString('en-GB')}`);
      setStep(3);
    } catch (e: any) {
      toast.error('Failed to save import job: ' + (e.message ?? ''));
    } finally {
      setSavingJob(false);
    }
  };

  const refreshJobs = async () => {
    const j = await getRateImportJobs({ hotelId: ctx.hotelId || undefined });
    setJobs(j.jobs);
  };

  const resetWizard = () => {
    setStep(0);
    setParsedLines([]);
    setFileName('');
    setSourceType('CSV');
    setTermsText(undefined);
    setRoomMapping({});
    setMealMapping({});
    setJobId(null);
    setValidationResult(null);
    setShowHistory(true);
    refreshJobs();
  };

  if (loadingInit) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="font-bold text-xl text-foreground flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" /> Rate File Import
          </h1>
          <p className="text-xs text-muted-foreground">Upload CSV or PDF rate sheets and commit to the database</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => setShowHistory(v => !v)}>
          <History className="w-3.5 h-3.5" />{showHistory ? 'Hide' : 'Import'} History
        </Button>
      </div>

      {/* Import History */}
      {showHistory && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <p className="font-semibold text-sm">Import History</p>
          </div>
          {jobs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground italic text-center">No imports yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {jobs.map(job => {
                const cfg = STATUS_CONFIG[job.status ?? 'Draft'] ?? STATUS_CONFIG.Draft;
                const Icon = cfg.icon;
                return (
                  <div key={job.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10">
                    <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{job.jobName ?? job.fileName}</p>
                      <p className="text-xs text-muted-foreground">{job.layer} · {job.currency} · {job.totalLines ?? 0} lines</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${cfg.color} ${cfg.bg} border`}>{job.status}</Badge>
                    {job.createdAt && <p className="text-[10px] text-muted-foreground shrink-0">{new Date(job.createdAt).toLocaleDateString()}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Wizard Card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <WizardStepper current={step} />

        <div>
          {step === 0 && (
            <StepContext hotels={hotels} ctx={ctx} onChange={setCtx} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <StepUpload onParsed={handleParsed} onBack={() => setStep(0)} />
          )}
          {step === 2 && (
            <StepPreview
              lines={parsedLines}
              fileName={fileName}
              sourceType={sourceType}
              termsText={termsText}
              onNext={handlePreviewNext}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && jobId && (
            <StepMapping
              lines={parsedLines}
              roomTypes={roomTypes}
              hotelId={ctx.hotelId}
              layer={ctx.layer}
              roomMapping={roomMapping}
              mealMapping={mealMapping}
              onRoomMap={(label, id, name) => setRoomMapping(m => ({ ...m, [label]: { id, name } }))}
              onRoomTypesCreated={newRts => setRoomTypes(prev => [...prev, ...newRts.filter(n => !prev.find(p => p.id === n.id))])}
              onMealMap={(label, code) => setMealMapping(m => ({ ...m, [label]: code }))}
              onNext={async () => {
                try {
                  await applyRateImportMappings({
                    jobId: jobId!,
                    roomMappings: Object.entries(roomMapping).map(([label, v]) => ({ label, roomTypeId: v.id, roomTypeName: v.name })),
                    mealMappings: Object.entries(mealMapping).map(([label, mealPlanCode]) => ({ label, mealPlanCode })),
                  });
                  setStep(4);
                } catch (e: any) {
                  toast.error('Failed to save mappings: ' + (e.message ?? ''));
                }
              }}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && jobId && (
            <StepValidate
              jobId={jobId}
              onNext={res => { setValidationResult(res); setStep(5); }}
              onBack={() => setStep(3)}
            />
          )}
          {step === 5 && jobId && validationResult && (
            <StepCommit
              jobId={jobId}
              jobName={jobName}
              validationResult={validationResult}
              onBack={() => setStep(4)}
              onDone={resetWizard}
            />
          )}
        </div>
      </div>
    </div>
  );
}
