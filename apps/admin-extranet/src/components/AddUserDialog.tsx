import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Button } from '@project/components/ui/button';
import { Checkbox } from '@project/components/ui/checkbox';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { registerUser } from 'zitejs/api';
import { DMC_ROLES } from '@/hooks/useRole';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddUserDialog({ open, onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['Reservations Agent']);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail('');
    setCompany(''); setSelectedRoles(['Reservations Agent']); setPassword('');
  };

  const handleClose = () => { reset(); onClose(); };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !email.trim()) { toast.error('First name and email are required.'); return; }
    if (selectedRoles.length === 0) { toast.error('Please select at least one role.'); return; }
    setSaving(true);
    try {
      const result = await registerUser({
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: email.trim(),
        password: password.trim(),
        role: selectedRoles.join(','),
        companyName: company.trim() || undefined,
      });
      if (!result.success) { toast.error(result.error ?? 'Failed to create user.'); return; }
      toast.success(`User ${firstName} created successfully.`);
      reset();
      onCreated();
    } catch { toast.error('Something went wrong.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name <span className="text-destructive">*</span></Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" disabled={saving} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email <span className="text-destructive">*</span></Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@company.com" disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Satguru Travel" disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label>Roles <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-2 p-3 border border-border rounded-lg bg-muted/30">
              {DMC_ROLES.map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={selectedRoles.includes(r)}
                    onCheckedChange={() => toggleRole(r)}
                    disabled={saving}
                  />
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors">{r}</span>
                </label>
              ))}
            </div>
            {selectedRoles.length > 0 && (
              <p className="text-xs text-muted-foreground">Selected: {selectedRoles.join(', ')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Set login password" className="pr-9" disabled={saving} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Creating…</span> : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
