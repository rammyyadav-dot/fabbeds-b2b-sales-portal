import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Badge } from '@project/components/ui/badge';
import { Separator } from '@project/components/ui/separator';
import { CalendarDays, Building2, Users, DollarSign, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { GetReservationsOutputType } from 'zitejs/api';

type Reservation = GetReservationsOutputType['reservations'][0];

const STATUS_COLORS: Record<string, string> = {
  'Inquiry Received': 'bg-slate-100 text-slate-700',
  'Rate Validated': 'bg-blue-100 text-blue-700',
  'Awaiting Supplier Confirmation': 'bg-orange-100 text-orange-700',
  'Supplier Confirmed': 'bg-purple-100 text-purple-700',
  'Confirmed': 'bg-teal-100 text-teal-700',
  'Invoiced': 'bg-indigo-100 text-indigo-700',
  'Paid': 'bg-emerald-100 text-emerald-700',
  'Completed': 'bg-green-100 text-green-700',
  'Rate Dispute': 'bg-amber-100 text-amber-700',
};

const fmt = (v?: string | null) => { try { return v ? format(new Date(v), 'dd MMM yyyy') : '—'; } catch { return v ?? '—'; } };

function InfoCell({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-semibold ${highlight ?? 'text-foreground'}`}>{value}</p>
    </div>
  );
}

interface Props { reservation: Reservation | null; onClose: () => void; }

export default function ReservationQuickView({ reservation: r, onClose }: Props) {
  if (!r) return null;
  const nights = r.checkinDate && r.checkoutDate
    ? Math.round((new Date(r.checkoutDate).getTime() - new Date(r.checkinDate).getTime()) / 86400000)
    : 0;

  return (
    <Dialog open={!!r} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-mono text-primary">{r.reservationRef}</span>
            <Badge className={`text-xs border-0 ${STATUS_COLORS[r.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
              {r.status}
            </Badge>
          </DialogTitle>
          {r.inquiryRef && <p className="text-xs text-muted-foreground">Inquiry: {r.inquiryRef}</p>}
        </DialogHeader>

        <div className="space-y-4">
          {/* Hotel */}
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">{r.hotelName ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{r.destination ?? ''}{r.roomType ? ` · ${r.roomType}` : ''}{r.boardBasis ? ` · ${r.boardBasis}` : ''}</p>
            </div>
          </div>

          <Separator />

          {/* Stay details */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stay</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <InfoCell label="Check-in" value={fmt(r.checkinDate)} />
              <InfoCell label="Check-out" value={fmt(r.checkoutDate)} />
              <InfoCell label="Nights" value={String(nights || '—')} />
            </div>
          </div>

          {/* Pax */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Occupancy</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <InfoCell label="Rooms" value={String(r.rooms ?? '—')} />
              <InfoCell label="Adults" value={String(r.adults ?? '—')} />
              <InfoCell label="Children" value={String(r.children ?? 0)} />
            </div>
          </div>

          <Separator />

          {/* Financials */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate Summary</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <InfoCell label="Net Rate" value={r.netRateAed != null ? `AED ${r.netRateAed.toLocaleString()}` : '—'} />
              <InfoCell label="Selling Rate" value={r.sellingRateAed != null ? `AED ${r.sellingRateAed.toLocaleString()}` : '—'} />
              <InfoCell label="Profit" value={r.profitAed != null ? `AED ${r.profitAed.toLocaleString()}` : '—'} highlight="text-emerald-600" />
              <InfoCell label="Margin" value={r.profitMargin != null ? `${r.profitMargin}%` : '—'} highlight={r.profitMargin && r.profitMargin > 0 ? 'text-emerald-600' : 'text-red-500'} />
            </div>
          </div>

          {/* Agent */}
          {(r.agentName || r.agentCompany) && (
            <>
              <Separator />
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <span className="text-xs font-semibold text-foreground">{r.agentName}</span>
                  {r.agentCompany && <span className="text-xs text-muted-foreground ml-1.5">· {r.agentCompany}</span>}
                </div>
              </div>
            </>
          )}

          {r.lpoNumber && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">LPO Sent</Badge>
              <span className="text-xs font-mono text-emerald-700">{r.lpoNumber}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
