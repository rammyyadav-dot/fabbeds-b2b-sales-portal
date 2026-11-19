import { Badge } from '@project/components/ui/badge';
import { MEAL_PLAN_LABELS } from '@/data/hotelData';
import { TrendingUp } from 'lucide-react';

interface RateRowProps {
  roomType: string;
  mealPlan: string;
  sellPrice: number;
  markupLabel: string;
  isFiltered: boolean;
}

export default function RateRow({ roomType, mealPlan, sellPrice, markupLabel, isFiltered }: RateRowProps) {
  if (!isFiltered) return null;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{roomType}</p>
          <p className="text-xs text-muted-foreground">{MEAL_PLAN_LABELS[mealPlan] ?? mealPlan}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-xs font-mono border-border">{mealPlan}</Badge>
        <div className="text-right">
          <p className="font-bold text-primary text-base">AED {sellPrice.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end">
            <TrendingUp className="w-3 h-3 text-green-600" />
            {markupLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
