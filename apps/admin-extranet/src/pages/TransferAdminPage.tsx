import { useEffect, useMemo, useState } from 'react';
import {
  getTransferAdminWorkspace, GetTransferAdminWorkspaceOutputType, getTransferRatesAdmin, GetTransferRatesAdminOutputType,
  saveTransferZoneAdmin, saveTransferVehicleAdmin, saveTransferRateAdmin, saveTransferMarkupRuleAdmin, updateTransferBookingAdmin,
  bulkUpdateTransferRatesAdmin, saveTransferExtraAdmin,
} from 'zitejs/api';
import { getSessionUserId } from '@/hooks/useAppAuth';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Switch } from '@project/components/ui/switch';
import { CarFront, RefreshCw, Plus, Search, Eye, Pencil, ChevronLeft, ChevronRight, Plane, Ship, MapPin } from 'lucide-react';
import { toast } from 'sonner';

type Data = GetTransferAdminWorkspaceOutputType;
type Booking = Data['bookings'][number];
type Zone = Data['zones'][number];
type Vehicle = Data['vehicles'][number];
type Rule = Data['rules'][number];
type Extra = Data['extras'][number];
type Fare = GetTransferRatesAdminOutputType['items'][number];

const uid = () => getSessionUserId() || undefined;
const money = (n: number) => new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(n || 0);
const d = (v: string) => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
const statusTone = (s: string) => s === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : ['No Show', 'Cancelled'].includes(s) ? 'bg-red-100 text-red-800 border-red-200' : ['Dispatched', 'En Route'].includes(s) ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-amber-100 text-amber-800 border-amber-200';
const sel = 'h-8 rounded-md border border-input bg-background px-2 text-xs';
const th = 'px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground';
const td = 'px-3 py-2';
const ZoneIcon = ({ type }: { type: string }) => type === 'Airport' ? <Plane className="w-3.5 h-3.5 text-primary" /> : type === 'Port' ? <Ship className="w-3.5 h-3.5 text-primary" /> : <MapPin className="w-3.5 h-3.5 text-muted-foreground" />;
const Chip = ({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) =>
  <div className={'rounded-lg border px-3 py-1.5 bg-card ' + tone}><span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</span> <span className="font-black text-sm ml-1">{value}</span></div>;

export default function TransferAdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [zone, setZone] = useState<Zone | null | undefined>(undefined);
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [fare, setFare] = useState<Fare | null | undefined>(undefined);
  const [rule, setRule] = useState<{ rule: Rule | null; route?: Fare } | undefined>(undefined);
  const [extra, setExtra] = useState<Extra | null | undefined>(undefined);
  const [fareReload, setFareReload] = useState(0);

  const load = async () => { setLoading(true); try { setData(await getTransferAdminWorkspace({ actingUserId: getSessionUserId() || '' })); } catch (e: any) { toast.error(e?.message || 'Unable to load transfers'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const saved = async (close: () => void) => { close(); await load(); setFareReload(x => x + 1); };

  if (loading && !data) return <div className="p-6"><div className="h-40 rounded-xl bg-muted animate-pulse" /></div>;
  if (!data) return <div className="p-6">Transfer workspace unavailable.</div>;
  const s = data.stats, t = data.rateTotals;

  return <div className="p-3 md:p-5 max-w-[1600px] mx-auto space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 mr-2"><CarFront className="w-5 h-5 text-primary" /><h1 className="text-lg font-black">Transfers</h1></div>
      <Chip label="Today" value={s.today} /><Chip label="Next 24h" value={s.next24h} tone={s.next24h ? 'border-amber-300' : ''} />
      <Chip label="Unassigned" value={s.unassigned} tone={s.unassigned ? 'border-red-300' : ''} />
      <Chip label="Live fares" value={`${t.live} / ${t.all}`} /><Chip label="Contracted" value={t.contracted} /><Chip label="Zones" value={s.activeZones} />
      <Button size="sm" variant="ghost" className="ml-auto" onClick={load} disabled={loading}><RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} /></Button>
    </div>

    <Tabs defaultValue="operations" className="space-y-3">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="operations">Operations</TabsTrigger><TabsTrigger value="fares">Fares</TabsTrigger>
        <TabsTrigger value="network">Network</TabsTrigger><TabsTrigger value="vehicles">Vehicles</TabsTrigger>
        <TabsTrigger value="extras">Extras</TabsTrigger><TabsTrigger value="markups">Markup</TabsTrigger>
      </TabsList>
      <TabsContent value="operations"><Operations data={data} onOpen={setBooking} /></TabsContent>
      <TabsContent value="fares"><Fares data={data} reload={fareReload} onEdit={setFare} onRule={f => setRule({ rule: null, route: f })} onChanged={load} /></TabsContent>
      <TabsContent value="network"><Network data={data} onEdit={setZone} /></TabsContent>
      <TabsContent value="vehicles"><VehiclesTab data={data} onEdit={setVehicle} /></TabsContent>
      <TabsContent value="extras"><ExtrasTab data={data} onEdit={setExtra} /></TabsContent>
      <TabsContent value="markups"><Markups data={data} onEdit={r => setRule({ rule: r })} /></TabsContent>
    </Tabs>

    <BookingDialog booking={booking} onClose={() => setBooking(null)} onSaved={() => saved(() => setBooking(null))} />
    <ZoneDialog open={zone !== undefined} zone={zone ?? null} onClose={() => setZone(undefined)} onSaved={() => saved(() => setZone(undefined))} />
    <VehicleDialog open={vehicle !== undefined} vehicle={vehicle ?? null} onClose={() => setVehicle(undefined)} onSaved={() => saved(() => setVehicle(undefined))} />
    <FareDialog open={fare !== undefined} fare={fare ?? null} data={data} onClose={() => setFare(undefined)} onSaved={() => saved(() => setFare(undefined))} />
    <RuleDialog open={rule !== undefined} rule={rule?.rule ?? null} route={rule?.route} onClose={() => setRule(undefined)} onSaved={() => saved(() => setRule(undefined))} />
    <ExtraDialog open={extra !== undefined} extra={extra ?? null} onClose={() => setExtra(undefined)} onSaved={() => saved(() => setExtra(undefined))} />
  </div>;
}

function Operations({ data, onOpen }: { data: Data; onOpen: (b: Booking) => void }) {
  const [q, setQ] = useState(''); const [status, setStatus] = useState('ACTIVE');
  const rows = useMemo(() => { const k = q.trim().toLowerCase(); return data.bookings.filter(b => (status === 'ALL' || (status === 'ACTIVE' ? !['Completed', 'Cancelled', 'No Show'].includes(b.status) : b.status === status)) && (!k || [b.reference, b.leadPassenger, b.originName, b.destinationName, b.driverName, b.flightNumber].join(' ').toLowerCase().includes(k))); }, [data, q, status]);
  return <div className="rounded-xl border bg-card overflow-hidden">
    <div className="flex flex-wrap gap-2 p-2 border-b"><div className="relative flex-1 min-w-[200px]"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" /><Input className="h-8 pl-8 text-xs" value={q} onChange={e => setQ(e.target.value)} placeholder="Reference, passenger, route, flight, driver…" /></div>
      <select className={sel} value={status} onChange={e => setStatus(e.target.value)}><option value="ACTIVE">Open jobs</option><option value="ALL">All</option>{['Confirmed', 'Dispatched', 'En Route', 'Completed', 'No Show', 'Cancelled'].map(x => <option key={x}>{x}</option>)}</select></div>
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted/40"><tr><th className={th}>Booking</th><th className={th}>Route</th><th className={th}>Pickup</th><th className={th}>Vehicle · pax</th><th className={th}>Driver</th><th className={th}>Status</th><th className={th + ' text-right'}>Sell</th><th className={th + ' text-right'}>Margin</th><th /></tr></thead>
      <tbody className="divide-y">{rows.map(b => <tr key={b.id} className={b.urgent ? 'bg-amber-50/60' : ''}>
        <td className={td}><p className="font-bold">{b.reference}</p><p className="text-[10px] text-muted-foreground">{b.leadPassenger} · {b.transferType}</p>{b.operationalIssues[0] && <p className="text-[10px] text-red-600">{b.operationalIssues[0]}</p>}</td>
        <td className={td}><p className="font-semibold">{b.originName} → {b.destinationName}</p>{b.extrasSummary && <p className="text-[10px] text-muted-foreground truncate max-w-[260px]">{b.extrasSummary}</p>}</td>
        <td className={td + ' whitespace-nowrap'}>{d(b.pickupDate)} · {b.pickupTime || '—'}<p className="text-[10px] text-muted-foreground">{b.flightNumber || '—'}</p></td>
        <td className={td}>{b.vehicleName}<p className="text-[10px] text-muted-foreground">{b.pax} pax · {b.luggage} bags</p></td>
        <td className={td}>{b.driverName || <span className="text-red-600 font-semibold">Unassigned</span>}<p className="text-[10px] text-muted-foreground">{b.vehiclePlate}</p></td>
        <td className={td}><Badge variant="outline" className={'text-[10px] ' + statusTone(b.status)}>{b.status}</Badge></td>
        <td className={td + ' text-right font-bold'}>{money(b.totalPrice)}</td>
        <td className={td + ' text-right'}>{b.netCost > 0 ? money(b.totalPrice - b.netCost) : '—'}</td>
        <td className={td + ' text-right'}><Button size="sm" variant="ghost" className="h-7" onClick={() => onOpen(b)}><Eye className="w-3.5 h-3.5" /></Button></td>
      </tr>)}{!rows.length && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No transfer jobs match.</td></tr>}</tbody></table></div>
  </div>;
}

function Fares({ data, reload, onEdit, onRule, onChanged }: { data: Data; reload: number; onEdit: (f: Fare | null) => void; onRule: (f: Fare) => void; onChanged: () => void }) {
  const [f, setF] = useState({ originId: '', destinationId: '', vehicleId: '', emirate: '', status: 'all', fareStatus: 'all', q: '' });
  const [page, setPage] = useState(0); const [res, setRes] = useState<GetTransferRatesAdminOutputType | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set()); const [pct, setPct] = useState('5'); const [busy, setBusy] = useState(false);
  const fetch = async () => { try { setRes(await getTransferRatesAdmin({ actingUserId: uid(), originId: f.originId || undefined, destinationId: f.destinationId || undefined, vehicleId: f.vehicleId || undefined, emirate: f.emirate || undefined, status: f.status as any, fareStatus: f.fareStatus as any, q: f.q || undefined, offset: page * 50, limit: 50 })); } catch (e: any) { toast.error(e?.message || 'Unable to load fares'); } };
  useEffect(() => { const h = setTimeout(fetch, 250); return () => clearTimeout(h); }, [f, page, reload]);
  useEffect(() => { setPage(0); setPicked(new Set()); }, [f]);
  const zones = data.zones.filter(z => z.active);
  const set = (k: string, v: string) => setF(x => ({ ...x, [k]: v }));
  const bulk = async (action: any) => {
    if (!picked.size) return; setBusy(true);
    try { const r = await bulkUpdateTransferRatesAdmin({ actingUserId: uid(), ids: [...picked], action, percent: action === 'adjustNetPercent' ? Number(pct) : undefined }); toast.success(`${r.updated} fare(s) updated` + (r.skipped.length ? ` · ${r.skipped.length} skipped: ${r.skipped[0].reason}` : '')); setPicked(new Set()); await fetch(); onChanged(); }
    catch (e: any) { toast.error(e?.message || 'Bulk update failed'); } finally { setBusy(false); }
  };
  const items = res?.items || []; const allPicked = items.length > 0 && items.every(i => picked.has(i.id));
  return <div className="rounded-xl border bg-card overflow-hidden">
    <div className="flex flex-wrap gap-2 p-2 border-b items-center">
      <select className={sel + ' max-w-[210px]'} value={f.originId} onChange={e => set('originId', e.target.value)}><option value="">From: any zone</option>{zones.map(z => <option key={z.id} value={z.id}>{z.code ? z.code + ' · ' : ''}{z.name}</option>)}</select>
      <select className={sel + ' max-w-[210px]'} value={f.destinationId} onChange={e => set('destinationId', e.target.value)}><option value="">To: any zone</option>{zones.map(z => <option key={z.id} value={z.id}>{z.code ? z.code + ' · ' : ''}{z.name}</option>)}</select>
      <select className={sel} value={f.vehicleId} onChange={e => set('vehicleId', e.target.value)}><option value="">Any vehicle</option>{data.vehicles.filter(v => v.active).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
      <select className={sel} value={f.emirate} onChange={e => set('emirate', e.target.value)}><option value="">Any emirate</option>{EMIRATES.map(x => <option key={x}>{x}</option>)}</select>
      <select className={sel} value={f.status} onChange={e => set('status', e.target.value)}><option value="all">Live + paused</option><option value="active">Live</option><option value="inactive">Paused</option><option value="issues">Live with issues</option></select>
      <select className={sel} value={f.fareStatus} onChange={e => set('fareStatus', e.target.value)}><option value="all">Any contract status</option><option>Indicative</option><option>Contracted</option></select>
      <Input className="h-8 text-xs w-40" value={f.q} onChange={e => set('q', e.target.value)} placeholder="Search route / code" />
      <Button size="sm" className="h-8 ml-auto" onClick={() => onEdit(null)}><Plus className="w-3.5 h-3.5 mr-1" />Fare</Button>
    </div>
    {picked.size > 0 && <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-primary/5 text-xs">
      <b>{picked.size} selected</b>
      <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => bulk('markContracted')}>Mark contracted</Button>
      <Button size="sm" className="h-7" disabled={busy} onClick={() => bulk('activate')}>Go live</Button>
      <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => bulk('deactivate')}>Pause</Button>
      <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => bulk('markIndicative')}>Back to indicative</Button>
      <span className="flex items-center gap-1 ml-2">Net <Input className="h-7 w-16 text-xs" type="number" value={pct} onChange={e => setPct(e.target.value)} />%<Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => bulk('adjustNetPercent')}>Apply</Button></span>
      <span className="text-muted-foreground">Only Contracted fares can go live.</span>
    </div>}
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted/40"><tr>
      <th className={th}><input type="checkbox" aria-label="Select page" checked={allPicked} onChange={e => setPicked(p => { const n = new Set(p); items.forEach(i => e.target.checked ? n.add(i.id) : n.delete(i.id)); return n; })} /></th>
      <th className={th}>Route</th><th className={th}>Vehicle</th><th className={th + ' text-right'}>km · min</th><th className={th + ' text-right'}>Net</th><th className={th + ' text-right'}>Night +</th><th className={th}>Contract</th><th className={th}>Status</th><th /></tr></thead>
      <tbody className="divide-y">{items.map(r => <tr key={r.id} className={picked.has(r.id) ? 'bg-primary/5' : ''}>
        <td className={td}><input type="checkbox" aria-label={`Select ${r.label}`} checked={picked.has(r.id)} onChange={e => setPicked(p => { const n = new Set(p); e.target.checked ? n.add(r.id) : n.delete(r.id); return n; })} /></td>
        <td className={td}><p className="font-semibold">{r.label}</p><p className="text-[10px] text-muted-foreground font-mono">{r.routeCode}</p>{r.issues[0] && <p className="text-[10px] text-red-600">{r.issues.join(' · ')}</p>}</td>
        <td className={td}>{r.vehicleName}</td>
        <td className={td + ' text-right whitespace-nowrap'}>{r.distanceKm || '—'} · {r.durationMinutes || '—'}</td>
        <td className={td + ' text-right font-bold'}>{money(r.netCost)}</td><td className={td + ' text-right'}>{money(r.midnightSurcharge)}</td>
        <td className={td}><Badge variant="outline" className={'text-[10px] ' + (r.fareStatus === 'Contracted' ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700')}>{r.fareStatus}</Badge></td>
        <td className={td}>{r.active ? <Badge className="text-[10px]">Live</Badge> : <span className="text-muted-foreground">Paused</span>}</td>
        <td className={td + ' text-right whitespace-nowrap'}><Button size="sm" variant="ghost" className="h-7" title="Edit fare" onClick={() => onEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button><Button size="sm" variant="ghost" className="h-7 text-[10px]" title="Route-specific markup" onClick={() => onRule(r)}>%</Button></td>
      </tr>)}{res && !items.length && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No fares match these filters.</td></tr>}</tbody></table></div>
    <div className="flex items-center justify-between p-2 border-t text-xs text-muted-foreground"><span>{res ? `${res.total.toLocaleString()} fares · page ${page + 1} of ${Math.max(1, Math.ceil(res.total / 50))}` : 'Loading…'}</span>
      <span className="flex gap-1"><Button size="sm" variant="outline" className="h-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button><Button size="sm" variant="outline" className="h-7" disabled={!res || (page + 1) * 50 >= res.total} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button></span></div>
  </div>;
}

function Network({ data, onEdit }: { data: Data; onEdit: (z: Zone | null) => void }) {
  const [em, setEm] = useState(''); const [type, setType] = useState(''); const [q, setQ] = useState(''); const [showRetired, setShowRetired] = useState(false);
  const rows = data.zones.filter(z => (showRetired || z.active) && (!em || z.emirate === em) && (!type || z.type === type) && (!q || [z.name, z.code, z.iataCode, z.districts].join(' ').toLowerCase().includes(q.toLowerCase())));
  return <div className="rounded-xl border bg-card overflow-hidden">
    <div className="flex flex-wrap gap-2 p-2 border-b items-center">
      <select className={sel} value={em} onChange={e => setEm(e.target.value)}><option value="">All emirates</option>{EMIRATES.map(x => <option key={x}>{x}</option>)}</select>
      <select className={sel} value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{['Airport', 'Port', 'Area Zone', 'Hotel', 'Intercity'].map(x => <option key={x}>{x}</option>)}</select>
      <Input className="h-8 text-xs w-56" value={q} onChange={e => setQ(e.target.value)} placeholder="Zone, code, IATA or district" />
      <label className="flex items-center gap-1.5 text-xs"><Switch checked={showRetired} onCheckedChange={setShowRetired} />Show retired</label>
      <span className="text-xs text-muted-foreground">{rows.length} zones</span>
      <Button size="sm" className="h-8 ml-auto" onClick={() => onEdit(null)}><Plus className="w-3.5 h-3.5 mr-1" />Zone</Button>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted/40"><tr><th className={th}>Code</th><th className={th}>Zone</th><th className={th}>Emirate</th><th className={th}>Districts / locations covered</th><th className={th}>Pick-up point</th><th className={th + ' text-right'}>Free wait</th><th className={th + ' text-right'}>Fares</th><th /></tr></thead>
      <tbody className="divide-y">{rows.map(z => <tr key={z.id} className={z.active ? '' : 'opacity-50'}>
        <td className={td + ' font-mono whitespace-nowrap'}>{z.code || '—'}</td>
        <td className={td}><span className="flex items-center gap-1.5 font-semibold"><ZoneIcon type={z.type} />{z.name}</span><span className="text-[10px] text-muted-foreground">{z.type}{z.iataCode ? ` · IATA ${z.iataCode}` : ''}</span></td>
        <td className={td}>{z.emirate}</td>
        <td className={td + ' max-w-[360px]'}><p className="line-clamp-2 text-muted-foreground">{z.districts || '—'}</p></td>
        <td className={td + ' max-w-[220px]'}><p className="line-clamp-2">{z.pickupPoint || '—'}</p></td>
        <td className={td + ' text-right'}>{z.waitingGrace} min</td><td className={td + ' text-right'}>{z.routes}</td>
        <td className={td + ' text-right'}><Button size="sm" variant="ghost" className="h-7" onClick={() => onEdit(z)}><Pencil className="w-3.5 h-3.5" /></Button></td>
      </tr>)}</tbody></table></div>
  </div>;
}

function VehiclesTab({ data, onEdit }: { data: Data; onEdit: (v: Vehicle | null) => void }) {
  return <div className="rounded-xl border bg-card overflow-hidden"><div className="flex p-2 border-b"><Button size="sm" className="h-8 ml-auto" onClick={() => onEdit(null)}><Plus className="w-3.5 h-3.5 mr-1" />Vehicle class</Button></div>
    <table className="w-full text-xs"><thead className="bg-muted/40"><tr><th className={th}>Class</th><th className={th}>Example models</th><th className={th}>Tier</th><th className={th + ' text-right'}>Pax</th><th className={th + ' text-right'}>Bags</th><th className={th}>Access</th><th className={th}>Status</th><th /></tr></thead>
      <tbody className="divide-y">{data.vehicles.map(v => <tr key={v.id} className={v.active ? '' : 'opacity-50'}><td className={td + ' font-semibold'}>{v.name}</td><td className={td + ' text-muted-foreground'}>{v.models}</td><td className={td}>{v.tier}</td><td className={td + ' text-right'}>{v.maxPax}</td><td className={td + ' text-right'}>{v.maxLuggage}</td><td className={td}>{v.wheelchair ? 'Wheelchair' : '—'}</td><td className={td}>{v.active ? 'Active' : 'Retired'}</td><td className={td + ' text-right'}><Button size="sm" variant="ghost" className="h-7" onClick={() => onEdit(v)}><Pencil className="w-3.5 h-3.5" /></Button></td></tr>)}</tbody></table></div>;
}

function ExtrasTab({ data, onEdit }: { data: Data; onEdit: (x: Extra | null) => void }) {
  return <div className="rounded-xl border bg-card overflow-hidden"><div className="flex items-center p-2 border-b"><p className="text-xs text-muted-foreground">Priced at checkout from this table (net + sell). Airport-only extras are refused on other routes.</p><Button size="sm" className="h-8 ml-auto" onClick={() => onEdit(null)}><Plus className="w-3.5 h-3.5 mr-1" />Extra</Button></div>
    <table className="w-full text-xs"><thead className="bg-muted/40"><tr><th className={th}>Code</th><th className={th}>Extra</th><th className={th}>Unit</th><th className={th + ' text-right'}>Net</th><th className={th + ' text-right'}>Sell</th><th className={th + ' text-right'}>Margin</th><th className={th + ' text-right'}>Max</th><th className={th}>Scope</th><th className={th}>Status</th><th /></tr></thead>
      <tbody className="divide-y">{data.extras.map(x => <tr key={x.id} className={x.active ? '' : 'opacity-50'}><td className={td + ' font-mono'}>{x.code}</td><td className={td}><p className="font-semibold">{x.name}</p><p className="text-[10px] text-muted-foreground">{x.description}</p></td><td className={td}>{x.unit}</td><td className={td + ' text-right'}>{money(x.netCost)}</td><td className={td + ' text-right font-bold'}>{money(x.sellPrice)}</td><td className={td + ' text-right'}>{money(x.sellPrice - x.netCost)}</td><td className={td + ' text-right'}>{x.maxQuantity}</td><td className={td}>{x.airportOnly ? 'Airport only' : 'All routes'}</td><td className={td}>{x.active ? 'Active' : 'Off'}</td><td className={td + ' text-right'}><Button size="sm" variant="ghost" className="h-7" onClick={() => onEdit(x)}><Pencil className="w-3.5 h-3.5" /></Button></td></tr>)}</tbody></table></div>;
}

function Markups({ data, onEdit }: { data: Data; onEdit: (r: Rule | null) => void }) {
  return <div className="rounded-xl border bg-card overflow-hidden"><div className="flex items-center p-2 border-b"><p className="text-xs text-muted-foreground">Order: route-specific › airport / intercity / city (from zone types & emirates) › global. Flat markups are charged once per trip; % markups also scale the night surcharge.</p><Button size="sm" className="h-8 ml-auto" onClick={() => onEdit(null)}><Plus className="w-3.5 h-3.5 mr-1" />Rule</Button></div>
    <table className="w-full text-xs"><thead className="bg-muted/40"><tr><th className={th}>Rule</th><th className={th}>Applies to</th><th className={th + ' text-right'}>Markup</th><th className={th + ' text-right'}>Cap</th><th className={th + ' text-right'}>Priority</th><th className={th}>Status</th><th /></tr></thead>
      <tbody className="divide-y">{data.rules.map(r => <tr key={r.id} className={r.active ? '' : 'opacity-50'}><td className={td}><p className="font-semibold">{r.name}</p><p className="text-[10px] text-muted-foreground line-clamp-1">{r.notes}</p></td><td className={td}>{r.appliesTo}</td><td className={td + ' text-right font-bold'}>{r.markupType.startsWith('Flat') ? money(r.markupValue) : r.markupValue + '%'}</td><td className={td + ' text-right'}>{r.maxCap ? money(r.maxCap) : '—'}</td><td className={td + ' text-right'}>{r.priority}</td><td className={td}>{r.active ? 'Active' : 'Off'}</td><td className={td + ' text-right'}><Button size="sm" variant="ghost" className="h-7" onClick={() => onEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button></td></tr>)}</tbody></table></div>;
}

function ZoneDialog({ open, zone, onClose, onSaved }: { open: boolean; zone: Zone | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const blank = { name: '', type: 'Area Zone', emirate: 'Dubai', description: '', waitingGrace: 15, active: true, code: '', iataCode: '', districts: '', pickupPoint: '', latitude: '', longitude: '' };
  const [f, setF] = useState<any>(blank);
  useEffect(() => { if (open) setF(zone ? { ...zone, latitude: zone.latitude ?? '', longitude: zone.longitude ?? '' } : blank); }, [open, zone?.id]);
  const s = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => { try { await saveTransferZoneAdmin({ actingUserId: getSessionUserId() || '', id: zone?.id, name: f.name, type: f.type, emirate: f.emirate, description: f.description, waitingGrace: Number(f.waitingGrace), active: !!f.active, code: f.code, iataCode: f.iataCode, districts: f.districts, pickupPoint: f.pickupPoint, latitude: f.latitude === '' ? null : Number(f.latitude), longitude: f.longitude === '' ? null : Number(f.longitude) }); toast.success('Zone saved'); await onSaved(); } catch (e: any) { toast.error(e?.message || 'Unable to save zone'); } };
  return <Dialog open={open} onOpenChange={o => !o && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{zone ? 'Edit' : 'New'} zone</DialogTitle></DialogHeader>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="col-span-2"><Field label="Zone name"><Input value={f.name} onChange={e => s('name', e.target.value)} /></Field></div>
      <Field label="Zone code"><Input value={f.code} onChange={e => s('code', e.target.value.toUpperCase())} placeholder="DXB-Z16" /></Field>
      <Field label="IATA (airports)"><Input maxLength={3} value={f.iataCode} onChange={e => s('iataCode', e.target.value.toUpperCase())} /></Field>
      <SelectBox label="Type" value={f.type} options={['Airport', 'Port', 'Area Zone', 'Hotel', 'Intercity']} onChange={v => s('type', v)} />
      <SelectBox label="Emirate" value={f.emirate} options={EMIRATES} onChange={v => s('emirate', v)} />
      <Field label="Free wait (min)"><Input type="number" value={f.waitingGrace} onChange={e => s('waitingGrace', e.target.value)} /></Field>
      <div className="flex items-end"><Toggle label="Active" checked={!!f.active} onChange={v => s('active', v)} /></div>
      <div className="col-span-2 md:col-span-4"><Field label="Districts / locations covered"><Textarea rows={2} value={f.districts} onChange={e => s('districts', e.target.value)} /></Field></div>
      <div className="col-span-2"><Field label="Pick-up point"><Input value={f.pickupPoint} onChange={e => s('pickupPoint', e.target.value)} /></Field></div>
      <Field label="Latitude"><Input type="number" step="0.0001" value={f.latitude} onChange={e => s('latitude', e.target.value)} /></Field>
      <Field label="Longitude"><Input type="number" step="0.0001" value={f.longitude} onChange={e => s('longitude', e.target.value)} /></Field>
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save zone</Button></DialogFooter></DialogContent></Dialog>;
}

function FareDialog({ open, fare, data, onClose, onSaved }: { open: boolean; fare: Fare | null; data: Data; onClose: () => void; onSaved: () => Promise<void> }) {
  const blank = { label: '', originId: '', destinationId: '', vehicleId: '', netCost: 0, sellingPrice: 0, midnightSurcharge: 0, tollsIncluded: true, active: false, fareStatus: 'Contracted', distanceKm: '', durationMinutes: '' };
  const [f, setF] = useState<any>(blank);
  useEffect(() => { if (open) setF(fare ? { ...fare } : blank); }, [open, fare?.id]);
  const s = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const zones = data.zones.filter(z => z.active || z.id === f.originId || z.id === f.destinationId);
  const save = async () => { try { await saveTransferRateAdmin({ actingUserId: getSessionUserId() || '', id: fare?.id, label: f.label, originId: f.originId, destinationId: f.destinationId, vehicleId: f.vehicleId, netCost: Number(f.netCost), sellingPrice: Number(f.sellingPrice), midnightSurcharge: Number(f.midnightSurcharge), tollsIncluded: !!f.tollsIncluded, active: !!f.active, fareStatus: f.fareStatus, distanceKm: f.distanceKm === '' ? undefined : Number(f.distanceKm), durationMinutes: f.durationMinutes === '' ? undefined : Number(f.durationMinutes), routeCode: f.routeCode }); toast.success('Fare saved'); await onSaved(); } catch (e: any) { toast.error(e?.message || 'Unable to save fare'); } };
  return <Dialog open={open} onOpenChange={o => !o && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{fare ? 'Edit' : 'New'} fare</DialogTitle></DialogHeader>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="col-span-2 md:col-span-4"><Field label="Route label"><Input value={f.label} onChange={e => s('label', e.target.value)} placeholder="DXB Airport → Dubai Marina, JBR & JLT" /></Field></div>
      <div className="col-span-2"><EntitySelect label="From" value={f.originId} items={zones.map(z => ({ value: z.id, label: `${z.code ? z.code + ' · ' : ''}${z.name}` }))} onChange={v => s('originId', v)} /></div>
      <div className="col-span-2"><EntitySelect label="To" value={f.destinationId} items={zones.map(z => ({ value: z.id, label: `${z.code ? z.code + ' · ' : ''}${z.name}` }))} onChange={v => s('destinationId', v)} /></div>
      <div className="col-span-2"><EntitySelect label="Vehicle" value={f.vehicleId} items={data.vehicles.filter(v => v.active || v.id === f.vehicleId).map(v => ({ value: v.id, label: `${v.name} (${v.maxPax} pax)` }))} onChange={v => s('vehicleId', v)} /></div>
      <Field label="Net cost (AED)"><Input type="number" value={f.netCost} onChange={e => s('netCost', e.target.value)} /></Field>
      <Field label="Night surcharge (23:00–06:00)"><Input type="number" value={f.midnightSurcharge} onChange={e => s('midnightSurcharge', e.target.value)} /></Field>
      <Field label="Stored sell (optional)"><Input type="number" value={f.sellingPrice} onChange={e => s('sellingPrice', e.target.value)} /></Field>
      <Field label="Distance (km)"><Input type="number" value={f.distanceKm} onChange={e => s('distanceKm', e.target.value)} /></Field>
      <Field label="Duration (min)"><Input type="number" value={f.durationMinutes} onChange={e => s('durationMinutes', e.target.value)} /></Field>
      <SelectBox label="Contract status" value={f.fareStatus} options={['Indicative', 'Contracted']} onChange={v => s('fareStatus', v)} />
      <div className="flex items-end"><Toggle label="Tolls included" checked={!!f.tollsIncluded} onChange={v => s('tollsIncluded', v)} /></div>
      <div className="col-span-2 flex items-end"><Toggle label={f.fareStatus === 'Contracted' ? 'Live for agents' : 'Live (requires Contracted)'} checked={!!f.active} onChange={v => s('active', v)} /></div>
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save fare</Button></DialogFooter></DialogContent></Dialog>;
}

function RuleDialog({ open, rule, route, onClose, onSaved }: { open: boolean; rule: Rule | null; route?: Fare; onClose: () => void; onSaved: () => Promise<void> }) {
  const blank = { name: '', markupType: 'Percentage (%)', markupValue: 10, appliesTo: 'Global (All Transfers)', specificRouteId: '', maxCap: 0, active: true, priority: 10, notes: '' };
  const [f, setF] = useState<any>(blank);
  useEffect(() => { if (open) setF(rule ? { ...rule } : route ? { ...blank, name: `Route: ${route.label} · ${route.vehicleName}`, appliesTo: 'Specific Route', specificRouteId: route.id } : blank); }, [open, rule?.id, route?.id]);
  const s = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => { try { await saveTransferMarkupRuleAdmin({ actingUserId: getSessionUserId() || '', id: rule?.id, name: f.name, markupType: f.markupType, markupValue: Number(f.markupValue), appliesTo: f.appliesTo, specificRouteId: f.appliesTo === 'Specific Route' ? f.specificRouteId || undefined : undefined, maxCap: Number(f.maxCap), priority: Number(f.priority), notes: f.notes, active: !!f.active }); toast.success('Markup rule saved'); await onSaved(); } catch (e: any) { toast.error(e?.message || 'Unable to save rule'); } };
  const isAed = f.markupType === 'Flat Amount (AED)';
  return <Dialog open={open} onOpenChange={o => !o && onClose()}><DialogContent><DialogHeader><DialogTitle>{rule ? 'Edit' : 'New'} markup rule</DialogTitle></DialogHeader>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Field label="Rule name"><Input value={f.name} onChange={e => s('name', e.target.value)} /></Field></div>
      <div><Label>Markup type</Label><div className="flex items-center gap-2 h-9 mt-1"><span className={'text-xs font-bold ' + (!isAed ? 'text-primary' : 'text-muted-foreground')}>%</span><Switch checked={isAed} onCheckedChange={c => s('markupType', c ? 'Flat Amount (AED)' : 'Percentage (%)')} /><span className={'text-xs font-bold ' + (isAed ? 'text-primary' : 'text-muted-foreground')}>AED</span></div></div>
      <Field label={isAed ? 'AED per trip' : 'Markup %'}><Input type="number" min="0" value={f.markupValue} onChange={e => s('markupValue', e.target.value)} /></Field>
      <div className="col-span-2"><SelectBox label="Applies to" value={f.appliesTo} options={['Global (All Transfers)', 'Airport Transfers Only', 'Intercity Transfers Only', 'City Transfers Only', 'Specific Route']} onChange={v => s('appliesTo', v)} /></div>
      {f.appliesTo === 'Specific Route' && <div className="col-span-2 text-xs rounded-md bg-muted p-2">{route ? `${route.label} · ${route.vehicleName}` : f.specificRouteId ? 'Route linked to this rule' : 'Open a fare in the Fares tab and click % to create a route-specific rule.'}</div>}
      <Field label="Max markup cap (AED, 0 = none)"><Input type="number" value={f.maxCap} onChange={e => s('maxCap', e.target.value)} /></Field>
      <Field label="Priority"><Input type="number" value={f.priority} onChange={e => s('priority', e.target.value)} /></Field>
      <div className="col-span-2"><Field label="Notes"><Textarea rows={2} value={f.notes} onChange={e => s('notes', e.target.value)} /></Field></div>
      <Toggle label="Active" checked={!!f.active} onChange={v => s('active', v)} />
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save rule</Button></DialogFooter></DialogContent></Dialog>;
}

function ExtraDialog({ open, extra, onClose, onSaved }: { open: boolean; extra: Extra | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const blank = { name: '', code: '', unit: 'Per item', netCost: 0, sellPrice: 0, maxQuantity: 1, airportOnly: false, description: '', sortOrder: 10, active: true };
  const [f, setF] = useState<any>(blank);
  useEffect(() => { if (open) setF(extra ? { ...extra } : blank); }, [open, extra?.id]);
  const s = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => { try { await saveTransferExtraAdmin({ actingUserId: uid(), id: extra?.id, name: f.name, code: f.code, unit: f.unit, netCost: Number(f.netCost), sellPrice: Number(f.sellPrice), maxQuantity: Number(f.maxQuantity), airportOnly: !!f.airportOnly, description: f.description, sortOrder: Number(f.sortOrder), active: !!f.active }); toast.success('Extra saved'); await onSaved(); } catch (e: any) { toast.error(e?.message || 'Unable to save extra'); } };
  return <Dialog open={open} onOpenChange={o => !o && onClose()}><DialogContent><DialogHeader><DialogTitle>{extra ? 'Edit' : 'New'} extra</DialogTitle></DialogHeader>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Name"><Input value={f.name} onChange={e => s('name', e.target.value)} /></Field>
      <Field label="Code"><Input value={f.code} onChange={e => s('code', e.target.value.toUpperCase())} placeholder="CSEAT" /></Field>
      <SelectBox label="Pricing unit" value={f.unit} options={['Per booking', 'Per item', 'Per 30 minutes']} onChange={v => s('unit', v)} />
      <Field label="Max quantity"><Input type="number" value={f.maxQuantity} onChange={e => s('maxQuantity', e.target.value)} /></Field>
      <Field label="Net cost (AED)"><Input type="number" value={f.netCost} onChange={e => s('netCost', e.target.value)} /></Field>
      <Field label="Sell price (AED)"><Input type="number" value={f.sellPrice} onChange={e => s('sellPrice', e.target.value)} /></Field>
      <div className="col-span-2"><Field label="Description"><Textarea rows={2} value={f.description} onChange={e => s('description', e.target.value)} /></Field></div>
      <Toggle label="Airport transfers only" checked={!!f.airportOnly} onChange={v => s('airportOnly', v)} /><Toggle label="Active" checked={!!f.active} onChange={v => s('active', v)} />
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save extra</Button></DialogFooter></DialogContent></Dialog>;
}

function BookingDialog({booking,onClose,onSaved}:{booking:Booking|null;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [state,setState]=useState('Confirmed'); const [driver,setDriver]=useState(''); const [phone,setPhone]=useState(''); const [plate,setPlate]=useState(''); const [flight,setFlight]=useState(''); const [time,setTime]=useState(''); const [notes,setNotes]=useState('');
  useEffect(()=>{if(booking){setState(booking.status);setDriver(booking.driverName);setPhone(booking.driverPhone);setPlate(booking.vehiclePlate);setFlight(booking.flightNumber);setTime(booking.pickupTime);setNotes(booking.notes);}},[booking?.id]);
  if(!booking)return null;
  const save=async()=>{try{await updateTransferBookingAdmin({actingUserId:getSessionUserId()||'',bookingId:booking.id,status:state as any,driverName:driver,driverPhone:phone,vehiclePlate:plate,flightNumber:flight,pickupTime:time,notes});toast.success('Transfer operation updated');await onSaved();}catch(e:any){toast.error(e?.message||'Unable to update transfer');}};
  return <Dialog open={!!booking} onOpenChange={o=>!o&&onClose()}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{booking.reference} · {booking.originName} → {booking.destinationName}</DialogTitle></DialogHeader>
    <div className="grid md:grid-cols-4 gap-3"><Summary label="Pickup" value={d(booking.pickupDate)+' '+booking.pickupTime}/><Summary label="Passenger" value={booking.leadPassenger}/><Summary label="Vehicle" value={booking.vehicleName}/><Summary label="Total" value={money(booking.totalPrice)}/></div>
    {booking.operationalIssues.length>0&&<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{booking.operationalIssues.join(' · ')}</div>}
    <div className="grid md:grid-cols-3 gap-3"><SelectBox label="Operational status" value={state} options={['Confirmed','Dispatched','En Route','Completed','No Show','Cancelled']} onChange={setState}/><Field label="Pickup time"><Input type="time" value={time} onChange={e=>setTime(e.target.value)}/></Field><Field label="Flight number"><Input value={flight} onChange={e=>setFlight(e.target.value)}/></Field><Field label="Driver name"><Input value={driver} onChange={e=>setDriver(e.target.value)}/></Field><Field label="Driver phone"><Input value={phone} onChange={e=>setPhone(e.target.value)}/></Field><Field label="Vehicle plate"><Input value={plate} onChange={e=>setPlate(e.target.value)}/></Field></div>
    <Field label="Operational notes / cancellation / no-show reason"><Textarea value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
    <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Allowed lifecycle: Confirmed → Dispatched → En Route → Completed. Confirmed/Dispatched may be Cancelled. En Route may become No Show only with a recorded reason.</div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Apply Operation</Button></DialogFooter>
  </DialogContent></Dialog>;
}


function VehicleDialog({open,vehicle,onClose,onSaved}:{open:boolean;vehicle:Vehicle|null;onClose:()=>void;onSaved:()=>Promise<void>}){
 const blank={name:'',models:'',maxPax:4,maxLuggage:3,wheelchair:false,tier:'Standard',supplier:'',active:true}; const [f,setF]=useState<any>(blank); useEffect(()=>{if(open)setF(vehicle?{...vehicle}:blank);},[open,vehicle?.id]); const s=(k:string,v:any)=>setF((x:any)=>({...x,[k]:v}));
 const save=async()=>{try{await saveTransferVehicleAdmin({actingUserId:getSessionUserId()||'',id:vehicle?.id,name:f.name,models:f.models,maxPax:Number(f.maxPax),maxLuggage:Number(f.maxLuggage),wheelchair:!!f.wheelchair,tier:f.tier,supplier:f.supplier,active:!!f.active});toast.success('Vehicle category saved');await onSaved();}catch(e:any){toast.error(e?.message||'Unable to save vehicle');}};
 return <Dialog open={open} onOpenChange={o=>!o&&onClose()}><DialogContent><DialogHeader><DialogTitle>{vehicle?'Edit':'Create'} Vehicle Category</DialogTitle></DialogHeader><div className="grid md:grid-cols-2 gap-3"><Field label="Category name"><Input value={f.name} onChange={e=>s('name',e.target.value)}/></Field><SelectBox label="Tier" value={f.tier} options={['Economy','Standard','Business','Luxury','VIP']} onChange={v=>s('tier',v)}/><Field label="Example models"><Input value={f.models} onChange={e=>s('models',e.target.value)}/></Field><Field label="Supplier"><Input value={f.supplier} onChange={e=>s('supplier',e.target.value)}/></Field><Field label="Max passengers"><Input type="number" value={f.maxPax} onChange={e=>s('maxPax',e.target.value)}/></Field><Field label="Max luggage"><Input type="number" value={f.maxLuggage} onChange={e=>s('maxLuggage',e.target.value)}/></Field><Toggle label="Wheelchair accessible" checked={!!f.wheelchair} onChange={v=>s('wheelchair',v)}/><Toggle label="Active vehicle" checked={!!f.active} onChange={v=>s('active',v)}/></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save Vehicle</Button></DialogFooter></DialogContent></Dialog>;
}


function Summary({label,value}:{label:string;value:string}){return <div className="rounded-lg border p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{label}</p><p className="font-bold mt-1">{value}</p></div>;}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>;}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm font-semibold">{label}</span><Switch checked={checked} onCheckedChange={onChange}/></div>;}
function SelectBox({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}){return <div><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{options.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>;}
function EntitySelect({label,value,items,onChange}:{label:string;value:string;items:{value:string;label:string}[];onChange:(v:string)=>void}){return <div><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger className="mt-1"><SelectValue placeholder={'Select '+label.toLowerCase()}/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select></div>;}
