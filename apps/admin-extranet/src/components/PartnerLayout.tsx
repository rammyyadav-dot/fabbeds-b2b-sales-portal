import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Hotel, CalendarDays, Boxes, LogOut, User, ChevronRight, Building2, Lock } from 'lucide-react';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';
import { cn } from '@project/components/lib/utils';
import { Button } from '@project/components/ui/button';

const NAV = [
  { href: '/partner/hotel', icon: Building2, label: 'My Hotel' },
  { href: '/partner/rates', icon: CalendarDays, label: 'Rates' },
  { href: '/partner/inventory', icon: Boxes, label: 'Inventory' },
];

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = usePartnerAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/partner/login'); };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Hotel className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-black text-sm text-foreground leading-tight">Partner Extranet</p>
              <p className="text-[10px] text-muted-foreground font-medium">UAE Hotels TMS</p>
            </div>
          </div>
        </div>

        {/* Property Badge — fixed, set by admin */}
        {user?.hotelName && (
          <div className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-primary/8 border border-primary/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Lock className="w-3 h-3 text-primary/60" />
              <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-wider">Property</span>
            </div>
            <p className="text-xs font-bold text-foreground leading-tight">{user.hotelName}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = location.pathname === href || (href === '/partner/hotel' && location.pathname.startsWith('/partner/hotel'));
            return (
              <Link key={href} to={href}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all group',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-border space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate">{user?.fullName || user?.email}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.role}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive text-xs">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
