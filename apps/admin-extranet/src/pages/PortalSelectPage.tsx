import { Link } from 'react-router-dom';
import { Building2, Hotel, ArrowRight, ShieldCheck, Users } from 'lucide-react';

export default function PortalSelectPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Brand */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Building2 className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">UAE Hotels TMS</h1>
        <p className="text-muted-foreground text-sm mt-1 font-medium tracking-widest uppercase">Travel Management System</p>
      </div>

      <p className="text-muted-foreground text-sm mb-8 text-center">Select your portal to continue</p>

      {/* Portal Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        {/* Staff Portal */}
        <Link to="/login"
          className="group flex flex-col gap-4 rounded-2xl border-2 border-border bg-card p-7 hover:border-primary hover:shadow-lg transition-all duration-200">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-foreground">Internal Staff Portal</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              For DMC team members — reservations, contracting, sales & finance staff.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['Reservations Agent', 'Sales Manager', 'Finance Controller', 'Contracting Team'].map(r => (
                <span key={r} className="text-[10px] font-semibold bg-primary/8 text-primary px-2 py-0.5 rounded-full border border-primary/15">{r}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm group-hover:gap-3 transition-all">
            <ShieldCheck className="w-4 h-4" /> Sign In to Staff Portal <ArrowRight className="w-4 h-4 ml-auto" />
          </div>
        </Link>

        {/* Partner Extranet */}
        <Link to="/partner/login"
          className="group flex flex-col gap-4 rounded-2xl border-2 border-border bg-card p-7 hover:border-secondary hover:shadow-lg transition-all duration-200">
          <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
            <Hotel className="w-6 h-6 text-secondary-foreground" style={{ color: 'hsl(var(--secondary-foreground))' }} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-foreground">Hotel Partner Extranet</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              For hotel partners — manage rates, availability, allotments & inventory.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['Hotel Owner', 'Hotel Manager', 'Revenue Manager'].map(r => (
                <span key={r} className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">{r}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm group-hover:text-foreground group-hover:gap-3 transition-all">
            <Hotel className="w-4 h-4" /> Sign In to Partner Extranet <ArrowRight className="w-4 h-4 ml-auto" />
          </div>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mt-10 text-center">
        © {new Date().getFullYear()} UAE Hotels TMS · Access restricted to authorised users only
      </p>
    </div>
  );
}
