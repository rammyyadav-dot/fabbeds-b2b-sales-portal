import { useEffect, useMemo, useState } from 'react';
import {
  getVisaAdminWorkspace, GetVisaAdminWorkspaceOutputType,
  saveVisaProduct, createVisaApplicationAdmin, updateVisaApplicationAdmin,
  updateVisaApplicantDossier, updateVisaSecurityDeposit,
  createVisaExtensionAdmin, updateVisaExtensionAdmin,
} from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Switch } from '@project/components/ui/switch';
import { PlaneTakeoff, FileCheck2, Clock3, CircleCheckBig, AlertTriangle, Search, Plus, RefreshCw, Eye, ShieldCheck, WalletCards, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { getSessionUserId } from '@/hooks/useAppAuth';

type Data=GetVisaAdminWorkspaceOutputType;
type Application=Data['applications'][number];
type Product=Data['products'][number];
type Applicant=Data['applicants'][number];
type Deposit=Data['deposits'][number];
type Extension=Data['extensions'][number];

const APP_STATUS=['Draft','Documents Pending','Under Review','Submitted to Govt','Approved','Rejected'] as const;
const STAY_STATUS=['Not Entered','In Country','Extension Pending','Extended','Overstay','Departed'] as const;
const DOC_STATUS=['Pending Upload','Uploaded','Under Review','Verified','Rejected'] as const;
const APPLICANT_STATUS=['Pending','Processing','Approved','Rejected'] as const;
const DEPOSIT_STATUS=['Not Required','Held (Credit Line)','Escrow Paid','Released','Forfeited'] as const;

const money=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:2}).format(n||0);
const fmtDate=(v:string)=>v?new Date(v).toLocaleDateString('en-GB'):'—';

