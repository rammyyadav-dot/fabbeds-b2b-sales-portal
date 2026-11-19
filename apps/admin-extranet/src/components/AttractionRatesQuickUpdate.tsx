import {useEffect,useMemo,useState} from 'react';
import {toast} from 'sonner';
import {bulkLoadAttractionRates,getAttractionCommercialWorkspace,quickLockAttractionDates,type GetAttractionAdminOverviewOutputType,type GetAttractionCommercialWorkspaceOutputType} from 'zitejs/api';
import {Button} from '@project/components/ui/button';
import {Input} from '@project/components/ui/input';
import {Label} from '@project/components/ui/label';
import {Badge} from '@project/components/ui/badge';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@project/components/ui/select';
import {Switch} from '@project/components/ui/switch';
import {ScrollArea,ScrollBar} from '@project/components/ui/scroll-area';
import {CalendarDays,Lock,Loader2,RefreshCw,Save,ShieldCheck} from 'lucide-react';
import {periodDates} from '../lib/attractionCommercialRules';

type Overview=GetAttractionAdminOverviewOutputType;
type Workspace=GetAttractionCommercialWorkspaceOutputType;
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fresh=()=>({start:'',end:'',weekdays:[0,1,2,3,4,5,6],netAdult:'',netChild:'0',retailAdult:'',retailChild:'0',allocation:'100',cutoff:'4',inventoryStatus:'Available',layer:'BASE',priority:'0',stopSale:false});

function Field({label,children}:{label:string;children:React.ReactNode}){
  return <label className="block space-y-1.5"><span className="text-[11px] font-semibold text-muted-foreground">{label}</span>{children}</label>;
}

function UpdateRow({label,sub,value,onChange,step='0.01'}:{label:string;sub?:string;value:string;onChange:(v:string)=>void;step?:string}){
  return <div className="grid grid-cols-[1fr_110px] gap-3 items-center">
    <div><span className="font-bold text-sm">{label}</span>{sub&&<span className="text-xs text-muted-foreground ml-1.5">({sub})</span>}</div>
    <Input type="number" min="0" step={step} value={value} onChange={e=>onChange(e.target.value)} className="h-11 text-center font-semibold"/>
  </div>;
}

