import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { ParsedRateLine } from '@/utils/rateFileParser';
import { ScrollArea } from '@project/components/ui/scroll-area';

interface Props {
  lines: ParsedRateLine[];
  fileName: string;
  sourceType: 'CSV' | 'PDF';
  termsText?: string;
  onNext: () => void;
  onBack: () => void;
}

const OCC_COLORS: Record<string, string> = {
  SGL: 'bg-blue-100 text-blue-700',
  DBL: 'bg-green-100 text-green-700',
  TPL: 'bg-purple-100 text-purple-700',
};

export default function StepPreview({ lines, fileName, sourceType, termsText, onNext, onBack }: Props) {
  const groups = [...new Set(lines.map(l => l.groupName ?? ''))].filter(Boolean);
  const rooms = [...new Set(lines.map(l => l.roomLabel))];
  const meals = [...new Set(lines.map(l => l.mealLabel))];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Lines', value: lines.length },
          { label: 'Room Labels', value: rooms.length },
          { label: 'Meal Labels', value: meals.length },
          { label: 'Groups', value: groups.length || '—' },
        ].map(s => (
          <div key={s.label} className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* File info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{sourceType}</Badge>
        <span className="font-mono">{fileName}</span>
      </div>

      {/* Rate lines table */}
      <ScrollArea className="h-64 rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 sticky top-0">
            <tr>
              {['Group', 'Room Label', 'Meal', 'From', 'To', 'Occ', 'Amount', 'Rate Code'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.slice(0, 200).map((l, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/10">
                <td className="px-3 py-1.5 text-muted-foreground">{l.groupName ?? '—'}</td>
                <td className="px-3 py-1.5 font-medium">{l.roomLabel}</td>
                <td className="px-3 py-1.5">{l.mealLabel}</td>
                <td className="px-3 py-1.5 font-mono">{l.fromDate}</td>
                <td className="px-3 py-1.5 font-mono">{l.toDate}</td>
                <td className="px-3 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${OCC_COLORS[l.occupancyKey] ?? 'bg-muted text-muted-foreground'}`}>
                    {l.occupancyKey}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-mono font-semibold">{l.amount.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-muted-foreground font-mono">{l.rateCode ?? '—'}</td>
              </tr>
            ))}
            {lines.length > 200 && (
              <tr><td colSpan={8} className="px-3 py-2 text-center text-muted-foreground italic">...and {lines.length - 200} more lines</td></tr>
            )}
          </tbody>
        </table>
      </ScrollArea>

      {termsText && (
        <details className="rounded-lg border border-orange-200 bg-orange-50">
          <summary className="px-4 py-2 text-xs font-semibold text-orange-700 cursor-pointer">Extracted Terms / Campaign Notes</summary>
          <pre className="px-4 pb-3 text-xs text-orange-800 whitespace-pre-wrap">{termsText}</pre>
        </details>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Re-upload</Button>
        <Button onClick={onNext}>Next: Map Room Types →</Button>
      </div>
    </div>
  );
}