function tone(status:string){
  if(['Approved','Verified','Paid','Released','Extended'].includes(status)) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if(['Rejected','Forfeited','Overstay'].includes(status)) return 'bg-red-100 text-red-800 border-red-200';
  if(['Submitted to Govt','Under Review','Processing','Escrow Paid'].includes(status)) return 'bg-blue-100 text-blue-800 border-blue-200';
  if(['Documents Pending','Extension Pending','Held (Credit Line)'].includes(status)) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function Metric({label,value,icon:Icon}:{label:string;value:string|number;icon:any}){
  return <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Icon className="w-5 h-5 text-primary"/></div><div><p className="text-xs text-muted-foreground font-semibold">{label}</p><p className="text-xl font-black">{value}</p></div></CardContent></Card>;
}

export default function VisaAdminPage(){
  const [data,setData]=useState<Data|null>(null);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('ALL');
  const [stayFilter,setStayFilter]=useState('ALL');
  const [selected,setSelected]=useState<Application|null>(null);
  const [productOpen,setProductOpen]=useState(false);
  const [editingProduct,setEditingProduct]=useState<Product|null>(null);
  const [applicationOpen,setApplicationOpen]=useState(false);

  const load=async()=>{setLoading(true);try{setData(await getVisaAdminWorkspace({actingUserId:getSessionUserId()||''}));}catch(e:any){toast.error(e?.message||'Unable to load visa workspace');}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);

  const applications=useMemo(()=>{
    if(!data) return [];
    const q=query.trim().toLowerCase();
    return data.applications.filter(a=>{
      const ok=status==='ALL'||a.applicationStatus===status;
      const hay=[a.applicationReference,a.visaProductName,...a.applicantNames].join(' ').toLowerCase();
      return ok&&(!q||hay.includes(q));
    });
  },[data,query,status]);

  const stayApplications=useMemo(()=>{
    if(!data) return [];
    return data.applications.filter(a=>{
      if(stayFilter==='ALL') return true;
      if(stayFilter==='EXPIRING') return a.daysToExpiry!==null&&a.daysToExpiry>=0&&a.daysToExpiry<=7;
      if(stayFilter==='OVERSTAY') return a.overstayDays>0||a.stayStatus==='Overstay';
      return a.stayStatus===stayFilter;
    }).sort((a,b)=>{
      const ar=a.overstayDays>0?-10000:(a.daysToExpiry??99999);
      const br=b.overstayDays>0?-10000:(b.daysToExpiry??99999);
      return ar-br;
    });
  },[data,stayFilter]);

  if(loading&&!data) return <div className="p-8"><div className="h-48 rounded-2xl bg-muted animate-pulse"/></div>;
  if(!data) return <div className="p-8">Visa workspace unavailable.</div>;

  return <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">
    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center"><PlaneTakeoff className="w-6 h-6 text-primary-foreground"/></div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Visa Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">Product setup → application intake → document verification → government submission → approval → stay monitoring → extension & deposit control.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={'w-4 h-4 mr-2 '+(loading?'animate-spin':'')}/>Refresh</Button>
        <Button variant="outline" onClick={()=>{setEditingProduct(null);setProductOpen(true);}}><Plus className="w-4 h-4 mr-2"/>Visa Product</Button>
        <Button onClick={()=>setApplicationOpen(true)}><Plus className="w-4 h-4 mr-2"/>New Application</Button>
      </div>
    </div>

    <div className="rounded-2xl border bg-card p-4 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] font-black text-primary">Internal Operations Only</p>
        <h2 className="text-base font-black mt-1">Visa Control Centre</h2>
        <p className="text-xs text-muted-foreground mt-1">Extension, expiry, overstay, deposit and post-approval controls are restricted to this Admin workspace and are no longer exposed in the external sales portal.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {['Application','Documents','Review','Govt Submission','Decision','Stay / Extension'].map((s,i)=><div key={s} className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground grid place-items-center font-black">{i+1}</span><span className="font-semibold">{s}</span>{i<5&&<span className="text-muted-foreground">→</span>}</div>)}
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      <Metric label="Applications" value={data.stats.total} icon={FileCheck2}/>
      <Metric label="Docs Pending" value={data.stats.documentsPending} icon={Clock3}/>
      <Metric label="Under Review" value={data.stats.underReview} icon={Search}/>
      <Metric label="Submitted" value={data.stats.submitted} icon={PlaneTakeoff}/>
      <Metric label="Approved" value={data.stats.approved} icon={CircleCheckBig}/>
      <Metric label="Expiry ≤ 7d" value={data.stats.expiringSoon} icon={CalendarClock}/>
      <Metric label="Overstay" value={data.stats.overstay} icon={AlertTriangle}/>
      <Metric label="Deposit Exposure" value={money(data.stats.depositExposure)} icon={WalletCards}/>
    </div>

    <Tabs defaultValue="applications" className="space-y-4">
      <TabsList className="h-auto p-1 flex-wrap">
        <TabsTrigger value="applications">Applications</TabsTrigger>
        <TabsTrigger value="products">Visa Products</TabsTrigger>
        <TabsTrigger value="deposits">Deposits</TabsTrigger>
        <TabsTrigger value="stay">Extension & Overstay</TabsTrigger>
        <TabsTrigger value="extensions">Extension Requests</TabsTrigger>
      </TabsList>

      <TabsContent value="applications" className="space-y-4">
        <Card><CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={e=>setQuery(e.target.value)} className="pl-9" placeholder="Search reference, visa product or applicant…"/></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full md:w-56"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ALL">All status</SelectItem>{APP_STATUS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        </CardContent></Card>

        <div className="rounded-xl border bg-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-left"><th className="px-4 py-3">Application</th><th className="px-4 py-3">Visa / Applicants</th><th className="px-4 py-3">Workflow</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Stay</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y">{applications.map(a=><tr key={a.id} className="hover:bg-muted/30">
            <td className="px-4 py-3"><p className="font-bold">{a.applicationReference}</p><p className="text-[11px] text-muted-foreground">{fmtDate(a.createdAt)} · {a.processingType}</p></td>
            <td className="px-4 py-3"><p className="font-semibold">{a.visaProductName}</p><p className="text-[11px] text-muted-foreground">{a.applicantNames.slice(0,2).join(', ')||a.applicantCount+' applicant(s)'}</p><p className="text-[10px] text-muted-foreground">{a.verifiedApplicants+'/'+a.applicantCount+' documents verified'}</p></td>
            <td className="px-4 py-3"><Badge variant="outline" className={tone(a.applicationStatus)}>{a.applicationStatus}</Badge></td>
            <td className="px-4 py-3"><Badge variant="outline" className={tone(a.paymentStatus)}>{a.paymentStatus}</Badge></td>
            <td className="px-4 py-3"><Badge variant="outline" className={tone(a.overstayDays>0?'Overstay':a.stayStatus)}>{a.overstayDays>0?'Overstay '+a.overstayDays+'d':a.stayStatus}</Badge>{a.daysToExpiry!==null&&<p className="text-[10px] mt-1 text-muted-foreground">{a.daysToExpiry>=0?a.daysToExpiry+'d to expiry':'Expired '+Math.abs(a.daysToExpiry)+'d ago'}</p>}</td>
            <td className="px-4 py-3 text-right font-bold">{money(a.totalSellPrice)}</td>
            <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={()=>setSelected(a)}><Eye className="w-4 h-4 mr-1"/>Open</Button></td>
          </tr>)}{!applications.length&&<tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No applications match the current filters.</td></tr>}</tbody>
        </table></div></div>
      </TabsContent>

      <TabsContent value="products"><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.products.map(p=><Card key={p.id} className={!p.active?'opacity-60':''}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><div><CardTitle className="text-base">{p.visaName}</CardTitle><p className="text-xs text-muted-foreground">{p.visaCategory} · {p.entryType}</p></div><Badge variant={p.active?'default':'secondary'}>{p.active?'Active':'Inactive'}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-3 gap-2 text-xs"><div><p className="text-muted-foreground">Stay</p><b>{p.stayDurationDays+'d'}</b></div><div><p className="text-muted-foreground">Sell</p><b>{money(p.sellingPrice)}</b></div><div><p className="text-muted-foreground">Margin</p><b>{money(p.sellingPrice-p.netCost)}</b></div></div><Button size="sm" variant="outline" onClick={()=>{setEditingProduct(p);setProductOpen(true);}}>Edit product</Button></CardContent></Card>)}
      </div></TabsContent>

      <TabsContent value="deposits"><Card><CardHeader><CardTitle className="text-base">Security Deposit Ledger</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2">Reference</th><th>Application</th><th>Amount</th><th>Status</th><th>Updated</th></tr></thead><tbody>{data.deposits.map(d=>{const app=data.applications.find(a=>a.id===d.applicationId);return <tr key={d.id} className="border-b last:border-0"><td className="py-3 font-semibold">{d.depositReference}</td><td>{app?.applicationReference||'—'}</td><td>{money(d.depositAmount)}</td><td><Badge variant="outline" className={tone(d.depositStatus)}>{d.depositStatus}</Badge></td><td>{fmtDate(d.updatedAt)}</td></tr>})}</tbody></table></div></CardContent></Card></TabsContent>

      <TabsContent value="stay" className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric label="Approved / Active" value={data.applications.filter(a=>a.applicationStatus==='Approved').length} icon={CircleCheckBig}/>
          <Metric label="In Country" value={data.applications.filter(a=>a.stayStatus==='In Country').length} icon={PlaneTakeoff}/>
          <Metric label="Extension Pending" value={data.applications.filter(a=>a.stayStatus==='Extension Pending').length} icon={CalendarClock}/>
          <Metric label="Expiring ≤ 7d" value={data.stats.expiringSoon} icon={Clock3}/>
          <Metric label="Overstay" value={data.stats.overstay} icon={AlertTriangle}/>
        </div>
        <Card><CardContent className="p-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground mr-2">Operational filter</span>
          {[['ALL','All'],['In Country','In Country'],['Extension Pending','Extension Pending'],['EXPIRING','Expiring Soon'],['OVERSTAY','Overstay'],['Extended','Extended'],['Departed','Departed']].map(([v,l])=><Button key={v} size="sm" variant={stayFilter===v?'default':'outline'} onClick={()=>setStayFilter(v)}>{l}</Button>)}
        </CardContent></Card>
        <div className="rounded-xl border bg-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-left"><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Travelers</th><th className="px-4 py-3">Stay Status</th><th className="px-4 py-3">Days Left</th><th className="px-4 py-3">Entry</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Extensions</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y">{stayApplications.map(a=><tr key={a.id} className={a.overstayDays>0?'bg-red-50/60 hover:bg-red-50':'hover:bg-muted/30'}>
            <td className="px-4 py-3"><p className="font-black">{a.applicationReference}</p><p className="text-[11px] text-muted-foreground">{a.processingType}</p></td>
            <td className="px-4 py-3"><p className="font-semibold">{a.applicantNames.slice(0,2).join(', ')||a.applicantCount+' applicant(s)'}</p><p className="text-[10px] text-muted-foreground">{a.applicantCount} traveler(s)</p></td>
            <td className="px-4 py-3"><Badge variant="outline" className={tone(a.overstayDays>0?'Overstay':a.stayStatus)}>{a.overstayDays>0?'Overstay':a.stayStatus}</Badge></td>
            <td className="px-4 py-3 font-bold">{a.daysToExpiry===null?'—':a.daysToExpiry<0?'-'+Math.abs(a.daysToExpiry)+'d':a.daysToExpiry+'d'}</td>
            <td className="px-4 py-3">{fmtDate(a.entryDate)}</td><td className="px-4 py-3">{fmtDate(a.visaExpiryDate)}</td><td className="px-4 py-3">{a.extensionCount||'—'}</td>
            <td className="px-4 py-3 text-right"><Button size="sm" onClick={()=>setSelected(a)}>{a.stayStatus==='Extension Pending'?'Review':'Open'}</Button></td>
          </tr>)}{!stayApplications.length&&<tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No records for this stay-status filter.</td></tr>}</tbody>
        </table></div></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Governance:</b> expiry and overstay are operational controls. An application is never auto-extended, auto-approved, or auto-regularized; every change requires an Admin action and recorded status update.</div>
      </TabsContent>

      <TabsContent value="extensions"><Card><CardHeader><CardTitle className="text-base">Extension Requests & Status Changes</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2">Application</th><th>Type</th><th>Status</th><th>New Expiry</th><th>Fees</th></tr></thead><tbody>{data.extensions.map(x=>{const app=data.applications.find(a=>a.id===x.applicationId);return <tr key={x.id} className="border-b last:border-0"><td className="py-3 font-semibold">{app?.applicationReference||'—'}</td><td>{x.extensionType}</td><td><Badge variant="outline" className={tone(x.extensionStatus)}>{x.extensionStatus}</Badge></td><td>{fmtDate(x.newExpiryDate)}</td><td>{money(x.extensionFee+x.overstayFine)}</td></tr>})}</tbody></table></div></CardContent></Card></TabsContent>
    </Tabs>

    <ApplicationDialog app={selected} data={data} onClose={()=>setSelected(null)} onChanged={async()=>{setSelected(null);await load();}}/>
    <ProductDialog open={productOpen} product={editingProduct} onClose={()=>setProductOpen(false)} onSaved={async()=>{setProductOpen(false);setEditingProduct(null);await load();}}/>
    <NewApplicationDialog open={applicationOpen} products={data.products.filter(p=>p.active)} onClose={()=>setApplicationOpen(false)} onSaved={async()=>{setApplicationOpen(false);await load();}}/>
  </div>;
}

function ApplicationDialog({app,data,onClose,onChanged}:{app:Application|null;data:Data;onClose:()=>void;onChanged:()=>Promise<void>}){
  const [notes,setNotes]=useState('');
  const [entryDate,setEntryDate]=useState('');
  const [expiry,setExpiry]=useState('');
  const [extOpen,setExtOpen]=useState(false);
  useEffect(()=>{setNotes(app?.notes||'');setEntryDate(app?.entryDate||'');setExpiry(app?.visaExpiryDate||'');},[app?.id]);
  if(!app) return null;
  const applicants=data.applicants.filter(x=>x.applicationId===app.id);
  const deposit=data.deposits.find(x=>x.applicationId===app.id);
  const extensions=data.extensions.filter(x=>x.applicationId===app.id);
  const update=async(payload:any)=>{try{await updateVisaApplicationAdmin({actingUserId:getSessionUserId()||'',applicationId:app.id,...payload});toast.success('Application updated');await onChanged();}catch(e:any){toast.error(e?.message||'Update failed');}};
  return <Dialog open={!!app} onOpenChange={o=>!o&&onClose()}><DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>{app.applicationReference} · {app.visaProductName}</DialogTitle></DialogHeader>
    <div className="grid md:grid-cols-4 gap-3"><Summary label="Workflow" value={app.applicationStatus}/><Summary label="Payment" value={app.paymentStatus}/><Summary label="Stay" value={app.stayStatus}/><Summary label="Sell Value" value={money(app.totalSellPrice)}/></div>
    <div className="rounded-xl border p-4 space-y-3"><h3 className="font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4"/>Workflow Control</h3><div className="grid md:grid-cols-3 gap-3">
      <SelectBox label="Application status" value={app.applicationStatus} options={[...APP_STATUS]} onChange={v=>update({applicationStatus:v})}/>
      <SelectBox label="Payment status" value={app.paymentStatus} options={['Pending','Paid','Refunded']} onChange={v=>update({paymentStatus:v})}/>
      <SelectBox label="Stay status" value={app.stayStatus} options={[...STAY_STATUS]} onChange={v=>update({stayStatus:v})}/>
    </div><div className="grid md:grid-cols-2 gap-3"><div><Label>Entry date</Label><Input type="date" className="mt-1" value={entryDate} onChange={e=>setEntryDate(e.target.value)}/></div><div><Label>Visa expiry date</Label><Input type="date" className="mt-1" value={expiry} onChange={e=>setExpiry(e.target.value)}/></div></div><div><Label>Operations notes</Label><Textarea className="mt-1" value={notes} onChange={e=>setNotes(e.target.value)}/></div><Button onClick={()=>update({entryDate:entryDate||null,visaExpiryDate:expiry||null,notes})}>Save operational details</Button></div>
    <div className="space-y-3"><h3 className="font-bold">Applicant Dossiers</h3>{applicants.map(a=><ApplicantCard key={a.id} applicant={a} onChanged={onChanged}/>)}</div>
    {deposit&&<DepositCard deposit={deposit} onChanged={onChanged}/>}
    <div className="rounded-xl border p-4 space-y-3"><div className="flex items-center justify-between"><h3 className="font-bold">Extensions</h3><Button size="sm" variant="outline" disabled={app.applicationStatus!=='Approved'} onClick={()=>setExtOpen(true)}><Plus className="w-4 h-4 mr-1"/>New Extension</Button></div>{extensions.length?extensions.map(x=><ExtensionCard key={x.id} extension={x} onChanged={onChanged}/>):<p className="text-sm text-muted-foreground">No extension requests.</p>}</div>
    <ExtensionDialog open={extOpen} app={app} onClose={()=>setExtOpen(false)} onSaved={async()=>{setExtOpen(false);await onChanged();}}/>
  </DialogContent></Dialog>;
}

function Summary({label,value}:{label:string;value:string}){return <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground uppercase font-bold">{label}</p><p className="font-bold mt-1">{value}</p></div>;}
function SelectBox({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}){return <div><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{options.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>;}

function ApplicantCard({applicant,onChanged}:{applicant:Applicant;onChanged:()=>Promise<void>}){
  const [doc,setDoc]=useState(applicant.documentStatus);
  const [state,setState]=useState(applicant.applicantStatus);
  const [uid,setUid]=useState(applicant.uidNumber);
  const [visa,setVisa]=useState(applicant.visaNumber);
  const [reason,setReason]=useState(applicant.rejectionReason);
  const save=async()=>{try{await updateVisaApplicantDossier({actingUserId:getSessionUserId()||'',dossierId:applicant.id,documentStatus:doc as any,applicantStatus:state as any,uidNumber:uid,visaNumber:visa,rejectionReason:reason});toast.success('Applicant review saved');await onChanged();}catch(e:any){toast.error(e?.message||'Applicant update failed');}};
  return <div className="rounded-xl border p-4 space-y-3"><div><p className="font-bold">{applicant.fullName}</p><p className="text-xs text-muted-foreground">{applicant.nationality} · Passport {applicant.passportNumber} · Exp {fmtDate(applicant.passportExpiry)}</p></div><div className="grid md:grid-cols-4 gap-3"><SelectBox label="Document status" value={doc} options={[...DOC_STATUS]} onChange={setDoc}/><SelectBox label="Applicant status" value={state} options={[...APPLICANT_STATUS]} onChange={setState}/><div><Label>UID number</Label><Input className="mt-1" value={uid} onChange={e=>setUid(e.target.value)}/></div><div><Label>Visa number</Label><Input className="mt-1" value={visa} onChange={e=>setVisa(e.target.value)}/></div></div>{doc==='Rejected'&&<div><Label>Rejection reason</Label><Textarea className="mt-1" value={reason} onChange={e=>setReason(e.target.value)}/></div>}<Button size="sm" variant="outline" onClick={save}>Save applicant review</Button></div>;
}

function DepositCard({deposit,onChanged}:{deposit:Deposit;onChanged:()=>Promise<void>}){
  const [state,setState]=useState(deposit.depositStatus);
  const [reason,setReason]=useState(deposit.forfeitReason);
  const save=async()=>{try{await updateVisaSecurityDeposit({actingUserId:getSessionUserId()||'',depositId:deposit.id,depositStatus:state as any,forfeitReason:reason});toast.success('Deposit updated');await onChanged();}catch(e:any){toast.error(e?.message||'Deposit update failed');}};
  return <div className="rounded-xl border p-4 space-y-3"><div className="flex justify-between"><h3 className="font-bold">Security Deposit</h3><b>{money(deposit.depositAmount)}</b></div><div className="grid md:grid-cols-2 gap-3"><SelectBox label="Deposit status" value={state} options={[...DEPOSIT_STATUS]} onChange={setState}/><div><Label>Forfeit reason</Label><Input className="mt-1" disabled={state!=='Forfeited'} value={reason} onChange={e=>setReason(e.target.value)}/></div></div><Button size="sm" variant="outline" onClick={save}>Update deposit</Button></div>;
}

function ExtensionCard({extension,onChanged}:{extension:Extension;onChanged:()=>Promise<void>}){
  const [state,setState]=useState(extension.extensionStatus);
  const [expiry,setExpiry]=useState(extension.newExpiryDate);
  const save=async()=>{try{await updateVisaExtensionAdmin({actingUserId:getSessionUserId()||'',extensionId:extension.id,extensionStatus:state as any,newExpiryDate:expiry||undefined,notes:extension.notes||''});toast.success('Extension updated');await onChanged();}catch(e:any){toast.error(e?.message||'Extension update failed');}};
  return <div className="rounded-lg bg-muted/40 p-3 grid md:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-end"><div><p className="font-semibold">{extension.extensionType}</p><p className="text-xs text-muted-foreground">{extension.reason} · {money(extension.extensionFee+extension.overstayFine)}</p></div><SelectBox label="Status" value={state} options={['Submitted','Under Review','Approved','Rejected']} onChange={setState}/><div><Label>New expiry</Label><Input type="date" className="mt-1 bg-background" value={expiry} onChange={e=>setExpiry(e.target.value)}/></div><Button size="sm" onClick={save}>Apply</Button></div>;
}

function ProductDialog({open,product,onClose,onSaved}:{open:boolean;product:Product|null;onClose:()=>void;onSaved:()=>Promise<void>}){
  const blank={visaName:'',visaCategory:'Tourist Visa',validityDays:60,stayDurationDays:30,entryType:'Single Entry',processingType:'Standard (3-5 Days)',netCost:0,sellingPrice:0,expressSurcharge:0,requiresSecurityDeposit:false,depositAmount:0,description:'',active:true};
  const [f,setF]=useState<any>(blank);
  useEffect(()=>{if(open)setF(product?{...product}:blank);},[open,product?.id]);
  const set=(k:string,v:any)=>setF((x:any)=>({...x,[k]:v}));
  const submit=async()=>{try{await saveVisaProduct({actingUserId:getSessionUserId()||'',id:product?.id,visaName:f.visaName,visaCategory:f.visaCategory,validityDays:Number(f.validityDays),stayDurationDays:Number(f.stayDurationDays),entryType:f.entryType,processingType:f.processingType,netCost:Number(f.netCost),sellingPrice:Number(f.sellingPrice),expressSurcharge:Number(f.expressSurcharge),requiresSecurityDeposit:!!f.requiresSecurityDeposit,depositAmount:Number(f.depositAmount),description:f.description||'',active:!!f.active});toast.success('Visa product saved');await onSaved();}catch(e:any){toast.error(e?.message||'Unable to save product');}};
  return <Dialog open={open} onOpenChange={o=>!o&&onClose()}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{product?'Edit':'Create'} Visa Product</DialogTitle></DialogHeader><div className="grid md:grid-cols-2 gap-4"><div><Label>Visa name</Label><Input className="mt-1" value={f.visaName} onChange={e=>set('visaName',e.target.value)}/></div><SelectBox label="Category" value={f.visaCategory} options={['Tourist Visa','Business Visa','Transit Visa','Employment Visa','Student Visa','e-Visa','Entry Visa']} onChange={v=>set('visaCategory',v)}/><div><Label>Validity days</Label><Input type="number" className="mt-1" value={f.validityDays} onChange={e=>set('validityDays',e.target.value)}/></div><div><Label>Stay duration</Label><Input type="number" className="mt-1" value={f.stayDurationDays} onChange={e=>set('stayDurationDays',e.target.value)}/></div><SelectBox label="Entry type" value={f.entryType} options={['Single Entry','Multiple Entry']} onChange={v=>set('entryType',v)}/><SelectBox label="Processing" value={f.processingType} options={['Standard (3-5 Days)','Express (24-48 Hrs)']} onChange={v=>set('processingType',v)}/><div><Label>Net cost (AED)</Label><Input type="number" className="mt-1" value={f.netCost} onChange={e=>set('netCost',e.target.value)}/></div><div><Label>Selling price (AED)</Label><Input type="number" className="mt-1" value={f.sellingPrice} onChange={e=>set('sellingPrice',e.target.value)}/></div><div><Label>Express surcharge</Label><Input type="number" className="mt-1" value={f.expressSurcharge} onChange={e=>set('expressSurcharge',e.target.value)}/></div><div><Label>Deposit amount</Label><Input type="number" className="mt-1" disabled={!f.requiresSecurityDeposit} value={f.depositAmount} onChange={e=>set('depositAmount',e.target.value)}/></div><div className="md:col-span-2"><Label>Description</Label><Textarea className="mt-1" value={f.description} onChange={e=>set('description',e.target.value)}/></div><div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm font-semibold">Security deposit required</span><Switch checked={f.requiresSecurityDeposit} onCheckedChange={v=>set('requiresSecurityDeposit',v)}/></div><div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm font-semibold">Active</span><Switch checked={f.active} onCheckedChange={v=>set('active',v)}/></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save Product</Button></DialogFooter></DialogContent></Dialog>;
}

function NewApplicationDialog({open,products,onClose,onSaved}:{open:boolean;products:Product[];onClose:()=>void;onSaved:()=>Promise<void>}){
  const empty={firstName:'',lastName:'',nationality:'',passportNumber:'',passportExpiry:'',dateOfBirth:'',gender:'Male'};
  const [productId,setProductId]=useState(''); const [processing,setProcessing]=useState<'Standard'|'Express'>('Standard'); const [payment,setPayment]=useState<'Pending'|'Paid'>('Pending'); const [notes,setNotes]=useState(''); const [applicants,setApplicants]=useState<any[]>([{...empty}]);
  useEffect(()=>{if(open){setProductId(products[0]?.id||'');setApplicants([{...empty}]);setNotes('');}},[open]);
  const upd=(i:number,k:string,v:string)=>setApplicants(a=>a.map((x,n)=>n===i?{...x,[k]:v}:x));
  const submit=async()=>{try{await createVisaApplicationAdmin({actingUserId:getSessionUserId()||'',visaProductId:productId,processingType:processing,paymentStatus:payment,applicants,notes});toast.success('Visa application created');await onSaved();}catch(e:any){toast.error(e?.message||'Unable to create application');}};
  return <Dialog open={open} onOpenChange={o=>!o&&onClose()}><DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>New Visa Application</DialogTitle></DialogHeader><div className="grid md:grid-cols-3 gap-3"><div><Label>Visa product</Label><Select value={productId} onValueChange={setProductId}><SelectTrigger className="mt-1"><SelectValue placeholder="Select visa product"/></SelectTrigger><SelectContent>{products.map(p=><SelectItem key={p.id} value={p.id}>{p.visaName} · {money(p.sellingPrice)}</SelectItem>)}</SelectContent></Select></div><SelectBox label="Processing" value={processing} options={['Standard','Express']} onChange={v=>setProcessing(v as any)}/><SelectBox label="Payment" value={payment} options={['Pending','Paid']} onChange={v=>setPayment(v as any)}/></div><div className="space-y-3"><div className="flex justify-between"><Label className="font-bold">Applicants</Label><Button size="sm" variant="outline" onClick={()=>setApplicants(a=>[...a,{...empty}])}><Plus className="w-4 h-4 mr-1"/>Add Applicant</Button></div>{applicants.map((a,i)=><div key={i} className="rounded-xl border p-4 grid md:grid-cols-3 gap-3"><div><Label>First name</Label><Input className="mt-1" value={a.firstName} onChange={e=>upd(i,'firstName',e.target.value)}/></div><div><Label>Last name</Label><Input className="mt-1" value={a.lastName} onChange={e=>upd(i,'lastName',e.target.value)}/></div><div><Label>Nationality</Label><Input className="mt-1" value={a.nationality} onChange={e=>upd(i,'nationality',e.target.value)}/></div><div><Label>Passport number</Label><Input className="mt-1" value={a.passportNumber} onChange={e=>upd(i,'passportNumber',e.target.value)}/></div><div><Label>Passport expiry</Label><Input type="date" className="mt-1" value={a.passportExpiry} onChange={e=>upd(i,'passportExpiry',e.target.value)}/></div><div><Label>Date of birth</Label><Input type="date" className="mt-1" value={a.dateOfBirth} onChange={e=>upd(i,'dateOfBirth',e.target.value)}/></div><SelectBox label="Gender" value={a.gender} options={['Male','Female','Other']} onChange={v=>upd(i,'gender',v)}/>{applicants.length>1&&<div className="flex items-end"><Button variant="ghost" className="text-destructive" onClick={()=>setApplicants(x=>x.filter((_,n)=>n!==i))}>Remove</Button></div>}</div>)}</div><div><Label>Notes</Label><Textarea className="mt-1" value={notes} onChange={e=>setNotes(e.target.value)}/></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={!productId}>Create Application</Button></DialogFooter></DialogContent></Dialog>;
}

function ExtensionDialog({open,app,onClose,onSaved}:{open:boolean;app:Application;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [type,setType]=useState('Visa Renewal'); const [expiry,setExpiry]=useState(''); const [days,setDays]=useState('30'); const [fee,setFee]=useState('0'); const [fine,setFine]=useState('0'); const [reason,setReason]=useState(''); const [notes,setNotes]=useState('');
  const submit=async()=>{try{await createVisaExtensionAdmin({actingUserId:getSessionUserId()||'',applicationId:app.id,extensionType:type as any,newExpiryDate:expiry||undefined,additionalDays:Number(days),extensionFee:Number(fee),overstayFine:Number(fine),reason,notes});toast.success('Extension created');await onSaved();}catch(e:any){toast.error(e?.message||'Unable to create extension');}};
  return <Dialog open={open} onOpenChange={o=>!o&&onClose()}><DialogContent><DialogHeader><DialogTitle>New Extension</DialogTitle></DialogHeader><div className="space-y-3"><SelectBox label="Type" value={type} options={['Status Change','Visa Renewal','Grace Period','Overstay Regularization']} onChange={setType}/><div className="grid grid-cols-2 gap-3"><div><Label>New expiry</Label><Input type="date" className="mt-1" value={expiry} onChange={e=>setExpiry(e.target.value)}/></div><div><Label>Additional days</Label><Input type="number" className="mt-1" value={days} onChange={e=>setDays(e.target.value)}/></div><div><Label>Extension fee</Label><Input type="number" className="mt-1" value={fee} onChange={e=>setFee(e.target.value)}/></div><div><Label>Overstay fine</Label><Input type="number" className="mt-1" value={fine} onChange={e=>setFine(e.target.value)}/></div></div><div><Label>Reason</Label><Textarea className="mt-1" value={reason} onChange={e=>setReason(e.target.value)}/></div><div><Label>Notes</Label><Textarea className="mt-1" value={notes} onChange={e=>setNotes(e.target.value)}/></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}>Submit Extension</Button></DialogFooter></DialogContent></Dialog>;
}
