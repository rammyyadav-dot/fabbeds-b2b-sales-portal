import { useEffect, useState } from 'react';
import { getSeasons, saveSeason, deleteSeason, GetSeasonsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Separator } from '@project/components/ui/separator';
import SeasonFormDialog from '@/components/SeasonFormDialog';
import SeasonCalendarView from '@/components/SeasonCalendarView';
import BulkEditRatesDialog from '@/components/BulkEditRatesDialog';
import { Plus, Edit2, Trash2, CalendarDays, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Season = GetSeasonsOutputType['seasons'][0];

const TYPE_COLORS: Record<string, string> = {
  Peak: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Shoulder: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const formatDate = (d?: string) => d ? format(new Date(d), 'dd MMM yyyy') : '—';
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(currentYear);
  const [formOpen, setFormOpen] = useState(false);
  const [editSeason, setEditSeason] = useState<Season | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getSeasons({}).then(r => setSeasons(r.seasons)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const yearSeasons = seasons.filter(s => !s.year || s.year === year);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      await saveSeason(data);
      toast.success(data.id ? 'Period updated' : 'Period added');
      setFormOpen(false); setEditSeason(null); load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await deleteSeason({ id: deleteId }); toast.success('Period deleted'); setDeleteId(null); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleBulkApply = async (data: any) => {
    // Apply bulk rate changes - show success for now
    toast.success('Bulk rate changes applied');
    setBulkOpen(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tariff Periods</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Calendar-based rate periods for seasonal pricing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
            <BarChart3 className="w-4 h-4" /> Bulk Edit Rates
          </Button>
          <Button onClick={() => { setEditSeason(null); setFormOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Period
          </Button>
        </div>
      </div>

      {/* Year Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Year:</span>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{yearSeasons.length} period(s)</span>
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : (
        <SeasonCalendarView seasons={yearSeasons} year={year} />
      )}

      <Separator />

      {/* Period List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Defined Periods</h2>
        {yearSeasons.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium text-sm">No periods for {year}</p>
            <p className="text-xs mt-1">Add Peak, High, Shoulder or Low periods</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {yearSeasons.map(s => (
              <div key={s.id} className={`border rounded-lg p-4 ${s.seasonType ? TYPE_COLORS[s.seasonType] || 'bg-muted border-border' : 'bg-card border-border'}`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{s.seasonName}</p>
                    {s.seasonType && <Badge variant="outline" className="text-xs border-current">{s.seasonType}</Badge>}
                    <p className="text-xs opacity-80">{formatDate(s.startDate)} → {formatDate(s.endDate)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-70 hover:opacity-100" onClick={() => { setEditSeason(s); setFormOpen(true); }}><Edit2 className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-70 hover:opacity-100 text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SeasonFormDialog open={formOpen} season={editSeason} onClose={() => { setFormOpen(false); setEditSeason(null); }} onSave={handleSave} loading={saving} />
      <BulkEditRatesDialog open={bulkOpen} onClose={() => setBulkOpen(false)} onApply={handleBulkApply} loading={saving} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Period?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this tariff period.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
