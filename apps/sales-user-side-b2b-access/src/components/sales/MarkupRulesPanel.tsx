import { useState } from 'react';
import { GetSalesPortalDataOutputType } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';

type MarkupRule = GetSalesPortalDataOutputType['markupRules'][0];

interface MarkupRulesPanelProps {
  rules: MarkupRule[];
}

const SCOPE_COLORS: Record<string, string> = {
  'Global (All Hotels)': 'bg-primary/10 text-primary border-primary/20',
  'Specific Hotel': 'bg-orange-100 text-orange-700 border-orange-200',
};

export default function MarkupRulesPanel({ rules }: MarkupRulesPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Markup Rules</span>
          <Badge variant="secondary" className="text-xs">{rules.length} rules</Badge>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
          {rules.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No active markup rules</p>}
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40">
              <div>
                <p className="text-sm font-medium text-foreground">{rule.name}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${SCOPE_COLORS[rule.appliesTo] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {rule.appliesTo}
                </span>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary text-sm">
                  {rule.type === 'Percentage (%)' ? `+${rule.value}%` : `+AED ${rule.value}`}
                </p>
                <p className="text-xs text-muted-foreground">{rule.type}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
