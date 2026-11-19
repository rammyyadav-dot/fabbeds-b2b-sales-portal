import { useState } from 'react';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Button } from '@project/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { toast } from 'sonner';
import { createVisaApplication } from 'zitejs/api';
import { Loader2, CheckCircle2, Plus, Trash2, Zap, Users, AlertTriangle } from 'lucide-react';

interface Product {
  id: string; visaName: string; sellingPrice: number; expressSurcharge: number;
  requiresDeposit: boolean; depositAmount: number; category: string;
}

interface Applicant {
  firstName: string; lastName: string; nationality: string;
  passportNumber: string; passportExpiry: string; dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
}

const EMPTY_APPLICANT: Applicant = {
  firstName: '', lastName: '', nationality: '', passportNumber: '',
  passportExpiry: '', dateOfBirth: '', gender: 'MALE',
};

interface Props { product: Product; onSuccess: (ref: string) => void; onBack: () => void; }

export default function VisaApplicationForm({ product, onSuccess, onBack }: Props) {
  const [express, setExpress] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([{ ...EMPTY_APPLICANT }]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const perPerson = product.sellingPrice + (express ? product.expressSurcharge : 0);
  const total = perPerson * applicants.length;
  const depositTotal = product.requiresDeposit ? product.depositAmount * applicants.length : 0;

  const updateApplicant = (idx: number, field: string, val: string) => {
    setApplicants(prev => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };

  const addApplicant = () => setApplicants(prev => [...prev, { ...EMPTY_APPLICANT }]);
  const removeApplicant = (idx: number) => setApplicants(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    for (const a of applicants) {
      if (!a.firstName || !a.lastName || !a.nationality || !a.passportNumber || !a.passportExpiry || !a.dateOfBirth) {
        toast.error('Please fill all required fields for every applicant');
        return;
      }
      const expiry = new Date(a.passportExpiry);
      const sixMonths = new Date();
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      if (expiry < sixMonths) {
        toast.error(`Passport for ${a.firstName} ${a.lastName} expires within 6 months. Not eligible.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await createVisaApplication({
        visaProductId: product.id,
        processingType: express ? 'EXPRESS' : 'STANDARD',
        applicants,
        notes: notes || undefined,
      });
      setConfirmed(res.applicationReference);
      onSuccess(res.applicationReference);
      toast.success(`Application submitted: ${res.applicationReference}`);
    } catch {
      toast.error('Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="text-center py-10 space-y-4">
        <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
        <h3 className="text-xl font-bold text-foreground">Application Submitted!</h3>
        <p className="text-sm text-muted-foreground">Reference: <span className="font-mono font-bold text-foreground">{confirmed}</span></p>
        <div className="bg-muted/50 rounded-xl p-4 text-xs space-y-1 max-w-sm mx-auto">
          <p className="font-semibold">{product.visaName}</p>
          <p>{applicants.length} applicant{applicants.length > 1 ? 's' : ''} · {express ? 'Express' : 'Standard'}</p>
          <p className="font-bold text-foreground text-sm">Total: AED {total.toFixed(2)}</p>
          {depositTotal > 0 && <p className="text-amber-600">Security Deposit: AED {depositTotal.toFixed(2)}</p>}
          <p className="text-muted-foreground mt-2">Next step: Upload passport copies & photos for each applicant</p>
        </div>
        <Button variant="outline" onClick={onBack}>Back to Visa Products</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Product summary */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground">{product.visaName}</h3>
            <p className="text-xs text-muted-foreground">AED {product.sellingPrice.toFixed(0)} per applicant</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack}>← Change Visa</Button>
        </div>

        {/* Express toggle */}
        <div className="flex items-center justify-between mt-4 bg-muted/40 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-xs font-medium text-foreground">Express Processing (24-48 hrs)</p>
              <p className="text-[10px] text-muted-foreground">+AED {product.expressSurcharge.toFixed(0)} per applicant</p>
            </div>
          </div>
          <Switch checked={express} onCheckedChange={setExpress} />
        </div>
      </div>

      {/* Applicants */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4" /> Applicants ({applicants.length})
          </h4>
          <Button variant="outline" size="sm" onClick={addApplicant} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Applicant
          </Button>
        </div>

        {applicants.map((a, idx) => (
          <div key={idx} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Applicant {idx + 1}</p>
              {applicants.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeApplicant(idx)} className="text-destructive h-7 text-xs gap-1">
                  <Trash2 className="w-3 h-3" /> Remove
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">First Name *</Label>
                <Input placeholder="As in passport" value={a.firstName} onChange={e => updateApplicant(idx, 'firstName', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Last Name *</Label>
                <Input placeholder="As in passport" value={a.lastName} onChange={e => updateApplicant(idx, 'lastName', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Nationality (ISO 3-letter) *</Label>
                <Input placeholder="e.g. IND, GBR, USA" value={a.nationality} onChange={e => updateApplicant(idx, 'nationality', e.target.value.toUpperCase())} maxLength={3} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Gender *</Label>
                <Select value={a.gender} onValueChange={v => updateApplicant(idx, 'gender', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Passport Number *</Label>
                <Input placeholder="e.g. Z1234567" value={a.passportNumber} onChange={e => updateApplicant(idx, 'passportNumber', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Passport Expiry *</Label>
                <Input type="date" value={a.passportExpiry} onChange={e => updateApplicant(idx, 'passportExpiry', e.target.value)} className="mt-1" />
                {a.passportExpiry && (() => {
                  const exp = new Date(a.passportExpiry);
                  const threshold = new Date();
                  threshold.setMonth(threshold.getMonth() + 6);
                  return exp < threshold ? (
                    <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3" /> Expires within 6 months — rejected</p>
                  ) : null;
                })()}
              </div>
              <div>
                <Label className="text-xs">Date of Birth *</Label>
                <Input type="date" value={a.dateOfBirth} onChange={e => updateApplicant(idx, 'dateOfBirth', e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div>
        <Label className="text-xs">Special Notes (optional)</Label>
        <Textarea placeholder="Any special requirements..." value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" rows={2} />
      </div>

      {/* Price breakdown */}
      <div className="bg-primary/5 rounded-xl p-5 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Base fee × {applicants.length} applicant{applicants.length > 1 ? 's' : ''}</span>
          <span>AED {(product.sellingPrice * applicants.length).toFixed(2)}</span>
        </div>
        {express && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Express surcharge × {applicants.length}</span>
            <span>AED {(product.expressSurcharge * applicants.length).toFixed(2)}</span>
          </div>
        )}
        {depositTotal > 0 && (
          <div className="flex justify-between text-xs text-amber-600">
            <span>Security deposit (refundable)</span>
            <span>AED {depositTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-2 mt-2">
          <span>Total</span>
          <span>AED {total.toFixed(2)}</span>
        </div>
      </div>

      <Button className="w-full" size="lg" disabled={submitting} onClick={handleSubmit}>
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</> : `Submit Application · AED ${total.toFixed(0)}`}
      </Button>
    </div>
  );
}
