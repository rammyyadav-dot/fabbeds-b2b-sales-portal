import { useState, useEffect } from 'react';
import { getVisaProducts, GetVisaProductsOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertCircle, FileCheck, ShieldCheck, Globe, ShoppingBag } from 'lucide-react';
import SalesHeader from '@/components/sales/SalesHeader';
import VisaCategoryChips from '@/components/visa/VisaCategoryChips';
import VisaProductCard from '@/components/visa/VisaProductCard';
import VisaApplicationForm from '@/components/visa/VisaApplicationForm';

type Product = GetVisaProductsOutputType['products'][0];

interface Props { onLogout: () => void; }

export default function VisaPage({ onLogout }: Props) {
  const [category, setCategory] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadProducts = () => {
    setLoading(true);
    setError(null);
    getVisaProducts({ category: category || undefined })
      .then(res => setProducts(res.products))
      .catch(() => setError('Visa products are temporarily unavailable. Please try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProducts(); }, [category]);

  if (selectedProduct) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SalesHeader onLogout={onLogout} hotelCount={0} />
        <main className="container mx-auto px-4 py-7 max-w-5xl">
          <VisaApplicationForm
            product={selectedProduct}
            onSuccess={() => {}}
            onBack={() => setSelectedProduct(null)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SalesHeader onLogout={onLogout} hotelCount={0} />

      <section className="bg-primary px-4 py-8">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <p className="text-primary-foreground/60 text-[10px] uppercase tracking-[0.18em] mb-2">UAE Visa Services</p>
              <h1 className="text-primary-foreground text-3xl font-black tracking-tight">Visa Products & Applications</h1>
              <p className="text-primary-foreground/70 text-sm mt-2 max-w-2xl">Choose an available visa product, review the commercial terms, and submit traveller details for processing.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-primary-foreground">
              <ShoppingBag className="w-5 h-5" />
              <div><p className="text-xs font-bold">Application Portal</p><p className="text-[10px] text-primary-foreground/60">Operational monitoring is handled internally.</p></div>
            </div>
          </div>

          <div className="mt-6 bg-card rounded-2xl p-3 shadow-xl">
            <VisaCategoryChips value={category} onChange={setCategory} />
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-7 max-w-5xl">
        {error && (
          <div className="flex items-center justify-between text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>
            <button onClick={loadProducts} className="text-xs font-semibold underline hover:no-underline">Retry</button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black">Available Visa Products</h2>
            <p className="text-xs text-muted-foreground">Select a product to start a new visa application.</p>
          </div>
          {!loading && <span className="text-xs font-semibold text-muted-foreground">{products.length} product{products.length === 1 ? '' : 's'}</span>}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-xl">
            <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No visa products are currently available.</p>
            <p className="text-sm mt-1">Please contact your account manager for assistance.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(p => <VisaProductCard key={p.id} product={p} onApply={setSelectedProduct} />)}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
            <ShieldCheck className="w-8 h-8 text-primary shrink-0" />
            <div><p className="text-xs font-semibold">Document-led processing</p><p className="text-[10px] text-muted-foreground">Applications proceed only after required traveller information and documents are supplied.</p></div>
          </div>
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
            <Globe className="w-8 h-8 text-primary shrink-0" />
            <div><p className="text-xs font-semibold">Application status support</p><p className="text-[10px] text-muted-foreground">Your servicing team can assist with application progress and follow-up.</p></div>
          </div>
        </div>
      </main>
    </div>
  );
}
