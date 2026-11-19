import { useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Card, CardContent } from '@project/components/ui/card';
import { Plus, Edit2, Trash2, Zap, Clock, Tag, Percent, BedDouble, Gift, Eye, EyeOff } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { useState } from 'react';
import { GetPromotionsOutputType } from 'zitejs/api';
import { format } from 'date-fns';

type Promotion = GetPromotionsOutputType['promotions'][0];

const STATUS_COLOR: Record<string, string> = {
  Active: 'bg-green-100 text-green-800 border-green-200',
  Draft: 'bg-gray-100 text-gray-700 border-gray-200',
  Paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Expired: 'bg-orange-100 text-orange-800 border-orange-200',
  Archived: 'bg-red-100 text-red-800 border-red-200',
};

const PROMO_ICON: Record<string, React.ReactNode> = {
  EarlyBird: <Clock className="w-4 h-4 text-blue-500" />,
  FlashSale: <Zap className="w-4 h-4 text-red-500" />,
  PercentOff: <Percent className="w-4 h-4 text-green-500" />,
  StayXPayY: <BedDouble className="w-4 h-4 text-purple-500" />,
  DiscountSubsequentNights: <Tag className="w-4 h-4 text-orange-500" />,
  FreeNight: <Gift className="w-4 h-4 text-pink-500" />,
  FixedAmountOff: <Tag className="w-4 h-4 text-teal-500" />,
  PackageAddOn: <Gift className="w-4 h-4 text-indigo-500" />,
};

function discountLabel(p: Promotion) {
  if (p.promoType === 'StayXPayY') return `Stay ${p.stayNights} Pay ${p.payNights}`;
  if (p.promoType === 'DiscountSubsequentNights') return `${p.discountPercent ?? 0}% off night ${p.startNightIndex ?? 2}+`;
  if (p.promoType === 'FixedAmountOff') return `AED ${p.discountAmount ?? 0} OFF`;
  if (p.promoType === 'FreeNight') return `Free night`;
  return `${p.discountPercent ?? 0}% OFF`;
}

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return format(new Date(d), 'MMM dd, yyyy'); } catch { return d; }
}

interface Props {
  hotelId: string;
  promotions: Promotion[];
  onRefresh: () => void;
  onDelete: (id: string) => Promise<void>;
}

export default function PromotionsTab({ hotelId, promotions, onRefresh, onDelete }: Props) {
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const active = promotions.filter(p => p.status === 'Active');
  const others = promotions.filter(p => p.status !== 'Active');

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await onDelete(deleteId); } finally { setDeleting(false); setDeleteId(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Hotel Deals & Promotions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage discounts, special offers, and promotional rates</p>
        </div>
        <Button onClick={() => navigate(`/hotels/${hotelId}/promotions/new`)} className="gap-2 font-bold">
          <Plus className="w-4 h-4" /> Create New Promotion
        </Button>
      </div>

      {promotions.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl py-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Gift className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-bold text-foreground">No promotions yet</p>
          <p className="text-sm text-muted-foreground">Create rate promotions and assign them to room types with distribution codes</p>
          <Button onClick={() => navigate(`/hotels/${hotelId}/promotions/new`)} className="mt-2 gap-2 font-bold">
            <Plus className="w-4 h-4" /> Create First Promotion
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && <PromoGroup title={`Active Promotions (${active.length})`} promos={active} hotelId={hotelId} navigate={navigate} onDelete={setDeleteId} />}
          {others.length > 0 && <PromoGroup title={`Other Promotions (${others.length})`} promos={others} hotelId={hotelId} navigate={navigate} onDelete={setDeleteId} />}
        </div>
      )}

      {/* Tip card */}
      {promotions.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm text-primary">Create New Promotions</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click the "Create New Promotion" button above to add flash sales, discounts, and special offers</p>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotion?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this promotion and cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PromoGroup({ title, promos, hotelId, navigate, onDelete }: {
  title: string; promos: Promotion[]; hotelId: string;
  navigate: (path: string) => void; onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-extrabold text-foreground mb-3">{title}</h3>
      <div className="space-y-3">
        {promos.map(p => (
          <Card key={p.id} className="border border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {PROMO_ICON[p.promoType ?? ''] ?? <Tag className="w-4 h-4 text-muted-foreground" />}
                      <span className="font-extrabold text-base text-foreground">{p.promotionName}</span>
                    </div>
                    {p.promotionCode && (
                      <Badge variant="outline" className="font-mono text-xs font-bold">{p.promotionCode}</Badge>
                    )}
                    {p.isFlashSale && (
                      <Badge className="bg-red-500 text-white text-xs gap-1"><Zap className="w-3 h-3" />Flash Sale</Badge>
                    )}
                    {p.status && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR[p.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {p.status}
                      </span>
                    )}
                    {p.memberOnly && <Badge variant="secondary" className="text-xs">Member Only</Badge>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 mt-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Promotion Type</p>
                      <p className="font-bold text-foreground">{p.promoType?.replace(/([A-Z])/g, ' $1').trim() ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Discount</p>
                      <p className="font-bold text-green-600">{discountLabel(p)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Stay Dates</p>
                      <p className="font-bold text-foreground">{fmtDate(p.stayStartDate)} → {fmtDate(p.stayEndDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Min LOS</p>
                      <p className="font-bold text-foreground">{p.minLos ?? 1} {(p.minLos ?? 1) === 1 ? 'night' : 'nights'}</p>
                    </div>
                  </div>
                  {(p.channels ?? []).length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {(p.channels ?? []).map(ch => (
                        <Badge key={ch} variant="outline" className="text-xs font-semibold">{ch}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/hotels/${hotelId}/promotions/${p.id}`)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
