import { Calendar } from 'lucide-react';

interface SeasonPrice {
  id: string;
  seasonName: string;
  validFrom: string;
  validTo: string;
  retailAdultTwin: number;
  retailAdultSingle: number;
  retailChildWithBed: number;
  retailChildNoBed: number;
  allotmentCap: number | null;
}

function fmt(n: number) {
  return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SeasonPriceGrid({ seasons }: { seasons: SeasonPrice[] }) {
  if (seasons.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No season pricing configured yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Season</th>
            <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valid Dates</th>
            <th className="text-right py-3 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Twin Share /pp</th>
            <th className="text-right py-3 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Single /pp</th>
            <th className="text-right py-3 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Child +Bed</th>
            <th className="text-right py-3 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Child -Bed</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map(s => {
            const today = new Date().toISOString().split('T')[0];
            const isCurrent = s.validFrom <= today && s.validTo >= today;
            return (
              <tr key={s.id} className={`border-b border-border/50 ${isCurrent ? 'bg-primary/5' : 'hover:bg-muted/30'} transition-colors`}>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-semibold text-xs">{s.seasonName}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-700 px-1.5 py-0.5 rounded-full">ACTIVE</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3 text-xs text-muted-foreground">
                  {fmtDate(s.validFrom)} – {fmtDate(s.validTo)}
                </td>
                <td className="py-3 px-3 text-right font-semibold text-xs">{fmt(s.retailAdultTwin)}</td>
                <td className="py-3 px-3 text-right text-xs">{fmt(s.retailAdultSingle)}</td>
                <td className="py-3 px-3 text-right text-xs">{fmt(s.retailChildWithBed)}</td>
                <td className="py-3 px-3 text-right text-xs text-muted-foreground">{fmt(s.retailChildNoBed)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
