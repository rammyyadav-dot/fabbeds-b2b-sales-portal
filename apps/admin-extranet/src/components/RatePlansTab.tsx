import { useState, useEffect } from 'react';
import { saveRatePlan, deleteRatePlan, getMealPlans, GetRatePlansOutputType, GetRoomTypesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import RatePlanFormDialog from '@/components/RatePlanFormDialog';
import { Plus, Edit2, Trash2, ShieldCheck, ShieldOff, BedDouble, UtensilsCrossed, Hash, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@project/components/lib/utils';

type RatePlan = GetRatePlansOutputType['ratePlans'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];

interface Props {
  hotelId: string;
  hotelName?: string;
  ratePlans: RatePlan[];
  roomTypes: RoomType[];
  onRefresh: () => void;
}

const statusColors: Record<string, string> = {
  Active: 'bg-green-100 text-green-700 border-green-200',
  Draft: 'bg-amber-100 text-amber-700 border-amber-200',
  Inactive: 'bg-red-100 text-red-700 border-red-200',
};

const layerColors: Record<string, string> = {
  Base: 'bg-blue-100 text-blue-700',
  Derived: 'bg-purple-100 text-purple-700',
  Promo: 'bg-orange-100 text-orange-700',
};

function RatePlanRow({ plan, onEdit, onDelete }: { plan: RatePlan; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <div className="space-y-1.5">
          {/* Name + Status + Layer */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{plan.ratePlanName}</span>
            {plan.status && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusColors[plan.status] ?? ''}`}>{plan.status}</Badge>}
            {plan.layer && <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${layerColors[plan.layer] ?? ''}`}><Layers className="w-2.5 h-2.5 mr-0.5" />{plan.layer}</Badge>}
          </div>

          {/* Codes row */}
          {plan.ratePlanCode && (
            <div className="flex items-center gap-2">
              <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{plan.ratePlanCode}</span>
            </div>
          )}

          {/* Attributes */}
          <div className="flex flex-wrap gap-1.5">
            {plan.mealPlan && <Badge variant="outline" className="text-xs"><UtensilsCrossed className="w-2.5 h-2.5 mr-1" />{plan.mealPlan}</Badge>}
            {plan.rateType && <Badge variant="outline" className="text-xs">{plan.rateType}</Badge>}
            {plan.refundable
              ? <Badge variant="outline" className="text-xs text-green-700 bg-green-50"><ShieldCheck className="w-2.5 h-2.5 mr-1" />Refundable</Badge>
              : <Badge variant="outline" className="text-xs text-red-700 bg-red-50"><ShieldOff className="w-2.5 h-2.5 mr-1" />Non-refundable</Badge>}
            {plan.minStayNights != null && <Badge variant="outline" className="text-xs">Min {plan.minStayNights}+ nights</Badge>}
            <Badge variant="outline" className="text-xs">Market {plan.nationalityMarket || 'ALL'}</Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 items-start opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Edit2 className="w-3 h-3" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>
    </div>
  );
}

function RoomTypeGroup({ roomType, plans, onEdit, onDelete }: {
  roomType: RoomType | null;
  plans: RatePlan[];
  onEdit: (p: RatePlan) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const activePlans = plans.filter(p => p.status === 'Active').length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left">
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <BedDouble className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">{roomType?.roomTypeName ?? 'Unassigned Room Type'}</span>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="secondary" className="text-xs">{plans.length} plan{plans.length !== 1 ? 's' : ''}</Badge>
          {activePlans > 0 && <Badge className="text-xs bg-green-500 text-white">{activePlans} active</Badge>}
        </div>
      </button>
      {open && (
        plans.length === 0
          ? <p className="px-4 py-3 text-xs text-muted-foreground italic">No rate plans for this room type yet.</p>
          : plans.map(plan => (
              <RatePlanRow key={plan.id} plan={plan}
                onEdit={() => onEdit(plan)}
                onDelete={() => onDelete(plan.id)}
              />
            ))
      )}
    </div>
  );
}

export default function RatePlansTab({ hotelId, hotelName, ratePlans, roomTypes, onRefresh }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<RatePlan | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mealPlansList, setMealPlansList] = useState<{ id: string; code: string; agentLabel: string }[]>([]);
  const [mealPlansLoading, setMealPlansLoading] = useState(false);
  const [mealPlansError, setMealPlansError] = useState(false);

  useEffect(() => {
    if (!formOpen) return;
    let cancelled = false;
    setMealPlansLoading(true);
    setMealPlansError(false);
    getMealPlans({})
      .then(r => { if (!cancelled) setMealPlansList(r.mealPlans); })
      .catch(() => {
        if (!cancelled) {
          setMealPlansList([]);
          setMealPlansError(true);
        }
      })
      .finally(() => { if (!cancelled) setMealPlansLoading(false); });
    return () => { cancelled = true; };
  }, [formOpen]);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      await saveRatePlan(data);
      toast.success(data.id ? 'Rate plan updated' : 'Rate plan created');
      setFormOpen(false); setEditPlan(null); onRefresh();
    } catch (error: any) { toast.error(error?.message || 'Failed to save rate plan'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const result = await deleteRatePlan({ id: deleteId });
      if (!(result as any).success) {
        toast.error((result as any).error || 'Cannot delete this rate plan');
        setDeleteId(null);
        return;
      }
      toast.success('Rate plan deleted');
      setDeleteId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
      setDeleteId(null);
    }
  };

  // Group rate plans by room type
  const grouped = roomTypes.map(rt => ({
    roomType: rt,
    plans: ratePlans.filter(p => {
      const rtId = Array.isArray(p.roomType) ? p.roomType[0] : p.roomType;
      return rtId === rt.id;
    }),
  }));
  const unassigned = ratePlans.filter(p => {
    const rtId = Array.isArray(p.roomType) ? p.roomType[0] : p.roomType;
    return !rtId || !roomTypes.find(rt => rt.id === rtId);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="bg-muted/40 border border-border rounded-lg px-4 py-3 space-y-1.5 flex-1">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">How to name a Rate Plan (human-friendly)</p>
          <p className="text-xs text-muted-foreground font-mono">
            <span className="text-primary font-semibold">{'{RoomType}'}</span>{' '}
            <span className="text-orange-600 font-semibold">{'{MealPlan}'}</span>{' '}
            <span className="text-green-600 font-semibold">{'{Refundability}'}</span>{' '}
            <span className="text-blue-600 font-semibold">{'{Channel/Contract}'}</span>{' '}
            <span className="text-purple-600 font-semibold">{'{Market?}'}</span>
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {['DLX BB Refundable BAR', 'DLX RO Non-Refundable NET', '1BR BB Refundable WB GCC'].map(ex => (
              <span key={ex} className="font-mono text-[11px] bg-card border border-border rounded px-2 py-0.5 text-foreground">{ex}</span>
            ))}
          </div>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => { setEditPlan(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4" /> New Rate Plan
        </Button>
      </div>

      {ratePlans.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed rounded-xl text-muted-foreground">
          <BedDouble className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">No rate plans yet</p>
          <p className="text-sm">Create rate plans and assign them to room types with distribution codes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ roomType, plans }) => (
            <RoomTypeGroup key={roomType.id} roomType={roomType} plans={plans}
              onEdit={p => { setEditPlan(p); setFormOpen(true); }}
              onDelete={id => setDeleteId(id)}
            />
          ))}
          {unassigned.length > 0 && (
            <RoomTypeGroup roomType={null} plans={unassigned}
              onEdit={p => { setEditPlan(p); setFormOpen(true); }}
              onDelete={id => setDeleteId(id)}
            />
          )}
        </div>
      )}

      <RatePlanFormDialog open={formOpen} hotelId={hotelId} hotelName={hotelName} roomTypes={roomTypes} mealPlans={mealPlansList} mealPlansLoading={mealPlansLoading} mealPlansError={mealPlansError} ratePlan={editPlan}
        onClose={() => { setFormOpen(false); setEditPlan(null); }} onSave={handleSave} loading={saving} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Rate Plan?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this rate plan and its codes.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
