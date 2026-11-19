import { GetPricingEngineOutputType } from 'zitejs/api';
import { TrendingUp, DollarSign, Percent, Moon } from 'lucide-react';

type Summary = NonNullable<GetPricingEngineOutputType['summary']>;

interface Props {
  summary: Summary;
  nights: number;
}

function Card({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function PricingSummaryCards({ summary, nights }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card label="Total Net Cost" value={`AED ${summary.totalNet.toLocaleString()}`}
        sub={`AED ${summary.avgNetPerNight.toLocaleString()} / night`}
        icon={DollarSign} color="bg-blue-100 text-blue-600" />
      <Card label="Total Sell Price" value={`AED ${summary.totalSell.toLocaleString()}`}
        sub={`AED ${summary.avgSellPerNight.toLocaleString()} / night`}
        icon={TrendingUp} color="bg-green-100 text-green-600" />
      <Card label="Total Margin" value={`AED ${summary.totalMargin.toLocaleString()}`}
        sub={`${summary.avgMarginPct}% avg margin`}
        icon={Percent} color="bg-orange-100 text-orange-600" />
      <Card label="Nights" value={String(nights)}
        sub={`${nights} night${nights !== 1 ? 's' : ''} priced`}
        icon={Moon} color="bg-purple-100 text-purple-600" />
    </div>
  );
}