export default function AttractionRatesQuickUpdate({attractions,tickets,initialTicketId='',onSaved}:{attractions:Overview['attractions'];tickets:Overview['ticketOptions'];initialTicketId?:string;onSaved:()=>void}){
  const initialAttraction=tickets.find(t=>t.id===initialTicketId)?.attractionId||attractions.find(a=>a.status==='Active')?.id||attractions[0]?.id||'';
  const [attractionId,setAttractionId]=useState(initialAttraction);
  const [ticketId,setTicketId]=useState(initialTicketId);
  const [planId,setPlanId]=useState('');
  const [data,setData]=useState<Workspace|null>(null);
  const [form,setForm]=useState(fresh());
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);

  const refresh=async()=>{setLoading(true);try{setData(await getAttractionCommercialWorkspace({}));}catch(e:any){toast.error(e.message||'Could not load Rates & Inventory');}finally{setLoading(false);}};
  useEffect(()=>{refresh();},[]);
  useEffect(()=>{
    if(initialTicketId){
      const t=tickets.find(x=>x.id===initialTicketId);
      if(t){setAttractionId(t.attractionId);setTicketId(t.id);}
    }
  },[initialTicketId,tickets]);

  const attractionTickets=useMemo(()=>tickets.filter(t=>t.attractionId===attractionId&&t.status==='Active'),[tickets,attractionId]);
  useEffect(()=>{
    if(ticketId&&!attractionTickets.some(t=>t.id===ticketId)){setTicketId(attractionTickets[0]?.id||'');setPlanId('');}
    else if(!ticketId&&attractionTickets.length)setTicketId(attractionTickets[0].id);
  },[attractionId,attractionTickets,ticketId]);

  const plans=(data?.plans||[]).filter(p=>p.ticketOptionId===ticketId);
  const selectedPlan=plans.find(p=>p.id===planId);
  const selectedTicket=tickets.find(t=>t.id===ticketId);
  const selectedAttraction=attractions.find(a=>a.id===attractionId);
  const planPeriods=(data?.periods||[]).filter(p=>p.planId===planId).sort((a,b)=>b.end.localeCompare(a.end));
  const latest=planPeriods[0];

  useEffect(()=>{
    if(planId&&!plans.some(p=>p.id===planId))setPlanId('');
  },[ticketId,plans,planId]);

  const loadLatest=()=>{
    if(!latest)return;
    setForm(f=>({...f,netAdult:String(latest.netAdult),netChild:String(latest.netChild),retailAdult:String(latest.retailAdult),retailChild:String(latest.retailChild),allocation:String(latest.allocation),cutoff:String(latest.cutoff),inventoryStatus:latest.inventoryStatus,layer:latest.layer,priority:String(latest.priority),stopSale:latest.stopSale}));
    toast.success('Loaded the latest commercial values for this SKU.');
  };

  const reset=()=>setForm(fresh());

  const validate=()=>{
    if(!attractionId)return 'Select an attraction.';
    if(!ticketId)return 'Select a SKU product.';
    if(!planId)return 'Select a commercial plan for this SKU.';
    if(!form.start||!form.end)return 'Select From and To dates.';
    const today=new Date();today.setHours(0,0,0,0);
    if(new Date(form.start+'T00:00:00')<today||new Date(form.end+'T00:00:00')<today)return 'Back-dated quick updates are not allowed.';
    let rows:string[]=[];
    try{rows=periodDates(form.start,form.end,form.weekdays);}catch(e:any){return e.message;}
    const nums=[form.netAdult,form.netChild,form.retailAdult,form.retailChild,form.allocation,form.cutoff,form.priority].map(Number);
    if(nums.some(n=>!Number.isFinite(n)||n<0))return 'Rates, allocation, cutoff and priority must be valid non-negative numbers.';
    if(Number(form.netAdult)<=0&&Number(form.netChild)<=0)return 'Enter at least one positive net rate.';
    if(Number(form.retailAdult)<Number(form.netAdult)||Number(form.retailChild)<Number(form.netChild))return 'Retail must be at least net for each age band.';
    if(form.inventoryStatus==='Available'&&Number(form.allocation)<=0&&!form.stopSale)return 'Available inventory requires positive allocation.';
    return rows;
  };

  const apply=async(lockAfter:boolean)=>{
    const checked=validate();
    if(typeof checked==='string'){toast.error(checked);return;}
    setBusy(true);
    try{
      const result=await bulkLoadAttractionRates({
        ticketOptionId:ticketId,ratePlanId:planId,startDate:form.start,endDate:form.end,selectedWeekdays:form.weekdays,
        netAdult:Number(form.netAdult),netChild:Number(form.netChild),retailAdult:Number(form.retailAdult),retailChild:Number(form.retailChild),
        totalCapacity:Number(form.allocation),cutoffHours:Number(form.cutoff),inventoryStatus:form.inventoryStatus as 'Available'|'Sold Out'|'On Request',
        stopSale:form.stopSale,rateLayer:form.layer as 'OVERRIDE'|'PROMO'|'BASE'|'FALLBACK',priority:Number(form.priority),
        overlapAction:'override',publish:true,reason:lockAfter?'Attraction Quick Update · apply then lock':'Attraction Quick Update · apply'
      });
      if(lockAfter)await quickLockAttractionDates({attractionId,ticketId,start:form.start,end:form.end,weekdays:form.weekdays});
      toast.success((lockAfter?'Applied & locked ':'Applied ')+result.created+' new + '+result.updated+' updated daily rows');
      await refresh();onSaved();
    }catch(e:any){toast.error(e.message||'Could not apply attraction rates');}
    finally{setBusy(false);}
  };

  const lockOnly=async()=>{
    if(!attractionId||!ticketId){toast.error('Select an attraction and SKU product.');return;}
    if(!form.start||!form.end||!form.weekdays.length){toast.error('Select a valid period and weekdays.');return;}
    const today=new Date();today.setHours(0,0,0,0);
    if(new Date(form.start+'T00:00:00')<today||new Date(form.end+'T00:00:00')<today){toast.error('Back-dated Quick Updates are not allowed.');return;}
    try{periodDates(form.start,form.end,form.weekdays);}catch(e:any){toast.error(e.message);return;}
    setBusy(true);
    try{
      const result=await quickLockAttractionDates({attractionId,ticketId,start:form.start,end:form.end,weekdays:form.weekdays});
      toast.success('Locked '+result.locked+' SKU dates without changing rates or allocation.');
      await refresh();onSaved();
    }catch(e:any){toast.error(e.message||'Could not lock attraction dates');}
    finally{setBusy(false);}
  };

  const count=(()=>{try{return periodDates(form.start,form.end,form.weekdays).length;}catch{return 0;}})();
  const activeAttractions=attractions.filter(a=>a.status==='Active'&&tickets.some(t=>t.attractionId===a.id&&t.status==='Active'));

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-xl font-black">Quick Update</h2><p className="text-xs text-muted-foreground mt-1">Attraction → SKU Product → commercial plan → date rows → B2B / API</p></div>
      <Button variant="outline" size="icon" aria-label="Refresh Rates & Inventory" disabled={busy||loading} onClick={refresh}><RefreshCw className={'w-4 h-4 '+(loading?'animate-spin':'')}/></Button>
    </div>

    <ScrollArea className="w-full border rounded-t-xl bg-card">
      <div className="flex min-w-max">
        {activeAttractions.map(a=><button key={a.id} onClick={()=>{setAttractionId(a.id);setPlanId('');}} className={'px-5 py-3 text-sm border-r transition-colors '+(a.id===attractionId?'bg-primary text-primary-foreground font-bold':'text-muted-foreground hover:bg-muted/50')}>{a.title}</button>)}
      </div><ScrollBar orientation="horizontal"/>
    </ScrollArea>

    <section className="border border-t-0 rounded-b-xl bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground w-16 shrink-0">Period</span>
        <Input type="date" min={new Date().toISOString().slice(0,10)} value={form.start} onChange={e=>setForm({...form,start:e.target.value,end:form.end&&form.end<e.target.value?'':form.end})} className="w-52"/>
        <span className="text-muted-foreground">→</span>
        <Input type="date" min={form.start||new Date().toISOString().slice(0,10)} value={form.end} onChange={e=>setForm({...form,end:e.target.value})} className="w-52"/>
        <Badge variant="outline">{count} daily rows</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground w-16 shrink-0">Days</span>
        {DAYS.map((d,i)=><button key={d} type="button" aria-pressed={form.weekdays.includes(i)} onClick={()=>setForm(f=>({...f,weekdays:f.weekdays.includes(i)?f.weekdays.filter(n=>n!==i):[...f.weekdays,i]}))} className={'h-8 min-w-12 rounded-md border px-3 text-xs font-bold '+(form.weekdays.includes(i)?'bg-primary text-primary-foreground border-primary':'bg-background')}>{d}</button>)}
      </div>

      <div className="grid lg:grid-cols-[160px_minmax(240px,1fr)_minmax(220px,1fr)] gap-3 items-end">
        <div className="text-sm"><div className="font-medium text-muted-foreground">Update By</div><div className="mt-2 font-semibold">SKU Product + Plan</div></div>
        <Field label="SKU Product (Rate Plan)">
          <Select value={ticketId} onValueChange={v=>{setTicketId(v);setPlanId('');}}><SelectTrigger><SelectValue placeholder="-- Select SKU Product --"/></SelectTrigger><SelectContent>{attractionTickets.map(t=><SelectItem key={t.id} value={t.id}>{t.skuCode} · {t.name}</SelectItem>)}</SelectContent></Select>
        </Field>
        <div className="flex gap-2 items-end"><div className="flex-1"><Field label="Commercial Plan / Tier"><Select value={planId} onValueChange={setPlanId} disabled={!ticketId}><SelectTrigger><SelectValue placeholder="-- Select Commercial Plan --"/></SelectTrigger><SelectContent>{plans.map(p=><SelectItem key={p.id} value={p.id}>{p.name}{p.slot?' · '+p.slot:''}</SelectItem>)}</SelectContent></Select></Field></div>{latest&&<Button type="button" variant="outline" onClick={loadLatest}>Load current</Button>}</div>
      </div>

      {selectedTicket&&<div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs flex flex-wrap gap-x-5 gap-y-1"><span><strong>{selectedAttraction?.title}</strong></span><span>{selectedTicket.ticketType}</span><span>SKU {selectedTicket.skuCode}</span><span>{selectedTicket.minPax}–{selectedTicket.maxPax} pax</span>{selectedPlan?.slot&&<span>Slot {selectedPlan.slot}</span>}</div>}
    </section>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <section className="border rounded-xl bg-card p-4 space-y-4">
        <div className="flex items-center justify-between border-b pb-3"><div><h3 className="font-bold">Price</h3><p className="text-[10px] text-muted-foreground">AED · net and retail</p></div><Badge variant="secondary">Required</Badge></div>
        <div className="grid grid-cols-[1fr_110px] gap-3 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold"><span/><span className="text-center">Value</span></div>
        <UpdateRow label="Adult Net" sub="AED" value={form.netAdult} onChange={v=>setForm({...form,netAdult:v})}/>
        <UpdateRow label="Adult Retail" sub="AED" value={form.retailAdult} onChange={v=>setForm({...form,retailAdult:v})}/>
        <UpdateRow label="Child Net" sub="AED" value={form.netChild} onChange={v=>setForm({...form,netChild:v})}/>
        <UpdateRow label="Child Retail" sub="AED" value={form.retailChild} onChange={v=>setForm({...form,retailChild:v})}/>
        <p className="text-[10px] text-muted-foreground">Rule: retail cannot be below net. At least one net age-band rate must be positive.</p>
      </section>

      <section className="border rounded-xl bg-card p-4 space-y-4">
        <div className="flex items-center justify-between border-b pb-3"><div><h3 className="font-bold">Availability</h3><p className="text-[10px] text-muted-foreground">Inventory & booking cutoff</p></div><ShieldCheck className="w-4 h-4 text-primary"/></div>
        <UpdateRow label="Allocation" sub="Pax / day" step="1" value={form.allocation} onChange={v=>setForm({...form,allocation:v})}/>
        <UpdateRow label="Booking Cutoff" sub="Hours" step="1" value={form.cutoff} onChange={v=>setForm({...form,cutoff:v})}/>
        <Field label="Inventory Status"><Select value={form.inventoryStatus} onValueChange={v=>setForm({...form,inventoryStatus:v})}><SelectTrigger className="h-11"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Available">Available / Free Sale</SelectItem><SelectItem value="On Request">On Request</SelectItem><SelectItem value="Sold Out">Sold Out</SelectItem></SelectContent></Select></Field>
        <div className="rounded-lg border bg-muted/20 p-3 text-[10px] text-muted-foreground space-y-1"><p><strong>Available</strong> requires positive allocation.</p><p>Allocation can never be reduced below sold + active held quantity.</p><p>Existing sold and held quantities are preserved during override.</p></div>
      </section>

      <section className="border rounded-xl bg-card p-4 space-y-4">
        <div className="flex items-center justify-between border-b pb-3"><div><h3 className="font-bold">Restrictions & Conditions</h3><p className="text-[10px] text-muted-foreground">Commercial controls for the selected SKU</p></div><CalendarDays className="w-4 h-4 text-primary"/></div>
        <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-bold">Stop Sale</p><p className="text-[10px] text-muted-foreground">Close selected dates to B2B / API</p></div><Switch checked={form.stopSale} onCheckedChange={v=>setForm({...form,stopSale:v})}/></div>
        <Field label="Rate Layer"><Select value={form.layer} onValueChange={v=>setForm({...form,layer:v})}><SelectTrigger className="h-11"><SelectValue/></SelectTrigger><SelectContent>{['BASE','PROMO','OVERRIDE','FALLBACK'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
        <UpdateRow label="Priority" sub="0–999" step="1" value={form.priority} onChange={v=>setForm({...form,priority:v})}/>
        <div className="rounded-lg border p-3 text-xs"><p className="font-semibold">Cancellation Policy</p><p className="text-muted-foreground mt-1 whitespace-pre-wrap">{selectedPlan?.cancellation||selectedTicket?.cancellationRule||selectedAttraction?.cancellationPolicy||'Select a commercial plan.'}</p></div>
      </section>
    </div>

    <div className="flex flex-wrap justify-end gap-3 border-t pt-3">
      <Button variant="outline" onClick={reset} disabled={busy}>Reset</Button>
      <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={lockOnly} disabled={busy}><Lock className="w-4 h-4"/>Lock Dates</Button>
      <Button variant="outline" className="gap-2 border-amber-500 text-amber-700" onClick={()=>apply(true)} disabled={busy}><Lock className="w-4 h-4"/>Apply & Lock</Button>
      <Button className="gap-2" onClick={()=>apply(false)} disabled={busy}>{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{busy?'Applying…':'Apply Update'}</Button>
    </div>
    <p className="text-[10px] text-right text-muted-foreground">Quick Update overwrites only the selected rate layer + priority on matching dates. Back-dated edits are blocked; server-side sold/hold, overlap, price and allocation rules remain enforced.</p>
  </div>;
}
