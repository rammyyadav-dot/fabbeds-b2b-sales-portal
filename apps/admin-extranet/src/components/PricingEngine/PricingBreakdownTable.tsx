import { GetPricingEngineOutputType } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@project/components/lib/utils';

type Night = GetPricingEngineOutputType['perNightBreakdown'][0];

const statusColor: Record<string, string> = {
  'Free Sale': 'bg-green-100 text-green-700',
  'Limited': 'bg-amber-100 text-amber-700',
  'On Request': 'bg-blue-100 text-blue-700',
  'Stop Sale': 'bg-red-100 text-red-700',
  'No Rate': 'bg-gray-100 text-gray-600',
};

const sourceColor: Record<string, string> = {
  'DailyRates': 'bg-blue-50 text-blue-700 border-blue-200',
  'NetRates': 'bg-purple-50 text-purple-700 border-purple-200',
  'None': 'bg-gray-50 text-gray-500 border-gray-200',
};

function NightRow({ n }: { n: Night }) {
  const noRate = n.netSource === 'None';
  return (
    <tr className={cn('border-b border-border last:border-0 text-sm', noRate && 'opacity-50 bg-muted/30')}>
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{n.date}</td>
      <td className="px-3 py-2.5">
        <Badge variant="outline" className={`text-[10px] px-1.5 ${sourceColor[n.netSource] ?? ''}`}>{n.netSource}</Badge>
        {n.rateLayer && <span className="ml-1 text-[10px] text-muted-foreground font-mono">[{n.rateLayer}]</span>}
      </td>
      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{noRate ? '—' : `AED ${n.netRate.toLocaleString()}`}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {n.markupRuleName ? (
          <span className="truncate max-w-[120px] block" title={n.markupRuleName}>{n.markupRuleName}</span>
        ) : <span className="text-destructive/70 text-[10px]">No rule</span>}
        {n.markupValue != null && <span className="text-[10px] text-muted-foreground ml-1">({n.markupType === 'Percentage (%)' ? `${n.markupValue}%` : `AED ${n.markupValue}`})</span>}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-orange-600 font-medium">
        {noRate ? '—' : `+AED ${n.markupAmount.toLocaleString()}`}
        {n.maxCapApplied && <span className="ml-1 text-[10px] text-amber-600">[capped]</span>}
        {n.floorApplied && <span className="ml-1 text-[10px] text-blue-600">[floor]</span>}
      </td>
      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-foreground">{noRate ? '—' : `AED ${n.sellRate.toLocaleString()}`}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {!noRate && <span className={cn('text-xs font-semibold', n.marginPct >= 10 ? 'text-green-600' : n.marginPct >= 5 ? 'text-amber-600' : 'text-red-600')}>{n.marginPct}%</span>}
      </td>
      <td className="px-3 py-2.5">
        <Badge className={`text-[10px] px-1.5 h-4 ${statusColor[n.availabilityStatus] ?? 'bg-gray-100 text-gray-600'}`}>{n.availabilityStatus}</Badge>
      </td>
    </tr>
  );
}

interface Props {
  nights: GetPricingEngineOutputType['perNightBreakdown'];
}

export default function PricingBreakdownTable({ nights }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <ArrowRight className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-sm">Per-Night Pricing Breakdown</h3>
        <span className="text-xs text-muted-foreground ml-auto">Net Rate → Markup → Floor → Sell Rate</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-right">Net Rate</th>
              <th className="px-3 py-2 text-left">Markup Rule</th>
              <th className="px-3 py-2 text-right">Markup</th>
              <th className="px-3 py-2 text-right">Sell Rate</th>
              <th className="px-3 py-2 text-right">Margin %</th>
              <th className="px-3 py-2 text-left">Avail</th>
            </tr>
          </thead>
          <tbody>
            {nights.map(n => <NightRow key={n.date} n={n} />)}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-muted/20 border-t border-border flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />[floor] = minimum margin floor applied</span>
        <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" />[capped] = maxMarkupValue cap applied</span>
      </div>
    </div>
  );
}
