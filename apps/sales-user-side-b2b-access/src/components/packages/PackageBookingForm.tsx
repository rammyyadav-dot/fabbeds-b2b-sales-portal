import { useState, useMemo } from 'react';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Button } from '@project/components/ui/button';
import { Loader2, CheckCircle, Users, User, Baby } from 'lucide-react';
import { createPackageBooking } from 'zitejs/api';
import { toast } from 'sonner';

interface SeasonPrice {
  id: string;
  seasonName: string;
  validFrom: string;
  validTo: string;
  retailAdultTwin: number;
  retailAdultSingle: number;
  retailChildWithBed: number;
  retailChildNoBed: number;
}

interface Props {
  packageId: string;
  packageTitle: string;
  seasonPrices: SeasonPrice[];
}

function fmt(n: number) {
  return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function PackageBookingForm({ packageId, packageTitle, seasonPrices }: Props) {
  const [travelDate, setTravelDate] = useState('');
  const [leadName, setLeadName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [adultsTwin, setAdultsTwin] = useState(2);
  const [adultsSingle, setAdultsSingle] = useState(0);
  const [childrenBed, setChildrenBed] = useState(0);
  const [childrenNoBed, setChildrenNoBed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const matchedSeason = useMemo(() => {
    if (!travelDate) return null;
    return seasonPrices.find(s => travelDate >= s.validFrom && travelDate <= s.validTo) || null;
  }, [travelDate, seasonPrices]);

  const estimate = useMemo(() => {
    if (!matchedSeason) return null;
    const total =
      adultsTwin * matchedSeason.retailAdultTwin +
      adultsSingle * matchedSeason.retailAdultSingle +
      childrenBed * matchedSeason.retailChildWithBed +
      childrenNoBed * matchedSeason.retailChildNoBed;
    return total;
  }, [matchedSeason, adultsTwin, adultsSingle, childrenBed, childrenNoBed]);

  const totalPax = adultsTwin + adultsSingle + childrenBed + childrenNoBed;

  const handleSubmit = async () => {
    if (!leadName.trim() || !email.trim() || !phone.trim() || !travelDate || totalPax === 0) {
      toast.error('Please fill in all fields and add at least one traveler');
      return;
    }
    setLoading(true);
    try {
      const res = await createPackageBooking({
        packageId,
        travelStartDate: travelDate,
        leadTravelerName: leadName,
        contactEmail: email,
        contactPhone: phone,
        adultsTwin,
        adultsSingle,
        childrenWithBed: childrenBed,
        childrenNoBed: childrenNoBed,
      });
      setSuccess(res.bookingReference);
      toast.success(`Booking ${res.bookingReference} submitted to DMC operations queue`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit booking');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-10">
        <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
        <h3 className="font-bold text-lg text-foreground mb-1">Booking Submitted</h3>
        <p className="text-sm text-muted-foreground mb-2">Reference: <span className="font-mono font-bold text-foreground">{success}</span></p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Your booking has been queued for manual allocation by our DMC operations team. You will receive a confirmation voucher once all supplier components are secured.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Travel date */}
      <div>
        <Label className="text-xs font-semibold">Travel Start Date</Label>
        <Input type="date" value={travelDate} onChange={e => setTravelDate(e.target.value)} className="mt-1" />
        {travelDate && !matchedSeason && (
          <p className="text-[11px] text-destructive mt-1">No season pricing covers this date. Choose a date within an active season.</p>
        )}
        {matchedSeason && (
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">✓ {matchedSeason.seasonName} rates applied</p>
        )}
      </div>

      {/* Occupancy grid */}
      <div>
        <Label className="text-xs font-semibold mb-2 block">Occupancy Breakdown</Label>
        <div className="grid grid-cols-2 gap-3">
          <OccupancyInput icon={<Users className="w-4 h-4" />} label="Adults (Twin Share)" value={adultsTwin} onChange={setAdultsTwin} price={matchedSeason?.retailAdultTwin} />
          <OccupancyInput icon={<User className="w-4 h-4" />} label="Adults (Single)" value={adultsSingle} onChange={setAdultsSingle} price={matchedSeason?.retailAdultSingle} />
          <OccupancyInput icon={<Baby className="w-4 h-4" />} label="Child (With Bed)" value={childrenBed} onChange={setChildrenBed} price={matchedSeason?.retailChildWithBed} />
          <OccupancyInput icon={<Baby className="w-4 h-4" />} label="Child (No Bed)" value={childrenNoBed} onChange={setChildrenNoBed} price={matchedSeason?.retailChildNoBed} />
        </div>
      </div>

      {/* Guest details */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Lead Traveler Name</Label>
          <Input value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="Full name" className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971..." className="mt-1" />
          </div>
        </div>
      </div>

      {/* Cost summary */}
      {estimate !== null && estimate > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{totalPax} traveler{totalPax > 1 ? 's' : ''} · {matchedSeason?.seasonName}</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-sm font-semibold text-foreground">Total Package Cost</span>
            <span className="text-2xl font-extrabold text-primary">{fmt(estimate)}</span>
          </div>
        </div>
      )}

      <Button onClick={handleSubmit} disabled={loading || !matchedSeason || totalPax === 0} className="w-full h-12 text-sm font-bold">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Submit to DMC Operations Queue
      </Button>

      <p className="text-[10px] text-center text-muted-foreground">
        This is an offline static package. A DMC operations clerk will manually confirm all supplier components and issue a unified voucher.
      </p>
    </div>
  );
}

function OccupancyInput({ icon, label, value, onChange, price }: {
  icon: React.ReactNode; label: string; value: number; onChange: (v: number) => void; price?: number;
}) {
  return (
    <div className="bg-muted/30 border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[11px] font-medium text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-sm font-bold hover:bg-muted transition-colors">−</button>
        <span className="w-8 text-center text-sm font-bold">{value}</span>
        <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-sm font-bold hover:bg-muted transition-colors">+</button>
      </div>
      {price !== undefined && price > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1.5">AED {price.toLocaleString()} /pp</p>
      )}
    </div>
  );
}
