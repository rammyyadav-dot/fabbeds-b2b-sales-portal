import { useState } from 'react';
import { Building2, FileText, TrendingUp, DollarSign, ShieldCheck, LogIn, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Separator } from '@project/components/ui/separator';
import { Checkbox } from '@project/components/ui/checkbox';
import { useAppAuth } from '@/hooks/useAppAuth';
import { validateAccessCode, registerUser } from 'zitejs/api';
import { toast } from 'sonner';

const MODULES = [
  { icon: FileText, label: 'Contracting', subs: ['Hotel Contract Management', 'Rate Structure Builder', 'Allotment & Inventory', 'Special Conditions'] },
  { icon: TrendingUp, label: 'Sales & Account Management', subs: ['Booking Enquiries', 'Rate Sheet & Tariff', 'Client Accounts', 'Reports'] },
  { icon: DollarSign, label: 'Finance & Reconciliation', subs: ['Financial Reports', 'Invoice Management', 'Reconciliation', 'Rate Logs'] },
];

const ROLES = [
  { role: 'Admin', access: 'All Modules — Full Access' },
  { role: 'Contracting Team', access: 'Contracting · Rate Builder' },
  { role: 'Sales Manager', access: 'Sales · Reports' },
  { role: 'Finance Controller', access: 'Finance' },
];

// DMC staff roles only — Hotel Owners register via /partner/login
const SIGNUP_ROLES = ['Reservations Agent', 'Sales Manager', 'Finance Controller', 'Contracting Team'];

export default function LoginPage() {
  const { login } = useAppAuth();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Signup fields
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['Reservations Agent']);
  const toggleSignupRole = (r: string) => setSelectedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { toast.error('Please enter your email and password.'); return; }
    setLoading(true);
    try {
      const result = await validateAccessCode({ email: email.trim().toLowerCase(), password: password.trim() });
      if (!result.success || !result.id) {
        toast.error(result.error ?? 'Invalid email or password. Please try again.');
      } else {
        login({ id: result.id, username: result.username!, fullName: result.fullName, email: result.email, role: result.role! });
        // Full reload so AuthGuard re-reads localStorage in all component instances
        window.location.href = '/';
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !signupEmail.trim() || !signupPassword.trim()) { toast.error('Please fill in all required fields.'); return; }
    if (signupPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    if (signupPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      if (selectedRoles.length === 0) { toast.error('Please select at least one role.'); setLoading(false); return; }
      const result = await registerUser({ fullName: fullName.trim(), email: signupEmail.trim(), password: signupPassword, role: selectedRoles.join(',') });
      if (!result.success || !result.id) {
        toast.error(result.error ?? 'Failed to create account.');
      } else {
        toast.success('Account created! Your request is pending admin approval. You will be notified once approved.', { duration: 6000 });
        setActiveTab('signin');
        setEmail(signupEmail.trim());
        setFullName(''); setSignupEmail(''); setSignupPassword(''); setConfirmPassword('');
        setSelectedRoles(['Reservations Agent']);
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="lg:w-3/5 bg-primary text-primary-foreground p-8 lg:p-12 flex flex-col justify-between">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">UAE Hotels TMS</h1>
              <p className="text-primary-foreground/60 text-sm">Travel Management System</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/50 mb-4">Core System Modules</p>
            <div className="space-y-3">
              {MODULES.map(({ icon: Icon, label, subs }) => (
                <div key={label} className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-secondary" />
                    <span className="font-semibold text-sm">{label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {subs.map(s => (
                      <span key={s} className="text-[10px] bg-white/10 text-primary-foreground/80 px-2 py-0.5 rounded-full border border-white/10">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8">
          <Separator className="bg-white/10 mb-5" />
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/50 mb-3">Role-Based Access Control</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map(({ role, access }) => (
              <div key={role} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-secondary shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{role}</div>
                  <div className="text-[10px] text-primary-foreground/55 truncate">{access}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="lg:w-2/5 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {activeTab === 'signin' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {activeTab === 'signin' ? 'Sign in to access your TMS dashboard' : 'Register to get started with UAE Hotels TMS'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setActiveTab('signin')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all ${activeTab === 'signin' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => toast.info('Staff accounts must be created by a verified Admin. Contact your administrator.')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-all ${activeTab === 'signup' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
            >
              Create Account
            </button>
          </div>

          {activeTab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" disabled={loading} className="pr-10" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-11 gap-2 font-bold" disabled={loading}>
                {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" placeholder="John Smith" value={fullName} onChange={e => setFullName(e.target.value)} disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signupEmail">Email Address</Label>
                <Input id="signupEmail" type="email" placeholder="you@company.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} autoComplete="email" disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signupPassword">Password</Label>
                <div className="relative">
                  <Input id="signupPassword" type={showSignupPassword ? 'text' : 'password'} placeholder="Min. 6 characters" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} disabled={loading} className="pr-10" />
                  <button type="button" onClick={() => setShowSignupPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" placeholder="Re-enter your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label>Roles <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-2 p-3 border border-border rounded-lg bg-muted/30">
                  {SIGNUP_ROLES.map(r => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedRoles.includes(r)} onCheckedChange={() => toggleSignupRole(r)} disabled={loading} />
                      <span className="text-sm">{r}</span>
                    </label>
                  ))}
                </div>
                {selectedRoles.length > 0 && (
                  <p className="text-xs text-muted-foreground">Selected: {selectedRoles.join(', ')}</p>
                )}
              </div>
              <Button type="submit" className="w-full h-11 gap-2 font-bold" disabled={loading}>
                {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Access is restricted to authorised personnel only.
          </p>

          <div className="border-t border-border pt-4 text-center space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Are you a hotel partner?{' '}
              <a href="/partner/login" className="text-primary font-semibold hover:underline">
                Partner Extranet →
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
