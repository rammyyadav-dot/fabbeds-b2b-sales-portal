import { MapPin, Building2 } from 'lucide-react';
import { Badge } from '@project/components/ui/badge';
import { GetHotelProfileOutputType } from 'zitejs/api';
import StarRating from './StarRating';

type Hotel = GetHotelProfileOutputType['hotel'];

interface Props { hotel: Hotel; }

export default function HotelProfileHeader({ hotel }: Props) {
  const starNum = parseInt(hotel.starRating) || 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-72 h-52 sm:h-auto shrink-0 overflow-hidden">
          {hotel.imageUrl ? (
            <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 via-secondary/30 to-accent/20 flex items-center justify-center">
              <Building2 className="w-16 h-16 text-primary/30" />
            </div>
          )}
        </div>
        <div className="flex-1 p-6 space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{hotel.name}</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <StarRating stars={starNum} size="md" />
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{hotel.location || hotel.emirate}
              </span>
              <Badge variant="outline" className="text-xs">{hotel.emirate}</Badge>
            </div>
          </div>
          {hotel.description && (
            <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">{hotel.description}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">FabBeds Exclusive Deals</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
