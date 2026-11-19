import { useState, useRef } from 'react';
import { Button } from '@project/components/ui/button';
import { UploadCloud, FileText, AlertCircle } from 'lucide-react';
import { parseCSV, parsePDFFile, ParsedRateLine } from '@/utils/rateFileParser';

interface Props {
  onParsed: (lines: ParsedRateLine[], fileName: string, sourceType: 'CSV' | 'PDF', termsText?: string) => void;
  onBack: () => void;
}

export default function StepUpload({ onParsed, onBack }: Props) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setParsing(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.pdf')) {
        const buf = await file.arrayBuffer();
        const { lines, termsText } = await parsePDFFile(buf);
        if (lines.length === 0) throw new Error('No rate data found in PDF. Ensure it is a digital (not scanned) PDF.');
        onParsed(lines, file.name, 'PDF', termsText);
      } else if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
        const text = await file.text();
        const lines = parseCSV(text);
        if (lines.length === 0) throw new Error('No rate rows found. Check your CSV has From Date, To Date, Room Type, and rate columns.');
        onParsed(lines, file.name, 'CSV');
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        throw new Error('Excel files must be saved as CSV first. In Excel: File → Save As → CSV (Comma delimited).');
      } else {
        throw new Error('Unsupported file type. Please upload a CSV or PDF file.');
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-5">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <UploadCloud className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-semibold text-sm">Drop your rate file here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Supports: CSV, TSV, PDF (digital text only)</p>
        <p className="text-xs text-orange-600 mt-1">Excel files: please save as CSV first (File → Save As → CSV)</p>
        <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,.pdf,.xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {parsing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Parsing file...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />CSV Format Guide</p>
        <p className="text-xs text-muted-foreground">Required columns: <code className="bg-muted px-1 rounded">From Date</code>, <code className="bg-muted px-1 rounded">To Date</code>, <code className="bg-muted px-1 rounded">Room Type</code>, <code className="bg-muted px-1 rounded">Meal Plan</code></p>
        <p className="text-xs text-muted-foreground">Rate columns: <code className="bg-muted px-1 rounded">SGL</code>, <code className="bg-muted px-1 rounded">DBL</code>, <code className="bg-muted px-1 rounded">TPL</code> (use N/A for unavailable)</p>
        <p className="text-xs text-muted-foreground">Optional: <code className="bg-muted px-1 rounded">Rate Code</code>, <code className="bg-muted px-1 rounded">Season</code>, <code className="bg-muted px-1 rounded">Min Stay</code></p>
      </div>

      <Button variant="outline" onClick={onBack}>← Back</Button>
    </div>
  );
}
