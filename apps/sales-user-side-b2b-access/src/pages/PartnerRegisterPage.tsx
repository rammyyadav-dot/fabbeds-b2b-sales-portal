import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { toast } from 'sonner';
import { partnerSignUp, partnerSignIn } from 'zitejs/api';
import { usePartnerAuth } from '@/lib/partnerAuth';
import SalesHeader from '@/components/sales/SalesHeader';
import type { PartnerProfile } from '@/lib/partnerAuth';

const BUSINESS_TYPES = ['Travel Agent', 'Tour Operator', 'DMC', 'Corporate', 'Other'];
const COUNTRIES = ['UAE', 'Saudi Arabia', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'UK', 'Germany', 'France', 'India', 'Other'];

export default function PartnerRegisterPage() {
  const navigate = useNavigate();
  const { signIn } = usePartnerAuth();
  const [form, setForm] = useState({ email: '', password: '', agencyName: '', businessType: '', agencyMobile: '', country: '', city: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.agencyName) { toast.error('Fill in all required fields'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res = await partnerSignUp({
        email: form.email, password: form.password, agencyName: form.agencyName,
        businessType: form.businessType || undefined, agencyMobile: form.agencyMobile || undefined,
        country: form.country || undefined, city: form.city || undefined,
      });
      if (res.success && res.partner) {
        const signInRes = await partnerSignIn({ email: form.email, password: form.password });
        if (signInRes.success && signInRes.token && signInRes.partner) {
          signIn(signInRes.token, signInRes.partner as PartnerProfile);
        }
        toast.success('Partner account created!');
        navigate('/my-bookings');
      } else {
        toast.error(res.error || 'Failed to create account');
      }
    } catch { toast.error('Failed to create account'); }
    finally { setLoading(false); }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-background">
      <SalesHeader onLogout={() => {}} />
      <div className="container mx-auto px-4 max-w-lg py-10">
        <h1 className="text-xl font-semibold text-foreground">Create partner account</h1>
        <p className="text-sm text-muted-foreground mt-1">For agencies and DMCs. Get your bookings in one place, agency details prefilled.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Agency email *</label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="ops@agency.com" className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Password * (min 8 characters)</label>
              <Input type="password" value={form.password} onChange={set('password')} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Company / agency name *</label>
              <Input value={form.agencyName} onChange={set('agencyName')} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Business type</label>
              <Select value={form.businessType} onValueChange={v => setForm(p => ({ ...p, businessType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Agency mobile / WhatsApp</label>
              <Input value={form.agencyMobile} onChange={set('agencyMobile')} placeholder="+971 50 ..." className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Country</label>
              <Select value={form.country} onValueChange={v => setForm(p => ({ ...p, country: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">City</label>
              <Input value={form.city} onChange={set('city')} className="mt-1" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
