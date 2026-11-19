import { Zap, Tag, Flame, TrendingUp, MapPin } from 'lucide-react';

interface Props {
  id: string;
  ticketOptionId: string;
  ticketOptionName: string;
  title: string;
  shortDescription: string;
  city: string;
  category: string;
  skuCode?: string;
  coverImage?: string;
  imageCredit?: string;
  rating: number;
  reviewCount: number;
  cancellationPolicy: string;
  instantConfirmation: boolean;
  bookedCount: number;
  retailPrice: number | null;
  netPrice: number | null;
  discountPct: number;
  rrpSet?: boolean;
  pricesVisible?: boolean;
  onClick: () => void;
}

function formatBooked(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000)}K+`;
  if (n > 0) return `${n}+`;
  return '';
}

export default function AttractionCard({
  title, ticketOptionName, shortDescription, city, category, skuCode, coverImage, rating, reviewCount,
  instantConfirmation, bookedCount, retailPrice, netPrice, discountPct, rrpSet, pricesVisible, onClick,
}: Props) {
  const isBestSeller = bookedCount >= 500 || (rating >= 4.7 && reviewCount >= 100);
  const isTrending = !isBestSeller && (bookedCount >= 100 || (rating >= 4.5 && reviewCount >= 20));
  const bookedLabel = formatBooked(bookedCount);
  const hasDiscount = !!(discountPct > 0 && retailPrice && netPrice && retailPrice > netPrice);

  return (
    <button onClick={onClick} className="group bg-white rounded-md overflow-hidden border border-black/10 hover:border-primary/60 hover:shadow-[0_18px_40px_rgba(0,0,0,.10)] transition-all duration-200 text-left w-full">
      <div className="h-44 bg-muted relative overflow-hidden">
        {coverImage ? (
          <img src={coverImage} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/5 to-amber-100 flex items-center justify-center text-5xl">🎟️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <div className="absolute left-3 bottom-3 right-3 text-white">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] bg-[#D71921] text-white px-2 py-1 rounded-sm">{category || 'Attraction'}</span>
            {isBestSeller && <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Flame className="w-2.5 h-2.5"/>Best Seller</span>}
            {isTrending && <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5"/>Trending</span>}
          </div>
        </div>
      </div>

      <div className="p-4">
        <p className="text-[9px] uppercase tracking-[0.12em] text-primary font-black line-clamp-1">{title}</p>
        <h3 className="text-base font-black text-foreground leading-[1.05] tracking-[-0.03em] line-clamp-2 group-hover:text-primary transition-colors mt-1">{ticketOptionName || title}</h3>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="w-3 h-3" /> {city || 'UAE'}
        </div>
        {shortDescription && <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{shortDescription}</p>}

        <div className="mt-2 flex items-center gap-2 flex-wrap text-[10px]">
          {rating > 0 && <span className="text-amber-600 font-bold">★ {rating.toFixed(1)}</span>}
          {reviewCount > 0 && <span className="text-muted-foreground">({reviewCount.toLocaleString()})</span>}
          {bookedLabel && <><span className="text-muted-foreground/40">·</span><span className="text-muted-foreground">{bookedLabel} booked</span></>}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {instantConfirmation && <span className="flex items-center gap-0.5 text-[9px] text-emerald-700 font-medium"><Zap className="w-2.5 h-2.5"/>Instant eligible</span>}
          {skuCode && <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{skuCode}</span>}
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-black/10 bg-[#f6f6f4]">
        <div className="flex items-end justify-between gap-3">
          <div>
            {netPrice && netPrice > 0 ? (
              <>
                {hasDiscount && <div className="flex items-center gap-1.5 mb-0.5"><span className="text-[10px] text-muted-foreground line-through">AED {retailPrice!.toFixed(0)}</span><span className="text-[10px] font-bold text-white bg-destructive px-1 py-0.5 rounded">{discountPct}%</span></div>}
                <div className="flex items-baseline gap-1"><span className="text-[10px] text-muted-foreground">from AED</span><span className="text-lg font-extrabold">{netPrice.toFixed(0)}</span></div>
                <p className="text-[8px] text-primary font-semibold mt-0.5 flex items-center gap-0.5"><Tag className="w-2 h-2"/>Current B2B net rate</p>
                {rrpSet === false && <p className="text-[9px] text-amber-700 font-semibold mt-0.5">RRP not set</p>}
              </>
            ) : pricesVisible === false ? (
              <div><p className="text-xs font-semibold text-primary">Sign in for agent rates</p><p className="text-[9px] text-muted-foreground mt-0.5">B2B net prices are for registered agencies</p></div>
            ) : (
              <div><p className="text-xs font-semibold">Rate not loaded</p><p className="text-[9px] text-muted-foreground mt-0.5">SKU available for contracting / rate setup</p></div>
            )}
          </div>
          <span className="text-[10px] font-semibold text-primary group-hover:underline">View ticket options →</span>
        </div>
      </div>
    </button>
  );
}
