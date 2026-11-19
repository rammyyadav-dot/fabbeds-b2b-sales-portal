import { GetRatePlansOutputType, GetRoomTypesOutputType } from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { Check, AlertTriangle, Minus } from 'lucide-react';

type RatePlan = GetRatePlansOutputType['ratePlans'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];

const MEAL_CODES = ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All Inclusive'] as const;
const SHORT_LABELS: Record<string, string> = {
  'Room Only': 'RO', 'Bed & Breakfast': 'BB', 'Half Board': 'HB', 'Full Board': 'FB', 'All Inclusive': 'AI',
};

interface Props {
  roomTypes: RoomType[];
  ratePlans: RatePlan[];
}

export default function CommercialMatrix({ roomTypes, ratePlans }: Props) {
  const activePlans = ratePlans.filter(rp => rp.status === 'Active');

  const hasCombo = (rtId: string, meal: string) =>
    activePlans.some(rp => {
      const rpRt = Array.isArray(rp.roomType) ? rp.roomType[0] : rp.roomType;
      return rpRt === rtId && rp.mealPlan === meal;
    });

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <h3 className="text-sm font-semibold">Commercial Matrix</h3>
        <span className="text-xs text-muted-foreground">Active rate plans only</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
              <th className="px-4 py-2">Room Type</th>
              {MEAL_CODES.map(m => <th key={m} className="px-3 py-2 text-center">{SHORT_LABELS[m]}</th>)}
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map(rt => {
              const meals = MEAL_CODES.map(m => hasCombo(rt.id, m));
              const anyActive = meals.some(Boolean);
              return (
                <tr key={rt.id} className={`border-b border-border last:border-0 ${!anyActive ? 'bg-muted/30' : ''}`}>
                  <td className="px-4 py-2.5 font-medium">{rt.roomTypeName}</td>
                  {meals.map((has, i) => (
                    <td key={i} className="px-3 text-center">
                      {has
                        ? <Check className="w-4 h-4 text-green-600 inline" />
                        : <Minus className="w-4 h-4 text-muted-foreground inline" />}
                    </td>
                  ))}
                  <td className="px-3 text-center">
                    {anyActive
                      ? <Badge variant="outline" className="text-xs text-green-700 bg-green-50">Ready</Badge>
                      : <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50"><AlertTriangle className="w-3 h-3 mr-1" />Fix</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
