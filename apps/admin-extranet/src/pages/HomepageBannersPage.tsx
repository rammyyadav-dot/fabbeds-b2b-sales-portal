import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Loader2, Megaphone, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useUpload } from 'zitejs/upload';
import {
  deleteHomepageBanner,
  getHomepageBannersAdmin,
  getHotels,
  saveHomepageBanner,
  type GetHomepageBannersAdminOutputType,
  type GetHotelsOutputType,
} from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Switch } from '@project/components/ui/switch';
import { Badge } from '@project/components/ui/badge';

type Banner = GetHomepageBannersAdminOutputType['banners'][0];
type Hotel = GetHotelsOutputType['hotels'][0];

type FormState = {
  id?: string;
  name: string;
  type: 'Hero Banner' | 'Hotel Deal' | 'Destination Banner' | 'Promo Strip';
  desktopImageUrl: string;
  mobileImageUrl: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaUrl: string;
  destination: string;
  hotelId: string;
  displayOrder: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  audience: 'All' | 'Signed In' | 'New Visitors';
  altText: string;
  imageCredit: string;
};

const EMPTY: FormState = {
  name: '',
  type: 'Hotel Deal',
  desktopImageUrl: '',
  mobileImageUrl: '',
  headline: '',
  subheadline: '',
  ctaLabel: '',
  ctaUrl: '',
  destination: 'UAE',
  hotelId: '',
  displayOrder: '0',
  startDate: '',
  endDate: '',
  isActive: true,
  audience: 'All',
  altText: '',
  imageCredit: '',
};

const DESTINATIONS = ['UAE','Dubai','Abu Dhabi','Sharjah','Ras Al Khaimah','Fujairah','Ajman','Umm Al Quwain'];

