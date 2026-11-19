import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hotel, Eye, EyeOff, LogIn, UserPlus, BedDouble, TrendingUp, Shield } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { toast } from 'sonner';
import { validatePartnerLogin, registerPartner } from 'zitejs/api';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';

const FEATURES = [
  { icon: BedDouble, label: 'Rate Management', desc: 'Load & update rates by calendar, grid, or bulk CSV' },
  { icon: TrendingUp, label: 'Inventory Control', desc: 'Manage availability, allotments & stop-sell' },
  { icon: Shield, label: 'Secure Access', desc: 'Role-based access for your entire hotel team' },
];

export default function PartnerLoginPage() {
  const { login } = usePartnerAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '', hotelName: '' });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Please fill in all required fields.');
    if (mode === 'signup') {
      if (!form.fullName) return toast.error('Full name is required.');
      if (form.password.length < 6) return toast.error('Password must be at least 6 characters.');
      if (form.password !== form.confirm) return toast.error('Passwords do not match.');
    }
    setLoading(true);
    try {
      const session = mode === 'login'
        ? await validatePartnerLogin({ email: form.email, accessCode: form.password })
        : await registerPartner({ fullName: form.fullName, email: form.email, accessCode: form.password, hotelName: form.hotelName });
      login(session);
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created! Welcome to the Partner Extranet.');
      navigate('/partner/dashboard');
    } catch (err: any) {
      toast.error(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="lg:w-1/2 bg-primary text-primary-foreground p-10 lg:p-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <Hotel className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-lg leading-tight">UAE Hotels</p>
              <p className="text-primary-foreground/60 text-xs font-medium tracking-widest uppercase">Partner Extranet</p>
            </div>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black leading-tight mb-4">
            Manage your hotel<br />rates & inventory
          </h1>
          <p className="text-primary-foreground/70 text-sm leading-relaxed mb-10">
            The all-in-one extranet for UAE hotel partners to load rates, control availability, and stay bookable 24/7.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 bg-white/8 rounded-xl p-4 border border-white/10">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-sm">{label}</p>
                  <p className="text-primary-foreground/60 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-primary-foreground/40 text-xs mt-8">© {new Date().getFullYear()} UAE Hotels TMS · Partner Portal</p>
      </div>

      {/* Right Panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-14">
        <div className="w-full max-w-md">
          {/* Toggle */}
          <div className="flex bg-muted rounded-xl p-1 mb-8">
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-black text-foreground">
              {mode === 'login' ? 'Welcome back' : 'Join as a partner'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === 'login' ? 'Sign in to your partner extranet' : 'Create your hotel partner account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <Label>Full Name *</Label>
                  <Input placeholder="John Smith" value={form.fullName} onChange={set('fullName')} disabled={loading} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hotel Name</Label>
                  <Input placeholder="Grand Hyatt Dubai" value={form.hotelName} onChange={set('hotelName')} disabled={loading} />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Email Address *</Label>
              <Input type="email" placeholder="you@hotel.com" value={form.email} onChange={set('email')} disabled={loading} autoComplete="email" />
            </div>

            <div className="space-y-1.5">
              <Label>Password *</Label>
              <div className="relative">
                <Input type={showPass ? 'text' : 'password'} placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Enter your password'}
                  value={form.password} onChange={set('password')} disabled={loading} className="pr-10" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label>Confirm Password *</Label>
                <Input type="password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} disabled={loading} />
              </div>
            )}

            <Button type="submit" className="w-full h-11 gap-2 font-bold mt-2" disabled={loading}>
              {loading
                ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                : mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Access is restricted to authorised hotel partners only.
          </p>

          <div className="border-t border-border pt-4 text-center space-y-1.5">
            <p className="text-xs text-muted-foreground">
              TMS staff?{' '}
              <a href="/login" className="text-primary font-semibold hover:underline">
                Staff Portal →
              </a>
            </p>
            <p className="text-xs text-muted-foreground">
              <a href="/portal" className="text-muted-foreground hover:text-foreground hover:underline">
                ← Back to Portal Selection
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
