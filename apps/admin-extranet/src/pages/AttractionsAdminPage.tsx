import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  getAttractionAdminOverview,
  saveAttractionMaster,
  saveAttractionTicketOption,
  bulkLoadAttractionRates,
  saveAttractionPackage,
  updateAttractionReservation,
  getUaeAttractionProductLibrary,
  loadAttractionStockImages,
  type GetAttractionAdminOverviewOutputType,
  type GetUaeAttractionProductLibraryOutputType,
} from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Checkbox } from '@project/components/ui/checkbox';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import {
  Ticket, CalendarDays, ClipboardList, Plus, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, ExternalLink, Copy, Clock3, CheckCircle2, Search, Images, Globe2, Percent,
} from 'lucide-react';
import AttractionProfileWorkspace from '../components/AttractionProfileWorkspace';
import AttractionCommercialWorkspace from '../components/AttractionCommercialWorkspace';
import AttractionRatesQuickUpdate from '../components/AttractionRatesQuickUpdate';
import AttractionMarkupWorkspace from '../components/AttractionMarkupWorkspace';

type Data = GetAttractionAdminOverviewOutputType;
type LibraryData = GetUaeAttractionProductLibraryOutputType;
type LibraryProduct = LibraryData['products'][number];
type View = 'attractions'|'rates'|'reservations'|'markup';

const CITIES=['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','UAQ City'];
const CATEGORIES=['Theme Parks','Water Parks','Observation Decks','Museums','Tours','Desert Safari','Dinner Cruise','Sports & Adventure','Entertainment','Aquarium','Cruise','Aerial Tour','City Tour','Cultural','Outdoor'];
const DISPLAY_GROUPS=['Admission','Fast Track','Combo','Meal','VIP','Family','Experiences'];
const WEEKDAYS=[['Sun',0],['Mon',1],['Tue',2],['Wed',3],['Thu',4],['Fri',5],['Sat',6]] as const;

function fmtDate(v:string){
  if(!v)return '—';
  return new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}

function emirateFromCity(city:string){
  if(/abu dhabi|yas|saadiyat|al ain|corniche|al wathba/i.test(city))return 'Abu Dhabi';
  if(/sharjah|khor fakkan|kalba|mleiha|al dhaid/i.test(city))return 'Sharjah';
  if(/ras al khaimah|jebel jais|al marjan|al hamra|rak|dhayah/i.test(city))return 'Ras Al Khaimah';
  if(/fujairah|dibba|masafi|wadi wurayah|sandy beach/i.test(city))return 'Fujairah';
  if(/ajman|al zorah|manama/i.test(city))return 'Ajman';
  if(/umm al quwain|uaq/i.test(city))return 'Umm Al Quwain';
  return 'Dubai';
}

function productImage(key:string,category:string,emirate:string){
  const exact:Record<string,string>={
    'burj-khalifa':'/attraction-images/burj-khalifa.jpg',
    'museum-future':'/attraction-images/museum-future.jpg',
    'dubai-frame':'/attraction-images/dubai-frame.jpg',
    'aquaventure':'/attraction-images/aquaventure.jpg',
    'ferrari-world':'/attraction-images/ferrari-world.jpg',
    'warner-bros-world':'/attraction-images/warner-bros-world.jpg',
    'seaworld-abu-dhabi':'/attraction-images/seaworld-abu-dhabi.jpg',
    'yas-waterworld':'/attraction-images/yas-waterworld.jpg',
    'qasr-al-watan':'/attraction-images/qasr-al-watan.jpg',
    'grand-mosque':'/attraction-images/grand-mosque.jpg',
    'ras-al-khaimah':'/attraction-images/ras-al-khaimah.jpg',
  };
  if(exact[key])return exact[key];
  if(/water|aquarium|diving|marine/i.test(category))return '/attraction-images/aquaventure.jpg';
  if(/theme|entertainment|kids/i.test(category))return emirate==='Abu Dhabi'?'/attraction-images/ferrari-world.jpg':'/attraction-images/burj-khalifa.jpg';
  if(/museum|heritage|cultural|palace|art/i.test(category))return emirate==='Abu Dhabi'?'/attraction-images/qasr-al-watan.jpg':'/attraction-images/dubai-frame.jpg';
  if(emirate==='Ras Al Khaimah')return '/attraction-images/ras-al-khaimah.jpg';
  if(emirate==='Abu Dhabi')return '/attraction-images/qasr-al-watan.jpg';
  return '/attraction-images/burj-khalifa.jpg';
}

function Field({label,children}:{label:string;children:React.ReactNode}){
  return <div><Label className="text-xs text-muted-foreground">{label}</Label><div className="mt-1.5">{children}</div></div>;
}

