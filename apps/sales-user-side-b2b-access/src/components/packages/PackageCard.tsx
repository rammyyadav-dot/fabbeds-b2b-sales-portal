import { MapPin, CalendarDays, Hotel, Bus, Star } from 'lucide-react';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { packageFallbackImage } from '@/lib/packageImages';

interface PackageData {
  id: string;
  title: string;
  totalDays: number;
  totalNights: number;
  destinations: string[];
  hotelStarRating: string;
  transferType: string;
  category: string;
  coverImageUrl: string | null;
  startingPrice: number;
  lowestSeasonPrice: number | null;
  inclusions: string;
}

const categoryColors: Record<string, string> = {
  Classic: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  Premium: 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  Luxury: 'bg-amber-500/15 text-amber-800 border-amber-500/30',
  Honeymoon: 'bg-pink-500/15 text-pink-700 border-pink-500/30',
  Family: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  Adventure: 'bg-red-500/15 text-red-700 border-red-500/30',
};

export default function PackageCard({ pkg, onSelect }: { pkg: PackageData; onSelect: (id: string) => void }) {
  const displayPrice = pkg.lowestSeasonPrice || pkg.startingPrice;
  const stars = pkg.hotelStarRating?.match(/\d/)?.[0] || '4';

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-all group cursor-pointer" onClick={() => onSelect(pkg.id)}>
      {/* Cover image */}
      <div className="relative h-44 bg-muted overflow-hidden">
        <img src={pkg.coverImageUrl || packageFallbackImage(pkg.destinations)} alt={pkg.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        {/* Category badge */}
        <Badge variant="outline" className={`absolute top-3 left-3 text-[10px] font-bold backdrop-blur-sm ${categoryColors[pkg.category] || 'bg-muted text-muted-foreground'}`}>
          {pkg.category}
        </Badge>
        {/* Price tag */}
        <div className="absolute bottom-3 right-3 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg shadow-lg">
          <p className="text-[10px] leading-none opacity-70">from</p>
          <p className="text-lg font-extrabold leading-none">AED {displayPrice.toLocaleString()}</p>
          <p className="text-[10px] leading-none opacity-70">per person</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-sm text-foreground leading-snug mb-2 line-clamp-2">{pkg.title}</h3>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
            <CalendarDays className="w-3 h-3" /> {pkg.totalDays}D / {pkg.totalNights}N
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
            <Hotel className="w-3 h-3" /> {pkg.hotelStarRating || `${stars}-Star`}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
            <Bus className="w-3 h-3" /> {pkg.transferType || 'SIC'}
          </span>
        </div>

        {/* Destinations */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <MapPin className="w-3 h-3 shrink-0" />
          {pkg.destinations.join(' · ')}
        </div>

        {/* Inclusions preview */}
        {pkg.inclusions && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{pkg.inclusions.slice(0, 120)}...</p>
        )}

        <Button className="w-full" size="sm" onClick={(e) => { e.stopPropagation(); onSelect(pkg.id); }}>
          View Itinerary & Book
        </Button>
      </div>
    </div>
  );
}
