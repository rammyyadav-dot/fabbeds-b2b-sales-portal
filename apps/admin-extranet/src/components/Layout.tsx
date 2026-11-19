import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useRole, DmcRole } from '@/hooks/useRole';
import { getHotels, GetHotelsOutputType } from 'zitejs/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { ChevronDown, LogOut, User, Menu, X, ShieldCheck, UserCog, Users, Hotel, ClipboardList, Search, Check } from 'lucide-react';
import { cn } from '@project/components/lib/utils';

type HotelRecord = GetHotelsOutputType['hotels'][0];

type NavItem =
  | { label: string; href: string; roles?: DmcRole[] }
  | { label: string; items: { label: string; href: string }[]; roles?: DmcRole[] };

const MICE_ROLES = ['Admin','Contracting Team','Sales Manager','Reservations Agent'];

// roles: undefined = visible to all authenticated users
const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Bookings', href: '/bookings', roles: ['Admin', 'Contracting Team', 'Sales Manager', 'Reservations Agent'] },
  { label: 'Hotel Management', roles: ['Admin', 'Contracting Team'], items: [
    { label: 'Hotel Profile', href: '/hotels' },
    { label: 'Full Hotel Management', href: '/hotels/:hotelId' },
    { label: 'Quick Update', href: '/quick-update' },
    { label: 'Rate Sync', href: '/rate-sync' },
    { label: 'Rate Upload', href: '/rate-upload' },
  ]},
  { label: 'Yielding', roles: ['Admin', 'Contracting Team'], items: [
    { label: 'Markup Rules', href: '/markup-rules' },
    { label: 'Pricing Engine', href: '/pricing-engine' },
    { label: 'Source Markets', href: '/source-markets' },
  ]},
  { label: 'Finance', href: '/financial-reports', roles: ['Admin', 'Finance Controller'] },
  { label: 'Attractions & Tickets', href: '/attractions', roles: ['Admin', 'Contracting Team', 'Sales Manager', 'Reservations Agent'] },
  { label: 'Visa Operations', href: '/visa', roles: ['Admin'] },
  { label: 'Transfer Operations', href: '/transfers', roles: ['Admin'] },
  { label: 'Package Operations', href: '/packages', roles: ['Admin'] },
  { label: 'Tariff Calendar', href: '/rate-sheet', roles: ['Admin', 'Contracting Team', 'Sales Manager'] },
  { label: 'Homepage Banners', href: '/homepage-banners', roles: ['Admin', 'Contracting Team', 'Sales Manager'] },
  { label: 'User Management', href: '/user-management', roles: ['Admin'] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAppAuth();
  const { isAdmin, roles, role } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [hotels, setHotels] = useState<HotelRecord[]>([]);
  const [selectedHotel, setSelectedHotel] = useState('');
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertyQuery, setPropertyQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    getHotels({}).then(r => {
      setHotels(r.hotels);
      const match = matchPath('/hotels/:id', location.pathname);
      const urlHotelId = match?.params?.id;
      const saved = localStorage.getItem('selectedHotelId');
      const id = urlHotelId ?? saved ?? r.hotels[0]?.id ?? '';
      setSelectedHotel(id);
      if (id) localStorage.setItem('selectedHotelId', id);
    });
  }, []);

  useEffect(() => {
    const match = matchPath('/hotels/:id', location.pathname);
    const urlHotelId = match?.params?.id;
    if (urlHotelId && hotels.length > 0) {
      setSelectedHotel(urlHotelId);
      localStorage.setItem('selectedHotelId', urlHotelId);
    }
  }, [location.pathname, hotels]);

  const handleHotelChange = (id: string) => {
    setSelectedHotel(id);
    setPropertyOpen(false);
    setPropertyQuery('');
    localStorage.setItem('selectedHotelId', id);
    window.dispatchEvent(new Event('hotelChanged'));
    const onHotelDetail = matchPath('/hotels/:hotelId', location.pathname);
    if (onHotelDetail) navigate(`/hotels/${id}`);
  };

  const selectedHotelRecord = hotels.find(h => h.id === selectedHotel);
  const normalizedPropertyQuery = propertyQuery.trim().toLowerCase();
  const filteredHotels = normalizedPropertyQuery
    ? hotels.filter(h =>
        [h.hotelName, h.hotelCode, h.location, h.emirate]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(normalizedPropertyQuery))
      )
    : hotels;

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  const canSeeItem = (item: NavItem) =>
    !item.roles || isAdmin || item.roles.some(r => roles.includes(r));

  const visibleNav = NAV.filter(canSeeItem);
  const canSeeMice = isAdmin || roles.some(r => MICE_ROLES.includes(r));

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Top bar */}
      <header className="bg-primary text-primary-foreground shrink-0" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
        <div className="flex items-center px-5 h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center shadow-md">
              <Hotel className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div className="hidden sm:block">
              <span className="font-black text-lg tracking-tight text-primary-foreground leading-none">
                UAE Hotels <span className="text-secondary">TMS</span>
              </span>
              <p className="text-[10px] text-primary-foreground/50 font-medium tracking-widest uppercase leading-none mt-0.5">Travel Management System</p>
            </div>
          </Link>

          <div className="hidden lg:block w-px h-8 bg-white/15 mx-1" />

          {/* Property selector */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="hidden lg:flex flex-col">
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary-foreground/40 leading-none flex items-center gap-1">
                Property <Search className="w-3 h-3" />
              </span>
            </div>

            <Popover open={propertyOpen} onOpenChange={(open) => {
              setPropertyOpen(open);
              if (!open) setPropertyQuery('');
            }}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-9 text-sm flex-1 min-w-0 bg-white/10 border border-white/20 text-primary-foreground focus:outline-none focus:ring-2 focus:ring-secondary font-semibold rounded-md px-3 flex items-center gap-2 hover:bg-white/15 transition-colors"
                  aria-label="Search and select property"
                >
                  <Search className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  <span className="truncate text-left flex-1">
                    {selectedHotelRecord?.hotelName || 'Type to search property'}
                  </span>
                  {selectedHotelRecord?.hotelCode && (
                    <span className="hidden xl:inline text-[10px] font-mono text-primary-foreground/55 shrink-0">
                      {selectedHotelRecord.hotelCode}
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
              </PopoverTrigger>

              <PopoverContent align="start" className="w-[420px] max-w-[92vw] p-0">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={propertyQuery}
                      onChange={e => setPropertyQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && filteredHotels.length > 0) {
                          e.preventDefault();
                          handleHotelChange(filteredHotels[0].id);
                        }
                      }}
                      placeholder="Type hotel name, code, location or emirate…"
                      className="pl-9 h-10"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {filteredHotels.length} match{filteredHotels.length === 1 ? '' : 'es'} · Enter selects first match
                  </p>
                </div>

                <div className="max-h-72 overflow-y-auto p-1">
                  {filteredHotels.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No matching property found.
                    </div>
                  ) : (
                    filteredHotels.map(h => {
                      const active = h.id === selectedHotel;
                      return (
                        <button
                          type="button"
                          key={h.id}
                          onClick={() => handleHotelChange(h.id)}
                          className={cn(
                            'w-full rounded-md px-3 py-2.5 text-left flex items-center gap-3 transition-colors',
                            active ? 'bg-primary/10' : 'hover:bg-muted'
                          )}
                        >
                          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Hotel className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate">{h.hotelName || 'Unnamed hotel'}</p>
                              {h.hotelCode && <Badge variant="outline" className="text-[9px] font-mono h-5 px-1.5">{h.hotelCode}</Badge>}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {[h.location, h.emirate].filter(Boolean).join(' · ') || 'Location not set'}
                            </p>
                          </div>
                          {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Quick links */}
          <div className="hidden sm:flex items-center gap-2 ml-2">
            {canSeeMice && (
              <Link to="/mice" className={cn(
                'flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-bold transition-all whitespace-nowrap border',
                isActive('/mice')
                  ? 'bg-secondary text-secondary-foreground border-secondary'
                  : 'bg-white/8 text-primary-foreground/80 border-white/15 hover:bg-white/15 hover:text-primary-foreground hover:border-white/25'
              )}>
                <Users className="w-3.5 h-3.5" />
                Groups & MICE
              </Link>
            )}
            {canSeeMice && (
              <Link to="/reservations" className={cn(
                'flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-bold transition-all whitespace-nowrap border',
                isActive('/reservations')
                  ? 'bg-secondary text-secondary-foreground border-secondary'
                  : 'bg-white/8 text-primary-foreground/80 border-white/15 hover:bg-white/15 hover:text-primary-foreground hover:border-white/25'
              )}>
                <ClipboardList className="w-3.5 h-3.5" />
                Reservations
              </Link>
            )}
          </div>

          {/* User menu */}
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-9 text-xs text-primary-foreground hover:bg-white/10 hover:text-primary-foreground px-2">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shadow-sm">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="font-bold text-xs leading-none">{user?.fullName || user?.username}</p>
                    <p className="text-[10px] text-primary-foreground/50 leading-none mt-0.5 max-w-[120px] truncate">{roles.join(', ')}</p>
                  </div>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-foreground">{user?.fullName || user?.username}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {isAdmin
                      ? <ShieldCheck className="w-3 h-3 text-primary" />
                      : <UserCog className="w-3 h-3 text-muted-foreground" />}
                    {roles.map(r => (
                      <Badge key={r} variant={r === 'Admin' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 h-4">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <DropdownMenuItem onClick={() => logout()} className="gap-2 text-destructive focus:text-destructive mt-1">
                  <LogOut className="w-4 h-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Nav bar */}
        <div className="hidden md:flex items-center px-5 border-t border-white/10 bg-primary/95">
          {visibleNav.map(item =>
            'items' in item ? (
              <DropdownMenu key={item.label}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-4 py-3 text-sm font-bold text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10 transition-all">
                    {item.label} <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[200px]">
                  {item.items.map(sub => (
                    <DropdownMenuItem key={sub.label} asChild>
                      <Link to={sub.href.replace(':hotelId', selectedHotel)} className="font-semibold">{sub.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link key={item.href} to={item.href}
                className={cn(
                  'px-4 py-3 text-sm font-bold transition-all relative',
                  isActive(item.href)
                    ? 'text-secondary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-secondary after:rounded-t'
                    : 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10'
                )}>
                {item.label}
              </Link>
            )
          )}
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden flex items-center px-5 py-2.5 gap-3 border-t border-white/10">
          <button onClick={() => setMobileOpen(o => !o)} className="text-primary-foreground">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="text-sm font-bold">
            {visibleNav.find(n => 'href' in n && isActive(n.href as string))?.label ||
             (visibleNav.filter(n => 'items' in n) as Array<{label: string; items: {label: string; href: string}[]}>)
               .flatMap(n => n.items).find(s => isActive(s.href))?.label ||
             'Menu'}
          </span>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-primary text-primary-foreground border-b border-primary/50 shrink-0 shadow-lg">
          {canSeeMice && (
            <Link to="/mice" onClick={() => setMobileOpen(false)}
              className={cn("block px-5 py-3 text-sm font-bold border-b border-white/10",
                isActive('/mice') ? "text-secondary" : "text-primary-foreground/80 hover:text-primary-foreground")}>
              Groups & MICE
            </Link>
          )}
          {canSeeMice && (
            <Link to="/reservations" onClick={() => setMobileOpen(false)}
              className={cn("block px-5 py-3 text-sm font-bold border-b border-white/10",
                isActive('/reservations') ? "text-secondary" : "text-primary-foreground/80 hover:text-primary-foreground")}>
              Reservations
            </Link>
          )}
          {visibleNav.map(item =>
            'items' in item ? (
              <div key={item.label}>
                <div className="px-5 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground/40">{item.label}</div>
                {item.items.map(sub => (
                  <Link key={sub.label} to={sub.href.replace(':hotelId', selectedHotel)} onClick={() => setMobileOpen(false)}
                    className="block px-7 py-2.5 text-sm font-semibold text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10">
                    {sub.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link key={item.href} to={item.href} onClick={() => setMobileOpen(false)}
                className={cn("block px-5 py-3 text-sm font-bold border-b border-white/10",
                  isActive(item.href) ? "text-secondary" : "text-primary-foreground/80 hover:text-primary-foreground")}>
                {item.label}
              </Link>
            )
          )}
        </div>
      )}

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
