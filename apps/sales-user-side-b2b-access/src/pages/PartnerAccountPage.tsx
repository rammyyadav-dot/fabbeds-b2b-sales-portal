import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, CreditCard, ShieldCheck, WalletCards } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { getPartnerWallet, type GetPartnerWalletOutputType } from 'zitejs/api';
import { usePartnerAuth } from '@/lib/partnerAuth';
import SalesHeader from '@/components/sales/SalesHeader';

export default function PartnerAccountPage() {
  const { partner, token, signOut } = usePartnerAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<GetPartnerWalletOutputType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partner || !token) {
      navigate('/partner/sign-in', { replace: true });
      return;
    }
    setLoading(true);
    getPartnerWallet({ token })
      .then(setWallet)
      .catch(() => setWallet(null))
      .finally(() => setLoading(false));
  }, [partner, token, navigate]);

  if (!partner) return null;

  const usedPct = wallet && wallet.creditLimit > 0
    ? Math.min(100, Math.round((wallet.creditUsed / wallet.creditLimit) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={() => {}} />
      <div className="container mx-auto px-4 max-w-6xl py-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary font-semibold">Travel trade account</p>
            <h1 className="text-2xl font-bold text-foreground mt-1">{partner.agencyName}</h1>
            <p className="text-sm text-muted-foreground">{partner.agencyEmail}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/my-bookings')}>My bookings</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : wallet ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Credit limit</p>
                  <CreditCard className="w-4 h-4 text-primary" />
                </div>
                <p className="text-2xl font-extrabold mt-2">AED {wallet.creditLimit.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Used credit</p>
                  <WalletCards className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-extrabold mt-2">AED {wallet.creditUsed.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-emerald-700 uppercase tracking-wide">Available credit</p>
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                </div>
                <p className="text-2xl font-extrabold text-emerald-700 mt-2">AED {wallet.creditAvailable.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Credit terms</p>
                  <CalendarDays className="w-4 h-4 text-primary" />
                </div>
                <p className="text-2xl font-extrabold mt-2">{wallet.creditTermsDays || 0} days</p>
              </div>
            </div>

            <div className="mt-4 bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Credit utilisation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{wallet.openBookings} open booking exposure{wallet.overdueBookings > 0 ? ` · ${wallet.overdueBookings} overdue` : ''}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${wallet.canBookOnCredit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {wallet.creditStatus}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted mt-4 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${usedPct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                <span>{usedPct}% utilised</span>
                <span>{Math.max(0, 100 - usedPct)}% available</span>
              </div>

              {!wallet.canBookOnCredit && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  New booking requests are disabled until credit is approved, available credit is positive, and overdue exposure is cleared.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load the agency credit wallet. Sign out and sign in again, or contact operations.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          <div className="border border-border rounded-xl p-5 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Agency profile</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Company / agency</label>
                <Input defaultValue={partner.agencyName} readOnly className="mt-1 bg-muted/20" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Business type</label>
                <Input defaultValue={partner.businessType || ''} readOnly className="mt-1 bg-muted/20" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Agency mobile / WhatsApp</label>
                <Input defaultValue={partner.agencyMobile || ''} readOnly className="mt-1 bg-muted/20" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Country / city</label>
                <Input defaultValue={[partner.country, partner.city].filter(Boolean).join(' · ')} readOnly className="mt-1 bg-muted/20" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Profile and credit-limit changes are controlled by operations/finance.</p>
          </div>

          <div className="border border-border rounded-xl p-5 bg-card">
            <h2 className="font-semibold">Credit account rules</h2>
            <div className="space-y-3 mt-4 text-sm text-muted-foreground">
              <p>• No payment gateway is used. Hotel bookings are submitted against approved agency credit.</p>
              <p>• Every open booking consumes available credit until finance marks its exposure Settled or Released.</p>
              <p>• Overdue exposure automatically blocks new credit bookings.</p>
              <p>• Cancellation or rejection releases booking exposure when finance/operations updates the settlement state.</p>
            </div>
            <Button className="mt-5 w-full" onClick={() => navigate('/')}>Search hotels</Button>
          </div>
        </div>

        <div className="mt-6">
          <Button variant="outline" onClick={() => { signOut(); navigate('/'); }} className="w-full sm:w-auto">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
