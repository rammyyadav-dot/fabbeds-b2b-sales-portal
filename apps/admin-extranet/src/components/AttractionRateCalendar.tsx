import {toast} from 'sonner';
import { useEffect, useMemo, useState } from 'react';
import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import { getAttractionRateCalendar, type GetAttractionRateCalendarOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, CheckCircle2, CircleDollarSign } from 'lucide-react';

type Data=GetAttractionRateCalendarOutputType;
type Day=Data['days'][number];

function statusClass(status:Day['status']){
  if(status==='Available') return 'border-emerald-200 bg-emerald-50';
  if(status==='Limited') return 'border-amber-300 bg-amber-50';
  if(status==='Sold Out') return 'border-slate-300 bg-slate-100';
  if(status==='Stop Sale') return 'border-red-300 bg-red-50';
  if(status==='On Request') return 'border-blue-300 bg-blue-50';
  if(status==='Closed') return 'border-zinc-300 bg-zinc-100';
  return 'border-dashed border-orange-300 bg-orange-50/50';
}
function statusBadge(status:Day['status']){
  if(status==='Available') return 'bg-emerald-600';
  if(status==='Limited') return 'bg-amber-600';
  if(status==='Sold Out'||status==='Closed') return 'bg-slate-600';
  if(status==='Stop Sale') return 'bg-red-600';
  if(status==='On Request') return 'bg-blue-600';
  return 'bg-orange-600';
}

