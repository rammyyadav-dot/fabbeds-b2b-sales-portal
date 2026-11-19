import { useEffect, useMemo, useState } from 'react';
import { getSourceMarkets, GetSourceMarketsOutputType } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Input } from '@project/components/ui/input';
import { Search, Globe2 } from 'lucide-react';

type Market = GetSourceMarketsOutputType['markets'][0];

export default function SourceMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getSourceMarkets({}).then(r => setMarkets(r.markets)).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter(m =>
      [m.name, m.code, m.description, ...m.countries.flatMap(c => [c.name, c.iso2, c.iso3])]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    );
  }, [markets, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Commercial</p>
          <h1 className="text-2xl font-black tracking-tight">Source Markets</h1>
          <p className="text-sm text-muted-foreground mt-1">Reusable market profiles for hotel Rate Plan nationality, residency and agency-source eligibility.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search market, country or ISO code" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading source markets...</p>
        ) : filtered.map(m => (
          <Card key={m.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe2 className="w-4 h-4 text-primary" />
                    {m.name}
                  </CardTitle>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{m.code}</p>
                </div>
                <Badge variant="secondary">{m.countries.length} countries</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {m.countries.slice(0, 12).map(c => (
                  <Badge key={c.id} variant="outline" className="text-xs">{c.iso2} · {c.name}</Badge>
                ))}
                {m.countries.length > 12 && <Badge variant="outline" className="text-xs">+{m.countries.length - 12} more</Badge>}
                {m.countries.length === 0 && m.code !== 'WORLDWIDE' && (
                  <span className="text-xs text-amber-700">No countries assigned</span>
                )}
                {m.code === 'WORLDWIDE' && m.countries.length === 0 && (
                  <span className="text-xs text-muted-foreground">Global fallback profile</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">Priority {m.priority}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
