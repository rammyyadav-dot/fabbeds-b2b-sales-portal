import { useState, useEffect, useCallback } from 'react';
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, Edit2, CalendarDays, ListFilter } from 'lucide-react';
import { getDailyRates, bulkSaveDailyRates, GetRoomTypesOutputType, GetDailyRatesOutputType, GetRatePlansOutputType } from 'zitejs/api';
import { toast } from 'sonner';
import DateRateFormDialog from '@/components/DateRateFormDialog';

type RoomType = GetRoomTypesOutputType['roomTypes'][0];
type DailyRate = GetDailyRatesOutputType['rates'][0];
type RatePlan = GetRatePlansOutputType['ratePlans'][0];

interface Props {
  hotelId: string;
  roomTypes: RoomType[];
  ratePlans?: RatePlan[];
}

const DAY_COUNT = 14;
const statusColors: Record<string, string> = {
  'Free Sale': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Limited': 'bg-amber-50 text-amber-700 border-amber-200',
  'On Request': 'bg-blue-50 text-blue-700 border-blue-200',
  'Stop Sale': 'bg-red-50 text-red-700 border-red-200',
};

export default function RateGridTab({ hotelId, roomTypes, ratePlans = [] }: Props) {
  const [viewStart, setViewStart] = useState(() => new Date());
  const [rates, setRates] = useState<DailyRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRatePlanId, setSelectedRatePlanId] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRoomTypeId, setDialogRoomTypeId] = useState<string | undefined>();
  const [dialogDate, setDialogDate] = useState<string | undefined>();
  const [dialogExistingRate, setDialogExistingRate] = useState<DailyRate | null>(null);
  const [saving, setSaving] = useState(false);

  const days = eachDayOfInterval({ start: viewStart, end: addDays(viewStart, DAY_COUNT - 1) });

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = format(viewStart, 'yyyy-MM-dd');
      const endDate = format(addDays(viewStart, DAY_COUNT - 1), 'yyyy-MM-dd');
      const res = await getDailyRates({
        hotelId,
        startDate,
        endDate,
        ratePlanId: selectedRatePlanId !== 'all' ? selectedRatePlanId : undefined,
      });
      setRates(res.rates);
    } catch {
      toast.error('Failed to load rates');
    } finally {
      setLoading(false);
    }
  }, [hotelId, viewStart, selectedRatePlanId]);

  useEffect(() => { loadRates(); }, [loadRates]);

  // Build lookup: roomTypeId → date → rate (prefer highest priority layer)
  const rateMap = new Map<string, Map<string, DailyRate>>();
  for (const rate of rates) {
    const rtId = Array.isArray(rate.roomType) ? rate.roomType[0] : rate.roomType;
    if (!rtId || !rate.rateDate) continue;
    if (!rateMap.has(rtId)) rateMap.set(rtId, new Map());
    const existing = rateMap.get(rtId)!.get(rate.rateDate);
    // Keep highest layer priority
    const layerPriority: Record<string, number> = { OVERRIDE: 4, PROMO: 3, BASE: 2, FALLBACK: 1 };
    if (!existing || (layerPriority[rate.layer ?? 'BASE'] ?? 2) >= (layerPriority[existing.layer ?? 'BASE'] ?? 2)) {
      rateMap.get(rtId)!.set(rate.rateDate, rate);
    }
  }

  const selectedPlan = ratePlans.find(p => p.id === selectedRatePlanId);

  // When a Rate Plan is selected, only show its owning Room Type.
  // This prevents operators from accidentally applying/viewing a plan against
  // a different room.
  const visibleRoomTypes = selectedPlan
    ? roomTypes.filter(rt => {
        const ownerRoomTypeId = Array.isArray(selectedPlan.roomType) ? selectedPlan.roomType[0] : selectedPlan.roomType;
        return rt.id === ownerRoomTypeId;
      })
    : roomTypes;

  const openDialog = (roomTypeId?: string, date?: string, existingRate?: DailyRate) => {
    setDialogRoomTypeId(roomTypeId);
    setDialogDate(date);
    setDialogExistingRate(existingRate || null);
    setDialogOpen(true);
  };

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      if (selectedRatePlanId === 'all') {
        toast.error('Select a Rate Plan before applying rates');
        return;
      }
      await bulkSaveDailyRates({
        hotelId,
        roomTypeId: data.roomTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        adult1Rate: data.adult1Rate,
        adult2Rate: data.adult2Rate,
        adult3Rate: data.adult3Rate,
        childSupplement: data.childSupplement,
        extraBedRate: data.extraBedRate,
        minStay: data.minStay,
        allocation: data.allocation,
        currency: data.currency,
        ratePlanId: selectedRatePlanId !== 'all' ? selectedRatePlanId : undefined,
      });
      toast.success('Rates applied successfully');
      setDialogOpen(false);
      loadRates();
    } catch {
      toast.error('Failed to save rates');
    } finally {
      setSaving(false);
    }
  };

  if (roomTypes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
        <p className="font-medium">No room types yet</p>
        <p className="text-sm">Add room types first to enter rates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewStart(d => addDays(d, -DAY_COUNT))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground min-w-[200px] text-center">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            {format(viewStart, 'dd MMM')} – {format(addDays(viewStart, DAY_COUNT - 1), 'dd MMM yyyy')}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewStart(d => addDays(d, DAY_COUNT))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setViewStart(new Date())}>
            Today
          </Button>

          {/* Rate Plan Filter */}
          {ratePlans.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2">
              <ListFilter className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={selectedRatePlanId} onValueChange={setSelectedRatePlanId}>
                <SelectTrigger className="h-8 text-xs w-52">
                  <SelectValue placeholder="All Rate Plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rate Plans</SelectItem>
                  {ratePlans.filter(p => p.status === 'Active').map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.ratePlanCode ? `[${p.ratePlanCode}] ` : ''}{p.ratePlanName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (selectedRatePlanId === 'all') {
              toast.error('Select a Rate Plan first');
              return;
            }
            const plan = ratePlans.find(p => p.id === selectedRatePlanId);
            const planRoomTypeId = plan ? (Array.isArray(plan.roomType) ? plan.roomType[0] : plan.roomType) : undefined;
            openDialog(planRoomTypeId);
          }}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" /> Apply Rates
        </Button>
      </div>

      {/* Active plan banner */}
      {selectedPlan && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
          <Badge className="text-xs">{selectedPlan.ratePlanCode || selectedPlan.ratePlanName}</Badge>
          <span className="text-foreground font-medium">{selectedPlan.ratePlanName}</span>
          {selectedPlan.mealPlan && <Badge variant="outline" className="text-xs">{selectedPlan.mealPlan}</Badge>}
          {selectedPlan.layer && <Badge variant="secondary" className="text-xs">{selectedPlan.layer}</Badge>}
          <span className="text-xs text-muted-foreground ml-auto">Showing rates for this plan only</span>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs border-collapse" style={{ minWidth: `${160 + DAY_COUNT * 90}px` }}>
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left py-2.5 px-3 font-semibold text-foreground border-b border-border sticky left-0 bg-muted/40 z-10 min-w-[160px]">
                Room Type
              </th>
              {days.map(day => {
                const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <th key={day.toISOString()} className={`py-2 px-1 border-b border-border text-center min-w-[88px] ${isToday ? 'bg-primary/10' : isWeekend ? 'bg-muted/60' : ''}`}>
                    <div className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{format(day, 'EEE')}</div>
                    <div className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{format(day, 'd')}</div>
                    <div className="text-xs text-muted-foreground">{format(day, 'MMM')}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRoomTypes.map(rt => {
              // Find rate plans for this room type
              const rtPlans = ratePlans.filter(p => {
                const rtId = Array.isArray(p.roomType) ? p.roomType[0] : p.roomType;
                return rtId === rt.id && p.status === 'Active';
              });

              return (
                <tr key={rt.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 px-3 border-r border-border sticky left-0 bg-card z-10">
                    <div className="font-medium text-foreground text-xs">{rt.roomTypeName}</div>
                    {rtPlans.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {rtPlans.slice(0, 2).map(p => (
                          <Badge key={p.id} variant="outline" className="text-[9px] h-3.5 px-1 py-0">
                            {p.ratePlanCode || p.ratePlanName?.slice(0, 8)}
                          </Badge>
                        ))}
                        {rtPlans.length > 2 && <span className="text-[9px] text-muted-foreground">+{rtPlans.length - 2}</span>}
                      </div>
                    )}
                    {rt.maxOccupancy && <div className="text-xs text-muted-foreground mt-0.5">Max {rt.maxOccupancy} pax</div>}
                  </td>
                  {loading
                    ? days.map(day => <td key={day.toISOString()} className="p-1"><Skeleton className="h-14 w-full rounded" /></td>)
                    : days.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const rate = rateMap.get(rt.id)?.get(dateStr);
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                      const statusClass = rate?.status ? (statusColors[rate.status] || 'bg-gray-50 text-gray-600') : '';

                      return (
                        <td
                          key={dateStr}
                          className={`p-1 border-r border-border last:border-0 cursor-pointer hover:bg-primary/5 transition-colors ${isToday ? 'bg-primary/5' : isWeekend ? 'bg-muted/20' : ''}`}
                          onClick={() => {
                            if (selectedRatePlanId === 'all') {
                              toast.error('Select a Rate Plan first');
                              return;
                            }
                            openDialog(rt.id, dateStr, rate);
                          }}
                        >
                          {rate ? (
                            <div className={`rounded border p-1.5 h-full min-h-[64px] flex flex-col justify-between ${statusClass || 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                              <div>
                                <div className="font-bold text-sm leading-tight">
                                  {rate.adult2Rate != null ? rate.adult2Rate.toLocaleString('en') : rate.adult1Rate != null ? rate.adult1Rate.toLocaleString('en') : '—'}
                                </div>
                                <div className="flex gap-1 mt-0.5 flex-wrap">
                                  {rate.adult1Rate != null && rate.adult1Rate > 0 && <span className="text-xs opacity-70">S:{rate.adult1Rate}</span>}
                                  {rate.adult3Rate != null && rate.adult3Rate > 0 && <span className="text-xs opacity-70">T:{rate.adult3Rate}</span>}
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                {rate.allocation != null && <span className="text-xs opacity-60">×{rate.allocation}</span>}
                                {rate.layer && rate.layer !== 'BASE' && (
                                  <span className="text-[9px] opacity-50 font-mono">{rate.layer}</span>
                                )}
                                <Edit2 className="w-2.5 h-2.5 opacity-40 ml-auto" />
                              </div>
                            </div>
                          ) : (
                            <div className="min-h-[60px] flex items-center justify-center text-muted-foreground/30 hover:text-primary/50 rounded border border-dashed border-border/40">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </td>
                      );
                    })
                  }
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="font-medium">Status:</span>
        {Object.entries(statusColors).map(([s, cls]) => (
          <span key={s} className={`px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>{s}</span>
        ))}
        <span className="ml-2 text-muted-foreground">· DBL rate shown · Click any cell to edit</span>
      </div>

      <DateRateFormDialog
        open={dialogOpen}
        hotelId={hotelId}
        roomTypes={roomTypes}
        initialRoomTypeId={dialogRoomTypeId}
        initialDate={dialogDate}
        existingRate={dialogExistingRate}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        loading={saving}
      />
    </div>
  );
}