export default function AttractionRateCalendar({
  ticketOptionId,
  ratePlanId,
  mode='rates',
  onPickDate,
}:{
  ticketOptionId:string;
  ratePlanId?:string;
  mode?:'rates'|'availability';
  onPickDate?:(date:string)=>void;
}){
  const [month,setMonth]=useState(format(new Date(),'yyyy-MM'));
  const [data,setData]=useState<Data|null>(null);
  const [loading,setLoading]=useState(false);
  const [selectedDate,setSelectedDate]=useState<string>('');

  useEffect(()=>{
    let cancelled=false;
    setSelectedDate('');
    if(!ticketOptionId){setData(null);setLoading(false);return;}
    setLoading(true);
    getAttractionRateCalendar({ticketOptionId,month,ratePlanId})
      .then(result=>{if(!cancelled)setData(result);})
      .catch(err=>{if(!cancelled){setData(null);toast.error(err?.message||'Could not load calendar');}})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[ticketOptionId,month,ratePlanId]);

  const firstDayOffset=useMemo(()=>{
    const d=startOfMonth(parseISO(month+'-01'));
    return (d.getDay()+6)%7;
  },[month]);

  const selected=useMemo(()=>data?.days.find(d=>d.date===selectedDate)||null,[data,selectedDate]);

  if(!ticketOptionId){
    return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Select an active SKU to open the monthly tariff & allocation calendar.</div>;
  }

  return <div className="space-y-4">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary"/><h3 className="font-bold">{mode==='availability'?'Availability Calendar':'Rate Calendar'}</h3></div>
        {data&&<p className="text-xs text-muted-foreground mt-1">{data.ticket.skuCode} · {data.ticket.name} · {data.ticket.ticketType}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={()=>setMonth(format(addMonths(parseISO(month+'-01'),-1),'yyyy-MM'))}><ChevronLeft className="w-4 h-4"/></Button>
        <div className="min-w-[150px] text-center font-black">{format(parseISO(month+'-01'),'MMMM yyyy')}</div>
        <Button variant="outline" size="icon" onClick={()=>setMonth(format(addMonths(parseISO(month+'-01'),1),'yyyy-MM'))}><ChevronRight className="w-4 h-4"/></Button>
        <Button variant="outline" onClick={()=>setMonth(format(new Date(),'yyyy-MM'))}>Today</Button>
      </div>
    </div>

    {loading?<Skeleton className="h-[520px] w-full rounded-xl"/>:data&&<>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          ['Coverage',data.coverage.coveragePct+'%'],
          ['Rated days',data.coverage.ratedDays],
          ['Available',data.coverage.availableDays],
          ['Missing',data.coverage.missingDays],
          ['Stop sale',data.coverage.stopSaleDays],
          ['Sold out',data.coverage.soldOutDays],
        ].map(([label,value])=><div key={String(label)} className="rounded-lg border bg-card p-3"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className="text-lg font-black mt-1">{value}</p></div>)}
      </div>

      <div className="grid grid-cols-7 gap-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} className="px-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({length:firstDayOffset}).map((_,i)=><div key={'blank-'+i}/>)}
        {data.days.map(day=>{
          const active=selectedDate===day.date;
          return <button key={day.date} type="button" onClick={()=>{setSelectedDate(day.date);onPickDate?.(day.date);}}
            className={`min-h-[130px] text-left rounded-lg border p-2 transition-all hover:shadow-md ${statusClass(day.status)} ${active?'ring-2 ring-primary':''}`}>
            <div className="flex items-start justify-between gap-1">
              <span className="font-black text-sm">{Number(day.date.slice(-2))}</span>
              <span className={`text-[8px] text-white rounded px-1.5 py-0.5 ${statusBadge(day.status)}`}>{day.status}</span>
            </div>
            <div className="mt-3 space-y-1 text-[10px]">
              {mode==='rates'&&(day.minAdult!=null?<p><span className="text-muted-foreground">Adult</span> <strong>AED {day.minAdult.toFixed(2)}</strong></p>:<p className="text-orange-700 font-semibold">No active rate</p>)}
              {mode==='rates'&&day.minChild!=null&&<p><span className="text-muted-foreground">Child</span> <strong>AED {day.minChild.toFixed(2)}</strong></p>}
              {day.slotCount>1&&<p>{day.slotCount} slots</p>}
              <p><span className="text-muted-foreground">Sellable</span> <strong>{day.sellable==null?'Open':day.sellable}</strong></p>
              {(day.held>0||day.sold>0)&&<p className="text-muted-foreground">Sold {day.sold} · Held {day.held}</p>}
            </div>
          </button>;
        })}
      </div>

      {selected&&<section className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3">
          <div><h4 className="font-bold">{format(parseISO(selected.date),'dd MMMM yyyy')}</h4><p className="text-xs text-muted-foreground mt-1">{selected.rows.length} rate row(s) · effective sellable {selected.sellable==null?'Open':selected.sellable}</p></div>
          <Badge>{selected.status}</Badge>
        </div>
        {selected.rows.length===0?<div className="p-5 flex items-start gap-2 text-sm text-orange-800 bg-orange-50"><AlertTriangle className="w-4 h-4 mt-0.5"/><span>No rate row exists for this date. Use the Date Slab Loader to create one.</span></div>:
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-muted/30 border-b">{(mode==='availability'?['Slot','Layer','Allocation','Sold','Held','Sellable','Status','Cutoff']:['Slot','Layer','Adult','Child','Allocation','Sold','Held','Sellable','Status','Cutoff']).map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead><tbody>
          {selected.rows.map(r=><tr key={r.id} className="border-b">
            <td className="px-3 py-2 font-semibold">{r.slot||'Open date'}</td>
            <td className="px-3 py-2"><Badge variant="outline">{r.rateLayer} · {r.priority}</Badge></td>
            {mode==='rates'&&<><td className="px-3 py-2">AED {r.adult.toFixed(2)}</td>
            <td className="px-3 py-2">AED {r.child.toFixed(2)}</td></>}
            <td className="px-3 py-2">{r.allocation||'Open'}</td>
            <td className="px-3 py-2">{r.sold}</td><td className="px-3 py-2">{r.held}</td>
            <td className="px-3 py-2 font-black">{r.sellable==null?'Open':r.sellable}</td>
            <td className="px-3 py-2">{r.stopSale?<Badge variant="destructive">Stop Sale</Badge>:<Badge variant="outline">{r.status}</Badge>}</td>
            <td className="px-3 py-2">{r.cutoffHours}h</td>
          </tr>)}
        </tbody></table></div>}
      </section>}

      <div className="rounded-xl border bg-muted/20 p-4 flex items-start gap-3 text-xs">
        <CircleDollarSign className="w-4 h-4 mt-0.5 text-primary"/>
        <div><p className="font-semibold">Calendar rule</p><p className="text-muted-foreground mt-1">Sellable = Allocation − Confirmed Sold − Active Checkout Holds. Stop Sale, cutoff-expired and rate-missing dates fail closed in agent availability.</p></div>
      </div>
    </>}
  </div>;
}
