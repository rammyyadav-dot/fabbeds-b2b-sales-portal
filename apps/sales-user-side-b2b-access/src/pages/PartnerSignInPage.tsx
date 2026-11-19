import BrandWordmark from '@/components/BrandWordmark';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, CreditCard, LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { toast } from 'sonner';
import { partnerSignIn } from 'zitejs/api';
import SalesHeader from '@/components/sales/SalesHeader';
import { usePartnerAuth, type PartnerProfile } from '@/lib/partnerAuth';

export default function PartnerSignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, partner } = usePartnerAuth();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const returnTo = searchParams.get('returnTo') || '/';

  if (partner) {
    navigate(returnTo, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await partnerSignIn({ email: email.trim().toLowerCase(), password });
      if (res.success && res.token && res.partner) {
        signIn(res.token, res.partner as PartnerProfile);
        toast.success(`Welcome back, ${res.partner.agencyName}`, {
          description: res.partner.creditStatus === 'Approved'
            ? `Agency credit limit: AED ${res.partner.creditLimit.toLocaleString()}`
            : `Credit status: ${res.partner.creditStatus}`,
        });
        navigate(returnTo, { replace: true });
      } else {
        toast.error(res.error || 'Sign in failed');
      }
    } catch {
      toast.error('Sign in failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={() => {}} hotelCount={0} />
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-7 lg:p-9 bg-primary text-primary-foreground">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-5">
              <Building2 className="w-6 h-6" />
            </div>
            <BrandWordmark size="lg" />
            <h1 className="text-3xl font-extrabold mt-2 leading-tight">Your B2B hotel booking account.</h1>
            <p className="text-sm text-primary-foreground/75 mt-3 max-w-md">
              Sign in to contracted hotel tariffs, booking history and your agency credit wallet. No consumer checkout and no online payment gateway.
            </p>

            <div className="space-y-4 mt-8">
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Trade-only hotel rates</p>
                  <p className="text-xs text-primary-foreground/70">Book the exact room type and rate plan sourced from the tariff backend.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <CreditCard className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Agency credit wallet</p>
                  <p className="text-xs text-primary-foreground/70">Bookings consume approved credit limit; settlements are handled offline by finance.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Controlled booking exposure</p>
                  <p className="text-xs text-primary-foreground/70">Credit status, overdue exposure and available limit are checked before every booking request.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-7 lg:p-9">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <LogIn className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Partner sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Use the registered agency email for your travel trade account.</p>

            <form onSubmit={handleSubmit} className="space-y-4 mt-7">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Agency email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ops@agency.com"
                  className="mt-1.5 h-11"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1.5 h-11"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in to trade account'}
              </Button>
            </form>

            <div className="border-t border-border mt-6 pt-5">
              <p className="text-xs text-muted-foreground">
                New agency? Registration creates a trade account with credit status <strong>Pending Review</strong>. Credit limit is assigned by operations after approval.
              </p>
              <Button type="button" variant="outline" className="w-full mt-3" onClick={() => navigate('/partner/register')}>
                Create partner account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
