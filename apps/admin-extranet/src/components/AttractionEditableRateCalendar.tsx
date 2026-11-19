import {useEffect,useRef,useState} from 'react';
import {addMonths,format,parseISO,endOfMonth} from 'date-fns';
import {toast} from 'sonner';
import {getAttractionRateCalendar,saveAttractionCalendarRates,bulkChangeAttractionCalendarRates,bulkLoadAttractionRates,type GetAttractionRateCalendarOutputType,type GetAttractionCommercialWorkspaceOutputType} from 'zitejs/api';
import {Button} from '@project/components/ui/button';
import {Input} from '@project/components/ui/input';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@project/components/ui/select';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@project/components/ui/dialog';
import DatePickerInput from './DatePickerInput';
import {ChevronLeft,ChevronRight,RefreshCw,Upload,CheckCircle2,AlertCircle,Loader2} from 'lucide-react';
type Row=GetAttractionRateCalendarOutputType['days'][number]['rows'][number];
type FieldKey='adult'|'child'|'retailAdult'|'retailChild'|'allocation'|'cutoffHours';
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>;}
function Cell({value,label,onSave,disabled=false,integer=false}:{value:number;label:string;onSave:(v:number)=>Promise<number>;disabled?:boolean;integer?:boolean}){
 const [draft,setDraft]=useState(String(value)),[state,setState]=useState<'idle'|'saving'|'saved'|'error'>('idle'),[error,setError]=useState('');
 const dirty=useRef(false),active=useRef(true),running=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{if(!dirty.current)setDraft(String(value));},[value]);
 const save=async()=>{
 if(!dirty.current||running.current)return;
 const n=Number(draft);
 if(draft.trim()===''||!Number.isFinite(n)||n<0||(integer&&!Number.isInteger(n))){setState('error');setError('Enter a valid non-negative '+(integer?'whole number':'rate'));return;}
 running.current=true;setState('saving');setError('');
 try{const result=await onSave(n);if(active.current){dirty.current=false;setDraft(String(result));setState('saved');}}
 catch(e:any){if(active.current){setState('error');setError(e.message||'Save failed');}}
 finally{running.current=false;}
 };
 return <div className="relative min-w-[92px]"><Input aria-label={label} type="number" min="0" step={integer?'1':'0.01'} value={draft} disabled={disabled||state==='saving'} onChange={e=>{dirty.current=true;setDraft(e.target.value);setState('idle');}} onBlur={save} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){dirty.current=false;setDraft(String(value));setState('idle');}}} title={error||label} aria-invalid={state==='error'} className={'h-9 w-[92px] text-xs rounded-lg pr-6 '+(state==='error'?'border-red-500':state==='saved'?'border-emerald-300':'')}/><span className="absolute right-1 top-2">{state==='saving'?<Loader2 className="w-3 h-3 animate-spin text-primary"/>:state==='saved'?<CheckCircle2 className="w-3 h-3 text-emerald-600"/>:state==='error'?<button aria-label={'Retry '+label} title={error} onClick={save}><AlertCircle className="w-4 h-4 text-red-600"/></button>:null}</span></div>;
}
export default function AttractionEditableRateCalendar({attractionId,ticketId,ticketName,planId,plans,onPlanChange,onSaved,onBusyChange,bulkRequest=0,onCreatePlan}:{attractionId:string;ticketId:string;ticketName:string;planId:string;plans:GetAttractionCommercialWorkspaceOutputType['plans'];onPlanChange:(id:string)=>void;onSaved:()=>void;onBusyChange?:(busy:boolean)=>void;bulkRequest?:number;onCreatePlan:()=>void}){
 const today=format(new Date(),'yyyy-MM-dd');
 const [month,setMonth]=useState(today.slice(0,7)),[data,setData]=useState<GetAttractionRateCalendarOutputType|null>(null),[loading,setLoading]=useState(true),[pending,setPending]=useState(0),[error,setError]=useState(''),[bulk,setBulk]=useState(false),[bulkBusy,setBulkBusy]=useState(false),[bulkPlanId,setBulkPlanId]=useState(planId);
 const [form,setForm]=useState({start:today,end:today,weekdays:[0,1,2,3,4,5,6],mode:'load',operation:'set',adjustment:'',adult:'',child:'',retailAdult:'',retailChild:'',allocation:'10',cutoff:'4',status:'Available',overwrite:false});
 const revisions=useRef(new Map<string,Row>()),queue=useRef<Promise<unknown>>(Promise.resolve()),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{onBusyChange?.(pending>0||bulkBusy);return()=>onBusyChange?.(false);},[pending,bulkBusy]);
 const load=async(preserveError=false)=>{setLoading(true);if(!preserveError)setError('');try{const d=await getAttractionRateCalendar({ticketOptionId:ticketId,ratePlanId:planId||undefined,month});setData(d);revisions.current=new Map(d.days.flatMap(day=>day.rows.map(row=>[row.id,row] as const)));}catch(e:any){setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{let cancelled=false;if(!ticketId){setData(null);setLoading(false);return;}setLoading(true);getAttractionRateCalendar({ticketOptionId:ticketId,ratePlanId:planId||undefined,month}).then(d=>{if(!cancelled){setData(d);revisions.current=new Map(d.days.flatMap(day=>day.rows.map(row=>[row.id,row] as const)));setError('');}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[ticketId,planId,month]);
 const save=(row:Row,key:FieldKey,value:number):Promise<number>=>{
 setPending(n=>n+1);
 const task=queue.current.catch(()=>{}).then(async()=>{
 const latest=revisions.current.get(row.id);
 if(!latest)throw new Error('Refresh the calendar before editing.');
 const result=await saveAttractionCalendarRates({attractionId,ticketId,planId:latest.planId||undefined,edits:[{rateId:row.id,revision:latest.revision,[key]:value}]});
 if(result.failed.length)throw new Error(result.failed[0].message);
 const saved=result.saved[0];if(!saved)throw new Error('The row was not saved.');
 const next={...latest,...saved,allocation:latest.allocation===latest.baseAllocation?saved.allocation:latest.allocation,baseAllocation:saved.allocation};
 revisions.current.set(row.id,next);
 if(mounted.current){setData(d=>d?{...d,days:d.days.map(day=>({...day,rows:day.rows.map(r=>r.id===row.id?next:r)}))}:d);setError('');}
 onSaved();return key==='allocation'?saved.allocation:saved[key];
 });
 queue.current=task;
 return task.catch(e=>{if(mounted.current)setError(e.message);throw e;}).finally(()=>{if(mounted.current)setPending(n=>n-1);});
 };
 const openBulk=(date?:string)=>{setForm(f=>({...f,start:date||(month===today.slice(0,7)?today:month+'-01'),end:date||format(endOfMonth(parseISO(month+'-01')),'yyyy-MM-dd'),adult:'',child:'',retailAdult:'',retailChild:''}));setBulkPlanId(planId||plans[0]?.id||'');setError('');setBulk(true);};
 useEffect(()=>{if(bulkRequest)openBulk();},[bulkRequest]);
 const runBulk=async()=>{
 if(!bulkPlanId)return toast.error('Select a rate plan or create one first.');
 if(!form.weekdays.length)return toast.error('Select applicable days.');
 setBulkBusy(true);
 const optional=(v:string)=>v.trim()===''?undefined:Number(v);
 try{
 if(form.mode==='load'){
 if(optional(form.adult)===undefined&&optional(form.child)===undefined)throw new Error('Enter adult or child net rates.');
 const adult=optional(form.adult)??0,child=optional(form.child)??0;
 const result=await bulkLoadAttractionRates({ticketOptionId:ticketId,ratePlanId:bulkPlanId,startDate:form.start,endDate:form.end,selectedWeekdays:form.weekdays,netAdult:adult,netChild:child,retailAdult:optional(form.retailAdult)??adult,retailChild:optional(form.retailChild)??child,totalCapacity:Number(form.allocation),cutoffHours:Number(form.cutoff),inventoryStatus:form.status as any,stopSale:false,rateLayer:'BASE',priority:0,publish:true,overlapAction:form.overwrite?'override':'reject',reason:'Rate calendar bulk loader'});
 toast.success(result.created+' created · '+result.updated+' changed');
 }else{
 const result=await bulkChangeAttractionCalendarRates({attractionId,ticketId,planId:bulkPlanId,start:form.start,end:form.end,weekdays:form.weekdays,operation:form.operation as any,adjustment:optional(form.adjustment),adult:optional(form.adult),child:optional(form.child),retailAdult:optional(form.retailAdult),retailChild:optional(form.retailChild),allocation:optional(form.allocation),cutoffHours:optional(form.cutoff)});
 if(result.failed.length){toast.error(result.saved+' saved · '+result.failed.length+' failed');setError(result.failed.map(f=>f.message).join('; '));}else toast.success(result.saved+' daily rows changed');
 }
 setBulk(false);await load(true);onSaved();
 }catch(e:any){toast.error(e.message);await load(true);setError(e.message);}
 finally{setBulkBusy(false);}
 };
 const locked=loading||pending>0||bulkBusy;
 return <section className="rounded-xl border overflow-hidden bg-card">
 <div className="bg-gradient-to-r from-violet-600 to-indigo-500 text-white p-4 flex flex-col lg:flex-row justify-between gap-3"><div><h2 className="text-lg font-bold">{ticketName||'Attraction Rate Calendar'}</h2><div className="flex gap-2 items-center text-xs mt-1"><span>AED · Adult / Child</span><span role="status">{pending?'Saving '+pending+' edit(s)…':'Autosave on blur / Enter'}</span></div></div><div className="flex flex-wrap gap-2 items-center"><Select value={planId||'all'} onValueChange={v=>onPlanChange(v==='all'?'':v)} disabled={locked}><SelectTrigger className="w-52 bg-white text-foreground border-white"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Rate Plans</SelectItem>{plans.map(p=><SelectItem key={p.id} value={p.id}>{p.name}{p.slot?' · '+p.slot:''}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20" disabled={locked||!ticketId} onClick={()=>openBulk()}><Upload className="w-4 h-4 mr-1"/>Bulk Load / Change</Button><Button size="icon" variant="ghost" aria-label="Refresh rate calendar" disabled={locked} onClick={()=>load()}><RefreshCw className="w-4 h-4"/></Button><div className="flex items-center bg-white/10 rounded-lg"><Button size="icon" variant="ghost" aria-label="Previous month" disabled={locked} onClick={()=>setMonth(format(addMonths(parseISO(month+'-01'),-1),'yyyy-MM'))}><ChevronLeft className="w-4 h-4"/></Button><span className="text-sm font-semibold min-w-32 text-center">{format(parseISO(month+'-01'),'MMMM yyyy')}</span><Button size="icon" variant="ghost" aria-label="Next month" disabled={locked} onClick={()=>setMonth(format(addMonths(parseISO(month+'-01'),1),'yyyy-MM'))}><ChevronRight className="w-4 h-4"/></Button></div></div></div>
 {error&&<div role="alert" className="bg-red-50 text-red-700 p-3 text-sm">{error}</div>}
 <div className="overflow-x-auto max-h-[70vh]"><table className="w-full text-xs"><thead className="sticky top-0 z-10 bg-card"><tr className="border-b">{['Date','Rate Plan / Slot','Adult Net','Child Net','Adult Retail','Child Retail','Allocation','Cutoff · h','Status'].map(h=><th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>
 {loading?<tr><td colSpan={9} className="p-12 text-center">Loading calendar…</td></tr>:data?.days.filter(day=>month!==today.slice(0,7)||day.date>=today).map(day=>day.rows.length?day.rows.map((row,index)=><tr key={row.id} className={'border-b '+(day.date===today?'bg-violet-50 border-l-4 border-l-violet-500':'')}>
 <td className="px-4 py-2 whitespace-nowrap"><span className="font-bold">{Number(day.date.slice(-2))}</span> <span className="text-muted-foreground">| {DAYS[new Date(day.date+'T00:00:00Z').getUTCDay()]}</span></td><td className="p-2 min-w-40">{plans.find(p=>p.id===row.planId)?.name||'Existing Rate'}{row.slot?' · '+row.slot:''}</td>
 {(['adult','child','retailAdult','retailChild','allocation','cutoffHours'] as FieldKey[]).map(key=><td key={key} className="px-3 py-2"><Cell key={row.id+key} label={day.date+' '+key+' '+(row.slot||'Open')} value={key==='allocation'?row.baseAllocation:row[key]} integer={key==='allocation'||key==='cutoffHours'} onSave={v=>save(row,key,v)}/></td>)}
 <td className="px-3 py-2 whitespace-nowrap">{row.blocked?'Blackout / Period Stop':row.stopSale?'Stop Sale':row.status==='On Request'?'On Request':row.sellable===0?'Sold Out':day.status}</td></tr>):<tr key={day.date} className="border-b bg-muted/10"><td className="px-4 py-3 whitespace-nowrap">{Number(day.date.slice(-2))} | {DAYS[new Date(day.date+'T00:00:00Z').getUTCDay()]}</td><td colSpan={7} className="p-3 text-muted-foreground">{day.status==='Stop Sale'?'Blackout':'No daily rates'}</td><td className="p-2"><Button size="sm" variant="outline" disabled={!ticketId||locked} onClick={()=>openBulk(day.date)}>Load Rates</Button></td></tr>)}
 {!ticketId&&<tr><td colSpan={9} className="p-10 text-center">Select a ticket product</td></tr>}</tbody></table></div>
 <Dialog open={bulk} onOpenChange={v=>{if(!bulkBusy)setBulk(v);}}><DialogContent aria-describedby={undefined} className="max-w-xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Bulk Rate Loader — {ticketName}</DialogTitle></DialogHeader><div className="space-y-4">
 <Field label="Rate Plan"><Select value={bulkPlanId} onValueChange={setBulkPlanId} disabled={bulkBusy||!plans.length}><SelectTrigger><SelectValue placeholder="Select rate plan"/></SelectTrigger><SelectContent>{plans.map(p=><SelectItem key={p.id} value={p.id}>{p.name}{p.slot?' · '+p.slot:''}</SelectItem>)}</SelectContent></Select></Field>
 {!plans.length&&<div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between gap-3"><span className="text-sm">Create a rate plan to load daily rates.</span><Button onClick={()=>{setBulk(false);onCreatePlan();}}>Create Rate Plan</Button></div>}
 <Field label="Action"><Select value={form.mode} onValueChange={v=>setForm({...form,mode:v,allocation:v==='change'?'':'10',cutoff:v==='change'?'':'4'})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="load">Load / Replace Daily Rates</SelectItem><SelectItem value="change">Change Existing Rates</SelectItem></SelectContent></Select></Field>
 <div className="grid grid-cols-2 gap-3"><Field label="From Date"><DatePickerInput value={form.start} onChange={start=>setForm({...form,start})}/></Field><Field label="To Date"><DatePickerInput value={form.end} onChange={end=>setForm({...form,end})}/></Field></div>
 {form.mode==='change'&&<div className="grid grid-cols-2 gap-3"><Field label="Uplift / Adjustment"><Select value={form.operation} onValueChange={v=>setForm({...form,operation:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="set">Set Rates</SelectItem><SelectItem value="percent">Percentage</SelectItem><SelectItem value="amount">Fixed AED Amount</SelectItem></SelectContent></Select></Field>{form.operation!=='set'&&<Field label={form.operation==='percent'?'Adjustment · %':'Adjustment · AED'}><Input type="number" step="0.01" value={form.adjustment} onChange={e=>setForm({...form,adjustment:e.target.value})}/></Field>}</div>}
 {(form.mode==='load'||form.operation==='set')&&<div className="grid grid-cols-2 gap-3">{([['adult','Adult Net · AED'],['child','Child Net · AED'],['retailAdult','Adult Retail · AED'],['retailChild','Child Retail · AED']] as const).map(([key,label])=><Field key={key} label={label}><Input type="number" min="0" step="0.01" placeholder={form.mode==='change'?'Keep current':'0'} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></Field>)}</div>}
 <div className="grid grid-cols-2 gap-3"><Field label="Allocation / Day"><Input type="number" min="0" value={form.allocation} onChange={e=>setForm({...form,allocation:e.target.value})} placeholder="Keep current"/></Field><Field label="Cutoff · Hours"><Input type="number" min="0" value={form.cutoff} onChange={e=>setForm({...form,cutoff:e.target.value})} placeholder="Keep current"/></Field></div>
 {form.mode==='load'&&<><Field label="Inventory Status"><Select value={form.status} onValueChange={v=>setForm({...form,status:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Available">Free Sale</SelectItem><SelectItem value="On Request">On Request</SelectItem></SelectContent></Select></Field><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.overwrite} onChange={e=>setForm({...form,overwrite:e.target.checked})}/>Replace existing BASE tier rows</label></>}
 <Field label="Apply to Days"><div className="grid grid-cols-7 gap-1">{DAYS.map((d,i)=><button key={d} type="button" aria-pressed={form.weekdays.includes(i)} className={'border rounded-md py-2 text-xs '+(form.weekdays.includes(i)?'bg-primary text-primary-foreground':'')} onClick={()=>setForm(f=>({...f,weekdays:f.weekdays.includes(i)?f.weekdays.filter(n=>n!==i):[...f.weekdays,i]}))}>{d}</button>)}</div></Field>
 <div className="flex justify-end gap-2"><Button variant="outline" disabled={bulkBusy} onClick={()=>setBulk(false)}>Cancel</Button><Button disabled={bulkBusy||!bulkPlanId} onClick={runBulk}><Upload className="w-4 h-4 mr-1"/>{bulkBusy?'Applying…':'Apply Bulk Rates'}</Button></div></div></DialogContent></Dialog>
 </section>;
}
