import { useEffect, useMemo, useState } from 'react';
import { getRateCertification, getHotels, GetRateCertificationOutputType, GetHotelsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { AlertTriangle, BadgeCheck, CircleX, ClipboardCheck, ExternalLink, RefreshCw, ShieldCheck, Search, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type Audit = GetRateCertificationOutputType;
type Plan = Audit['ratePlans'][0];
type Hotel = GetHotelsOutputType['hotels'][0];

const badgeClass: Record<string,string> = {
  PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WARN: 'bg-amber-50 text-amber-700 border-amber-200',
  FAIL: 'bg-red-50 text-red-700 border-red-200',
};

function Stat({label,value,tone='default'}:{label:string;value:number|string;tone?:'default'|'good'|'warn'|'bad'}) {
  const toneClass = tone==='good'?'text-emerald-700':tone==='warn'?'text-amber-700':tone==='bad'?'text-red-700':'text-foreground';
  return <div className="rounded-xl border bg-card p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className={'text-2xl font-black mt-1 '+toneClass}>{value}</p></div>;
}

function IssueList({title,items,tone}:{title:string;items:Audit['p0'];tone:'bad'|'warn'|'default'}) {
  const icon = tone==='bad'?<CircleX className="w-4 h-4 text-red-600"/>:tone==='warn'?<AlertTriangle className="w-4 h-4 text-amber-600"/>:<Wrench className="w-4 h-4 text-muted-foreground"/>;
  return <section className="rounded-xl border bg-card overflow-hidden">
    <div className="px-4 py-3 border-b flex items-center gap-2">{icon}<h3 className="font-bold text-sm">{title}</h3><Badge variant="outline" className="ml-auto">{items.length}</Badge></div>
    <div className="divide-y">{items.length?items.map(i=><div key={i.code} className="px-4 py-3 flex items-start gap-3"><Badge variant="outline" className="font-mono text-[10px] shrink-0">{i.count}</Badge><div><p className="text-xs font-bold">{i.code}</p><p className="text-xs text-muted-foreground mt-0.5">{i.description}</p></div></div>):<p className="p-4 text-xs text-muted-foreground">No issues in this severity.</p>}</div>
  </section>;
}

export default function RateCertificationPage() {
  const navigate = useNavigate();
  const [data,setData] = useState<Audit|null>(null);
  const [hotels,setHotels] = useState<Hotel[]>([]);
  const [loading,setLoading] = useState(true);
  const [horizon,setHorizon] = useState('90');
  const [hotelId,setHotelId] = useState('ALL');
  const [status,setStatus] = useState('ALL');
  const [query,setQuery] = useState('');
  const [selected,setSelected] = useState<Plan|null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [audit,hotelRes] = await Promise.all([
        getRateCertification({horizonDays:Number(horizon),...(hotelId!=='ALL'?{hotelId}:{})}),
        getHotels({})
      ]);
      setData(audit); setHotels(hotelRes.hotels);
    } catch(e:any) { toast.error(e?.message||'Rate certification failed'); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ load(); },[horizon,hotelId]);

  const rows = useMemo(()=>{
    if(!data)return [];
    const q=query.trim().toLowerCase();
    return data.ratePlans.filter(r =>
      (status==='ALL'||r.certificationStatus===status) &&
      (!q||[r.hotelName,r.roomTypeName,r.name,r.code,r.sourceMarket,r.mealPlan].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)))
    );
  },[data,status,query]);

  const verdictClass=data?.verdict==='PASS'?'bg-emerald-50 text-emerald-800 border-emerald-200':data?.verdict==='PASS WITH WARNINGS'?'bg-amber-50 text-amber-800 border-amber-200':'bg-red-50 text-red-800 border-red-200';

  return <div className="p-4 md:p-6 max-w-[1500px] mx-auto space-y-5">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-primary-foreground"/></div>
        <div><h1 className="text-2xl font-black">Hotel Rate Plan Certification</h1><p className="text-sm text-muted-foreground mt-1">Read-only commercial audit: Hotel → Room → Rate Plan → Daily Rate → Market → Markup → Distribution readiness.</p></div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Select value={hotelId} onValueChange={setHotelId}><SelectTrigger className="w-56"><SelectValue placeholder="All hotels"/></SelectTrigger><SelectContent><SelectItem value="ALL">All hotels</SelectItem>{hotels.map(h=><SelectItem key={h.id} value={h.id}>{h.hotelName||h.id}</SelectItem>)}</SelectContent></Select>
        <Select value={horizon} onValueChange={setHorizon}><SelectTrigger className="w-36"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem><SelectItem value="180">180 days</SelectItem><SelectItem value="365">365 days</SelectItem></SelectContent></Select>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2"><RefreshCw className={'w-4 h-4 '+(loading?'animate-spin':'')}/>Run Certification</Button>
      </div>
    </div>

    {data&&<div className={'rounded-xl border px-4 py-3 flex items-center gap-3 '+verdictClass}>
      {data.verdict==='PASS'?<BadgeCheck className="w-5 h-5"/>:<AlertTriangle className="w-5 h-5"/>}
      <div><p className="font-black">Commercial Verdict: {data.verdict}</p><p className="text-xs opacity-80">Checked {new Date(data.checkedAt).toLocaleString()} · {data.horizonDays}-day distribution horizon. No production data was mutated.</p></div>
    </div>}

    {data&&<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-3">
      <Stat label="Hotels" value={data.summary.hotels}/>
      <Stat label="Rate Plans" value={data.summary.ratePlans}/>
      <Stat label="Certified" value={data.summary.pass} tone="good"/>
      <Stat label="Warnings" value={data.summary.warn} tone="warn"/>
      <Stat label="Failed" value={data.summary.fail} tone="bad"/>
      <Stat label="Quarantined" value={data.summary.quarantinedDailyRates} tone="bad"/>
      <Stat label="Orphaned Rates" value={data.summary.orphanedDailyRates} tone="bad"/>
      <Stat label="Duplicate Keys" value={data.summary.duplicateCommercialKeys} tone="warn"/>
      <Stat label="Bad Markup Rules" value={data.summary.malformedActiveMarkupRules} tone="bad"/>
    </div>}

    {data&&<div className="grid lg:grid-cols-3 gap-3">
      <IssueList title="P0 · Distribution Blockers" items={data.p0} tone="bad"/>
      <IssueList title="P1 · Contracting Data" items={data.p1} tone="warn"/>
      <IssueList title="P2 · Quality / Governance" items={data.p2} tone="default"/>
    </div>}

    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="p-4 border-b flex flex-col md:flex-row gap-3 md:items-center">
        <div><h2 className="font-black">Rate Plan Audit Matrix</h2><p className="text-xs text-muted-foreground">Certification is computed; it does not change Rate Plan status.</p></div>
        <div className="md:ml-auto flex gap-2">
          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Hotel, room, plan, code, market…" className="pl-9 w-72"/></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-32"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="PASS">PASS</SelectItem><SelectItem value="WARN">WARN</SelectItem><SelectItem value="FAIL">FAIL</SelectItem></SelectContent></Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>
            <th className="px-3 py-2 text-left">Hotel / Room</th><th className="px-3 py-2 text-left">Rate Plan</th><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2 text-left">Meal</th><th className="px-3 py-2 text-left">Market</th><th className="px-3 py-2 text-left">Currency</th><th className="px-3 py-2 text-right">Usable Rates</th><th className="px-3 py-2 text-right">Sellable Days</th><th className="px-3 py-2 text-left">Integrity</th><th className="px-3 py-2 text-left">Certification</th><th className="px-3 py-2 text-right">Actions</th>
          </tr></thead>
          <tbody>{loading?<tr><td colSpan={11} className="p-10 text-center text-muted-foreground">Running certification…</td></tr>:rows.map(r=><tr key={r.ratePlanId} className="border-t hover:bg-muted/20">
            <td className="px-3 py-3"><p className="font-semibold">{r.hotelName||'Unlinked hotel'}</p><p className="text-[11px] text-muted-foreground">{r.roomTypeName||'Unlinked room'}</p></td>
            <td className="px-3 py-3"><p className="font-semibold">{r.name}</p><p className="text-[10px] text-muted-foreground">{r.status}</p></td>
            <td className="px-3 py-3 font-mono text-xs">{r.code||<span className="text-red-600">MISSING</span>}</td>
            <td className="px-3 py-3 text-xs">{r.mealPlan||'—'}</td><td className="px-3 py-3 text-xs">{r.sourceMarket||<span className="text-red-600">BLANK</span>}</td><td className="px-3 py-3">{r.currency||'—'}</td>
            <td className="px-3 py-3 text-right tabular-nums">{r.usableDailyRates}</td><td className="px-3 py-3 text-right tabular-nums">{r.sellableDateCount}/{data?.horizonDays||0}</td>
            <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{r.quarantinedRows>0&&<Badge variant="outline" className="text-[9px] text-red-700">{r.quarantinedRows} quarantine</Badge>}{r.duplicateKeys>0&&<Badge variant="outline" className="text-[9px] text-amber-700">{r.duplicateKeys} duplicate</Badge>}{r.nullLayerRows>0&&<Badge variant="outline" className="text-[9px]">{r.nullLayerRows} no layer</Badge>}</div></td>
            <td className="px-3 py-3"><Badge variant="outline" className={badgeClass[r.certificationStatus]}>{r.certificationStatus}</Badge><p className="text-[9px] text-muted-foreground mt-1">{r.errors.length+r.warnings.length} issue(s)</p></td>
            <td className="px-3 py-3 text-right whitespace-nowrap"><Button size="sm" variant="ghost" onClick={()=>setSelected(r)}>View Audit</Button>{r.hotelId&&<Button size="sm" variant="ghost" onClick={()=>navigate('/hotels/'+r.hotelId)}>Open <ExternalLink className="w-3 h-3 ml-1"/></Button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <Sheet open={!!selected} onOpenChange={o=>!o&&setSelected(null)}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {selected&&<><SheetHeader><SheetTitle>{selected.name}</SheetTitle></SheetHeader>
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[10px] uppercase text-muted-foreground">Hotel</p><p className="font-semibold">{selected.hotelName||'Missing link'}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Room</p><p className="font-semibold">{selected.roomTypeName||'Missing link'}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Code</p><p className="font-mono">{selected.code||'MISSING'}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Certification</p><Badge variant="outline" className={badgeClass[selected.certificationStatus]}>{selected.certificationStatus}</Badge></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Meal Plan</p><p>{selected.mealPlan||'Missing'}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Market</p><p>{selected.sourceMarket||'Missing'}</p></div>
            </div>
            <div><h3 className="font-bold text-sm mb-2">Daily Rate Health</h3><div className="grid grid-cols-3 gap-2"><Stat label="Rows" value={selected.dailyRateCount}/><Stat label="Usable" value={selected.usableDailyRates} tone="good"/><Stat label="Quarantine" value={selected.quarantinedRows} tone={selected.quarantinedRows?'bad':'good'}/><Stat label="Stop Sale" value={selected.stopSaleRows}/><Stat label="Duplicates" value={selected.duplicateKeys} tone={selected.duplicateKeys?'warn':'good'}/><Stat label="Null Layer" value={selected.nullLayerRows} tone={selected.nullLayerRows?'warn':'good'}/></div></div>
            <div><h3 className="font-bold text-sm mb-2 text-red-700">Certification Blockers</h3>{selected.errors.length?<div className="space-y-1">{selected.errors.map(x=><div key={x} className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs font-mono text-red-800">{x}</div>)}</div>:<p className="text-xs text-muted-foreground">No blockers.</p>}</div>
            <div><h3 className="font-bold text-sm mb-2 text-amber-700">Warnings</h3>{selected.warnings.length?<div className="space-y-1">{selected.warnings.map(x=><div key={x} className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-mono text-amber-800">{x}</div>)}</div>:<p className="text-xs text-muted-foreground">No warnings.</p>}</div>
            <div className="border-t pt-4 flex flex-wrap gap-2">{selected.hotelId&&<Button onClick={()=>navigate('/hotels/'+selected.hotelId)}>Open Rate Plan</Button>}<Button variant="outline" onClick={()=>navigate('/quick-update')}>Open Quick Update</Button><Button variant="outline" onClick={()=>navigate('/pricing-engine')}>Preview Price</Button></div>
          </div>
        </>}
      </SheetContent>
    </Sheet>
  </div>;
}
