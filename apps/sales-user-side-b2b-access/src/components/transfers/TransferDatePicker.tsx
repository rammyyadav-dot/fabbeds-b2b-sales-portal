import {useEffect,useState} from 'react';
import {addDays,format,parseISO,startOfDay} from 'date-fns';
import {CalendarDays,ChevronDown} from 'lucide-react';
import {Calendar} from '@project/components/ui/calendar';
import {Popover,PopoverContent,PopoverTrigger} from '@project/components/ui/popover';
import {Button} from '@project/components/ui/button';

export default function TransferDatePicker({value,onChange}:{value:string;onChange:(date:string)=>void}){
 const [open,setOpen]=useState(false),[wide,setWide]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(min-width: 640px)');const update=()=>setWide(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const today=startOfDay(new Date()),selected=value?parseISO(value):undefined;
 const pick=(date:Date|undefined)=>{if(!date||date<today)return;onChange(format(date,'yyyy-MM-dd'));setOpen(false);};
 return <Popover open={open} onOpenChange={setOpen}>
 <PopoverTrigger asChild><Button type="button" variant="outline" aria-label="Select transfer pickup date" className="mt-1 h-11 w-full rounded-lg bg-white shadow-none border-border/60 justify-start px-3 font-normal gap-2">
 <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0"/><span className="flex-1 text-left truncate">{selected?format(selected,'EEE, dd MMM yyyy'):'Select pickup date'}</span><ChevronDown className={'w-3.5 h-3.5 text-muted-foreground transition-transform '+(open?'rotate-180':'')}/>
 </Button></PopoverTrigger>
 <PopoverContent align="start" sideOffset={8} collisionPadding={12} className="w-auto max-w-[calc(100vw-24px)] p-0 rounded-2xl border border-border shadow-2xl overflow-auto">
 <div className="px-4 py-3 border-b flex items-center justify-between gap-4"><span className="text-sm font-bold">Pickup date</span><span className="text-xs text-muted-foreground">{selected?format(selected,'dd MMM yyyy'):'Choose a date'}</span></div>
 <div className="flex gap-2 px-4 pt-3">{[['Today',0],['Tomorrow',1],['In 7 days',7]].map(([label,offset])=><Button key={label} type="button" size="sm" variant="outline" className="rounded-full h-7 text-xs font-medium" onClick={()=>pick(addDays(today,Number(offset)))}>{label}</Button>)}</div>
 <Calendar mode="single" selected={selected} onSelect={pick} defaultMonth={selected&&selected>=today?selected:today} numberOfMonths={wide?2:1} weekStartsOn={1} fromMonth={today} showOutsideDays={false} disabled={{before:today}} initialFocus className="p-4" classNames={{day:"h-9 w-9 p-0 font-normal rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary aria-selected:opacity-100",head_cell:"text-muted-foreground w-9 font-medium text-xs",day_today:"ring-1 ring-primary text-primary",day_selected:"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",day_disabled:"text-muted-foreground opacity-30"}}/>
 <div className="border-t px-4 py-3 flex items-center justify-between gap-3 bg-muted/20"><span className="text-xs text-muted-foreground">Select a date to apply</span><Button type="button" variant="ghost" size="sm" onClick={()=>setOpen(false)}>Close</Button></div>
 </PopoverContent></Popover>;
}
