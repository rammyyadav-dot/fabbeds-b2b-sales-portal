import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@project/components/ui/dialog';
import {Badge} from '@project/components/ui/badge';
import {Plus,RefreshCw} from 'lucide-react';
import {financeRequestPayload,financeErrorMessage} from '../lib/financeRequestForm';
import {useEffect,useState} from 'react';
import {getTenantFinance,requestTenantFinanceChange,reviewTenantFinanceChange,GetTenantFinanceOutputType} from 'zitejs/api';
import {Button} from '@project/components/ui/button';
import {Input} from '@project/components/ui/input';
import {Card,CardContent} from '@project/components/ui/card';
import {toast} from 'sonner';
const money=(v:unknown)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED'}).format(Number(v??0));
type Kind='Credit Policy'|'Wallet Deposit'|'Account Status';
export default function TenantFinancePanel(){
 const [data,setData]=useState<GetTenantFinanceOutputType|null>(null);const [tenant,setTenant]=useState<string>();
 const [search,setSearch]=useState('');const [query,setQuery]=useState('');const [page,setPage]=useState(0);const [requestPage,setRequestPage]=useState(0);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [revision,setRevision]=useState(0);
 const [kind,setKind]=useState<Kind>('Credit Policy');const [amount,setAmount]=useState('');const [terms,setTerms]=useState('30');
 const [creditStatus,setCreditStatus]=useState<'Pending Review'|'Approved'|'On Hold'|'Disabled'>('Pending Review');
 const [accountStatus,setAccountStatus]=useState<'Active'|'Suspended'>('Active');const [reference,setReference]=useState('');const [evidence,setEvidence]=useState('');const [reason,setReason]=useState('');
 const [ownerOverride,setOwnerOverride]=useState(false);
 const [requestOpen,setRequestOpen]=useState(false);
 const [formError,setFormError]=useState('');const [saved,setSaved]=useState('');
 const [review,setReview]=useState<Record<string,unknown>|null>(null);const [notes,setNotes]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setData(null);setError('');
 getTenantFinance({tenantId:tenant,search:query,page,requestPage}).then(r=>{if(active)setData(r)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load tenant finance')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false};
 },[tenant,query,page,requestPage,revision]);
 const d=data?.detail;
 async function submit(){
 if(busy)return;
 setFormError('');setSaved('');
 let payload;
 try{payload=financeRequestPayload({tenantId:tenant,type:kind,amount,terms,creditStatus,accountStatus,reference,evidence,reason});}
 catch(e){setFormError(financeErrorMessage(e));return;}
 setBusy(true);
 try{
 const result=await requestTenantFinanceChange(payload);
 setSaved(result.reference);
 toast.success('Request submitted');
 setReason('');setReference('');setEvidence('');setRequestPage(0);setRevision(x=>x+1);
 }catch(e){setFormError(financeErrorMessage(e));}finally{setBusy(false)}
 }
 async function decide(decision:'Approve'|'Reject'){
 if(!tenant||!review)return;setBusy(true);try{await reviewTenantFinanceChange({tenantId:tenant,requestId:String(review.id),decision,notes,ownerOverride});toast.success('Review saved');setReview(null);setNotes('');setRevision(x=>x+1)}catch(e){toast.error(financeErrorMessage(e))}finally{setBusy(false)}
 }
 function choose(id:string){setFormError('');setSaved('');setTenant(id);setRequestPage(0);setReview(null);setNotes('');setAmount('');setReason('');setReference('');setEvidence('')}
 return <div className="space-y-3">
 <div className="flex justify-between gap-2.5 items-center"><h2 className="text-base font-semibold">Agency accounts</h2><Button variant="outline" disabled={loading||busy} onClick={()=>setRevision(x=>x+1)}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button></div>
 
 {error&&<div role="alert" className="border border-red-300 p-2.5 rounded-lg text-red-800">{error}</div>}
 <Card><CardContent className="p-2.5"><form className="flex gap-2 mb-4" onSubmit={e=>{e.preventDefault();setQuery(search);setPage(0)}}><Input aria-label="Search tenant accounts" placeholder="Agency name or login email" value={search} onChange={e=>setSearch(e.target.value)}/><Button variant="outline">Search</Button></form>
 <div className="overflow-x-auto"><table className="w-full text-sm whitespace-nowrap"><thead><tr className="border-b text-left text-muted-foreground bg-muted/50">{['Agency','Login','Access','Credit','Limit','Terms','Last login',''].map(c=><th key={c} className="p-2.5">{c}</th>)}</tr></thead><tbody>{loading?<tr><td colSpan={8} className="p-6">Loading accounts…</td></tr>:data?.accounts.map(a=><tr key={String(a.id)} className={'border-b '+(tenant===a.id?'bg-muted/60':'')}><td className="p-2.5 font-medium">{String(a.agencyName||'Unnamed agency')}</td><td className="p-2.5">{String(a.agencyEmail??'—')}</td><td className="p-2.5"><Badge variant="outline">{String(a.accountStatus??'Unknown')}</Badge></td><td className="p-2.5"><Badge variant="outline">{String(a.creditStatus??'Pending Review')}</Badge></td><td className="p-2.5">{money(a.creditLimitAed)}</td><td className="p-2.5">{String(a.creditTermsDays??0)} days</td><td className="p-2.5">{a.lastSignedIn?new Date(String(a.lastSignedIn)).toLocaleString():'Never recorded'}</td><td className="p-2.5"><Button variant="outline" size="sm" disabled={busy} onClick={()=>choose(String(a.id))}>Manage</Button></td></tr>)}{!loading&&data?.accounts.length===0&&<tr><td colSpan={8} className="p-8 text-center">No accounts</td></tr>}</tbody></table></div>
 <div className="flex justify-between pt-4"><span className="text-sm text-muted-foreground">{data?.total??'—'} accounts · Page {page+1}</span><div className="flex gap-2"><Button variant="outline" disabled={!page||loading||busy} onClick={()=>setPage(x=>x-1)}>Previous</Button><Button variant="outline" disabled={loading||!data||(page+1)*25>=data.total} onClick={()=>setPage(x=>x+1)}>Next</Button></div></div>
 </CardContent></Card>
 {d&&<><div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold">{String(d.agencyName)}</h3><div className="flex gap-2"><Badge variant="outline">Wallet spending disabled</Badge><Button size="sm" onClick={()=>{setFormError('');setSaved('');setRequestOpen(true)}}><Plus className="h-4 w-4 mr-2"/>New request</Button></div></div>
 <div className="grid md:grid-cols-4 gap-2.5">{[['creditLimit','Credit limit'],['creditUsed','Credit used'],['creditAvailable','Credit available'],['walletBalance','Wallet deposits']].map(([k,l])=><Card key={k}><CardContent className="p-2.5"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold mt-2">{money(d[k])}</p></CardContent></Card>)}</div>
 <div className="flex flex-wrap gap-2.5 text-sm border rounded-lg p-2.5"><span>Credit: <strong>{String(d.creditStatus)}</strong></span><span>Open bookings: <strong>{String(d.openBookings)}</strong></span><span>Overdue: <strong>{String(d.overdueBookings)}</strong></span><span>Incomplete exposure: <strong>{String(d.incompleteExposure)}</strong></span><span>Pending reviews: <strong>{String(d.pending)}</strong></span></div>
 <Dialog open={requestOpen} onOpenChange={open=>{if(!busy)setRequestOpen(open)}}><DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>New finance request</DialogTitle></DialogHeader><form noValidate onSubmit={e=>{e.preventDefault();void submit()}} className="space-y-3"><div className="grid md:grid-cols-3 gap-2.5">
 <label className="text-sm">Request type<select className="border rounded-md p-2 block w-full mt-1 bg-background" value={kind} onChange={e=>{setKind(e.target.value as Kind);setFormError('');setSaved('')}}>{[['Credit Policy','Change credit limit'],['Wallet Deposit','Record deposit'],['Account Status','Change login access']].map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
 {kind!=='Account Status'&&<label className="text-sm">{kind==='Credit Policy'?'New credit limit (AED)':'Deposit (AED)'}<Input className="mt-1" type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
 {kind==='Credit Policy'&&<><label className="text-sm">Payment terms (days)<Input className="mt-1" type="number" min="0" max="365" step="1" value={terms} onChange={e=>setTerms(e.target.value)}/></label><label className="text-sm">Credit status<select className="border rounded-md p-2 block w-full mt-1 bg-background" value={creditStatus} onChange={e=>setCreditStatus(e.target.value as typeof creditStatus)}>{['Pending Review','Approved','On Hold','Disabled'].map(s=><option key={s}>{s}</option>)}</select></label></>}
 {kind==='Account Status'&&<label className="text-sm">Login access<select className="border rounded-md p-2 block w-full mt-1 bg-background" value={accountStatus} onChange={e=>setAccountStatus(e.target.value as typeof accountStatus)}><option>Active</option><option>Suspended</option></select></label>}
 {kind==='Wallet Deposit'&&<><label className="text-sm">Bank reference *<Input className="mt-1" value={reference} onChange={e=>setReference(e.target.value)}/></label><label className="text-sm">Receipt evidence link *<Input className="mt-1" type="url" value={evidence} onChange={e=>setEvidence(e.target.value)}/></label></>}
 </div><label className="block text-sm">Reason * <textarea rows={2} aria-label="Reason" placeholder="Example: Credit limit for October bookings" className="border rounded-md p-2.5 w-full mt-1 bg-background" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></label>
 {formError&&<div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</div>}{saved&&<div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 break-words">{saved}</div>}<Button type="submit" disabled={busy}>{busy?'Saving…':'Submit for review'}</Button></form></DialogContent></Dialog>
 <Card><CardContent className="p-2.5"><h3 className="font-semibold mb-3">Requests</h3><div className="overflow-x-auto"><table className="w-full text-sm whitespace-nowrap"><thead><tr className="border-b text-left">{['Request','Type','Amount AED','Status','Requested by','Reviewed by','Reference',''].map(c=><th key={c} className="p-2.5">{c}</th>)}</tr></thead><tbody>{data?.requests.map(r=><tr key={String(r.id)} className="border-b"><td className="p-2.5 font-mono text-xs">{String(r.requestReference).slice(0,16)}…</td><td className="p-2.5">{String(r.requestType)}</td><td className="p-2.5">{r.requestType==='Account Status'?'—':money(Number(r.amountMinor)/100)}</td><td className="p-2.5"><Badge variant="outline">{String(r.requestStatus)}</Badge></td><td className="p-2.5">{String(r.requestedBy)}</td><td className="p-2.5">{String(r.reviewedBy??'—')}</td><td className="p-2.5">{String(r.externalReference??'—')}</td><td className="p-2.5"><Button size="sm" variant="outline" onClick={()=>{setReview(r);setNotes('');setOwnerOverride(false)}}>Review</Button></td></tr>)}{data?.requests.length===0&&<tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No requests</td></tr>}</tbody></table></div>
 <div className="flex gap-2 justify-end mt-4"><Button variant="outline" disabled={!requestPage||loading} onClick={()=>setRequestPage(x=>x-1)}>Previous</Button><span className="p-2 text-sm">Page {requestPage+1} · {data?.requestTotal} requests</span><Button variant="outline" disabled={loading||!data||(requestPage+1)*25>=data.requestTotal} onClick={()=>setRequestPage(x=>x+1)}>Next</Button></div>
 </CardContent></Card>
 {review&&<Dialog open={!!review} onOpenChange={open=>{if(!open&&!busy)setReview(null)}}><DialogContent aria-describedby={undefined} className="max-w-xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{String(review.requestType)} <Badge variant="outline">{String(review.requestStatus)}</Badge></DialogTitle></DialogHeader><p className="text-sm break-all">{String(review.requestReference)}</p><p className="text-sm">Reason: {String(review.reason)}</p><p className="text-sm">Amount: {money(Number(review.amountMinor)/100)} · Credit: {String(review.creditStatus)} · Terms: {String(review.creditTermsDays)} days · Account: {String(review.accountStatus)}</p>{typeof review.evidenceUrl==='string'&&review.evidenceUrl.startsWith('https://')&&<a className="underline text-primary text-sm" href={review.evidenceUrl} target="_blank" rel="noopener noreferrer">Open deposit evidence</a>}
 {review.requestStatus==='Pending'?<>{review.requestedBy===data?.actor&&data?.canOverrideReview&&<label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium"><input type="checkbox" checked={ownerOverride} disabled={busy} onChange={e=>setOwnerOverride(e.target.checked)}/>Ram Kumar — Admin override</label>}<label className="block text-sm">Review notes *<textarea className="border rounded-md p-2.5 w-full mt-1 bg-background" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></label><div className="flex gap-2"><Button disabled={busy||notes.trim().length<10||(review.requestedBy===data?.actor&&!(data?.canOverrideReview&&ownerOverride))} onClick={()=>decide('Approve')}>Approve</Button><Button variant="outline" disabled={busy||notes.trim().length<10||(review.requestedBy===data?.actor&&!(data?.canOverrideReview&&ownerOverride))} onClick={()=>decide('Reject')}>Reject</Button></div>{review.requestedBy===data?.actor&&!data?.canOverrideReview&&<p className="text-sm text-amber-800">Another authorised finance user must review your request.</p>}</>:<p className="text-sm">Reviewed by {String(review.reviewedBy??'—')}: {String(review.reviewNotes??'—')}</p>}
 </DialogContent></Dialog>}
 </>}
 </div>;
}
