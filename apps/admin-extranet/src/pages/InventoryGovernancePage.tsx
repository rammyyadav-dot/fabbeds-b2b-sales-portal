import { useEffect, useMemo, useState } from 'react';
import {
  getInventoryGovernance,
  GetInventoryGovernanceOutputType,
  saveInventoryGovernance,
} from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Checkbox } from '@project/components/ui/checkbox';
import { AlertTriangle, CalendarRange, Clock3, Gauge, Loader2, RefreshCw, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

type Governance=GetInventoryGovernanceOutputType;
type Row=Governance['rows'][number];

function today(){return new Date().toISOString().slice(0,10);}
function plusDays(date:string,days:number){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
const riskClass=(risk:string)=>risk==='OVER'?'bg-red-50 text-red-700 border-red-200':risk==='FULL'?'bg-amber-50 text-amber-700 border-amber-200':risk==='WATCH'?'bg-yellow-50 text-yellow-700 border-yellow-200':'bg-emerald-50 text-emerald-700 border-emerald-200';
const statusClass=(status:string)=>status==='Stop Sale'?'bg-red-50 text-red-700 border-red-200':status==='On Request'?'bg-amber-50 text-amber-700 border-amber-200':status==='Limited'?'bg-blue-50 text-blue-700 border-blue-200':'bg-emerald-50 text-emerald-700 border-emerald-200';

function Stat({label,value,tone='default'}:{label:string;value:number|string;tone?:'default'|'good'|'warn'|'bad'}){
  const cls=tone==='good'?'text-emerald-700':tone==='warn'?'text-amber-700':tone==='bad'?'text-red-700':'text-foreground';
  return <div className="rounded-xl border bg-card p-4"><p className="text-[10px] uppercase tracking-widest font-extrabold text-muted-foreground">{label}</p><p className={'mt-1 text-2xl font-black '+cls}>{value}</p></div>;
}

type Draft={
  status:'Free Sale'|'Limited'|'On Request'|'Stop Sale';
  allocationType:'Free Sale'|'Allotment'|'Flexi Allotment'|'Stop Sell';
  allocation:string;
  overbookingAllowance:string;
  releaseDay:string;
  releaseHourUtc:string;
  releaseAction:'On Request'|'Close'|'Continue';
  cta:boolean;ctd:boolean;
  minStay:string;maxStay:string;leadDays:string;
  contractPoolCode:string;stopSaleReason:string;governanceNote:string;reason:string;
};

function makeDraft(row:Row):Draft{
  return {
    status:row.status as Draft['status'],
    allocationType:(row.allocationType|| (row.status==='Free Sale'?'Free Sale':'Allotment')) as Draft['allocationType'],
    allocation:row.contractedAllocation==null?'':String(row.contractedAllocation),
    overbookingAllowance:String(row.overbookingAllowance||0),
    releaseDay:row.releaseDay==null?'':String(row.releaseDay),
    releaseHourUtc:row.releaseHourUtc==null?'':String(row.releaseHourUtc),
    releaseAction:(row.releaseAction|| (row.allocationType==='Flexi Allotment'?'Continue':'On Request')) as Draft['releaseAction'],
    cta:row.cta,ctd:row.ctd,minStay:row.minStay==null?'':String(row.minStay),maxStay:row.maxStay==null?'':String(row.maxStay),
    leadDays:row.leadDays==null?'':String(row.leadDays),contractPoolCode:row.contractPoolCode||'',
    stopSaleReason:row.stopSaleReason||'',governanceNote:row.governanceNote||'',reason:'',
  };
}
const numOrNull=(v:string)=>v.trim()===''?null:Number(v);

export default function InventoryGovernancePage(){
  const [hotelId,setHotelId]=useState(()=>localStorage.getItem('selectedHotelId')||'');
  const [startDate,setStartDate]=useState(today());
  const [endDate,setEndDate]=useState(()=>plusDays(today(),30));
  const [data,setData]=useState<Governance|null>(null);
  const [loading,setLoading]=useState(false);
  const [query,setQuery]=useState('');
  const [statusFilter,setStatusFilter]=useState('ALL');
  const [selected,setSelected]=useState<Row|null>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [saving,setSaving]=useState(false);

  const load=async(nextHotel=hotelId)=>{
    if(!nextHotel)return;
    setLoading(true);
    try{setData(await getInventoryGovernance({hotelId:nextHotel,startDate,endDate}));}
    catch(err:any){toast.error(err?.message||'Inventory governance could not load.');}
    finally{setLoading(false);}
  };

  useEffect(()=>{load();},[hotelId,startDate,endDate]);
  useEffect(()=>{
    const fn=()=>{const id=localStorage.getItem('selectedHotelId')||'';setHotelId(id);};
    window.addEventListener('hotelChanged',fn);return()=>window.removeEventListener('hotelChanged',fn);
  },[]);

  const rows=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return (data?.rows||[]).filter(r=>{
      if(statusFilter!=='ALL'&&r.effectiveStatus!==statusFilter&&r.allocationType!==statusFilter)return false;
      if(!q)return true;
      return [r.roomTypeName,r.ratePlanName,r.mealPlan,r.date,r.contractPoolCode,r.status,r.effectiveStatus,r.allocationType].some(v=>String(v||'').toLowerCase().includes(q));
    });
  },[data,query,statusFilter]);

  const openRow=(row:Row)=>{setSelected(row);setDraft(makeDraft(row));};

  const save=async()=>{
    if(!selected||!draft)return;
    setSaving(true);
    try{
      const result=await saveInventoryGovernance({changes:[{
        rateId:selected.rateId,revision:selected.revision,status:draft.status,allocationType:draft.allocationType,
        allocation:numOrNull(draft.allocation),overbookingAllowance:Number(draft.overbookingAllowance||0),
        releaseDay:numOrNull(draft.releaseDay),releaseHourUtc:numOrNull(draft.releaseHourUtc),releaseAction:draft.releaseAction,
        cta:draft.cta,ctd:draft.ctd,minStay:numOrNull(draft.minStay),maxStay:numOrNull(draft.maxStay),leadDays:numOrNull(draft.leadDays),
        contractPoolCode:draft.contractPoolCode,stopSaleReason:draft.stopSaleReason,governanceNote:draft.governanceNote,reason:draft.reason,
      }]});
      if(result.failed.length) throw new Error(result.failed[0].message);
      toast.success('Inventory governance saved with audit evidence.');
      setSelected(null);setDraft(null);await load();
    }catch(err:any){toast.error(err?.message||'Governance save failed.');}
    finally{setSaving(false);}
  };

  return <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">
    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
      <div className="flex items-start gap-3"><div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-primary-foreground"/></div><div><h1 className="text-2xl font-black">Hotel Allotment & Stop-Sale Governance</h1><p className="text-sm text-muted-foreground mt-1">Authoritative allocation pools, release periods, CTA/CTD, lead time, stop sale and controlled overbooking by hotel / room / rate plan / date.</p></div></div>
      <Button variant="outline" onClick={()=>load()} disabled={loading||!hotelId} className="gap-2"><RefreshCw className={'w-4 h-4 '+(loading?'animate-spin':'')}/>Refresh</Button>
    </div>

    {!hotelId&&<div className="rounded-xl border bg-amber-50 border-amber-200 p-4 text-sm text-amber-800">Select a property from the top Property selector before managing inventory governance.</div>}

    {data&&<div className="rounded-xl border bg-card p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Property</p><p className="font-black text-lg">{data.hotelName}</p></div>
      <div className="flex flex-wrap gap-2 items-end">
        <div><p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">From</p><Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-40"/></div>
        <div><p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">To</p><Input type="date" value={endDate} min={startDate} onChange={e=>setEndDate(e.target.value)} className="w-40"/></div>
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Room, rate plan, pool…" className="pl-9 w-64"/></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-48"><SelectValue/></SelectTrigger><SelectContent>
          <SelectItem value="ALL">All governance</SelectItem><SelectItem value="Free Sale">Free Sale</SelectItem><SelectItem value="Allotment">Allotment</SelectItem><SelectItem value="Flexi Allotment">Flexi Allotment</SelectItem><SelectItem value="On Request">On Request</SelectItem><SelectItem value="Stop Sale">Stop Sale</SelectItem>
        </SelectContent></Select>
      </div>
    </div>}

    {data&&<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-3">
      <Stat label="Cells" value={data.summary.cells}/>
      <Stat label="Free Sale" value={data.summary.freeSale}/>
      <Stat label="Allotment" value={data.summary.allotment}/>
      <Stat label="Flexi" value={data.summary.flexi}/>
      <Stat label="Released" value={data.summary.released} tone={data.summary.released?'warn':'good'}/>
      <Stat label="On Request" value={data.summary.onRequest} tone={data.summary.onRequest?'warn':'good'}/>
      <Stat label="WATCH" value={data.summary.watch} tone={data.summary.watch?'warn':'good'}/>
      <Stat label="FULL" value={data.summary.full} tone={data.summary.full?'warn':'good'}/>
      <Stat label="OVER" value={data.summary.over} tone={data.summary.over?'bad':'good'}/>
    </div>}

    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start gap-3"><Gauge className="w-5 h-5 text-primary mt-0.5"/><div><p className="font-black">Authoritative precedence</p><p className="text-xs text-muted-foreground mt-1">Stop Sale / Stop Sell overrides everything. Allotment sells only before its release cut-off unless Release Action says Continue. On Request never auto-confirms. Sellable capacity = contracted allocation + approved overbooking − active holds − booked rooms. CTA applies to arrival; CTD applies to departure; min/max stay and lead days remain hard search/recheck gates.</p></div></div>
    </div>

    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between"><div><h2 className="font-black">Governed Commercial Cells</h2><p className="text-xs text-muted-foreground">Click a row to edit governance. Rate price is intentionally not editable here.</p></div><Badge variant="outline">{rows.length}</Badge></div>
      <div className="overflow-x-auto max-h-[650px]"><table className="w-full text-xs"><thead className="bg-muted/50 sticky top-0 z-10"><tr>
        <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Room / Rate Plan</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Effective</th>
        <th className="px-3 py-2 text-right">Contracted</th><th className="px-3 py-2 text-right">Overbook</th><th className="px-3 py-2 text-right">Held</th><th className="px-3 py-2 text-right">Booked</th><th className="px-3 py-2 text-right">Remaining</th>
        <th className="px-3 py-2 text-left">Release</th><th className="px-3 py-2 text-left">Stay Controls</th><th className="px-3 py-2 text-left">Risk</th>
      </tr></thead><tbody>{loading?<tr><td colSpan={12} className="p-10 text-center text-muted-foreground">Loading governance…</td></tr>:rows.length?rows.map(r=><tr key={r.rateId} onClick={()=>openRow(r)} className="border-t hover:bg-muted/30 cursor-pointer">
        <td className="px-3 py-3 font-mono">{r.date}</td>
        <td className="px-3 py-3"><p className="font-bold">{r.roomTypeName}</p><p className="text-[10px] text-muted-foreground">{r.ratePlanName} · {r.mealPlan} · {r.layer}</p>{r.contractPoolCode&&<p className="font-mono text-[9px] mt-1">{r.contractPoolCode}</p>}</td>
        <td className="px-3 py-3"><Badge variant="outline">{r.allocationType||'—'}</Badge></td>
        <td className="px-3 py-3"><Badge variant="outline" className={statusClass(r.effectiveStatus)}>{r.effectiveStatus}</Badge>{r.released&&<p className="text-[9px] text-amber-700 mt-1">release applied</p>}</td>
        <td className="px-3 py-3 text-right">{r.contractedAllocation==null?'∞':r.contractedAllocation}</td><td className="px-3 py-3 text-right">{r.overbookingAllowance}</td><td className="px-3 py-3 text-right">{r.held}</td><td className="px-3 py-3 text-right font-bold">{r.booked}</td><td className="px-3 py-3 text-right font-black">{r.remaining==null?'∞':r.remaining}</td>
        <td className="px-3 py-3"><p>{r.releaseDay==null?'—':r.releaseDay+'d @ '+String(r.releaseHourUtc??0).padStart(2,'0')+':00 UTC'}</p><p className="text-[9px] text-muted-foreground">{r.releaseAction||'—'}</p></td>
        <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{r.cta&&<Badge variant="outline">CTA</Badge>}{r.ctd&&<Badge variant="outline">CTD</Badge>}{r.minStay&&<Badge variant="outline">MIN {r.minStay}</Badge>}{r.maxStay&&<Badge variant="outline">MAX {r.maxStay}</Badge>}{r.leadDays!=null&&r.leadDays>0&&<Badge variant="outline">LEAD {r.leadDays}</Badge>}</div></td>
        <td className="px-3 py-3"><Badge variant="outline" className={riskClass(r.risk)}>{r.risk}</Badge></td>
      </tr>):<tr><td colSpan={12} className="p-10 text-center text-muted-foreground">No governed Daily Rate cells found for this date range.</td></tr>}</tbody></table></div>
    </section>

    <Sheet open={!!selected&&!!draft} onOpenChange={open=>{if(!open){setSelected(null);setDraft(null);}}}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto"><SheetHeader><SheetTitle>Inventory Governance</SheetTitle></SheetHeader>
      {selected&&draft&&<div className="mt-5 space-y-5">
        <div className="rounded-xl border bg-muted/30 p-4"><p className="font-black">{selected.roomTypeName} · {selected.ratePlanName}</p><p className="text-xs text-muted-foreground mt-1">{selected.date} · {selected.mealPlan} · {selected.layer}</p><div className="grid grid-cols-4 gap-2 mt-3"><Stat label="Held" value={selected.held}/><Stat label="Booked" value={selected.booked}/><Stat label="Remaining" value={selected.remaining==null?'∞':selected.remaining}/><Stat label="Risk" value={selected.risk} tone={selected.risk==='OVER'?'bad':selected.risk==='WATCH'||selected.risk==='FULL'?'warn':'good'}/></div></div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-xs font-bold">Allocation Type<Select value={draft.allocationType} onValueChange={v=>setDraft({...draft,allocationType:v as Draft['allocationType']})}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Free Sale">Free Sale</SelectItem><SelectItem value="Allotment">Allotment</SelectItem><SelectItem value="Flexi Allotment">Flexi Allotment</SelectItem><SelectItem value="Stop Sell">Stop Sell</SelectItem></SelectContent></Select></label>
          <label className="text-xs font-bold">Status<Select value={draft.status} onValueChange={v=>setDraft({...draft,status:v as Draft['status']})}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Free Sale">Free Sale</SelectItem><SelectItem value="Limited">Limited</SelectItem><SelectItem value="On Request">On Request</SelectItem><SelectItem value="Stop Sale">Stop Sale</SelectItem></SelectContent></Select></label>
          <label className="text-xs font-bold">Contracted Allocation<Input type="number" min="0" value={draft.allocation} onChange={e=>setDraft({...draft,allocation:e.target.value})} className="mt-1"/></label>
          <label className="text-xs font-bold">Overbooking Allowance<Input type="number" min="0" value={draft.overbookingAllowance} onChange={e=>setDraft({...draft,overbookingAllowance:e.target.value})} className="mt-1"/></label>
          <label className="text-xs font-bold">Release Days<Input type="number" min="0" value={draft.releaseDay} onChange={e=>setDraft({...draft,releaseDay:e.target.value})} className="mt-1"/></label>
          <label className="text-xs font-bold">Release Hour UTC<Input type="number" min="0" max="23" value={draft.releaseHourUtc} onChange={e=>setDraft({...draft,releaseHourUtc:e.target.value})} className="mt-1"/></label>
          <label className="text-xs font-bold">Release Action<Select value={draft.releaseAction} onValueChange={v=>setDraft({...draft,releaseAction:v as Draft['releaseAction']})}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="On Request">Move to On Request</SelectItem><SelectItem value="Close">Close / Stop Sale</SelectItem><SelectItem value="Continue">Continue Selling</SelectItem></SelectContent></Select></label>
          <label className="text-xs font-bold">Contract Pool Code<Input value={draft.contractPoolCode} onChange={e=>setDraft({...draft,contractPoolCode:e.target.value})} placeholder="e.g. DXB-WIN26-STD" className="mt-1"/></label>
          <label className="text-xs font-bold">Minimum Stay<Input type="number" min="1" value={draft.minStay} onChange={e=>setDraft({...draft,minStay:e.target.value})} className="mt-1"/></label>
          <label className="text-xs font-bold">Maximum Stay<Input type="number" min="1" value={draft.maxStay} onChange={e=>setDraft({...draft,maxStay:e.target.value})} className="mt-1"/></label>
          <label className="text-xs font-bold">Lead Days<Input type="number" min="0" value={draft.leadDays} onChange={e=>setDraft({...draft,leadDays:e.target.value})} className="mt-1"/></label>
          <div className="flex gap-5 items-end pb-2"><label className="flex items-center gap-2 text-xs font-bold"><Checkbox checked={draft.cta} onCheckedChange={v=>setDraft({...draft,cta:!!v})}/>CTA</label><label className="flex items-center gap-2 text-xs font-bold"><Checkbox checked={draft.ctd} onCheckedChange={v=>setDraft({...draft,ctd:!!v})}/>CTD</label></div>
        </div>

        {(draft.status==='Stop Sale'||draft.allocationType==='Stop Sell')&&<label className="text-xs font-bold block">Stop Sale Reason<Input value={draft.stopSaleReason} onChange={e=>setDraft({...draft,stopSaleReason:e.target.value})} placeholder="Mandatory for Stop Sale" className="mt-1"/></label>}
        <label className="text-xs font-bold block">Governance Note<textarea value={draft.governanceNote} onChange={e=>setDraft({...draft,governanceNote:e.target.value})} className="mt-1 w-full min-h-20 rounded-md border bg-background px-3 py-2 text-sm" placeholder="Contracting note, supplier instruction or pool detail"/></label>
        <label className="text-xs font-bold block">Change Reason *<textarea value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})} className="mt-1 w-full min-h-20 rounded-md border bg-background px-3 py-2 text-sm" placeholder="Required audit reason"/></label>

        <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 text-xs text-amber-800 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/><p>Governed capacity cannot be reduced below active holds + booked rooms unless the cell is being stopped. Stop Sale prevents new sales but never deletes existing commitments. Overbooking is explicit, additive capacity and should only be used when contractually approved.</p></div>
        <Button onClick={save} disabled={saving||draft.reason.trim().length<3} className="w-full gap-2">{saving?<Loader2 className="w-4 h-4 animate-spin"/>:<SlidersHorizontal className="w-4 h-4"/>}Save Governance</Button>
      </div>}
      </SheetContent>
    </Sheet>
  </div>;
}
