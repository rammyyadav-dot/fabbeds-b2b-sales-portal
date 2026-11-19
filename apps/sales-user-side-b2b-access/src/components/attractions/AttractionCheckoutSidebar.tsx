import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Ticket, CalendarDays, Users, Clock, ShieldCheck, Zap, Tag } from 'lucide-react';

interface Props {
  attractionName: string;
  ticketOptionName: string;
  targetDate: string;
  targetSlot: string;
  adultCount: number;
  childCount: number;
  netTotal: number;
  sellTotal: number;
  confirmed: boolean;
  submitDisabled: boolean;
  loading: boolean;
}

const fmtDate = (s: string) => {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

export default function AttractionCheckoutSidebar({
  attractionName, ticketOptionName, targetDate, targetSlot,
  adultCount, childCount, netTotal, sellTotal, confirmed, submitDisabled, loading,
}: Props) {
  const savings = sellTotal > netTotal ? sellTotal - netTotal : 0;
  const discount = sellTotal > 0 && savings > 0 ? Math.round((savings / sellTotal) * 100) : 0;
  const agentMarginPct = sellTotal > 0 && savings > 0 ? Math.round((savings / sellTotal) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm sticky top-4">
      {/* Header — match hotel sidebar */}
      <div className="bg-primary px-5 py-4">
        <p className="text-primary-foreground/70 text-[10px] font-bold uppercase tracking-widest">Price Summary</p>
        <p className="text-primary-foreground font-bold text-sm mt-0.5 line-clamp-2">{attractionName}</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Details */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Ticket className="w-3.5 h-3.5 text-muted-foreground" /> {ticketOptionName}
          </p>
          {targetDate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> {fmtDate(targetDate)}
            </p>
          )}
          {targetSlot && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {targetSlot}
            </p>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {adultCount} Adult{adultCount !== 1 ? 's' : ''}{childCount > 0 ? `, ${childCount} Child${childCount !== 1 ? 'ren' : ''}` : ''}
          </p>
        </div>

        <div className="border-t border-border" />

        {/* Pricing */}
        <div className="space-y-2">
          {discount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Retail Price</span>
              <span className="line-through text-muted-foreground tabular-nums">AED {sellTotal.toFixed(2)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">B2B Discount</span>
              <span className="font-bold text-white bg-destructive px-1.5 py-0.5 rounded text-[10px]">{discount}% OFF</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-dashed border-border">
            <p className="text-sm font-bold text-foreground">Net Total</p>
            <p className="text-lg font-extrabold text-primary tabular-nums">AED {netTotal.toFixed(2)}</p>
          </div>
          {savings > 0 && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-emerald-700 font-medium">Agent Margin</span>
              <span className="font-bold text-emerald-700 tabular-nums">AED {savings.toFixed(2)} ({agentMarginPct}%)</span>
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Declaration status */}
        {!confirmed && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Confirm the declaration below to submit</p>
          </div>
        )}
        {confirmed && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700">Ready to submit</p>
          </div>
        )}

        <Button type="submit" form="attraction-checkout-form" className="w-full h-11 font-semibold" disabled={submitDisabled}>
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating Voucher…</>
          ) : (
            'Generate Voucher / Offline Hold'
          )}
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          Zero emails · Instant PDF · Offline DMC settlement
        </p>

        {/* Trust */}
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-medium">B2B Wholesale Net Rates</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-foreground">
            <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-medium">Instant Confirmation</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-foreground">
            <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-medium">DMC Direct Contracting</span>
          </div>
        </div>
      </div>
    </div>
  );
}
