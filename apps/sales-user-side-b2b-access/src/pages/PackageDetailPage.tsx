import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPackageDetail, GetPackageDetailOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { ArrowLeft, CalendarDays, Hotel, Bus, MapPin, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Badge } from '@project/components/ui/badge';
import SalesHeader from '@/components/sales/SalesHeader';
import ItineraryTimeline from '@/components/packages/ItineraryTimeline';
import SeasonPriceGrid from '@/components/packages/SeasonPriceGrid';
import PackageBookingForm from '@/components/packages/PackageBookingForm';
import { packageFallbackImage } from '@/lib/packageImages';

type DetailData = GetPackageDetailOutputType;

export default function PackageDetailPage({ onLogout }: { onLogout: () => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'pricing' | 'book'>('itinerary');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getPackageDetail({ packageId: id })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SalesHeader onLogout={onLogout} hotelCount={0} />
        <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SalesHeader onLogout={onLogout} hotelCount={0} />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
          <p className="font-semibold">Package not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/packages')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Packages
          </Button>
        </div>
      </div>
    );
  }

  const pkg = data.package;
  const displayPrice = pkg.startingPrice;

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />

      {/* Hero */}
      <div className="relative">
        <div className="h-64 md:h-80 relative">
          <img src={pkg.coverImageUrl || packageFallbackImage(pkg.destinations)} alt={pkg.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="container mx-auto max-w-5xl">
            <button onClick={() => navigate('/packages')} className="text-white/70 hover:text-white text-xs flex items-center gap-1 mb-3 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Back to Packages
            </button>
            <h1 className="text-white text-2xl md:text-3xl font-extrabold mb-2 drop-shadow-lg">{pkg.title}</h1>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <SummaryBadge icon={<CalendarDays className="w-3.5 h-3.5" />} text={`${pkg.totalDays} Days / ${pkg.totalNights} Nights`} />
              <SummaryBadge icon={<Hotel className="w-3.5 h-3.5" />} text={`${pkg.hotelStarRating} Hotel Block`} />
              <SummaryBadge icon={<Bus className="w-3.5 h-3.5" />} text={pkg.transferType || 'Shared SIC Transfers'} />
              <SummaryBadge icon={<MapPin className="w-3.5 h-3.5" />} text={pkg.destinations.join(' · ')} />
            </div>
          </div>
        </div>

        {/* Floating price */}
        {displayPrice > 0 && (
          <div className="absolute top-4 right-4 md:right-8 bg-primary text-primary-foreground px-4 py-2 rounded-xl shadow-xl">
            <p className="text-[10px] opacity-70">from</p>
            <p className="text-xl font-extrabold">AED {displayPrice.toLocaleString()}</p>
            <p className="text-[10px] opacity-70">per person twin share</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Tab switcher */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6">
          {(['itinerary', 'pricing', 'book'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab ? 'bg-card text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab === 'itinerary' ? '📋 Itinerary' : tab === 'pricing' ? '💰 Season Pricing' : '✈️ Book Now'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2">
            {activeTab === 'itinerary' && (
              <div>
                <h2 className="font-bold text-lg text-foreground mb-4">Day-by-Day Program</h2>
                <ItineraryTimeline days={data.itinerary} />
              </div>
            )}

            {activeTab === 'pricing' && (
              <div>
                <h2 className="font-bold text-lg text-foreground mb-4">Season Price Matrix</h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <SeasonPriceGrid seasons={data.seasonPrices} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  All prices are per person in AED. Twin share = 2 adults sharing a double room. Season pricing auto-applies based on travel start date.
                </p>
              </div>
            )}

            {activeTab === 'book' && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-bold text-lg text-foreground mb-4">Book This Package</h2>
                <PackageBookingForm packageId={pkg.id} packageTitle={pkg.title} seasonPrices={data.seasonPrices} />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Inclusions */}
            {pkg.inclusions && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Inclusions
                </h3>
                <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{pkg.inclusions}</div>
              </div>
            )}

            {/* Exclusions */}
            {pkg.exclusions && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-3">
                  <XCircle className="w-4 h-4 text-destructive" /> Exclusions
                </h3>
                <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{pkg.exclusions}</div>
              </div>
            )}

            {/* Terms */}
            {pkg.termsAndConditions && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" /> Terms & Conditions
                </h3>
                <div className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-line">{pkg.termsAndConditions}</div>
              </div>
            )}

            {/* Book CTA */}
            {activeTab !== 'book' && (
              <Button className="w-full h-12 font-bold" onClick={() => setActiveTab('book')}>
                Book This Package →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium">
      {icon} {text}
    </span>
  );
}
