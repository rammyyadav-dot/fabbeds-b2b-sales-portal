import { Lock } from 'lucide-react';

export default function MarkupBanner() {
  const today = new Date().toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 shrink-0">
        <Lock className="w-3.5 h-3.5 text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Wholesale DMC Rates — Confidential</p>
        <p className="text-xs text-amber-700/80 mt-0.5 hidden sm:block">
          Not for public distribution · Rates subject to confirmation · Last updated: {today}
        </p>
      </div>
    </div>
  );
}
