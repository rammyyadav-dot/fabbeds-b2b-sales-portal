import { useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Hotel, Ticket, Car, FileCheck, Package, LogIn, User, BookOpen, LogOut, X, Globe2, ChevronDown, WalletCards, Code2, UsersRound } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePartnerAuth } from '@/lib/partnerAuth';
import { partnerSignIn } from 'zitejs/api';
import { toast } from 'sonner';
import type { PartnerProfile } from '@/lib/partnerAuth';
import { FABBEDS } from '../../lib/brand';
import BrandWordmark from '../BrandWordmark';

interface SalesHeaderProps {
  onLogout: () => void;
  hotelCount?: number;
}

function SignInPopover({ onClose }: { onClose: () => void }) {
  const { signIn } = usePartnerAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await partnerSignIn({ email, password });
      if (res.success && res.token && res.partner) {
        signIn(res.token, res.partner as PartnerProfile);
        toast.success(`Welcome back, ${res.partner.agencyName}`);
        onClose();
      } else {
        toast.error(res.error || 'Sign in failed');
      }
    } catch {
      toast.error('Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-card-foreground text-sm">Partner sign in</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">For agencies and DMCs with an account.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Agency email</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ops@agency.com" className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Password</label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button type="button" onClick={() => { onClose(); navigate('/partner/register'); }} className="hover:text-foreground">Create partner account</button>
        </div>
      </form>
    </div>
  );
}

export default function SalesHeader({ onLogout, hotelCount = 0 }: SalesHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { partner, signOut } = usePartnerAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const isAttractions = location.pathname.includes('/attraction');
  const isTransfers = location.pathname.includes('/transfers');
  const isVisa = location.pathname.includes('/visa');
  const isPackages = location.pathname.includes('/package');
  const isHotels = !isAttractions && !isTransfers && !isVisa && !isPackages;

  return (
    <header className="bg-[#111111] text-white border-b border-white/10 sticky top-0 z-40">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between h-14">
          {/* fabBeds brand */}
          <div className="flex items-center gap-2.5 cursor-pointer min-w-0" onClick={() => navigate('/')}>
            <div className="shrink-0 py-1">
              <BrandWordmark tone="light" size="md" />
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-white/60 text-[9px] leading-none uppercase tracking-[0.16em] whitespace-nowrap">
                {FABBEDS.tagline}
              </p>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 relative">
            <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] font-semibold">
              <span>AED</span>
              <span className="opacity-50">·</span>
              <Globe2 className="w-3 h-3" />
              <span>UAE</span>
            </div>
            {partner ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAccount(v => !v)}
                  className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 hover:bg-white/10 transition-colors"
                  aria-expanded={showAccount}
                  aria-label="Open agency account menu"
                >
                  <div className="w-7 h-7 rounded-full bg-[#D71921] flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="hidden md:block text-left min-w-0">
                    <div className="text-xs font-semibold truncate max-w-40">{partner.agencyName}</div>
                    <div className="text-[9px] text-white/55">Agency account</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-white/60" />
                </button>

                {showAccount && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card text-foreground shadow-2xl p-2 z-50">
                    <div className="p-3 border-b border-border">
                      <p className="font-bold text-sm">{partner.agencyName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{partner.agencyEmail}</p>
                      <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs">
                        <span className="font-semibold">Agency credit:</span> {partner.creditStatus}
                        {partner.creditLimit > 0 ? ` · AED ${partner.creditLimit.toLocaleString()}` : ''}
                      </div>
                    </div>

                    <div className="py-2">
                      <button onClick={() => { setShowAccount(false); navigate('/my-bookings'); }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted">
                        <BookOpen className="w-4 h-4 text-primary" /> My Bookings
                      </button>
                      <button onClick={() => { setShowAccount(false); navigate('/find-booking'); }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted">
                        <BookOpen className="w-4 h-4 text-primary" /> Find a Booking
                      </button>
                      <button onClick={() => { setShowAccount(false); navigate('/partner/account'); }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted">
                        <WalletCards className="w-4 h-4 text-primary" /> Agency Credit & Account
                      </button>

                      <div className="mt-1 pt-1 border-t border-border">
                        <div className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-3"><Code2 className="w-4 h-4" /> API Integration Docs</span>
                          <span className="text-[9px] font-bold uppercase tracking-wide">Soon</span>
                        </div>
                        <div className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-3"><UsersRound className="w-4 h-4" /> Sub-Agent Management</span>
                          <span className="text-[9px] font-bold uppercase tracking-wide">Soon</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border pt-2">
                      <button onClick={() => { setShowAccount(false); signOut(); onLogout(); }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowSignIn(true)} className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15 gap-1.5">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Sign in</span>
                </Button>
                {showSignIn && <SignInPopover onClose={() => setShowSignIn(false)} />}
              </>
            )}
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-0 -mb-px">
          <button onClick={() => navigate('/')} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${isHotels ? 'border-[#D71921] text-white' : 'border-transparent text-white/45 hover:text-white'}`}>
            <Hotel className="w-4 h-4" /> Hotels
          </button>
          <button onClick={() => navigate('/attractions')} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${isAttractions ? 'border-[#D71921] text-white' : 'border-transparent text-white/45 hover:text-white'}`}>
            <Ticket className="w-4 h-4" /> Attractions
          </button>
          <button onClick={() => navigate('/transfers')} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${isTransfers ? 'border-[#D71921] text-white' : 'border-transparent text-white/45 hover:text-white'}`}>
            <Car className="w-4 h-4" /> Transfers
          </button>
          <button onClick={() => navigate('/visa')} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${isVisa ? 'border-[#D71921] text-white' : 'border-transparent text-white/45 hover:text-white'}`}>
            <FileCheck className="w-4 h-4" /> Visa
          </button>
          <button onClick={() => navigate('/packages')} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${isPackages ? 'border-[#D71921] text-white' : 'border-transparent text-white/45 hover:text-white'}`}>
            <Package className="w-4 h-4" /> Packages
          </button>
        </div>
      </div>
    </header>
  );
}
