import { useEffect, useState } from 'react';
import { getMarkupRules, saveMarkupRule, deleteMarkupRule, getHotels, GetMarkupRulesOutputType, GetHotelsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Card, CardContent } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { Separator } from '@project/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import MarkupRuleFormDialog from '@/components/MarkupRuleFormDialog';
import EventMarkupSection from '@/components/EventMarkupSection';
import { Plus, Edit2, Trash2, PercentSquare, Globe, Building2 } from 'lucide-react';
import { toast } from 'sonner';

type Rule = GetMarkupRulesOutputType['rules'][0];
type Hotel = GetHotelsOutputType['hotels'][0];

export default function MarkupRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getMarkupRules({}), getHotels({})]).then(([r, h]) => {
      setRules(r.rules); setHotels(h.hotels);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const getHotelName = (id: string | string[] | undefined) => {
    const hId = Array.isArray(id) ? id[0] : id;
    return hotels.find(h => h.id === hId)?.hotelName || 'Unknown';
  };

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      await saveMarkupRule(data);
      toast.success(data.id ? 'Rule updated' : 'Rule created');
      setFormOpen(false); setEditRule(null);
      load();
    } catch { toast.error('Failed to save rule'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id?: string) => {
    const target = id ?? deleteId;
    if (!target) return;
    try {
      await deleteMarkupRule({ id: target });
      toast.success('Rule deleted');
      setDeleteId(null); load();
    } catch { toast.error('Failed to delete'); }
  };

  // Split standard vs event override rules
  const standardRules = rules.filter(r => !r.ruleCategory || r.ruleCategory === 'standard' || r.ruleCategory === 'Standard');
  const eventRules = rules.filter(r => r.ruleCategory === 'event_override' || r.ruleCategory === 'Event Override');
  const globalRules = standardRules.filter(r => r.appliesTo === 'Global (All Hotels)');
  const specificRules = standardRules.filter(r => r.appliesTo === 'Specific Hotel');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Markup Rules</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure automatic markup on net rates</p>
        </div>
        <Button onClick={() => { setEditRule(null); setFormOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Rule
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-8">
          {/* Standard Rules */}
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Global Rules ({globalRules.length})
              </h2>
              {globalRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No global rules. Add one to apply a markup to all hotels.</p>
              ) : (
                <div className="space-y-3">
                  {globalRules.map(rule => <RuleCard key={rule.id} rule={rule} onEdit={() => { setEditRule(rule); setFormOpen(true); }} onDelete={() => setDeleteId(rule.id)} />)}
                </div>
              )}
            </section>
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Hotel-Specific Rules ({specificRules.length})
              </h2>
              {specificRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hotel-specific rules.</p>
              ) : (
                <div className="space-y-3">
                  {specificRules.map(rule => <RuleCard key={rule.id} rule={rule} hotelName={getHotelName(rule.specificHotel)} onEdit={() => { setEditRule(rule); setFormOpen(true); }} onDelete={() => setDeleteId(rule.id)} />)}
                </div>
              )}
            </section>
          </div>

          <Separator />

          {/* Section 3: Event Markup Override */}
          <EventMarkupSection
            rules={eventRules}
            hotels={hotels}
            onSave={handleSave}
            onDelete={handleDelete}
            saving={saving}
          />
        </div>
      )}

      <MarkupRuleFormDialog open={formOpen} rule={editRule} hotels={hotels} onClose={() => { setFormOpen(false); setEditRule(null); }} onSave={handleSave} loading={saving} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Rule?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this markup rule.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete()} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RuleCard({ rule, hotelName, onEdit, onDelete }: { rule: Rule; hotelName?: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <PercentSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{rule.ruleName}</span>
                <Badge variant={rule.isActive ? 'default' : 'secondary'} className="text-xs">{rule.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {rule.markupType === 'Percentage (%)' ? `${rule.markupValue}% markup` : `AED ${rule.markupValue} fixed markup`}
                {hotelName && <span> • {hotelName}</span>}
              </div>
              {rule.notes && <p className="text-xs text-muted-foreground mt-1">{rule.notes}</p>}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Edit2 className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
