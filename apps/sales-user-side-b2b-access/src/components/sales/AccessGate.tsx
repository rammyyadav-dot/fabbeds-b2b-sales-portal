import BrandWordmark from '../BrandWordmark';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@project/components/ui/card';
import { Lock, ShieldCheck, AlertCircle } from 'lucide-react';
const ACCESS_CODE = 'SALES2025';
const SESSION_KEY = 'sales_portal_access';
interface AccessGateProps {
  onGranted: () => void;
}
export default function AccessGate({
  onGranted
}: AccessGateProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (code.trim().toUpperCase() === ACCESS_CODE) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        onGranted();
      } else {
        setError(true);
        setLoading(false);
      }
    }, 600);
  };
  return <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1><BrandWordmark size="lg" /></h1>
          <p className='text-muted-foreground mt-1'>Home of UAE’s Most Exclusive Deals</p>
        </div>
        <Card className="shadow-lg border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="w-4 h-4 text-primary" /> Enter Exclusive Zone
            </CardTitle>
            <CardDescription className=''>Imagine a platform searching contracts, Attractions & Transfers inbuilt availability calendar in just 5 Sec.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input type="password" placeholder="Enter your access code" value={code} onChange={e => {
              setCode(e.target.value);
              setError(false);
            }} className={error ? 'border-destructive' : ''} autoFocus />
              {error && <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" /> Invalid access code. Please try again.
                </div>}
              <Button type="submit" className="w-full" disabled={loading || !code}>
                {loading ? 'Verifying...' : 'Access Portal'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className='text-center text-muted-foreground mt-4 text-base font-bold'>Your Private Gateway to Wholesale Rates</p>
      </div>
    </div>;
}
export { SESSION_KEY };