export default function AttractionsAdminPage(){
  const [directoryQuery,setDirectoryQuery]=useState('');
  const [selectedAttractionId,setSelectedAttractionId]=useState('');
  const [data,setData]=useState<Data|null>(null);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState<View>('attractions');
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [wizardOpen,setWizardOpen]=useState(false);
  const [wizardStep,setWizardStep]=useState<1|2|3|4>(1);
  const [wizardAttractionId,setWizardAttractionId]=useState('');
  const [wizardTicketId,setWizardTicketId]=useState('');
  const [dailyCalendarOpen,setDailyCalendarOpen]=useState(false);
  const [rateMode,setRateMode]=useState<'periods'|'missing'|'expiring'|'stop'>('periods');
  const [libraryOpen,setLibraryOpen]=useState(false);
  const [library,setLibrary]=useState<LibraryProduct[]>([]);
  const [libraryLoading,setLibraryLoading]=useState(false);
  const [imagesLoading,setImagesLoading]=useState(false);
  const loadStockImages=async()=>{
    setImagesLoading(true);
    try{
      const res=await loadAttractionStockImages({limit:40});
      toast.success(`Loaded ${res.loaded.length} cover image(s) · ${res.remainingWithoutImage} attraction(s) still without an image`+(res.skipped.some(s=>s.reason.includes('limit'))?' · Unsplash hourly limit reached, run again later':''));
      await load();
    }catch(e:any){toast.error(e?.message||'Could not load images');}
    finally{setImagesLoading(false);}
  };
  const [librarySearch,setLibrarySearch]=useState('');
  const [libraryEmirate,setLibraryEmirate]=useState('all');

  const [attr,setAttr]=useState({
    title:'',slug:'',city:'Dubai',category:'Theme Parks',shortDescription:'',description:'',
    cancellationPolicy:'Free Cancellation',instantConfirmation:false,address:'',status:'Draft'
  });

  const [sku,setSku]=useState({
    attractionId:'',name:'',skuCode:'',displayGroup:'Admission',ticketType:'Open Date',requiresSlot:false,minPax:'1',maxPax:'10',
    inclusions:'',highlights:'',status:'Active',instantConfirmationEligible:false,adultAgeFrom:'12',childAgeFrom:'4',childAgeTo:'11',cancellationRule:''
  });

  const [rate,setRate]=useState({
    ticketOptionId:'',startDate:'',endDate:'',selectedWeekdays:[0,1,2,3,4,5,6] as number[],slotTime:'',
    netAdult:'0',netChild:'0',retailAdult:'0',retailChild:'0',totalCapacity:'100',
    inventoryStatus:'Available',stopSale:false,cutoffHours:'4',rateLayer:'BASE',priority:'0',reason:''
  });

  const [confirmationNos,setConfirmationNos]=useState<Record<string,string>>({});

  const load=async()=>{
    setLoading(true);
    try{setData(await getAttractionAdminOverview({}));}
    catch(err:any){toast.error(err?.message||'Failed to load Attractions Admin');}
    finally{setLoading(false);}
  };

  useEffect(()=>{load();},[]);

  const loadLibrary=async()=>{
    if(library.length){setLibraryOpen(true);return;}
    setLibraryLoading(true);
    try{
      const res=await getUaeAttractionProductLibrary({});
      setLibrary(res.products);
      setLibraryOpen(true);
    }catch(err:any){toast.error(err?.message||'Could not load UAE attraction product library');}
    finally{setLibraryLoading(false);}
  };

  const activeTickets=useMemo(()=>data?.ticketOptions.filter(t=>t.status==='Active')||[],[data]);

  const ticketStatus=(ticket:Data['ticketOptions'][number])=>{
    if(ticket.status!=='Active')return {label:'Inactive',tone:'muted'};
    const future=(data?.rates||[]).filter(r=>r.ticketOptionId===ticket.id&&r.isFuture);
    const positive=future.filter(r=>r.netAdult>0||r.netChild>0);
    if(!positive.length)return {label:'Rates Required',tone:'amber'};
    if(ticket.requiresSlot&&!positive.some(r=>!!r.slotTime))return {label:'Slot Setup Required',tone:'amber'};
    const usable=positive.filter(r=>!r.stopSale&&r.inventoryStatus!=='Sold Out'&&r.capacity>0);
    if(!usable.length){
      if(positive.every(r=>r.stopSale))return {label:'Stop Sale',tone:'red'};
      return {label:'Inventory Required',tone:'amber'};
    }
    return {label:'Sellable',tone:'green'};
  };

  const packageForTicket=(ticketId:string)=>data?.packages.find(p=>p.ticketOptionIds.includes(ticketId)&&p.status==='Active');

  const latestRateDate=(ticketId:string)=>{
    const future=(data?.rates||[]).filter(r=>r.ticketOptionId===ticketId&&r.isFuture);
    return future.length?future.map(r=>r.date).sort().at(-1)||'':'';
  };

  const createAttraction=async(next=true)=>{
    try{
      const res=await saveAttractionMaster({
        title:attr.title,
        slug:attr.slug||attr.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        city:attr.city,category:attr.category,shortDescription:attr.shortDescription||undefined,description:attr.description||undefined,
        cancellationPolicy:attr.cancellationPolicy as any,instantConfirmation:attr.instantConfirmation,address:attr.address||undefined,status:attr.status as any,
      });
      setWizardAttractionId(res.id);
      setSku(s=>({...s,attractionId:res.id,instantConfirmationEligible:attr.instantConfirmation}));
      toast.success('Attraction saved');
      await load();
      if(next)setWizardStep(2);
    }catch(err:any){toast.error(err?.message||'Could not save attraction');}
  };

  const createSku=async(next=true)=>{
    try{
      const res=await saveAttractionTicketOption({
        attractionId:sku.attractionId,name:sku.name,skuCode:sku.skuCode,ticketType:sku.ticketType as any,
        requiresSlot:sku.requiresSlot,minPax:Number(sku.minPax),maxPax:Number(sku.maxPax),
        inclusions:sku.inclusions||undefined,highlights:sku.highlights||undefined,status:sku.status as any,
        instantConfirmationEligible:sku.instantConfirmationEligible,adultAgeFrom:Number(sku.adultAgeFrom)||undefined,
        childAgeFrom:Number(sku.childAgeFrom)||undefined,childAgeTo:Number(sku.childAgeTo)||undefined,
        cancellationRule:sku.cancellationRule||undefined,
      });
      setWizardTicketId(res.id);
      setRate(r=>({...r,ticketOptionId:res.id}));
      if(sku.displayGroup){
        await saveAttractionPackage({
          attractionId:sku.attractionId,
          name:sku.displayGroup,
          ticketOptionIds:[res.id],
          description:sku.inclusions||undefined,
          badge:'B2B Net Rate',
          sortOrder:1,
          status:'Active',
        });
      }
      toast.success('Ticket product saved');
      await load();
      if(next)setWizardStep(3);
    }catch(err:any){toast.error(err?.message||'Could not save ticket product');}
  };

  const refreshAfterRates=async()=>{try{setData(await getAttractionAdminOverview({}));}catch(e:any){toast.error(e.message);}};

  const openAddTicket=(attractionId:string)=>{
    setWizardOpen(true);setWizardStep(2);setWizardAttractionId(attractionId);
    setSku({
      attractionId,name:'',skuCode:'',displayGroup:'Admission',ticketType:'Open Date',requiresSlot:false,minPax:'1',maxPax:'10',
      inclusions:'',highlights:'',status:'Active',instantConfirmationEligible:false,adultAgeFrom:'12',childAgeFrom:'4',childAgeTo:'11',cancellationRule:''
    });
  };

  const openRateLoader=(ticketId:string)=>{
    setView('rates');
    setRate(r=>({...r,ticketOptionId:ticketId}));
    window.scrollTo({top:0,behavior:'smooth'});
  };

  const updateReservation=async(id:string,status:'Confirmed'|'Cancelled'|'Rejected'|'Completed'|'Awaiting Confirmation')=>{
    try{
      await updateAttractionReservation({
        bookingId:id,status,
        supplierConfirmationNo:status==='Confirmed'?(confirmationNos[id]||undefined):undefined,
      });
      toast.success(status==='Confirmed'?'Reservation confirmed — voucher unlocked':`Reservation updated to ${status}`);
      await load();
    }catch(err:any){toast.error(err?.message||'Reservation update failed');}
  };

  const ratePeriods=useMemo(()=>{
    if(!data)return[];
    const byTicket=new Map<string,Data['rates']>();
    for(const r of data.rates.filter(x=>x.isFuture)){
      const arr=byTicket.get(r.ticketOptionId)||[];arr.push(r);byTicket.set(r.ticketOptionId,arr);
    }
    const periods:any[]=[];
    for(const [ticketId,rows] of byTicket){
      const sorted=[...rows].sort((a,b)=>a.date.localeCompare(b.date)||a.slotTime.localeCompare(b.slotTime));
      const groups=new Map<string,typeof sorted>();
      for(const r of sorted){
        const key=[r.netAdult,r.netChild,r.retailAdult,r.retailChild,r.capacity,r.inventoryStatus,r.stopSale,r.cutoffHours,r.rateLayer,r.slotTime].join('|');
        const arr=groups.get(key)||[];arr.push(r);groups.set(key,arr);
      }
      for(const rows2 of groups.values()){
        const ds=rows2.map(r=>r.date).sort();
        periods.push({
          ticketId,start:ds[0],end:ds.at(-1),days:rows2.length,slot:rows2[0].slotTime,
          netAdult:rows2[0].netAdult,netChild:rows2[0].netChild,retailAdult:rows2[0].retailAdult,retailChild:rows2[0].retailChild,
          capacity:rows2[0].capacity,status:rows2[0].inventoryStatus,stopSale:rows2[0].stopSale,layer:rows2[0].rateLayer,
        });
      }
    }
    return periods.sort((a,b)=>a.start.localeCompare(b.start));
  },[data]);

  const filteredPeriods=useMemo(()=>{
    const now=Date.now();
    const in30=new Date(now+30*86400000).toISOString().slice(0,10);
    if(rateMode==='missing')return[];
    if(rateMode==='expiring')return ratePeriods.filter(p=>p.end<=in30);
    if(rateMode==='stop')return ratePeriods.filter(p=>p.stopSale);
    return ratePeriods;
  },[ratePeriods,rateMode]);

  const filteredLibrary=useMemo(()=>{
    const q=librarySearch.trim().toLowerCase();
    return library.filter(p=>(libraryEmirate==='all'||p.emirate===libraryEmirate)&&(!q||[
      p.productName,p.attractionName,p.emirate,p.area,p.category,p.suggestedInternalSku
    ].join(' ').toLowerCase().includes(q)));
  },[library,librarySearch,libraryEmirate]);

  const useLibraryProduct=(p:LibraryProduct)=>{
    const existing=data?.attractions.find(a=>a.title.toLowerCase().includes(p.attractionName.toLowerCase())||p.attractionName.toLowerCase().includes(a.title.toLowerCase()));
    setLibraryOpen(false);
    setWizardOpen(true);
    if(existing){
      setWizardAttractionId(existing.id);
      setWizardStep(2);
      setSku({
        attractionId:existing.id,
        name:p.productName,
        skuCode:p.suggestedInternalSku,
        displayGroup:/vip/i.test(p.productName)?'VIP':/fast/i.test(p.productName)?'Fast Track':'Admission',
        ticketType:p.ticketType==='Timed Slot'?'Timed Slot':p.ticketType==='Open Date'?'Open Date':'Flexi Pass',
        requiresSlot:p.ticketType==='Timed Slot',
        minPax:'1',maxPax:'10',
        inclusions:p.highlights,
        highlights:p.productSummary,
        status:'Active',
        instantConfirmationEligible:false,
        adultAgeFrom:'12',childAgeFrom:'4',childAgeTo:'11',
        cancellationRule:'Confirm supplier cancellation policy before activation.',
      });
      return;
    }
    setWizardStep(1);
    setAttr({
      title:p.attractionName,
      slug:p.attractionName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
      city:p.emirate==='Ras Al Khaimah'?'Ras Al Khaimah':p.emirate,
      category:/theme/i.test(p.category)?'Theme Parks':/water park/i.test(p.category)?'Water Parks':/museum|art/i.test(p.category)?'Museums':/observation/i.test(p.category)?'Observation Decks':'Entertainment',
      shortDescription:p.productSummary.slice(0,140),
      description:p.productSummary+'\n\nHighlights: '+p.highlights,
      cancellationPolicy:'Flexible Cancellation',
      instantConfirmation:false,
      address:p.area,
      status:'Draft',
    });
    setSku(s=>({...s,name:p.productName,skuCode:p.suggestedInternalSku,inclusions:p.highlights,highlights:p.productSummary,ticketType:p.ticketType==='Timed Slot'?'Timed Slot':p.ticketType==='Open Date'?'Open Date':'Flexi Pass',requiresSlot:p.ticketType==='Timed Slot'}));
  };

  if(loading||!data){
    return <div className="p-6 space-y-4"><Skeleton className="h-12 w-72"/><Skeleton className="h-96 w-full rounded-xl"/></div>;
  }

  const selectedAttraction=data.attractions.find(a=>a.id===selectedAttractionId);
  if(view==='attractions'&&selectedAttraction)return <AttractionProfileWorkspace key={selectedAttraction.id} attraction={selectedAttraction} allAttractions={data.attractions} directoryTickets={data.ticketOptions} tickets={data.ticketOptions.filter(t=>t.attractionId===selectedAttraction.id)} rates={data.rates} onBack={()=>setSelectedAttractionId('')} onSwitch={setSelectedAttractionId} onSaved={refreshAfterRates}/>;
  const matchingAttractions=data.attractions.filter(a=>{
    const productText=data.ticketOptions.filter(t=>t.attractionId===a.id).map(t=>t.name+' '+t.skuCode).join(' ');
    return [a.title,a.city,a.category,productText].join(' ').toLowerCase().includes(directoryQuery.trim().toLowerCase());
  });

  const needsRates=activeTickets.filter(t=>ticketStatus(t).label==='Rates Required');
  const needsSlots=activeTickets.filter(t=>ticketStatus(t).label==='Slot Setup Required');
  const expiring=ratePeriods.filter(p=>p.end<=new Date(Date.now()+30*86400000).toISOString().slice(0,10)).length;

  return <div className="p-4 sm:p-5 lg:p-7 space-y-5">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><Ticket className="w-5 h-5 text-primary"/><h1 className="text-2xl font-black">Attractions & Tickets</h1></div>
        <p className="text-sm text-muted-foreground mt-1">Attraction → Ticket Product → Rate Plan → Rate Period → Reservation</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4"/>Refresh</Button>
        <Button variant="outline" onClick={loadLibrary} disabled={libraryLoading} className="gap-2"><Globe2 className="w-4 h-4"/>{libraryLoading?'Loading…':'UAE Product Library'}</Button>
        <Button variant="outline" onClick={loadStockImages} disabled={imagesLoading} className="gap-2" title="Fill missing cover images from Unsplash (credited, hotlinked)"><Images className="w-4 h-4"/>{imagesLoading?'Loading images…':'Load Images'}</Button>
        <Button onClick={()=>{setWizardOpen(true);setWizardStep(1);}} className="gap-2"><Plus className="w-4 h-4"/>Add Attraction</Button>
      </div>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl">
      {[
        ['attractions','Attractions',Ticket],
        ['rates','Rates & Inventory',CalendarDays],
        ['reservations','Reservations',ClipboardList],
        ['markup','Markup & Margin',Percent],
      ].map(([key,label,Icon]:any)=><Button key={key} variant={view===key?'default':'outline'} onClick={()=>setView(key)} className="gap-2 min-w-0"><Icon className="w-4 h-4 shrink-0"/><span className="truncate">{label}</span></Button>)}
    </div>

    {view==='attractions'&&<>
      <div className="flex items-center gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground"/><Input aria-label="Search attraction product directory" value={directoryQuery} onChange={e=>setDirectoryQuery(e.target.value)} placeholder="Search attraction, ticket product, SKU, destination…" className="pl-9 h-10"/></div><Badge variant="outline">{matchingAttractions.length} Attractions</Badge>{directoryQuery&&<Button variant="ghost" size="sm" onClick={()=>setDirectoryQuery('')}>Clear</Button>}</div>
      {(needsRates.length>0||needsSlots.length>0||expiring>0)&&(
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-700"/><h2 className="font-black text-sm">Needs your attention</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            {needsRates.length>0&&<button onClick={()=>{setView('rates');setRateMode('missing')}} className="text-left rounded-xl bg-white border border-amber-200 p-3 hover:border-amber-400">
              <p className="font-bold text-sm">{needsRates.length} ticket product{needsRates.length===1?'':'s'} need rates</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{needsRates.map(t=>t.name).join(', ')}</p>
              <span className="text-xs text-primary font-bold mt-2 inline-block">Add rates →</span>
            </button>}
            {needsSlots.length>0&&<button onClick={()=>openRateLoader(needsSlots[0].id)} className="text-left rounded-xl bg-white border border-amber-200 p-3 hover:border-amber-400">
              <p className="font-bold text-sm">{needsSlots.length} timed ticket{needsSlots.length===1?'':'s'} need slots</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{needsSlots.map(t=>t.name).join(', ')}</p>
              <span className="text-xs text-primary font-bold mt-2 inline-block">Add slots →</span>
            </button>}
            {expiring>0&&<button onClick={()=>{setView('rates');setRateMode('expiring')}} className="text-left rounded-xl bg-white border border-amber-200 p-3 hover:border-amber-400">
              <p className="font-bold text-sm">{expiring} rate period{expiring===1?'':'s'} expire within 30 days</p>
              <p className="text-xs text-muted-foreground mt-1">Extend commercial validity before sales stop.</p>
              <span className="text-xs text-primary font-bold mt-2 inline-block">Extend rates →</span>
            </button>}
          </div>
        </section>
      )}

      <section className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b flex items-center justify-between">
          <div><h2 className="font-black">Attraction catalogue</h2><p className="text-xs text-muted-foreground mt-1"></p></div>
          <Badge variant="outline">{data.attractions.length} attractions</Badge>
        </div>
        <div className="divide-y">
          {matchingAttractions.map(a=>{
            const tickets=data.ticketOptions.filter(t=>t.attractionId===a.id);
            const open=!!expanded[a.id];
            const validUntil=tickets.map(t=>latestRateDate(t.id)).filter(Boolean).sort().at(-1);
            return <div key={a.id}>
              <button type="button" onClick={()=>setSelectedAttractionId(a.id)} className="w-full text-left p-3 sm:p-4 hover:bg-muted/20">
                <div className="flex items-center gap-3 sm:gap-4">
                  <img src={productImage('',a.category,emirateFromCity(a.city))} alt="" className="w-20 h-16 sm:w-28 sm:h-20 rounded-xl object-cover shrink-0 bg-muted"/>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-base sm:text-lg">{a.title}</h3>
                      <Badge variant={a.status==='Active'?'default':'outline'}>{a.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.city} · {a.category}</p>
                    <p className="text-xs text-muted-foreground mt-1">{tickets.length} Ticket Product{tickets.length===1?'':'s'}{validUntil?` · Rates until ${fmtDate(validUntil)}`:''}</p>
                  </div>
                  <span className="text-xs font-semibold text-primary">Open Profile →</span>
                </div>
              </button>
              {open&&<div className="bg-muted/10 border-t p-4 sm:p-5">
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button size="sm" onClick={()=>openAddTicket(a.id)}><Plus className="w-4 h-4 mr-1"/>Add Ticket Product</Button>
                  {tickets[0]&&<Button size="sm" variant="outline" onClick={()=>openRateLoader(tickets[0].id)}><CalendarDays className="w-4 h-4 mr-1"/>Load Rates</Button>}
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {tickets.map(t=>{
                    const st=ticketStatus(t);
                    const pkg=packageForTicket(t.id);
                    const future=data.rates.filter(r=>r.ticketOptionId===t.id&&r.isFuture&&!r.stopSale&&r.capacity>0&&(r.netAdult>0||r.netChild>0));
                    const lead=future.sort((x,y)=>x.date.localeCompare(y.date))[0];
                    return <article key={t.id} className="rounded-xl border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2 items-center"><h4 className="font-black">{t.name}</h4>{pkg&&<Badge variant="outline">{pkg.name}</Badge>}</div>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{t.skuCode} · {t.ticketType}</p>
                          <p className="text-xs text-muted-foreground mt-1">Pax {t.minPax}-{t.maxPax}{t.adultAgeFrom!=null?` · Adult ${t.adultAgeFrom}+`:''}{t.childAgeFrom!=null&&t.childAgeTo!=null?` · Child ${t.childAgeFrom}-${t.childAgeTo}`:''}</p>
                        </div>
                        <StatusBadge label={st.label} tone={st.tone}/>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-muted/30 p-3"><p className="text-muted-foreground">Current net</p><p className="font-black mt-1">{lead?`AED ${lead.netAdult.toLocaleString()}`:'—'}</p></div>
                        <div className="rounded-lg bg-muted/30 p-3"><p className="text-muted-foreground">Allocation</p><p className="font-black mt-1">{lead?`${lead.capacity}/day`:'—'}</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button size="sm" variant="outline" onClick={()=>openRateLoader(t.id)}>Load / Extend Rates</Button>
                        {t.requiresSlot&&<Button size="sm" variant="outline" onClick={()=>openRateLoader(t.id)}><Clock3 className="w-3.5 h-3.5 mr-1"/>Add Slots</Button>}
                        <Button size="sm" variant="ghost" onClick={()=>{navigator.clipboard.writeText(t.skuCode);toast.success('SKU copied')}}><Copy className="w-3.5 h-3.5 mr-1"/>Copy SKU</Button>
                      </div>
                    </article>;
                  })}
                  {tickets.length===0&&<div className="rounded-xl border border-dashed p-6 text-center xl:col-span-2"><p className="font-semibold">No ticket products yet</p><p className="text-xs text-muted-foreground mt-1">Create the first sellable product for this attraction.</p><Button size="sm" className="mt-3" onClick={()=>openAddTicket(a.id)}>Add Ticket Product</Button></div>}
                </div>
              </div>}
            </div>
          })}
          {!matchingAttractions.length&&<div className="p-8 text-center text-sm text-muted-foreground">No matching attraction products</div>}
        </div>
      </section>
    </>}

    {view==='markup'&&<AttractionMarkupWorkspace/>}

    {view==='rates'&&<AttractionRatesQuickUpdate attractions={data.attractions} tickets={data.ticketOptions} initialTicketId={rate.ticketOptionId} onSaved={refreshAfterRates}/>}

    {view==='reservations'&&<section className="bg-card border rounded-2xl overflow-hidden">
      <div className="p-4 sm:p-5 border-b"><h2 className="font-black">Reservations</h2><p className="text-xs text-muted-foreground mt-1">Confirmation, supplier reference, voucher and cancellation operations.</p></div>
      <div className="divide-y">
        {data.reservations.map(r=><div key={r.id} className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-[1.1fr_1.4fr_1fr_.9fr_1fr] gap-3 items-center">
          <div><p className="font-mono font-bold text-sm">{r.bookingReference}</p><p className="text-xs text-muted-foreground mt-1">{r.agency}</p></div>
          <div><p className="font-bold">{r.attractionName}</p><p className="text-xs text-muted-foreground">{r.ticketOptionName} · {r.sku}</p></div>
          <div className="text-sm"><p>{fmtDate(r.targetDate)}{r.targetSlot?` · ${r.targetSlot}`:''}</p><p className="text-xs text-muted-foreground">{r.adults}A · {r.children}C · {r.guest}</p></div>
          <div><p className="font-black">AED {r.total.toLocaleString()}</p><Badge variant="outline" className="mt-1">{r.status}</Badge></div>
          <div className="space-y-2">
            {r.status==='Awaiting Confirmation'&&<><Input value={confirmationNos[r.id]||''} onChange={e=>setConfirmationNos(n=>({...n,[r.id]:e.target.value}))} placeholder="Supplier ref"/><div className="flex gap-2"><Button size="sm" onClick={()=>updateReservation(r.id,'Confirmed')}>Confirm</Button><Button size="sm" variant="outline" onClick={()=>updateReservation(r.id,'Rejected')}>Reject</Button></div></>}
            {r.status==='Confirmed'&&<div className="text-xs"><p className="font-semibold text-emerald-700">Confirmed</p><p className="text-muted-foreground mt-1">{r.supplierConfirmationNo||'Supplier reference pending'}</p></div>}
          </div>
        </div>)}
        {data.reservations.length===0&&<div className="p-8"><EmptyState text="No attraction reservations yet."/></div>}
      </div>
    </section>}

    {libraryOpen&&<div className="fixed inset-0 z-50 bg-black/50 p-2 sm:p-5 overflow-y-auto">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden min-h-[82vh]">
        <div className="p-4 sm:p-5 border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Globe2 className="w-5 h-5 text-primary"/><h2 className="text-xl font-black">UAE Attraction Product Library</h2></div>
            <p className="text-xs text-muted-foreground mt-1">Public product research for contracting. Products are not sellable until supplier terms, rates and allocation are loaded.</p>
          </div>
          <Button variant="outline" onClick={()=>setLibraryOpen(false)}>Close</Button>
        </div>

        <div className="p-4 sm:p-5 border-b bg-muted/20">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
              <Input className="pl-9" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Search attraction, product, category, area or SKU…"/>
            </div>
            <Select value={libraryEmirate} onValueChange={setLibraryEmirate}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Emirates</SelectItem>
                {['Dubai','Abu Dhabi','Sharjah','Ras Al Khaimah','Fujairah','Ajman','Umm Al Quwain'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
            <Badge variant="outline">{filteredLibrary.length} products</Badge>
            <span className="text-muted-foreground">Verified public products are research-backed; supplier SKU, B2B net rate and allocation must still be contracted.</span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLibrary.map(p=><article key={p.id} className="rounded-2xl border bg-white overflow-hidden flex flex-col">
              <div className="relative h-44 bg-muted overflow-hidden">
                <img src={productImage(p.imageKey,p.category,p.emirate)} alt={p.attractionName} className="w-full h-full object-cover"/>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/75">{p.emirate} · {p.area}</p>
                  <h3 className="font-black leading-tight mt-1">{p.attractionName}</h3>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{p.category}</Badge>
                  <Badge variant="outline">{p.ticketType}</Badge>
                  <Badge className={p.verificationStatus==='Verified Public Product'?'bg-emerald-600':p.verificationStatus.includes('Closed')?'bg-red-600':'bg-amber-600'}>{p.verificationStatus}</Badge>
                </div>
                <h4 className="font-black mt-3">{p.productName}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.productSummary}</p>
                <div className="rounded-lg bg-muted/30 p-3 mt-3 text-xs">
                  <p className="font-semibold">Highlights</p>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{p.highlights}</p>
                </div>
                <div className="mt-3 text-xs space-y-1">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Suggested internal SKU</span><span className="font-mono font-bold text-right">{p.suggestedInternalSku}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Source</span><span className="font-semibold text-right">{p.source}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Commercial</span><span className="font-semibold text-right">{p.commercialStatus}</span></div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button className="flex-1" onClick={()=>useLibraryProduct(p)}>Use in Contracting</Button>
                  {p.officialUrl&&<Button variant="outline" size="icon" title="Open official source" onClick={()=>window.open(p.officialUrl,'_blank','noopener,noreferrer')}><ExternalLink className="w-4 h-4"/></Button>}
                </div>
              </div>
            </article>)}
          </div>
          {filteredLibrary.length===0&&<div className="py-16"><EmptyState text="No matching products in the current research library."/></div>}
        </div>
      </div>
    </div>}

    {wizardOpen&&<div className="fixed inset-0 z-50 bg-black/45 p-3 sm:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b flex items-start justify-between gap-4">
          <div><p className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold">Attraction setup</p><h2 className="text-xl font-black mt-1">{wizardStep===1?'1. Attraction':wizardStep===2?'2. Ticket Product':wizardStep===3?'3. Rates & Inventory':'4. Review & Publish'}</h2></div>
          <Button variant="ghost" size="sm" onClick={()=>setWizardOpen(false)}>Close</Button>
        </div>
        <div className="grid grid-cols-4 border-b">
          {['Attraction','Ticket','Rates','Publish'].map((s,i)=><div key={s} className={`px-2 py-3 text-center text-[11px] font-bold ${wizardStep===i+1?'text-primary border-b-2 border-primary':'text-muted-foreground'}`}>{i+1}. {s}</div>)}
        </div>
        <div className="p-4 sm:p-6">
          {wizardStep===1&&<div className="space-y-4">
            <Field label="Attraction Name *"><Input value={attr.title} onChange={e=>setAttr({...attr,title:e.target.value})}/></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Destination / Emirate *"><Select value={attr.city} onValueChange={v=>setAttr({...attr,city:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CITIES.map(v=><SelectItem value={v} key={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="Category *"><Select value={attr.category} onValueChange={v=>setAttr({...attr,category:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CATEGORIES.map(v=><SelectItem value={v} key={v}>{v}</SelectItem>)}</SelectContent></Select></Field></div>
            <Field label="Short Description"><Input value={attr.shortDescription} onChange={e=>setAttr({...attr,shortDescription:e.target.value})}/></Field>
            <Field label="Full Description"><Textarea rows={4} value={attr.description} onChange={e=>setAttr({...attr,description:e.target.value})}/></Field>
            <Field label="Address / Meeting Point"><Input value={attr.address} onChange={e=>setAttr({...attr,address:e.target.value})}/></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Cancellation"><Select value={attr.cancellationPolicy} onValueChange={v=>setAttr({...attr,cancellationPolicy:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Free Cancellation','Flexible Cancellation','Non-Refundable'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="Status"><Select value={attr.status} onValueChange={v=>setAttr({...attr,status:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Draft','Active','Archived'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={attr.instantConfirmation} onCheckedChange={v=>setAttr({...attr,instantConfirmation:!!v})}/>Instant confirmation allowed</label>
            <Button className="w-full h-11 font-black" disabled={!attr.title.trim()} onClick={()=>createAttraction(true)}>Save & Add Ticket</Button>
          </div>}

          {wizardStep===2&&<div className="space-y-4">
            <Field label="Attraction"><Select value={sku.attractionId||wizardAttractionId} onValueChange={v=>setSku({...sku,attractionId:v})}><SelectTrigger><SelectValue placeholder="Select attraction"/></SelectTrigger><SelectContent>{data.attractions.map(a=><SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}</SelectContent></Select></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Ticket Name *"><Input value={sku.name} onChange={e=>setSku({...sku,name:e.target.value})}/></Field><Field label="SKU Code *"><Input value={sku.skuCode} onChange={e=>setSku({...sku,skuCode:e.target.value})} placeholder="BURJ-GA"/></Field></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Display Group"><Select value={sku.displayGroup} onValueChange={v=>setSku({...sku,displayGroup:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{DISPLAY_GROUPS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="Ticket Type"><Select value={sku.ticketType} onValueChange={v=>setSku({...sku,ticketType:v,requiresSlot:v==='Timed Slot'})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Open Date','Timed Slot','Flexi Pass'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Field label="Min Pax"><Input type="number" value={sku.minPax} onChange={e=>setSku({...sku,minPax:e.target.value})}/></Field><Field label="Max Pax"><Input type="number" value={sku.maxPax} onChange={e=>setSku({...sku,maxPax:e.target.value})}/></Field><Field label="Adult From"><Input type="number" value={sku.adultAgeFrom} onChange={e=>setSku({...sku,adultAgeFrom:e.target.value})}/></Field><Field label="Child To"><Input type="number" value={sku.childAgeTo} onChange={e=>setSku({...sku,childAgeTo:e.target.value})}/></Field></div>
            <Field label="Inclusions"><Textarea rows={3} value={sku.inclusions} onChange={e=>setSku({...sku,inclusions:e.target.value})}/></Field>
            <Field label="Cancellation Rule"><Textarea rows={3} value={sku.cancellationRule} onChange={e=>setSku({...sku,cancellationRule:e.target.value})}/></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={sku.instantConfirmationEligible} onCheckedChange={v=>setSku({...sku,instantConfirmationEligible:!!v})}/>Instant confirmation eligible</label>
            <Button className="w-full h-11 font-black" disabled={!sku.attractionId||!sku.name.trim()||!sku.skuCode.trim()} onClick={()=>createSku(true)}>Save & Add Rates</Button>
          </div>}

          {wizardStep===3&&<AttractionCommercialWorkspace tickets={data.ticketOptions.filter(t=>t.attractionId===wizardAttractionId)} initialTicketId={wizardTicketId||rate.ticketOptionId} onSaved={refreshAfterRates}/>}

          {wizardStep===4&&<div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-700"/><h3 className="font-black text-emerald-900">Ready to Sell</h3></div>
              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Attraction</p><p className="font-bold">{data.attractions.find(a=>a.id===wizardAttractionId)?.title||attr.title}</p></div>
                <div><p className="text-xs text-muted-foreground">Ticket</p><p className="font-bold">{data.ticketOptions.find(t=>t.id===wizardTicketId)?.name||sku.name}</p></div>
                <div><p className="text-xs text-muted-foreground">Validity</p><p className="font-bold">{fmtDate(rate.startDate)} – {fmtDate(rate.endDate)}</p></div>
                <div><p className="text-xs text-muted-foreground">Adult Net</p><p className="font-bold">AED {Number(rate.netAdult).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Child Net</p><p className="font-bold">AED {Number(rate.netChild).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Allocation</p><p className="font-bold">{rate.totalCapacity}/day</p></div>
              </div>
            </div>
            <Button className="w-full h-11 font-black" onClick={()=>{setWizardOpen(false);setView('attractions');setSelectedAttractionId(wizardAttractionId)}}>Done — View Attraction</Button>
          </div>}
        </div>
      </div>
    </div>}
  </div>;
}

function StatusBadge({label,tone}:{label:string;tone:string}){
  const cls=tone==='green'?'bg-emerald-50 text-emerald-700 border-emerald-200':tone==='amber'?'bg-amber-50 text-amber-800 border-amber-200':tone==='red'?'bg-red-50 text-red-700 border-red-200':'bg-muted text-muted-foreground border-border';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap ${cls}`}>{label}</span>;
}

function EmptyState({text}:{text:string}){
  return <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