export default function HomepageBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { upload, isUploading } = useUpload();

  const load = async () => {
    setLoading(true);
    try {
      const [b, h] = await Promise.all([getHomepageBannersAdmin({}), getHotels({})]);
      setBanners(b.banners);
      setHotels(h.hotels);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load homepage banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeCount = useMemo(() => banners.filter(b => b.isActive).length, [banners]);

  const edit = (b: Banner) => {
    setForm({
      id: b.id,
      name: b.name,
      type: b.type as FormState['type'],
      desktopImageUrl: b.desktopImageUrl || '',
      mobileImageUrl: b.mobileImageUrl || '',
      headline: b.headline || '',
      subheadline: b.subheadline || '',
      ctaLabel: b.ctaLabel || '',
      ctaUrl: b.ctaUrl || '',
      destination: b.destination || 'UAE',
      hotelId: b.hotelId || '',
      displayOrder: String(b.displayOrder || 0),
      startDate: b.startDate || '',
      endDate: b.endDate || '',
      isActive: b.isActive,
      audience: b.audience as FormState['audience'],
      altText: b.altText || '',
      imageCredit: b.imageCredit || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadImage = async (file: File, target: 'desktopImageUrl' | 'mobileImageUrl') => {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      toast.error('Use JPG, PNG or WebP images only.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8 MB.');
      return;
    }

    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const value = { width: image.naturalWidth, height: image.naturalHeight };
        URL.revokeObjectURL(objectUrl);
        resolve(value);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read image dimensions.'));
      };
      image.src = objectUrl;
    }).catch(() => null);

    if (!dims) {
      toast.error('Could not validate image dimensions.');
      return;
    }

    const isHeroOrDeal = form.type === 'Hero Banner' || form.type === 'Hotel Deal';
    const minWidth = target === 'desktopImageUrl' ? (isHeroOrDeal ? 1600 : 1200) : 720;
    const minHeight = target === 'desktopImageUrl' ? (isHeroOrDeal ? 700 : 500) : (isHeroOrDeal ? 900 : 600);

    if (dims.width < minWidth || dims.height < minHeight) {
      toast.error(`Image is too small. Minimum: ${minWidth}×${minHeight}px; uploaded: ${dims.width}×${dims.height}px.`);
      return;
    }

    try {
      const result = await upload(file, `uaewb-home-${Date.now()}-${file.name}`);
      setForm(prev => ({ ...prev, [target]: result.url }));
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Image upload failed');
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Banner name is required');
    if (!form.desktopImageUrl) return toast.error('Desktop image is required');

    setSaving(true);
    try {
      await saveHomepageBanner({
        id: form.id,
        name: form.name.trim(),
        type: form.type,
        desktopImageUrl: form.desktopImageUrl,
        mobileImageUrl: form.mobileImageUrl || undefined,
        headline: form.headline || undefined,
        subheadline: form.subheadline || undefined,
        ctaLabel: form.ctaLabel || undefined,
        ctaUrl: form.ctaUrl || undefined,
        destination: form.destination as any,
        hotelId: form.hotelId || undefined,
        displayOrder: Math.max(0, Number(form.displayOrder) || 0),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        isActive: form.isActive,
        audience: form.audience,
        altText: form.altText || undefined,
        imageCredit: form.imageCredit || undefined,
      });
      toast.success(form.id ? 'Banner updated' : 'Banner created');
      setForm(EMPTY);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: Banner) => {
    if (!window.confirm(`Delete "${b.name}"?`)) return;
    try {
      await deleteHomepageBanner({ id: b.id });
      toast.success('Banner deleted');
      if (form.id === b.id) setForm(EMPTY);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete banner');
    }
  };

  return (
    <div className="p-5 lg:p-7 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-black">Homepage Campaign Banners</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and schedule fabBeds hero, hotel-deal, destination and promotional banners. Currency is locked to AED.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{activeCount} active</Badge>
          <Button variant="outline" size="sm" onClick={() => setForm(EMPTY)}><Plus className="w-4 h-4 mr-1" /> New banner</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <section className="bg-card border border-border rounded-xl p-5 space-y-4 h-fit">
          <div>
            <h2 className="font-bold">{form.id ? 'Edit banner' : 'Create banner'}</h2>
            <p className="text-xs text-muted-foreground mt-1">Desktop image is mandatory; mobile image is optional.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Banner name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dubai Winter Deal" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Banner type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as FormState['type'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Hero Banner','Hotel Deal','Destination Banner','Promo Strip'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v as FormState['audience'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['All','Signed In','New Visitors'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Desktop image *</Label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:bg-muted/40">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="text-sm font-semibold">{form.desktopImageUrl ? 'Replace desktop image' : 'Upload desktop image'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, 'desktopImageUrl');
                e.currentTarget.value = '';
              }} />
            </label>
            {form.desktopImageUrl && <img src={form.desktopImageUrl} alt="" className="w-full h-36 object-cover rounded-lg border" />}
          </div>

          <div className="space-y-1.5">
            <Label>Mobile image</Label>
            <label className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg p-3 cursor-pointer hover:bg-muted/40">
              <ImagePlus className="w-4 h-4" />
              <span className="text-sm">{form.mobileImageUrl ? 'Replace mobile image' : 'Upload mobile image'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, 'mobileImageUrl');
                e.currentTarget.value = '';
              }} />
            </label>
          </div>

          <div className="space-y-1.5"><Label>Headline</Label><Input value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Subheadline</Label><Textarea rows={2} value={form.subheadline} onChange={e => setForm(f => ({ ...f, subheadline: e.target.value }))} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>CTA label</Label><Input value={form.ctaLabel} onChange={e => setForm(f => ({ ...f, ctaLabel: e.target.value }))} placeholder="View Deal" /></div>
            <div className="space-y-1.5"><Label>CTA URL</Label><Input value={form.ctaUrl} onChange={e => setForm(f => ({ ...f, ctaUrl: e.target.value }))} placeholder="/search?q=Dubai" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Destination</Label>
              <Select value={form.destination} onValueChange={v => setForm(f => ({ ...f, destination: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DESTINATIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hotel (optional)</Label>
              <Select value={form.hotelId || 'none'} onValueChange={v => setForm(f => ({ ...f, hotelId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="No hotel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No hotel</SelectItem>
                  {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.hotelName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Order</Label><Input type="number" min="0" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Start</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>End</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          </div>

          <div className="space-y-1.5"><Label>Alt text</Label><Input value={form.altText} onChange={e => setForm(f => ({ ...f, altText: e.target.value }))} placeholder="Describe the banner image" /></div>
          <div className="space-y-1.5"><Label>Image credit / licence note</Label><Input value={form.imageCredit} onChange={e => setForm(f => ({ ...f, imageCredit: e.target.value }))} placeholder="Photographer / source / licence" /></div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <div><p className="text-sm font-semibold">Active</p><p className="text-xs text-muted-foreground">Inactive banners never render publicly.</p></div>
            <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || isUploading} className="flex-1">
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving</> : 'Save banner'}
            </Button>
            {form.id && <Button variant="outline" onClick={() => setForm(EMPTY)}>Cancel</Button>}
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">Loading banners…</div>
          ) : banners.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center">
              <ImagePlus className="w-9 h-9 mx-auto text-muted-foreground mb-3" />
              <p className="font-bold">No campaign banners yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload the first fabBeds hotel-deal or hero campaign banner.</p>
            </div>
          ) : banners.map(b => (
            <div key={b.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col md:flex-row">
              <div className="md:w-64 h-40 md:h-auto bg-muted shrink-0">
                {b.desktopImageUrl
                  ? <img src={b.desktopImageUrl} alt={b.altText || b.name} className="w-full h-full object-cover" />
                  : <div className="h-full flex items-center justify-center text-muted-foreground"><ImagePlus className="w-7 h-7" /></div>}
              </div>
              <div className="p-4 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={b.isActive ? 'default' : 'secondary'}>{b.isActive ? 'Active' : 'Inactive'}</Badge>
                      <Badge variant="outline">{b.type}</Badge>
                      <Badge variant="outline">AED</Badge>
                    </div>
                    <h3 className="font-bold mt-2">{b.name}</h3>
                    {b.headline && <p className="text-sm mt-1">{b.headline}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {b.destination || 'UAE'} · order {b.displayOrder}
                      {b.startDate ? ` · from ${b.startDate}` : ''}
                      {b.endDate ? ` · until ${b.endDate}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" onClick={() => edit(b)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="outline" className="text-destructive" onClick={() => remove(b)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
