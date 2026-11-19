import { useState, useEffect, useCallback } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { ChevronLeft, ChevronRight, Upload, Save, Utensils, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getMealPlanRates, saveMealPlanRates } from 'zitejs/api';
import MealPlanGridTable, { DayRates } from '@/components/MealPlanGridTable';
import MealPlanBulkLoader from '@/components/MealPlanBulkLoader';

const MEAL_PLAN_KEYS: Record<string, { adult: keyof DayRates; child: keyof DayRates }> = {
  'Half Board': { adult: 'hbAdult', child: 'hbChild' },
  'Full Board': { adult: 'fbAdult', child: 'fbChild' },
  'All Inclusive': { adult: 'aiAdult', child: 'aiChild' },
};

interface Props { hotelId: string; }

export default function MealPlanRateGrid({ hotelId }: Props) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [rates, setRates] = useState<Record<string, DayRates>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMealPlanRates({ hotelId, year, month });
      const map: Record<string, DayRates> = {};
      for (const r of res.rates) {
        if (!map[r.date]) map[r.date] = {};
        const keys = MEAL_PLAN_KEYS[r.mealPlan];
        if (!keys) continue;
        if (r.adultRate != null) map[r.date][keys.adult] = r.adultRate;
        if (r.childRate != null) map[r.date][keys.child] = r.childRate;
      }
      setRates(map);
    } catch { toast.error('Failed to load rates'); }
    finally { setLoading(false); }
  }, [hotelId, year, month]);

  useEffect(() => { loadRates(); }, [loadRates]);

  const handleChange = (date: string, key: keyof DayRates, value: string) => {
    setRates(prev => ({ ...prev, [date]: { ...prev[date], [key]: value === '' ? undefined : parseFloat(value) } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ratesList: { date: string; mealPlan: string; adultRate?: number; childRate?: number }[] = [];
      for (const [date, dayRates] of Object.entries(rates)) {
        for (const [plan, keys] of Object.entries(MEAL_PLAN_KEYS)) {
          const adultRate = dayRates[keys.adult];
          const childRate = dayRates[keys.child];
          if (adultRate != null || childRate != null) {
            ratesList.push({ date, mealPlan: plan, adultRate, childRate });
          }
        }
      }
      await saveMealPlanRates({ hotelId, rates: ratesList });
      toast.success('Rates saved successfully');
    } catch { toast.error('Failed to save rates'); }
    finally { setSaving(false); }
  };

  const handleBulkApply = async (dates: string[], bulkRates: Record<string, number | undefined>) => {
    setSaving(true);
    try {
      const newRates = { ...rates };
      for (const date of dates) {
        newRates[date] = {
          ...newRates[date],
          hbAdult: bulkRates.hbAdult, hbChild: bulkRates.hbChild,
          fbAdult: bulkRates.fbAdult, fbChild: bulkRates.fbChild,
          aiAdult: bulkRates.aiAdult, aiChild: bulkRates.aiChild,
        };
      }
      setRates(newRates);
      // Save immediately
      const ratesList: { date: string; mealPlan: string; adultRate?: number; childRate?: number }[] = [];
      for (const date of dates) {
        for (const [plan, keys] of Object.entries(MEAL_PLAN_KEYS)) {
          const adultKey = keys.adult as string;
          const childKey = keys.child as string;
          const adultRate = bulkRates[adultKey];
          const childRate = bulkRates[childKey];
          if (adultRate != null || childRate != null) {
            ratesList.push({ date, mealPlan: plan, adultRate, childRate });
          }
        }
      }
      await saveMealPlanRates({ hotelId, rates: ratesList });
      toast.success(`Rates applied to ${dates.length} days`);
      setBulkOpen(false);
    } catch { toast.error('Failed to apply rates'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
          <Utensils className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-foreground tracking-wide">MEAL PLAN SUPPLEMENT RATES</p>
          <p className="text-xs text-blue-600">One Rate Grid. Complete Monthly View.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setCurrentDate(d => subMonths(d, 1))}
            disabled={currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() === today.getMonth()}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[130px] text-center">{format(currentDate, 'MMMM yyyy')}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setBulkOpen(true)}>
            <Upload className="w-4 h-4" /> Bulk Load
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading rates...
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <MealPlanGridTable year={year} month={month} rates={rates} onChange={handleChange} />
        </div>
      )}

      <MealPlanBulkLoader open={bulkOpen} onClose={() => setBulkOpen(false)} onApply={handleBulkApply} saving={saving} />
    </div>
  );
}
