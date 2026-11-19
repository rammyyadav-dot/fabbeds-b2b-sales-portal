import {useEffect,useRef,useState} from 'react';
import {format,parseISO,differenceInCalendarDays} from 'date-fns';
import {Calendar} from '@project/components/ui/calendar';
import {Popover,PopoverTrigger,PopoverContent} from '@project/components/ui/popover';
import {toast} from 'sonner';
import {getAttractionAvailabilityGrid,saveAttractionAvailability,type GetAttractionAvailabilityGridOutputType} from 'zitejs/api';
import {Button} from '@project/components/ui/button';
import {Input} from '@project/components/ui/input';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@project/components/ui/select';
import {CalendarDays,ChevronLeft,ChevronRight,PaintBucket,Check,X,HelpCircle,AlertTriangle,RefreshCw} from 'lucide-react';
import AvailabilityPaintToolbar,{type PaintStatus} from './AvailabilityPaintToolbar';
import {periodDates} from '../lib/attractionCommercialRules';
type Grid=GetAttractionAvailabilityGridOutputType;
type Cell=Grid['tickets'][number]['cells'][number];
type Change={ticketId:string;date:string;status:Exclude<PaintStatus,null>;allocation?:number;revision:string};
const colors:Record<string,string>={'Free Sale':'bg-green-500 text-white','Stop Sale':'bg-red-500 text-white','On Request':'bg-yellow-400 text-slate-900','Limited':'bg-orange-500 text-white','Sold Out':'bg-slate-500 text-white','Closed':'bg-slate-300 text-slate-700','Rate Missing':'bg-slate-100 text-slate-400 border border-dashed'};
const symbols:Record<string,React.ReactNode>={'Free Sale':<Check className="w-4 h-4"/>,'Stop Sale':<X className="w-4 h-4"/>,'On Request':<HelpCircle className="w-4 h-4"/>,'Limited':<AlertTriangle className="w-4 h-4"/>};
const today=()=>format(new Date(),'yyyy-MM-dd');
const shift=(date:string,amount:number)=>new Date(Date.parse(date)+amount*86400000).toISOString().slice(0,10);
export default function AttractionAvailabilityPaint({attractionId,onSaved,onDirtyChange}:{attractionId:string;onSaved:()=>void;onDirtyChange?:(dirty:boolean)=>void}){
 const [start,setStart]=useState(today()),[days,setDays]=useState(28),[data,setData]=useState<Grid|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[paint,setPaint]=useState<PaintStatus>(null),[limited,setLimited]=useState('10'),[type,setType]=useState('all'),[selected,setSelected]=useState<Set<string>>(new Set()),[pickerOpen,setPickerOpen]=useState(false),[range,setRange]=useState({from:today(),to:shift(today(),27)}),[staged,setStaged]=useState<Record<string,Change>>({}),[undo,setUndo]=useState<Record<string,Change>[]>([]),[error,setError]=useState(''),[cellErrors,setCellErrors]=useState<Record<string,string>>({});
 const painting=useRef(false),stagedRef=useRef(staged),active=useRef(true);
 useEffect(()=>{active.current=true;const stop=()=>{painting.current=false;};window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);window.addEventListener('blur',stop);return()=>{active.current=false;window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('blur',stop);};},[]);
 useEffect(()=>{stagedRef.current=staged;},[staged]);
 const hasChanges=Object.keys(staged).length>0;
 useEffect(()=>{onDirtyChange?.(hasChanges||saving);return()=>onDirtyChange?.(false);},[hasChanges,saving]);
 const reload=async()=>{setLoading(true);try{const d=await getAttractionAvailabilityGrid({attractionId,start,days});if(active.current)setData(d);}catch(e:any){if(active.current)setError(e.message);}finally{if(active.current)setLoading(false);}};
 useEffect(()=>{let cancelled=false;setLoading(true);getAttractionAvailabilityGrid({attractionId,start,days}).then(d=>{if(!cancelled){setData(d);setSelected(new Set(d.tickets.map(t=>t.id)));setError('');}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[attractionId,start,days]);
 const visible=data?.tickets.filter(t=>type==='all'||t.type===type)||[];
 const update=(next:Record<string,Change>)=>{stagedRef.current=next;setStaged(next);};
 const changeFor=(ticketId:string,cell:Cell):Change|null=>{
 if(!paint||cell.blocked)return null;
 if(paint==='Limited'&&(!Number.isInteger(Number(limited))||Number(limited)<1)){toast.error('Enter a positive Limited allocation.');return null;}
 return{ticketId,date:cell.date,status:paint,allocation:paint==='Limited'?Number(limited):undefined,revision:cell.revision};
 };
 const paintCell=(ticketId:string,cell:Cell)=>{if(saving||loading)return;const change=changeFor(ticketId,cell);if(change){const key=ticketId+'|'+cell.date;update({...stagedRef.current,[key]:change});setCellErrors(e=>{const next={...e};delete next[key];return next;});}};
 const begin=(ticketId:string,cell:Cell)=>{if(!paint||cell.blocked||saving||loading)return;setUndo(u=>[...u.slice(-49),{...stagedRef.current}]);painting.current=true;paintCell(ticketId,cell);};
 const fill=async()=>{
 if(!paint)return toast.error('Select a paint mode.');
 if(!selected.size)return toast.error('Select at least one SKU.');
 let dates:string[];try{dates=periodDates(range.from,range.to,[0,1,2,3,4,5,6]);}catch(e:any){return toast.error(e.message);}
 setLoading(true);
 try{
 const next={...stagedRef.current};let applied=0,blocked=0;
 for(let offset=0;offset<dates.length;offset+=60){
 const grid=await getAttractionAvailabilityGrid({attractionId,start:dates[offset],days:Math.max(7,Math.min(60,dates.length-offset))});
 for(const t of grid.tickets.filter(t=>selected.has(t.id)&&(type==='all'||t.type===type))){
 for(const cell of t.cells.filter(c=>dates.includes(c.date))){
 if(cell.blocked){blocked++;continue;}
 const c=changeFor(t.id,cell);if(c){next[t.id+'|'+cell.date]=c;applied++;}
 }}
 }
 setUndo(u=>[...u.slice(-49),{...stagedRef.current}]);update(next);toast.success(applied+' cells staged'+(blocked?' · '+blocked+' locked cells skipped':''));
 }catch(e:any){setError(e.message);}finally{setLoading(false);}
 };
 const save=async()=>{
 const changes=Object.values(stagedRef.current);if(!changes.length)return;
 setSaving(true);setError('');let savedCount=0;const errors:Record<string,string>={},remaining={...stagedRef.current};
 try{
 for(let offset=0;offset<changes.length;offset+=1000){
 const result=await saveAttractionAvailability({attractionId,changes:changes.slice(offset,offset+1000)});
 for(const c of result.saved){delete remaining[c.ticketId+'|'+c.date];savedCount++;}
 for(const c of result.failed)errors[c.ticketId+'|'+c.date]=c.message;
 }
 update(remaining);setCellErrors(errors);setUndo([]);await reload();onSaved();
 if(Object.keys(errors).length){setError(Object.values(errors).join('; '));toast.error(savedCount+' saved · '+Object.keys(errors).length+' failed');}else toast.success(savedCount+' availability cells saved');
 }catch(e:any){update(remaining);setError(e.message||'Save interrupted. Saved cells can be reloaded with Reset All.');await reload();}
 finally{setSaving(false);}
 };
 const reset=()=>{update({});setUndo([]);setCellErrors({});setError('');reload();};
 const locked=loading||saving;
 return <section className="space-y-4">
 <h2 className="text-xl font-bold flex gap-2 items-center"><CalendarDays className="w-5 h-5 text-primary"/>Attraction Availability Calendar</h2>
 <div className={'border rounded-xl p-4 '+(locked?'pointer-events-none opacity-60':'')}><AvailabilityPaintToolbar paintMode={paint} onPaintMode={setPaint} onUndo={()=>{if(!undo.length)return;update(undo[undo.length-1]);setUndo(u=>u.slice(0,-1));}} onReset={reset} onSave={save} saving={saving} hasChanges={hasChanges}/><div className="flex flex-wrap items-end gap-3 mt-3"><Field label="SKU Type"><Select value={type} onValueChange={setType}><SelectTrigger className="w-44"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All SKU Types</SelectItem>{['Open Date','Timed Slot','Flexi Pass'].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></Field>{paint==='Limited'&&<Field label="Limited Allocation / Plan / Slot"><Input type="number" min="1" className="w-36" value={limited} onChange={e=>setLimited(e.target.value)}/></Field>}<span role="status" className="text-xs text-muted-foreground">{Object.keys(staged).length} unsaved cells</span></div></div>
 <div className="rounded-xl border-2 border-primary/20 bg-card overflow-hidden shadow-sm">
 <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 text-xs font-bold text-primary uppercase tracking-wider">Date Range Filter & Bulk Apply</div>
 <div className="p-3 flex flex-col sm:flex-row items-stretch gap-3">
 <Popover open={pickerOpen} onOpenChange={setPickerOpen}><PopoverTrigger asChild>
 <button type="button" aria-label="Select availability date range" disabled={locked} className="flex-1 flex items-stretch border-2 border-border rounded-lg text-left hover:border-primary/40 bg-background">
 <span className="flex-1 px-4 py-2.5 border-r border-border"><span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest">From Date</span><span className="block text-sm font-bold mt-0.5">{range.from?format(parseISO(range.from),'EEE, dd MMM yyyy'):'Select date'}</span></span>
 <span className="flex items-center px-2 text-muted-foreground">→</span>
 <span className="flex-1 px-4 py-2.5"><span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest">To Date</span><span className="block text-sm font-bold mt-0.5">{range.to?format(parseISO(range.to),'EEE, dd MMM yyyy'):'Select date'}</span></span>
 </button></PopoverTrigger>
 <PopoverContent className="w-auto p-0 max-w-[95vw] overflow-auto" align="start" sideOffset={4}>
 <Calendar mode="range" selected={range.from?{from:parseISO(range.from),to:range.to?parseISO(range.to):undefined}:undefined} onSelect={r=>setRange({from:r?.from?format(r.from,'yyyy-MM-dd'):'',to:r?.to?format(r.to,'yyyy-MM-dd'):''})} numberOfMonths={2} defaultMonth={parseISO(start)} className="rounded-t-lg"/>
 <div className="p-3 border-t bg-muted/30 flex justify-between gap-2"><span className="text-xs self-center">{range.from&&range.to?differenceInCalendarDays(parseISO(range.to),parseISO(range.from))+1+' days':'Select start and end dates'}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setRange({from:'',to:''})}>Clear</Button><Button size="sm" disabled={!range.from||!range.to||hasChanges||locked} onClick={()=>{const count=differenceInCalendarDays(parseISO(range.to),parseISO(range.from))+1;if(count<1||count>60){toast.error('Select 1–60 days to view. Fill Range supports up to 366 days.');return;}setStart(range.from);setDays(Math.max(7,count));setPickerOpen(false);}}>View Range</Button></div></div>
 </PopoverContent></Popover>
 <Button variant={paint?'default':'outline'} disabled={locked||!paint||!range.from||!range.to} onClick={fill}><PaintBucket className="w-4 h-4 mr-2"/>Fill Range</Button>
 </div></div>
 <div className="flex flex-wrap items-center justify-between gap-3 border rounded-xl p-3"><div className="flex gap-2 items-center"><Button size="icon" variant="outline" aria-label="Previous dates" disabled={locked||hasChanges} onClick={()=>setStart(s=>shift(s,-days))}><ChevronLeft className="w-4 h-4"/></Button><Button variant="outline" disabled={locked||hasChanges} onClick={()=>setStart(today())}>Today</Button><Button size="icon" variant="outline" aria-label="Next dates" disabled={locked||hasChanges} onClick={()=>setStart(s=>shift(s,days))}><ChevronRight className="w-4 h-4"/></Button><Select value={String(days)} onValueChange={v=>setDays(Number(v))} disabled={locked||hasChanges}><SelectTrigger className="w-32"><SelectValue/></SelectTrigger><SelectContent>{[...new Set([7,14,28,60,days])].sort((a,b)=>a-b).map(n=><SelectItem key={n} value={String(n)}>{n} Days</SelectItem>)}</SelectContent></Select><Button size="icon" variant="outline" aria-label="Refresh saved availability" disabled={locked||hasChanges} onClick={reload}><RefreshCw className="w-4 h-4"/></Button></div><span className="text-sm text-muted-foreground">{start} — {shift(start,days-1)}</span></div>
 <div className="flex flex-wrap gap-4 items-center border rounded-xl px-4 py-3 text-xs">{['Free Sale','Stop Sale','On Request','Limited','Rate Missing'].map(s=><span key={s} className="flex gap-2 items-center"><span className={'rounded p-1 '+colors[s]}>{symbols[s]||'—'}</span>{s}</span>)}</div>
 {error&&<div role="alert" className="border border-red-200 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
 <div className="border rounded-xl overflow-auto max-h-[65vh]"><table className="text-xs border-collapse w-full select-none"><thead className="sticky top-0 z-20 bg-card"><tr><th className="sticky left-0 z-30 bg-card border-b border-r min-w-56 p-3 text-left"><label className="flex gap-2 items-center"><input type="checkbox" aria-label="Select all visible SKUs" checked={!!visible.length&&visible.every(t=>selected.has(t.id))} onChange={e=>setSelected(prev=>{const n=new Set(prev);visible.forEach(t=>e.target.checked?n.add(t.id):n.delete(t.id));return n;})}/>Attraction SKU</label></th>{data?.dates.map(date=><th key={date} className="border-b px-1 py-2 min-w-12"><div className="font-normal text-muted-foreground">{new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'})}</div><div className="font-bold text-sm mt-1">{Number(date.slice(-2))}</div><div className="font-normal text-muted-foreground">{new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})}</div></th>)}</tr></thead><tbody>
 {loading?<tr><td colSpan={days+1} className="p-10 text-center">Loading SKU availability…</td></tr>:visible.map(t=><tr key={t.id}><th className="sticky left-0 z-10 bg-card border-b border-r p-3 text-left"><label className="flex gap-2 items-start"><input aria-label={'Select '+t.name} type="checkbox" checked={selected.has(t.id)} onChange={e=>setSelected(prev=>{const n=new Set(prev);e.target.checked?n.add(t.id):n.delete(t.id);return n;})}/><span><span className="font-bold">{t.name}</span><span className="block font-normal text-muted-foreground mt-1">{t.sku} · {t.type}</span></span></label></th>{t.cells.map(cell=>{const key=t.id+'|'+cell.date,c=staged[key],status=c?.status||cell.status;return <td key={cell.date} className="border-b p-1"><button type="button" aria-label={t.sku+' '+cell.date+' '+status+(c?' unsaved':'')} title={cellErrors[key]||[status,cell.blocked?'Locked by blackout / period stop':'',cell.rateCount===0?'No published rates':cell.rateCount+' rates',cell.remaining===null?'On Request':cell.remaining+' remaining',c?'Unsaved':''].filter(Boolean).join(' · ')} disabled={cell.blocked||locked} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();begin(t.id,cell);}} onPointerEnter={e=>{if(painting.current&&e.buttons===1)paintCell(t.id,cell);}} onClick={e=>{if(e.detail===0){begin(t.id,cell);painting.current=false;}}} className={'w-10 h-10 rounded-lg flex items-center justify-center '+(colors[status]||colors['Closed'])+' '+(paint?'cursor-crosshair':'cursor-default')+' '+(c?'ring-2 ring-violet-500 ring-offset-1':'')+' '+(cellErrors[key]?'outline outline-2 outline-red-700':'')+' disabled:opacity-60'}>{symbols[status]||'—'}</button></td>;})}</tr>)}
 {!loading&&!visible.length&&<tr><td colSpan={days+1} className="p-10 text-center text-muted-foreground">No matching attraction SKUs</td></tr>}</tbody></table></div>
 </section>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>;}
