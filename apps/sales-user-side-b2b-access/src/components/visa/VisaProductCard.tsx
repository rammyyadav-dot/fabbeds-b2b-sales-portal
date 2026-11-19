import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Calendar, Clock, DoorOpen, Shield, Zap } from 'lucide-react';

interface Product {
  id: string;
  visaName: string;
  category: string;
  validityDays: number;
  stayDays: number;
  entryType: string;
  processingType: string;
  sellingPrice: number;
  expressSurcharge: number;
  requiresDeposit: boolean;
  depositAmount: number;
  description: string;
}

interface Props {
  product: Product;
  onApply: (product: Product) => void;
}

const CAT_COLORS: Record<string, string> = {
  'Tourist Visa': 'bg-primary/10 text-primary',
  'Business Visa': 'bg-blue-100 text-blue-700',
  'Transit Visa': 'bg-amber-100 text-amber-700',
  'Employment Visa': 'bg-purple-100 text-purple-700',
  'Student Visa': 'bg-emerald-100 text-emerald-700',
  'e-Visa': 'bg-cyan-100 text-cyan-700',
  'Entry Visa': 'bg-orange-100 text-orange-700',
};

export default function VisaProductCard({ product, onApply }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className={`text-[10px] ${CAT_COLORS[product.category] || ''}`}>{product.category}</Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <DoorOpen className="w-3 h-3" /> {product.entryType}
              </Badge>
            </div>
            <h3 className="font-bold text-foreground text-base mt-2">{product.visaName}</h3>
            {product.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-extrabold text-foreground">AED {product.sellingPrice.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">per applicant</p>
          </div>
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5" /> {product.validityDays} days validity
          </span>
          <span className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1">
            <Clock className="w-3.5 h-3.5" /> {product.stayDays} days stay
          </span>
          {product.requiresDeposit && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1">
              <Shield className="w-3.5 h-3.5" /> Deposit AED {product.depositAmount.toFixed(0)}
            </span>
          )}
        </div>

        {/* Express option */}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <Zap className="w-3 h-3" />
          <span>Express available: +AED {product.expressSurcharge.toFixed(0)} (24-48 hrs)</span>
        </div>
      </div>

      <div className="border-t border-border px-5 py-3 bg-muted/30">
        <Button size="sm" className="w-full" onClick={() => onApply(product)}>
          Apply Now
        </Button>
      </div>
    </div>
  );
}
