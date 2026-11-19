import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  getAttractionMarkupWorkspace, saveAttractionMarkupRule, savePartnerAgencyTier, previewAttractionMarkup,
  type GetAttractionMarkupWorkspaceOutputType, type PreviewAttractionMarkupOutputType,
} from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Switch } from '@project/components/ui/switch';
import { Plus, RefreshCw, Calculator, Pencil, Pause, Play, Check } from 'lucide-react';

type WS = GetAttractionMarkupWorkspaceOutputType;
type Rule = WS['rules'][number];
const TIERS = ['Standard', 'Silver', 'Gold', 'Platinum'];
const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Fujairah', 'Ajman', 'Umm Al Quwain'];
const CATEGORIES = ['Theme Parks', 'Water Parks', 'Observation & Landmarks', 'Museums & Culture', 'Heritage & Religious Sites', 'Desert Safari', 'Cruises & Yachts', 'Water Sports & Diving', 'Adventure & Outdoor', 'Nature & Wildlife', 'Tours & Experiences', 'Entertainment & Leisure'];
const blank = { id: '', ruleName: '', status: 'Active', markupType: 'Percent', markupValue: '10', agencyTier: '', partnerAccountId: '', emirate: '', productCategory: '', ticketOptionId: '', market: '', validFrom: '', validTo: '', priority: '0', notes: '' };
const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const FIXED = 'Fixed AED per pax';
/** % ⇄ AED switch: off = Percent, on = fixed AED per pax. */
function TypeToggle({ value, onChange, compact = false }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const isAed = value === FIXED;
  return <div className={`inline-flex items-center ${compact ? 'gap-1.5' : 'gap-2 h-9'}`}>
    <span className={`text-xs font-bold ${!isAed ? 'text-primary' : 'text-muted-foreground'}`}>%</span>
    <Switch checked={isAed} onCheckedChange={c => onChange(c ? FIXED : 'Percent')} aria-label={isAed ? 'Markup in AED per pax — switch to percent' : 'Markup in percent — switch to AED per pax'} />
    <span className={`text-xs font-bold ${isAed ? 'text-primary' : 'text-muted-foreground'}`}>AED</span>
  </div>;
}
const aed = (n: number) => `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AttractionMarkupWorkspace() {
  const [ws, setWs] = useState<WS | null>(null);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [saving, setSaving] = useState(false);
  const [pv, setPv] = useState({ ticketOptionId: '', partnerAccountId: '', agencyTier: 'Standard', date: new Date().toISOString().slice(0, 10), market: '', costAdult: '' });
  const [preview, setPreview] = useState<PreviewAttractionMarkupOutputType | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { type: string; value: string }>>({});

  const load = async () => { try { setWs(await getAttractionMarkupWorkspace({})); } catch (e: any) { toast.error(e?.message || 'Could not load markup rules'); } };
  useEffect(() => { load(); }, []);
  const partnerName = useMemo(() => new Map((ws?.partners || []).map(p => [p.id, p.agencyName])), [ws]);
  const ticketName = useMemo(() => new Map((ws?.tickets || []).map(t => [t.id, `${t.label} (${t.skuCode})`])), [ws]);

  const scope = (r: Rule) => [
    r.partnerAccountId && `Agency: ${partnerName.get(r.partnerAccountId) || '—'}`,
    r.ticketOptionId && `SKU: ${ticketName.get(r.ticketOptionId) || '—'}`,
    r.agencyTier && `Tier: ${r.agencyTier}`, r.productCategory, r.emirate, r.market && `Market ${r.market}`,
    (r.validFrom || r.validTo) && `Visit ${r.validFrom || '…'} → ${r.validTo || '…'}`,
  ].filter(Boolean).join(' · ') || 'All agencies, all attractions';

  const asForm = (r: Rule) => ({ ...blank, id: r.id, ruleName: r.ruleName, status: r.status, markupType: r.markupType, markupValue: String(r.markupValue), agencyTier: r.agencyTier || '', partnerAccountId: r.partnerAccountId || '', emirate: r.emirate || '', productCategory: r.productCategory || '', ticketOptionId: r.ticketOptionId || '', market: r.market || '', validFrom: r.validFrom || '', validTo: r.validTo || '', priority: String(r.priority), notes: r.notes });
  const saveInline = async (r: Rule) => {
    const d = drafts[r.id]; if (!d) return;
    await save({ ...asForm(r), markupType: d.type, markupValue: d.value }, true);
    setDrafts(x => { const n = { ...x }; delete n[r.id]; return n; });
    toast.success(`${r.ruleName}: ${d.type === FIXED ? `AED ${d.value}/pax` : `${d.value}%`}`);
  };
  const edit = (r?: Rule) => setForm(r ? {
    id: r.id, ruleName: r.ruleName, status: r.status, markupType: r.markupType, markupValue: String(r.markupValue), agencyTier: r.agencyTier || '',
    partnerAccountId: r.partnerAccountId || '', emirate: r.emirate || '', productCategory: r.productCategory || '', ticketOptionId: r.ticketOptionId || '',
    market: r.market || '', validFrom: r.validFrom || '', validTo: r.validTo || '', priority: String(r.priority), notes: r.notes,
  } : { ...blank });

  const save = async (f = form, quiet = false) => {
    if (!f) return;
    setSaving(true);
    try {
      await saveAttractionMarkupRule({
        id: f.id || undefined, ruleName: f.ruleName, status: f.status as any, markupType: f.markupType as any, markupValue: Number(f.markupValue),
        agencyTier: (f.agencyTier || null) as any, partnerAccountId: f.partnerAccountId || null, emirate: f.emirate || null, productCategory: f.productCategory || null,
        ticketOptionId: f.ticketOptionId || null, market: f.market || null, validFrom: f.validFrom || null, validTo: f.validTo || null,
        priority: Number(f.priority || 0), notes: f.notes,
      });
      if (!quiet) toast.success('Markup rule saved — applies to the next search and quote');
      if (!quiet) setForm(null);
      await load();
    } catch (e: any) { toast.error(e?.message || 'Could not save rule'); } finally { setSaving(false); }
  };
  const toggle = (r: Rule) => save({ ...asForm(r), status: r.status === 'Active' ? 'Inactive' : 'Active' }, true);

  const runPreview = async () => {
    if (!pv.ticketOptionId) return toast.error('Choose a SKU');
    try {
      setPreview(await previewAttractionMarkup({ ticketOptionId: pv.ticketOptionId, partnerAccountId: pv.partnerAccountId || undefined, agencyTier: pv.partnerAccountId ? undefined : pv.agencyTier, date: pv.date, market: pv.market || undefined, costAdult: pv.costAdult ? Number(pv.costAdult) : undefined }));
    } catch (e: any) { toast.error(e?.message || 'Preview failed'); }
  };

  if (!ws) return <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Loading markup workspace…</div>;
  const m = ws.margin;
  const F = (k: keyof typeof blank, v: string) => setForm(f => f ? { ...f, [k]: v } : f);

  return <div className="space-y-5">
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[['Live attraction bookings', String(m.bookings)], ['Supplier cost', aed(m.supplierCost)], ['Agent sell', aed(m.sell)], ['Gross margin', `${aed(m.markup)}${m.marginPct !== null ? ` · ${m.marginPct}%` : ''}`]].map(([k, v]) =>
        <div key={k} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-lg font-black mt-1">{v}</p></div>)}
    </section>

    <section className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 border-b">
        <div><h2 className="font-bold">Markup rules</h2><p className="text-xs text-muted-foreground">Agent price = supplier cost (rate Net Cost) + markup from the most specific active rule: Agency › SKU › Tier › Category › Emirate › Market, then Priority. Blank fields apply to all. Validity is by visit date.</p></div>
        <div className="flex gap-2 shrink-0"><Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button><Button size="sm" onClick={() => edit()}><Plus className="w-4 h-4 mr-1" />New rule</Button></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="text-left p-3">Rule</th><th className="text-left p-3">Applies to</th><th className="text-right p-3">Markup (% ⇄ AED per pax)</th><th className="text-right p-3">Priority</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
        <tbody>{ws.rules.map(r => <tr key={r.id} className="border-t">
          <td className="p-3 font-semibold">{r.ruleName}{r.notes && <p className="text-[11px] font-normal text-muted-foreground line-clamp-1">{r.notes}</p>}</td>
          <td className="p-3 text-xs">{scope(r)}</td>
          <td className="p-3">{(() => { const d = drafts[r.id] || { type: r.markupType, value: String(r.markupValue) }; const dirty = !!drafts[r.id] && (d.type !== r.markupType || Number(d.value) !== r.markupValue);
            return <div className="flex items-center justify-end gap-2">
              <TypeToggle compact value={d.type} onChange={v => setDrafts(x => ({ ...x, [r.id]: { ...d, type: v } }))} />
              <div className="relative"><Input type="number" min="0" step="0.01" aria-label={`${r.ruleName} markup value`} className="h-8 w-24 pr-9 text-right font-bold" value={d.value} onChange={e => setDrafts(x => ({ ...x, [r.id]: { ...d, value: e.target.value } }))} onKeyDown={e => { if (e.key === 'Enter' && dirty) saveInline(r); }} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{d.type === FIXED ? 'AED' : '%'}</span></div>
              <Button size="sm" variant={dirty ? 'default' : 'ghost'} disabled={!dirty || saving} onClick={() => saveInline(r)} title="Save markup"><Check className="w-3.5 h-3.5" /></Button>
            </div>; })()}</td>
          <td className="p-3 text-right">{r.priority}</td>
          <td className="p-3 text-center"><Badge variant={r.status === 'Active' ? 'default' : 'outline'}>{r.status}</Badge></td>
          <td className="p-3 text-right whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => edit(r)}><Pencil className="w-3.5 h-3.5" /></Button><Button size="sm" variant="ghost" onClick={() => toggle(r)} title={r.status === 'Active' ? 'Deactivate' : 'Activate'}>{r.status === 'Active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</Button></td>
        </tr>)}</tbody>
      </table></div>
    </section>

    {form && <section className="rounded-2xl border-2 border-primary/40 bg-card p-4 space-y-3">
      <h3 className="font-bold">{form.id ? 'Edit rule' : 'New markup rule'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2"><Label>Rule name</Label><Input value={form.ruleName} onChange={e => F('ruleName', e.target.value)} placeholder="e.g. Gold agencies — theme parks" /></div>
        <div><Label>Markup type</Label><div><TypeToggle value={form.markupType} onChange={v => F('markupType', v)} /></div></div>
        <div><Label>{form.markupType === 'Percent' ? 'Markup %' : 'AED per pax'}</Label><Input type="number" min="0" step="0.01" value={form.markupValue} onChange={e => F('markupValue', e.target.value)} /></div>
        <div><Label>Agency tier</Label><select className={sel} value={form.agencyTier} onChange={e => F('agencyTier', e.target.value)}><option value="">Any tier</option>{TIERS.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><Label>Specific agency</Label><select className={sel} value={form.partnerAccountId} onChange={e => F('partnerAccountId', e.target.value)}><option value="">Any agency</option>{ws.partners.map(p => <option key={p.id} value={p.id}>{p.agencyName}</option>)}</select></div>
        <div><Label>Emirate</Label><select className={sel} value={form.emirate} onChange={e => F('emirate', e.target.value)}><option value="">Any emirate</option>{EMIRATES.map(x => <option key={x}>{x}</option>)}</select></div>
        <div><Label>Product category</Label><select className={sel} value={form.productCategory} onChange={e => F('productCategory', e.target.value)}><option value="">Any category</option>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className="md:col-span-2"><Label>Specific SKU</Label><select className={sel} value={form.ticketOptionId} onChange={e => F('ticketOptionId', e.target.value)}><option value="">Any SKU</option>{ws.tickets.map(t => <option key={t.id} value={t.id}>{t.label} ({t.skuCode})</option>)}</select></div>
        <div><Label>Market (ISO-2)</Label><Input maxLength={2} value={form.market} onChange={e => F('market', e.target.value.toUpperCase())} placeholder="Any" /></div>
        <div><Label>Priority</Label><Input type="number" min="0" value={form.priority} onChange={e => F('priority', e.target.value)} /></div>
        <div><Label>Visit from</Label><Input type="date" value={form.validFrom} onChange={e => F('validFrom', e.target.value)} /></div>
        <div><Label>Visit to</Label><Input type="date" value={form.validTo} onChange={e => F('validTo', e.target.value)} /></div>
        <div><Label>Status</Label><select className={sel} value={form.status} onChange={e => F('status', e.target.value)}><option>Active</option><option>Inactive</option></select></div>
        <div className="md:col-span-4"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e => F('notes', e.target.value)} /></div>
      </div>
      <div className="flex gap-2"><Button disabled={saving || form.ruleName.trim().length < 3} onClick={() => save()}>{saving ? 'Saving…' : 'Save rule'}</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
    </section>}

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Calculator className="w-4 h-4" />Price preview</h2>
        <p className="text-xs text-muted-foreground">Exactly what an agency would be charged — same engine as search, hold and booking.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>SKU</Label><select className={sel} value={pv.ticketOptionId} onChange={e => setPv({ ...pv, ticketOptionId: e.target.value })}><option value="">Choose a SKU</option>{ws.tickets.map(t => <option key={t.id} value={t.id}>{t.label} ({t.skuCode})</option>)}</select></div>
          <div><Label>Agency</Label><select className={sel} value={pv.partnerAccountId} onChange={e => setPv({ ...pv, partnerAccountId: e.target.value })}><option value="">Simulate a tier</option>{ws.partners.map(p => <option key={p.id} value={p.id}>{p.agencyName}</option>)}</select></div>
          {!pv.partnerAccountId && <div><Label>Tier</Label><select className={sel} value={pv.agencyTier} onChange={e => setPv({ ...pv, agencyTier: e.target.value })}>{TIERS.map(t => <option key={t}>{t}</option>)}</select></div>}
          <div><Label>Visit date</Label><Input type="date" value={pv.date} onChange={e => setPv({ ...pv, date: e.target.value })} /></div>
          <div><Label>Market</Label><Input maxLength={2} value={pv.market} onChange={e => setPv({ ...pv, market: e.target.value.toUpperCase() })} placeholder="Any" /></div>
          <div><Label>Override cost (adult)</Label><Input type="number" min="0" value={pv.costAdult} onChange={e => setPv({ ...pv, costAdult: e.target.value })} placeholder="Use loaded rate" /></div>
        </div>
        <Button onClick={runPreview}>Preview price</Button>
        {preview && <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
          <p className="text-xs text-muted-foreground">Rule applied: <span className="font-semibold text-foreground">{preview.ruleLabel}</span></p>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div><p className="text-xs text-muted-foreground">Supplier cost</p><p className="font-bold">{aed(preview.costAdult)}</p></div>
            <div><p className="text-xs text-muted-foreground">Agent price</p><p className="font-black text-primary">{aed(preview.agentAdult)}</p></div>
            <div><p className="text-xs text-muted-foreground">RRP</p><p className="font-bold">{preview.retailAdult > 0 ? aed(preview.retailAdult) : 'Not set'}</p></div>
            <div><p className="text-xs text-muted-foreground">Our margin</p><p className="font-bold text-emerald-700">{aed(preview.markupAdult)}{preview.ourMarginPct !== null ? ` · ${preview.ourMarginPct}%` : ''}</p></div>
            <div className="col-span-2"><p className="text-xs text-muted-foreground">Agent margin to RRP</p><p className="font-bold">{preview.agentMarginAdult !== null ? aed(preview.agentMarginAdult) : '—'}</p></div>
          </div>
          {preview.costChild > 0 && <p className="text-xs text-muted-foreground">Child: cost {aed(preview.costChild)} → agent {aed(preview.agentChild)}</p>}
          {preview.warnings.map(w => <p key={w} className="text-xs text-amber-700">⚠ {w}</p>)}
        </div>}
      </section>

      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="font-bold">Agency pricing tiers</h2>
        <p className="text-xs text-muted-foreground">Tier-scoped rules apply to every agency in that tier. New agencies start on Standard.</p>
        <div className="divide-y">{ws.partners.map(p => <div key={p.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0"><p className="font-semibold text-sm truncate">{p.agencyName}</p><p className="text-[11px] text-muted-foreground truncate">{p.agencyEmail} · {p.accountStatus || '—'}</p></div>
          <select className={sel + ' max-w-[140px]'} value={p.agencyTier} onChange={async e => { try { await savePartnerAgencyTier({ partnerAccountId: p.id, agencyTier: e.target.value as any }); toast.success(`${p.agencyName} → ${e.target.value}`); load(); } catch (err: any) { toast.error(err?.message || 'Could not update tier'); } }}>{TIERS.map(t => <option key={t}>{t}</option>)}</select>
        </div>)}{ws.partners.length === 0 && <p className="text-sm text-muted-foreground py-2">No agencies yet.</p>}</div>
      </section>
    </div>

    <section className="rounded-2xl border bg-card overflow-hidden">
      <div className="p-4 border-b"><h2 className="font-bold">Recent bookings — margin</h2><p className="text-xs text-muted-foreground">Bookings made before the margin engine show cost = sell.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="text-left p-3">Reference</th><th className="text-left p-3">Attraction</th><th className="p-3">Visit</th><th className="text-right p-3">Cost</th><th className="text-right p-3">Sell</th><th className="text-right p-3">Margin</th><th className="text-left p-3">Rule</th></tr></thead>
        <tbody>{m.recent.map(b => <tr key={b.reference} className="border-t"><td className="p-3 font-mono text-xs">{b.reference}</td><td className="p-3">{b.attraction}</td><td className="p-3 text-center">{b.date}</td><td className="p-3 text-right">{aed(b.cost)}</td><td className="p-3 text-right">{aed(b.sell)}</td><td className="p-3 text-right font-bold text-emerald-700">{aed(b.markup)}</td><td className="p-3 text-xs">{b.rule}</td></tr>)}
        {m.recent.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={7}>No attraction bookings yet.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
