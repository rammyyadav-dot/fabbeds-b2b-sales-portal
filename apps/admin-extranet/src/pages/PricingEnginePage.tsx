import { useState } from 'react';
import { getPricingEngine, GetPricingEngineOutputType } from 'zitejs/api';
import { toast } from 'sonner';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Zap, Info } from 'lucide-react';
import PricingSearchForm, { PricingSearchParams } from '@/components/PricingEngine/PricingSearchForm';
import PricingSummaryCards from '@/components/PricingEngine/PricingSummaryCards';
import PricingBreakdownTable from '@/components/PricingEngine/PricingBreakdownTable';
import PricingRulesPanel from '@/components/PricingEngine/PricingRulesPanel';

type EngineResult = GetPricingEngineOutputType;

const statusBadge: Record<string, string> = {
  'Free Sale': 'bg-green-100 text-green-700 border-green-200',
  'Limited': 'bg-amber-100 text-amber-700 border-amber-200',
  'On Request': 'bg-blue-100 text-blue-700 border-blue-200',
  'Stop Sale': 'bg-red-100 text-red-700 border-red-200',
  'Blackout': 'bg-red-100 text-red-700 border-red-200',
  'No Rates': 'bg-gray-100 text-gray-600 border-gray-200',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default function PricingEnginePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EngineResult | null>(null);

  const handleSearch = async (params: PricingSearchParams) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await getPricingEngine(params);
      setResult(res);
      if (!res.hasRates) toast.warning('No rates found for the selected criteria');
    } catch (err: any) {
      toast.error(err?.message ?? 'Pricing engine error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-black text-foreground">Pricing Engine</h1>
          <p className="text-sm text-muted-foreground">OTA/Bedbank rate calculator — Net Rate → Markup → Floor → Sell Price</p>
        </div>
        {result && (
          <Badge variant="outline" className={`ml-auto text-xs px-2 py-1 ${statusBadge[result.availabilityStatus] ?? ''}`}>
            {result.availabilityStatus}
          </Badge>
        )}
      </div>

      {/* How it works */}
      <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 flex gap-3">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Engine order:</strong> Pull valid daily rates → Layer priority (OVERRIDE › PROMO › BASE › FALLBACK) → Fallback to season NetRates → Check blackout dates → Apply markup rule (hotel-specific event override › hotel-specific › global event override › global) → Apply date validity → Cap at maxMarkupValue → Enforce minimum margin floor → Display sell rate.
        </p>
      </div>

      <PricingSearchForm onSearch={handleSearch} loading={loading} />

      {loading && <LoadingSkeleton />}

      {!loading && result && (
        <div className="space-y-5">
          {result.summary && <PricingSummaryCards summary={result.summary} nights={result.nights} />}
          <PricingRulesPanel rules={result.appliedRules} pricingErrors={result.pricingErrors} blockedDates={result.blockedDates} />
          {result.perNightBreakdown.length > 0 && <PricingBreakdownTable nights={result.perNightBreakdown} />}
        </div>
      )}

      {!loading && !result && (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Select a hotel, room, and dates to run the pricing engine</p>
          <p className="text-sm mt-1">The engine will show a full per-night breakdown with markup rules applied</p>
        </div>
      )}
    </div>
  );
}
