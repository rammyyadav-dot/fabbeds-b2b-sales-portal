import { GetPricingEngineOutputType } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

type Rule = GetPricingEngineOutputType['appliedRules'][0];

interface Props {
  rules: Rule[];
  pricingErrors: string[];
  blockedDates: string[];
}

function RuleCard({ rule }: { rule: Rule }) {
  const isEvent = rule.ruleCategory === 'Event Override' || rule.ruleCategory === 'event_override';
  return (
    <div className="flex items-start gap-3 p-3 border border-border rounded-lg bg-muted/20">
      <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground">{rule.ruleName ?? 'Unnamed Rule'}</span>
          {isEvent && <Badge className="text-[10px] h-4 px-1.5 bg-orange-100 text-orange-700">Event Override</Badge>}
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{rule.appliesTo}</Badge>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="font-mono bg-card border border-border rounded px-1.5 py-0.5">
            {rule.markupType === 'Percentage (%)' ? `${rule.markupValue}% markup` : `AED ${rule.markupValue} fixed`}
          </span>
          {rule.maxMarkupValue != null && <span className="font-mono bg-card border border-border rounded px-1.5 py-0.5">Max AED {rule.maxMarkupValue}</span>}
          {rule.startDate && <span>From {rule.startDate}</span>}
          {rule.endDate && <span>To {rule.endDate}</span>}
          <span className="text-primary font-semibold">{rule.nightsApplied} night{rule.nightsApplied !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

export default function PricingRulesPanel({ rules, pricingErrors, blockedDates }: Props) {
  return (
    <div className="space-y-3">
      {pricingErrors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="font-bold text-sm text-destructive">Pricing Warnings</span>
          </div>
          {pricingErrors.map((e, i) => <p key={i} className="text-sm text-destructive/90 pl-6">{e}</p>)}
        </div>
      )}
      {blockedDates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-sm text-amber-700">Blackout Dates ({blockedDates.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {blockedDates.map(d => <span key={d} className="font-mono text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">{d}</span>)}
          </div>
        </div>
      )}
      {rules.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            Applied Markup Rules
          </h3>
          <div className="space-y-2">
            {rules.map((r, i) => <RuleCard key={i} rule={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}
