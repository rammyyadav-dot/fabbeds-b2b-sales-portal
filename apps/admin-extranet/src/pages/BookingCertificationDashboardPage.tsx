import { useEffect, useMemo, useState } from 'react';
import {
  getBookingCertificationDashboard,
  GetBookingCertificationDashboardOutputType,
  getBookingCertificationDetail,
  GetBookingCertificationDetailOutputType,
  releaseInventoryHoldAdmin,
  recertifyBooking,
  recertifyBookings,
  reconcileBookedInventoryLedger,
  getInventoryAuditAccounting,
  GetInventoryAuditAccountingOutputType,
  reconcileInventoryMovements,
} from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { AlertTriangle, ArrowLeftRight, BadgeCheck, CheckCircle2, CircleAlert, Clock3, DatabaseZap, Eye, Gauge, History, Loader2, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Dashboard=GetBookingCertificationDashboardOutputType;
type Audit=GetInventoryAuditAccountingOutputType;
type Hold=Dashboard['activeHolds'][number];
type Booking=Dashboard['bookings'][number];

const aed=(n:number)=>'AED '+Number(n||0).toLocaleString('en-AE',{maximumFractionDigits:2});

function Stat({label,value,sub,tone='default'}:{label:string;value:number|string;sub?:string;tone?:'default'|'good'|'warn'|'bad'}){
  const cls=tone==='good'?'text-emerald-700':tone==='warn'?'text-amber-700':tone==='bad'?'text-red-700':'text-foreground';
  return <div className="rounded-xl border bg-card p-4"><p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p><p className={'mt-1 text-2xl font-black '+cls}>{value}</p>{sub&&<p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}</div>;
}

function Countdown({expiresAt}:{expiresAt:string}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  if(!expiresAt)return <span>—</span>;
  const sec=Math.max(0,Math.ceil((new Date(expiresAt).getTime()-now)/1000));
  const m=Math.floor(sec/60),s=sec%60;
  return <span className={sec<=120?'font-bold text-amber-700':'font-semibold'}>{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
}

const riskClass=(risk:string)=>risk==='OVER'?'bg-red-50 text-red-700 border-red-200':risk==='FULL'?'bg-amber-50 text-amber-700 border-amber-200':risk==='WATCH'?'bg-yellow-50 text-yellow-700 border-yellow-200':'bg-emerald-50 text-emerald-700 border-emerald-200';
const certClass=(status:string)=>['COMPLETE','PASS','ALLOW'].includes(status)?'bg-emerald-50 text-emerald-700 border-emerald-200':['INCOMPLETE','WARN'].includes(status)?'bg-amber-50 text-amber-700 border-amber-200':'bg-red-50 text-red-700 border-red-200';

export default function BookingCertificationDashboardPage(){
  const [data,setData]=useState<Dashboard|null>(null);
  const [audit,setAudit]=useState<Audit|null>(null);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  const [hotelFilter,setHotelFilter]=useState('ALL');
  const [releaseBusy,setReleaseBusy]=useState('');
  const [detail,setDetail]=useState<GetBookingCertificationDetailOutputType|null>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [recertifyBusy,setRecertifyBusy]=useState('');
  const [bulkBusy,setBulkBusy]=useState(false);
  const [reconcileBusy,setReconcileBusy]=useState(false);
  const [movementReconcileBusy,setMovementReconcileBusy]=useState(false);

  const load=async()=>{
    setLoading(true);
    try{
      const [cert,auditData]=await Promise.all([
        getBookingCertificationDashboard({}),
        getInventoryAuditAccounting({limit:500}),
      ]);
      setData(cert);
      setAudit(auditData);
    }catch(err:any){toast.error(err?.message||'Inventory control dashboard could not load.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();},[]);

  const hotels=useMemo(()=>{
    if(!data)return [];
    return Array.from(new Set([...data.activeHolds.map(x=>x.hotelName),...data.exposure.map(x=>x.hotelName),...data.bookings.map(x=>x.hotelName)].filter(Boolean))).sort();
  },[data]);

  const q=query.trim().toLowerCase();
  const matches=(values:(string|number)[])=>!q||values.some(v=>String(v||'').toLowerCase().includes(q));
  const activeHolds=(data?.activeHolds||[]).filter(h=>(hotelFilter==='ALL'||h.hotelName===hotelFilter)&&matches([h.holdToken,h.partnerName,h.hotelName,h.signature]));
  const history=(data?.holdHistory||[]).filter(h=>(hotelFilter==='ALL'||h.hotelName===hotelFilter)&&matches([h.holdToken,h.partnerName,h.hotelName,h.status]));
  const exposure=(data?.exposure||[]).filter(x=>(hotelFilter==='ALL'||x.hotelName===hotelFilter)&&matches([x.hotelName,x.roomTypeName,x.ratePlanName,x.stayDate,x.risk]));
  const bookings=(data?.bookings||[]).filter(b=>(hotelFilter==='ALL'||b.hotelName===hotelFilter)&&matches([b.bookingReference,b.hotelName,b.partnerName,b.pricingVersion,b.holdToken]));
  const alerts=(data?.alerts||[]).filter(a=>matches([a.code,a.title,a.detail,a.holdToken,a.bookingId]));
  const auditCells=(audit?.cells||[]).filter(c=>(hotelFilter==='ALL'||c.hotelName===hotelFilter)&&matches([c.hotelName,c.roomTypeName,c.ratePlanName,c.stayDate,c.risk,c.cellKey]));
  const movements=(audit?.movements||[]).filter(m=>(hotelFilter==='ALL'||m.hotelName===hotelFilter)&&matches([m.movementType,m.hotelName,m.roomTypeName,m.ratePlanName,m.stayDate,m.holdToken,m.bookingReference,m.actor,m.source]));
  const auditAnomalies=(audit?.anomalies||[]).filter(a=>matches([a.code,a.title,a.detail,a.holdToken,a.bookingId,a.cellKey]));

  const releaseHold=async(hold:Hold)=>{
    if(!window.confirm('Release active hold '+hold.holdToken+'? This makes its inventory available again.'))return;
    setReleaseBusy(hold.holdToken);
    try{const result=await releaseInventoryHoldAdmin({holdToken:hold.holdToken});toast.success('Released '+result.releasedLines+' hold lines.');await load();}
    catch(err:any){toast.error(err?.message||'Hold could not be released.');}
    finally{setReleaseBusy('');}
  };

  const openBooking=async(bookingId:string)=>{
    setDetailLoading(true);setDetail(null);
    try{setDetail(await getBookingCertificationDetail({bookingId}));}
    catch(err:any){toast.error(err?.message||'Booking evidence could not load.');}
    finally{setDetailLoading(false);}
  };

  const recertifyOne=async(bookingId:string)=>{
    setRecertifyBusy(bookingId);
    try{
      const result=await recertifyBooking({bookingId});
      toast.success('Certification '+result.status+' · gate '+result.gate);
      await load();
      if(detail?.booking.id===bookingId) await openBooking(bookingId);
    }catch(err:any){toast.error(err?.message||'Re-certification failed.');}
    finally{setRecertifyBusy('');}
  };

  const recertifyAll=async()=>{
    setBulkBusy(true);
    try{
      const result=await recertifyBookings({limit:100});
      toast.success('Re-certified '+result.checked+' bookings · PASS '+result.pass+' · WARN '+result.warn+' · FAIL '+result.fail);
      if(result.errors.length) toast.warning(result.errors.length+' booking(s) could not be evaluated.');
      await load();
    }catch(err:any){toast.error(err?.message||'Bulk re-certification failed.');}
    finally{setBulkBusy(false);}
  };

  const reconcileInventory=async()=>{
    setReconcileBusy(true);
    try{
      const result=await reconcileBookedInventoryLedger({limit:100});
      toast.success('Sold inventory reconciled · '+result.createdRows+' ledger rows created across '+result.reconciled+' bookings.');
      if(result.errors.length) toast.warning(result.errors.length+' booking(s) need manual review.');
      await load();
    }catch(err:any){toast.error(err?.message||'Booked inventory reconciliation failed.');}
    finally{setReconcileBusy(false);}
  };

  const reconcileMovementAudit=async()=>{
    setMovementReconcileBusy(true);
    try{
      const result=await reconcileInventoryMovements({limit:200});
      toast.success('Movement audit reconciled · '+result.created+' explicit reconciliation events created.');
      if(result.errors.length) toast.warning(result.errors.length+' movement row(s) need manual review.');
      await load();
    }catch(err:any){toast.error(err?.message||'Movement audit reconciliation failed.');}
    finally{setMovementReconcileBusy(false);}
  };

  return <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">
    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
      <div className="flex items-start gap-3"><div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-primary-foreground"/></div><div><h1 className="text-2xl font-black">Inventory Hold & Booking Certification</h1><p className="text-sm text-muted-foreground mt-1">Live holds, held-vs-allocation exposure, nightly booking evidence and certification exceptions.</p></div></div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Hold, booking, hotel, partner…" className="pl-9 w-72"/></div>
        <Select value={hotelFilter} onValueChange={setHotelFilter}><SelectTrigger className="w-56"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ALL">All hotels</SelectItem>{hotels.map(h=><SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={reconcileInventory} disabled={reconcileBusy||loading} className="gap-2">{reconcileBusy?<Loader2 className="w-4 h-4 animate-spin"/>:<DatabaseZap className="w-4 h-4"/>}Reconcile Sold Inventory</Button>
        <Button variant="outline" onClick={recertifyAll} disabled={bulkBusy||loading} className="gap-2">{bulkBusy?<Loader2 className="w-4 h-4 animate-spin"/>:<ShieldCheck className="w-4 h-4"/>}Re-certify 100</Button>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2"><RefreshCw className={'w-4 h-4 '+(loading?'animate-spin':'')}/>Refresh</Button>
      </div>
    </div>

    {data&&<div className={'rounded-xl border px-4 py-3 flex items-center gap-3 '+(data.summary.alerts?'bg-amber-50 border-amber-200':'bg-emerald-50 border-emerald-200')}>
      {data.summary.alerts?<CircleAlert className="w-5 h-5 text-amber-700"/>:<BadgeCheck className="w-5 h-5 text-emerald-700"/>}
      <div><p className="font-black">{data.summary.alerts?String(data.summary.alerts)+' certification alerts require review':'No booking-certification exceptions detected'}</p><p className="text-xs text-muted-foreground">Checked {new Date(data.checkedAt).toLocaleString()} · read-only except explicit Admin hold release.</p></div>
    </div>}

    {data&&<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      <Stat label="PASS" value={data.summary.certifiedBookings} tone="good"/>
      <Stat label="WARN" value={data.summary.warningBookings} tone={data.summary.warningBookings?'warn':'good'}/>
      <Stat label="FAIL" value={data.summary.failedBookings} tone={data.summary.failedBookings?'bad':'good'}/>
      <Stat label="Confirmation BLOCK" value={data.summary.blockedConfirmations} tone={data.summary.blockedConfirmations?'bad':'good'}/>
      <Stat label="Active Holds" value={data.summary.activeHolds} sub="non-expired"/>
      <Stat label="Held Room-Nights" value={data.summary.activeHeldRoomNights}/>
      <Stat label="Over Allocation" value={data.summary.overAllocationCells} tone={data.summary.overAllocationCells?'bad':'good'}/>
      <Stat label="Alerts" value={data.summary.alerts} tone={data.summary.alerts?'warn':'good'}/>
    </div>}

    <Tabs defaultValue="active" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
        <TabsTrigger value="active" className="gap-1.5"><Clock3 className="w-3.5 h-3.5"/>Active Holds</TabsTrigger>
        <TabsTrigger value="exposure" className="gap-1.5"><Gauge className="w-3.5 h-3.5"/>Allocation Exposure</TabsTrigger>
        <TabsTrigger value="movements" className="gap-1.5"><ArrowLeftRight className="w-3.5 h-3.5"/>Movement Audit</TabsTrigger>
        <TabsTrigger value="bookings" className="gap-1.5"><BadgeCheck className="w-3.5 h-3.5"/>Booking Certification</TabsTrigger>
        <TabsTrigger value="alerts" className="gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/>Alerts</TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5"><History className="w-3.5 h-3.5"/>Hold History</TabsTrigger>
      </TabsList>

      <TabsContent value="active"><section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between"><div><h2 className="font-black">Active Inventory Holds</h2><p className="text-xs text-muted-foreground">Non-expired reservations currently reducing sellable allocation.</p></div><Badge variant="outline">{activeHolds.length}</Badge></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Hold</th><th className="px-3 py-2 text-left">Hotel / Partner</th><th className="px-3 py-2 text-right">Rooms</th><th className="px-3 py-2 text-right">Room-Nights</th><th className="px-3 py-2 text-right">Quote</th><th className="px-3 py-2 text-left">Expires</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
        <tbody>{loading?<tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Loading holds…</td></tr>:activeHolds.length?activeHolds.map(h=><tr key={h.holdToken} className="border-t hover:bg-muted/20">
          <td className="px-3 py-3"><p className="font-mono text-xs font-semibold max-w-[220px] truncate" title={h.holdToken}>{h.holdToken}</p><p className="text-[10px] text-muted-foreground">{h.ratePlans} rate plans</p></td>
          <td className="px-3 py-3"><p className="font-semibold">{h.hotelName}</p><p className="text-[11px] text-muted-foreground">{h.partnerName}</p></td>
          <td className="px-3 py-3 text-right font-semibold">{h.roomsHeld}</td><td className="px-3 py-3 text-right">{h.roomNights}</td><td className="px-3 py-3 text-right font-bold">{aed(h.quotedSellTotal)}</td>
          <td className="px-3 py-3"><Countdown expiresAt={h.expiresAt}/><p className="text-[9px] text-muted-foreground mt-1">{h.expiresAt?new Date(h.expiresAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—'}</p></td>
          <td className="px-3 py-3 text-right"><Button size="sm" variant="outline" className="text-red-700 gap-1.5" disabled={releaseBusy===h.holdToken} onClick={()=>releaseHold(h)}>{releaseBusy===h.holdToken?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Trash2 className="w-3.5 h-3.5"/>}Release</Button></td>
        </tr>):<tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No active holds match the current filter.</td></tr>}</tbody></table></div>
      </section></TabsContent>

      <TabsContent value="exposure"><section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b"><h2 className="font-black">Held + Sold vs Authoritative Allocation</h2><p className="text-xs text-muted-foreground">Remaining sellable inventory = contracted allocation − active holds − durable booked-room ledger.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Hotel</th><th className="px-3 py-2 text-left">Room / Plan</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Allocation</th><th className="px-3 py-2 text-right">Held</th><th className="px-3 py-2 text-right">Booked</th><th className="px-3 py-2 text-right">Consumed</th><th className="px-3 py-2 text-right">Remaining</th><th className="px-3 py-2 text-left">Risk</th></tr></thead>
        <tbody>{exposure.map(x=><tr key={x.roomTypeId+':'+x.ratePlanId+':'+x.stayDate} className="border-t">
          <td className="px-3 py-3 font-mono text-xs">{x.stayDate}</td><td className="px-3 py-3 font-semibold">{x.hotelName}</td><td className="px-3 py-3"><p className="font-semibold">{x.roomTypeName}</p><p className="text-[11px] text-muted-foreground">{x.ratePlanName}</p></td><td className="px-3 py-3 text-xs">{x.status||'—'}</td>
          <td className="px-3 py-3 text-right">{x.allocation==null?'Free Sale':x.allocation}</td><td className="px-3 py-3 text-right">{x.activeHeld}</td><td className="px-3 py-3 text-right font-bold">{x.bookedSold}</td><td className="px-3 py-3 text-right font-bold">{x.totalConsumed}</td><td className="px-3 py-3 text-right">{x.remaining==null?'∞':x.remaining}</td>
          <td className="px-3 py-3"><Badge variant="outline" className={riskClass(x.risk)}>{x.risk}{x.utilizationPct!=null?' · '+x.utilizationPct+'%':''}</Badge></td>
        </tr>)}</tbody></table></div>
      </section></TabsContent>

      <TabsContent value="movements"><div className="space-y-4">
        <section className="rounded-xl border bg-card p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div><h2 className="font-black">Immutable Inventory Movement Accounting</h2><p className="text-xs text-muted-foreground mt-1">Audit chain for HOLD → BOOKED → RELEASED / EXPIRED plus explicit legacy reconciliation. Movement rows are append-only evidence; sellable inventory still comes from live holds + booked ledger.</p></div>
            <Button variant="outline" className="gap-2" onClick={reconcileMovementAudit} disabled={movementReconcileBusy||loading}>{movementReconcileBusy?<Loader2 className="w-4 h-4 animate-spin"/>:<ArrowLeftRight className="w-4 h-4"/>}Reconcile Movement Audit</Button>
          </div>
          {audit&&<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 mt-4">
            <Stat label="Movements" value={audit.summary.movements}/>
            <Stat label="HOLD" value={audit.summary.holds}/>
            <Stat label="BOOKED" value={audit.summary.bookings}/>
            <Stat label="RELEASED" value={audit.summary.releases}/>
            <Stat label="EXPIRED" value={audit.summary.expiries}/>
            <Stat label="RECONCILED" value={audit.summary.reconciliations}/>
            <Stat label="Oversell Cells" value={audit.summary.overCells} tone={audit.summary.overCells?'bad':'good'}/>
            <Stat label="Movement Gaps" value={audit.summary.movementGaps} tone={audit.summary.movementGaps?'warn':'good'}/>
          </div>}
        </section>

        {auditAnomalies.length>0&&<section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b"><h3 className="font-black">Oversell & Audit Exceptions</h3><p className="text-xs text-muted-foreground">P0 oversell conditions and P2 movement-evidence gaps are investigation items, not automatic inventory mutations.</p></div>
          <div className="grid lg:grid-cols-2 gap-3 p-4">{auditAnomalies.map((a,i)=><div key={i} className={'rounded-lg border p-3 '+(a.severity==='P0'?'bg-red-50 border-red-200':a.severity==='P1'?'bg-amber-50 border-amber-200':'bg-muted/30')}>
            <div className="flex gap-2 items-start"><Badge variant="outline" className="font-mono">{a.severity}</Badge><div><p className="font-bold text-sm">{a.title}</p><p className="text-xs text-muted-foreground mt-1">{a.detail}</p><p className="font-mono text-[9px] text-muted-foreground mt-2 break-all">{a.code} · {a.cellKey}</p></div></div>
          </div>)}</div>
        </section>}

        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b"><h3 className="font-black">Current Inventory Accounting by Commercial Cell</h3><p className="text-xs text-muted-foreground">Contracted − Held − Booked = Remaining. Movement count is audit evidence only.</p></div>
          <div className="overflow-x-auto max-h-[420px]"><table className="w-full text-xs"><thead className="bg-muted/40 sticky top-0"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Hotel</th><th className="px-3 py-2 text-left">Room / Plan</th><th className="px-3 py-2 text-right">Contracted</th><th className="px-3 py-2 text-right">Held</th><th className="px-3 py-2 text-right">Booked</th><th className="px-3 py-2 text-right">Remaining</th><th className="px-3 py-2 text-left">Risk</th><th className="px-3 py-2 text-right">Moves</th></tr></thead>
          <tbody>{auditCells.length?auditCells.map(c=><tr key={c.cellKey} className="border-t">
            <td className="px-3 py-2 font-mono">{c.stayDate}</td><td className="px-3 py-2 font-semibold">{c.hotelName}</td><td className="px-3 py-2"><p className="font-semibold">{c.roomTypeName}</p><p className="text-[10px] text-muted-foreground">{c.ratePlanName}</p></td>
            <td className="px-3 py-2 text-right">{c.allocation==null?'Free Sale':c.allocation}</td><td className="px-3 py-2 text-right">{c.held}</td><td className="px-3 py-2 text-right font-bold">{c.booked}</td><td className="px-3 py-2 text-right font-bold">{c.remaining==null?'∞':c.remaining}</td>
            <td className="px-3 py-2"><Badge variant="outline" className={riskClass(c.risk)}>{c.risk}{c.utilizationPct!=null?' · '+c.utilizationPct+'%':''}</Badge></td><td className="px-3 py-2 text-right">{c.movementCount}</td>
          </tr>):<tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No held or booked inventory cells match the current filter.</td></tr>}</tbody></table></div>
        </section>

        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b"><h3 className="font-black">Movement Journal</h3><p className="text-xs text-muted-foreground">Append-only operational evidence with the inventory state captured immediately after each movement.</p></div>
          <div className="overflow-x-auto max-h-[520px]"><table className="w-full text-xs"><thead className="bg-muted/40 sticky top-0"><tr><th className="px-3 py-2 text-left">When</th><th className="px-3 py-2 text-left">Move</th><th className="px-3 py-2 text-right">Δ</th><th className="px-3 py-2 text-left">Hotel / Cell</th><th className="px-3 py-2 text-left">Reference</th><th className="px-3 py-2 text-right">Held After</th><th className="px-3 py-2 text-right">Booked After</th><th className="px-3 py-2 text-right">Remaining</th><th className="px-3 py-2 text-left">Source / Actor</th></tr></thead>
          <tbody>{movements.length?movements.map(m=><tr key={m.id} className="border-t">
            <td className="px-3 py-2 whitespace-nowrap">{m.occurredAt?new Date(m.occurredAt).toLocaleString():'—'}</td>
            <td className="px-3 py-2"><Badge variant="outline" className={m.movementType==='BOOKED'?'bg-violet-50 text-violet-700 border-violet-200':m.movementType==='HOLD'?'bg-blue-50 text-blue-700 border-blue-200':m.movementType==='RELEASED'||m.movementType==='EXPIRED'?'bg-amber-50 text-amber-700 border-amber-200':'bg-muted'}>{m.movementType}</Badge></td>
            <td className={'px-3 py-2 text-right font-black '+(m.quantityDelta<0?'text-emerald-700':m.quantityDelta>0?'text-red-700':'text-muted-foreground')}>{m.quantityDelta>0?'+':''}{m.quantityDelta}</td>
            <td className="px-3 py-2"><p className="font-semibold">{m.hotelName}</p><p className="text-[10px] text-muted-foreground">{m.roomTypeName} · {m.ratePlanName} · {m.stayDate}</p></td>
            <td className="px-3 py-2"><p className="font-mono">{m.bookingReference||m.holdToken||'—'}</p><p className="text-[9px] text-muted-foreground max-w-[180px] truncate" title={m.correlationId}>{m.correlationId}</p></td>
            <td className="px-3 py-2 text-right">{m.heldAfter}</td><td className="px-3 py-2 text-right">{m.bookedAfter}</td><td className="px-3 py-2 text-right font-bold">{m.remainingAfter==null?'∞':m.remainingAfter}</td>
            <td className="px-3 py-2"><p className="font-semibold">{m.source}</p><p className="text-[10px] text-muted-foreground">{m.actor}</p></td>
          </tr>):<tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No inventory movement evidence yet.</td></tr>}</tbody></table></div>
        </section>
      </div></TabsContent>

      <TabsContent value="bookings"><section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b"><h2 className="font-black">Automatic Booking Certification & Confirmation Gate</h2><p className="text-xs text-muted-foreground">PASS allows confirmation. WARN permits legacy review. FAIL blocks hotel confirmation until reconciliation evidence is fixed.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Booking</th><th className="px-3 py-2 text-left">Hotel / Agency</th><th className="px-3 py-2 text-left">Certification</th><th className="px-3 py-2 text-left">Confirmation Gate</th><th className="px-3 py-2 text-right">Sell / Delta</th><th className="px-3 py-2 text-left">Evidence</th><th className="px-3 py-2 text-left">Pricing</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
        <tbody>{bookings.length?bookings.map(b=><tr key={b.bookingId} className="border-t hover:bg-muted/20">
          <td className="px-3 py-3"><p className="font-mono text-xs font-semibold">{b.bookingReference}</p><p className="text-[10px] text-muted-foreground">{b.status} · {b.rooms} rooms × {b.nights} nights</p></td>
          <td className="px-3 py-3"><p className="font-semibold">{b.hotelName}</p><p className="text-[11px] text-muted-foreground">{b.partnerName}</p></td>
          <td className="px-3 py-3"><Badge variant="outline" className={certClass(b.certificationStatus)}>{b.certificationStatus}</Badge>{b.certificationReasons.length>0&&<p className="text-[9px] text-muted-foreground mt-1 max-w-[250px] truncate" title={b.certificationReasons.join(' · ')}>{b.certificationReasons.join(' · ')}</p>}</td>
          <td className="px-3 py-3"><Badge variant="outline" className={certClass(b.confirmationGate)}>{b.confirmationGate}</Badge></td>
          <td className="px-3 py-3 text-right"><p className="font-bold">{aed(b.sellTotal)}</p><p className={(Math.abs(b.sellDelta)<0.01?'text-emerald-700':'text-red-700')+' text-[10px]'}>Δ {aed(b.sellDelta)}</p></td>
          <td className="px-3 py-3"><Badge variant="outline" className={certClass(b.snapshotCoverage)}>{b.snapshotCoverage}</Badge><p className="text-[9px] text-muted-foreground mt-1">{b.nightlySnapshots}/{b.expectedNightlySnapshots} nightly · hold {b.holdStatus}</p></td>
          <td className="px-3 py-3"><p className="text-xs font-semibold">{b.pricingVersion||'legacy'}</p><p className="text-[9px] text-muted-foreground">{b.pricingStatus}</p></td>
          <td className="px-3 py-3 text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" className="gap-1.5" onClick={()=>openBooking(b.bookingId)}><Eye className="w-3.5 h-3.5"/>View</Button><Button size="sm" variant="outline" disabled={recertifyBusy===b.bookingId} onClick={()=>recertifyOne(b.bookingId)}>{recertifyBusy===b.bookingId?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<RefreshCw className="w-3.5 h-3.5"/>}</Button></div></td>
        </tr>):<tr><td colSpan={8} className="p-10 text-center text-muted-foreground">No hotel bookings match this filter.</td></tr>}</tbody></table></div>
      </section></TabsContent>

      <TabsContent value="alerts"><div className="grid lg:grid-cols-2 gap-3">
        {alerts.length?alerts.map((a,i)=><div key={i} className={'rounded-xl border p-4 '+(a.severity==='P0'?'bg-red-50 border-red-200':a.severity==='P1'?'bg-amber-50 border-amber-200':'bg-card')}>
          <div className="flex items-start gap-3"><AlertTriangle className={'w-4 h-4 mt-0.5 '+(a.severity==='P0'?'text-red-700':'text-amber-700')}/><div className="min-w-0 flex-1">
            <div className="flex gap-2 items-center"><Badge variant="outline" className="font-mono">{a.severity}</Badge><span className="font-mono text-[10px] text-muted-foreground">{a.code}</span></div><p className="font-bold text-sm mt-2">{a.title}</p><p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
            {a.bookingId&&<Button size="sm" variant="ghost" className="mt-2 px-0" onClick={()=>openBooking(a.bookingId)}>Open booking evidence</Button>}
          </div></div>
        </div>):<div className="lg:col-span-2 rounded-xl border bg-card p-10 text-center text-muted-foreground"><CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600"/>No certification alerts.</div>}
      </div></TabsContent>

      <TabsContent value="history"><section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b"><h2 className="font-black">Hold Lifecycle History</h2><p className="text-xs text-muted-foreground">Converted, released and expired holds retained as audit evidence.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Hold</th><th className="px-3 py-2 text-left">Hotel / Partner</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Room-Nights</th><th className="px-3 py-2 text-right">Quote</th><th className="px-3 py-2 text-left">Expiry</th><th className="px-3 py-2 text-left">Booking</th></tr></thead>
        <tbody>{history.map(h=><tr key={h.holdToken} className="border-t"><td className="px-3 py-3 font-mono text-xs max-w-[220px] truncate">{h.holdToken}</td><td className="px-3 py-3"><p className="font-semibold">{h.hotelName}</p><p className="text-[11px] text-muted-foreground">{h.partnerName}</p></td><td className="px-3 py-3"><Badge variant="outline">{h.status}</Badge></td><td className="px-3 py-3 text-right">{h.roomNights}</td><td className="px-3 py-3 text-right font-bold">{aed(h.quotedSellTotal)}</td><td className="px-3 py-3 text-xs">{h.expiresAt?new Date(h.expiresAt).toLocaleString():'—'}</td><td className="px-3 py-3 font-mono text-[10px]">{h.bookingId||'—'}</td></tr>)}</tbody></table></div>
      </section></TabsContent>
    </Tabs>

    <Sheet open={detailLoading||!!detail} onOpenChange={open=>{if(!open&&!detailLoading)setDetail(null);}}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto"><SheetHeader><SheetTitle>Booking Certification Evidence</SheetTitle></SheetHeader>
      {detailLoading?<div className="py-16 flex justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2"/>Loading evidence…</div>:detail&&<div className="mt-5 space-y-5">
        <div className="rounded-xl border bg-muted/30 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono text-xs">{detail.booking.reference}</p><p className="text-xl font-black mt-1">{aed(detail.booking.sellTotal)}</p><p className="text-xs text-muted-foreground">{detail.booking.rooms} rooms · {detail.booking.checkIn} → {detail.booking.checkOut}</p></div><div className="text-right flex flex-col items-end gap-2"><div className="flex gap-2"><Badge variant="outline" className={certClass(detail.certification.status)}>{detail.certification.status}</Badge><Badge variant="outline" className={certClass(detail.certification.gate)}>{detail.certification.gate}</Badge></div><Button size="sm" variant="outline" disabled={recertifyBusy===detail.booking.id} onClick={()=>recertifyOne(detail.booking.id)}>{recertifyBusy===detail.booking.id?<Loader2 className="w-3.5 h-3.5 animate-spin mr-2"/>:<RefreshCw className="w-3.5 h-3.5 mr-2"/>}Re-certify</Button></div></div>
          {detail.certification.reasons.length>0&&<div className={'mt-4 rounded-lg border p-3 text-xs '+(detail.certification.status==='FAIL'?'bg-red-50 border-red-200 text-red-700':'bg-amber-50 border-amber-200 text-amber-700')}><p className="font-bold">{detail.certification.status==='FAIL'?'Hotel confirmation is BLOCKED':'Legacy/reconciliation review required'}</p><p className="mt-1">{detail.certification.reasons.join(' · ')}</p></div>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2"><Stat label="Nightly Evidence" value={detail.evidence.actualNightlySnapshots+'/'+detail.evidence.expectedNightlySnapshots} tone={detail.evidence.nightlyCoverage==='COMPLETE'?'good':'bad'}/><Stat label="Inventory Ledger" value={detail.evidence.inventoryLedgerBooked+'/'+detail.evidence.inventoryLedgerExpected} tone={detail.evidence.inventoryLedgerCoverage==='COMPLETE'?'good':'bad'}/><Stat label="Night Sell Sum" value={aed(detail.evidence.sellTotalFromNights)}/><Stat label="Sell Delta" value={aed(detail.evidence.sellDelta)} tone={Math.abs(detail.evidence.sellDelta)<0.01?'good':'bad'}/><Stat label="Confirmation Gate" value={detail.certification.gate} tone={detail.certification.gate==='ALLOW'?'good':detail.certification.gate==='WARN'?'warn':'bad'}/></div>
        <section className="rounded-xl border overflow-hidden"><div className="px-4 py-3 border-b"><h3 className="font-bold">Room Certification</h3></div><div className="divide-y">{detail.rooms.map(r=><div key={r.roomNo} className="p-4 flex justify-between gap-4"><div><p className="font-bold">Room {r.roomNo} · {r.roomTypeName}</p><p className="text-xs text-muted-foreground">{r.ratePlanName} · {r.mealPlan} · {r.adults}A{r.children?' + '+r.children+'C ('+r.childAges+')':''}</p><p className="text-[10px] mt-1">Child {aed(r.childTotal)} · Extra bed {aed(r.extraBedTotal)} · {r.coverageStatus}</p></div><p className="font-black whitespace-nowrap">{aed(r.roomTotal)}</p></div>)}</div></section>
        <section className="rounded-xl border overflow-hidden"><div className="px-4 py-3 border-b"><h3 className="font-bold">Nightly Price Evidence</h3><p className="text-xs text-muted-foreground">multi-room-v3 rows captured at booking time.</p></div><div className="overflow-x-auto max-h-[420px]"><table className="w-full text-xs"><thead className="bg-muted/40 sticky top-0"><tr><th className="px-2 py-2 text-left">Room</th><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Basis</th><th className="px-2 py-2 text-right">Base</th><th className="px-2 py-2 text-right">Child</th><th className="px-2 py-2 text-right">Extra Bed</th><th className="px-2 py-2 text-right">Event</th><th className="px-2 py-2 text-right">Net</th><th className="px-2 py-2 text-right">Sell</th></tr></thead><tbody>{detail.nights.map((n,i)=><tr key={i} className="border-t"><td className="px-2 py-2">{n.roomNo}</td><td className="px-2 py-2 font-mono">{n.stayDate}</td><td className="px-2 py-2">{n.occupancyBasis}</td><td className="px-2 py-2 text-right">{aed(n.baseNet)}</td><td className="px-2 py-2 text-right" title={n.childDetailsJson}>{aed(n.childTotal)}</td><td className="px-2 py-2 text-right">{aed(n.extraBedTotal)}</td><td className="px-2 py-2 text-right">{aed(n.eventSupplement)}</td><td className="px-2 py-2 text-right">{aed(n.netTotal)}</td><td className="px-2 py-2 text-right font-bold">{aed(n.sellTotal)}</td></tr>)}</tbody></table></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><DatabaseZap className="w-4 h-4 text-primary"/><h3 className="font-bold">Snapshot / Hold Chain</h3></div><div className="grid md:grid-cols-2 gap-3 mt-3 text-xs"><div><p className="text-muted-foreground">Hold Token</p><p className="font-mono break-all">{detail.hold.token||'Missing'}</p></div><div><p className="text-muted-foreground">Hold Masters / Lines</p><p className="font-semibold">{detail.hold.masters} / {detail.hold.lines}</p></div><div><p className="text-muted-foreground">Price Rechecked At</p><p>{detail.booking.priceRecheckedAt?new Date(detail.booking.priceRecheckedAt).toLocaleString():'—'}</p></div><div><p className="text-muted-foreground">Quoted Hold Total</p><p className="font-semibold">{aed(detail.hold.quotedSellTotal)}</p></div></div></section>
      </div>}</SheetContent>
    </Sheet>
  </div>;
}
