import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPromotions, savePromotion, getRoomTypes, getRatePlans, previewPromotion, GetPromotionsOutputType, GetRoomTypesOutputType, GetRatePlansOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Checkbox } from '@project/components/ui/checkbox';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@project/components/lib/utils';
import DateRangePicker from '@/components/DateRangePicker';
import PackageBenefitConfig, { PackageBenefit } from '@/components/PackageBenefitConfig';

type Promotion = GetPromotionsOutputType['promotions'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];
type RatePlan = GetRatePlansOutputType['ratePlans'][0];

const PROMO_TYPES = [
  { value: 'PercentOff', label: 'Percent Off', icon: '🏷️', desc: 'Discount a percentage off the base rate' },
  { value: 'EarlyBird', label: 'Early Bird Discount', icon: '🐦', desc: 'Reward advance bookings' },
  { value: 'FlashSale', label: 'Flash Sale', icon: '⚡', desc: 'Limited-time urgent sale' },
  { value: 'StayXPayY', label: 'Stay X Pay Y', icon: '🛏️', desc: 'e.g. Stay 3 nights, pay for 2' },
  { value: 'DiscountSubsequentNights', label: 'Discount Subsequent Nights', icon: '🌙', desc: 'Night 1 full price, nights 2+ discounted' },
  { value: 'FreeNight', label: 'Free Night', icon: '🎁', desc: 'Every Nth night is free' },
  { value: 'FixedAmountOff', label: 'Fixed Amount Off', icon: '💰', desc: 'Fixed AED amount off total' },
  { value: 'PackageAddOn', label: 'Package Add-On', icon: '📦', desc: 'e.g. Free breakfast included' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STATUSES = ['Draft', 'Validated', 'Scheduled', 'Active', 'Paused', 'Expired', 'Archived'];

const STATUS_COLOR: Record<string, string> = {
  Active: 'bg-green-100 text-green-800 border-green-200',
  Draft: 'bg-gray-100 text-gray-700 border-gray-200',
  Paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Expired: 'bg-orange-100 text-orange-800 border-orange-200',
  Archived: 'bg-red-100 text-red-800 border-red-200',
};

function Section({ title, children, color = 'bg-card' }: { title: string; children: React.ReactNode; color?: string }) {
  return (
    <Card className={`border border-border ${color}`}>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-base font-extrabold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">{children}</CardContent>
    </Card>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-bold text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function PromotionFormPage() {
  const { id: hotelId, promoId } = useParams<{ id: string; promoId: string }>();
  const navigate = useNavigate();
  const isNew = promoId === 'new';

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewInput, setPreviewInput] = useState({
    roomTypeId: '', ratePlanId: '', checkIn: '', checkOut: '', bookingDate: new Date().toISOString().slice(0,10),
    sourceMarket: 'IN', agencySegment: '', memberTier: '', isMember: false, channel: 'Bedbank',
    baseNet: 700, baseSell: 800, publicMarkupPct: 0,
  });
  const [form, setForm] = useState<Partial<Promotion> & { hotelId?: string }>(
    {
      hotelId,
      status: 'Draft',
      promoType: 'PercentOff',
      priority: 1,
      stackingPolicy: 'Exclusive',
      minLos: 1,
      startNightIndex: 2,
      applicableDays: [],
      fundingSource: 'Supplier Funded',
      sourceMarkets: 'ALL',
      wholeStayRequired: false,
      minimumSellFloorAed: 0,
      minimumMargin: 0,
      maximumDiscount: 0,
      allowBelowNet: false,
      overrideApproved: false,
      sameFamilyStacking: false,
    }
  );

  useEffect(() => {
    if (!hotelId) return;
    Promise.all([getRoomTypes({ hotelId }), getRatePlans({ hotelId })])
      .then(([rooms, plans]) => {
        setRoomTypes(rooms.roomTypes.filter(r => r.status !== 'Inactive'));
        setRatePlans(plans.ratePlans.filter(p => p.status === 'Active'));
      })
      .catch(() => { setRoomTypes([]); setRatePlans([]); });

    if (!isNew) {
      getPromotions({ hotelId }).then(r => {
        const found = r.promotions.find(p => p.id === promoId);
        if (found) setForm({ ...found, hotelId });
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [promoId, hotelId, isNew]);

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  const toggleDay = (d: string) => {
    const cur = (form.applicableDays ?? []) as string[];
    set('applicableDays', cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]);
  };

  const splitIds = (v?: string) => String(v || '').split(/[\s,;|]+/).filter(Boolean);
  const toggleScopedId = (field: 'roomTypeIDs' | 'ratePlanIDs', id: string) => {
    const current = splitIds(form[field] as string | undefined);
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    set(field, next.join(','));
  };

  const handlePreview = async () => {
    if (isNew || !promoId) {
      toast.error('Save the promotion as Draft before running the simulator.');
      return;
    }
    if (!previewInput.roomTypeId || !previewInput.ratePlanId || !previewInput.checkIn || !previewInput.checkOut) {
      toast.error('Select room, rate plan and preview dates.');
      return;
    }
    setPreviewBusy(true);
    try {
      const result = await previewPromotion({
        promotionId: promoId,
        hotelId: hotelId!,
        roomTypeId: previewInput.roomTypeId,
        ratePlanId: previewInput.ratePlanId,
        checkIn: previewInput.checkIn,
        checkOut: previewInput.checkOut,
        bookingDate: previewInput.bookingDate,
        sourceMarket: previewInput.sourceMarket || undefined,
        agencySegment: previewInput.agencySegment || undefined,
        memberTier: previewInput.memberTier || undefined,
        isMember: previewInput.isMember,
        channel: previewInput.channel || undefined,
        baseNet: Number(previewInput.baseNet),
        baseSell: Number(previewInput.baseSell),
        publicMarkupPct: Number(previewInput.publicMarkupPct),
      });
      setPreview(result);
    } catch (e:any) {
      toast.error(e?.message || 'Promotion preview failed');
      setPreview(null);
    } finally { setPreviewBusy(false); }
  };

  const handleSave = async (targetStatus?: string) => {
    if (!form.promotionCode || !form.promotionName || !hotelId) {
      toast.error('Promotion Code and Name are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(isNew ? {} : { id: promoId }),
        hotelId: hotelId!,
        promotionCode: form.promotionCode!,
        promotionName: form.promotionName!,
        status: targetStatus ?? form.status ?? 'Draft',
        promoType: form.promoType,
        priority: form.priority,
        stackingPolicy: form.stackingPolicy,
        isFlashSale: form.isFlashSale,
        memberOnly: form.memberOnly,
        discountPercent: form.discountPercent,
        discountAmount: form.discountAmount,
        stayNights: form.stayNights,
        payNights: form.payNights,
        startNightIndex: form.startNightIndex,
        minRateAfterDiscount: form.minRateAfterDiscount,
        minLos: form.minLos,
        maxLos: form.maxLos,
        minAdvanceDays: form.minAdvanceDays,
        maxAdvanceDays: form.maxAdvanceDays,
        stayStartDate: form.stayStartDate,
        stayEndDate: form.stayEndDate,
        bookingStartDate: form.bookingStartDate,
        bookingEndDate: form.bookingEndDate,
        applicableDays: form.applicableDays,
        descriptionPublic: form.descriptionPublic,
        descriptionInternal: form.descriptionInternal,
        packageBenefitJson: formAny.packageBenefitJson as string | undefined,
        channels: form.channels,
        roomTypeIDs: form.roomTypeIDs,
        ratePlanIDs: form.ratePlanIDs,
        fundingSource: form.fundingSource,
        sourceMarkets: form.sourceMarkets,
        agencySegments: form.agencySegments,
        memberTiers: form.memberTiers,
        wholeStayRequired: form.wholeStayRequired,
        minimumSellFloorAed: form.minimumSellFloorAed,
        minimumMargin: form.minimumMargin,
        maximumDiscount: form.maximumDiscount,
        allowBelowNet: form.allowBelowNet,
        overrideApproved: form.overrideApproved,
        overrideApprover: form.overrideApprover,
        overrideReason: form.overrideReason,
        stackingGroup: form.stackingGroup,
        compatiblePromotionIds: form.compatiblePromotionIds,
        incompatiblePromotionIds: form.incompatiblePromotionIds,
        sameFamilyStacking: form.sameFamilyStacking,
        reason: targetStatus === 'Active' ? 'Promotion activation from Admin TMS' : 'Promotion saved from Admin TMS',
      };
      await savePromotion(payload);
      toast.success(isNew ? 'Promotion created' : 'Promotion updated');
      navigate(`/hotels/${hotelId}?tab=promotions`);
    } catch {
      toast.error('Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  const showFixed = form.promoType === 'FixedAmountOff';
  const showStayPay = form.promoType === 'StayXPayY';
  const showSubsequent = form.promoType === 'DiscountSubsequentNights';
  const showPackage = form.promoType === 'PackageAddOn';

  const formAny = form as Record<string, unknown>;
  const packageBenefit: PackageBenefit = (() => {
    try { return JSON.parse((formAny.packageBenefitJson as string) ?? '{}'); } catch { return {}; }
  })();
  const setPackageBenefit = (v: PackageBenefit) => set('packageBenefitJson', JSON.stringify(v));

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to={`/hotels/${hotelId}?tab=promotions`}>
              <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">
                {isNew ? 'Create New Promotion' : `Edit: ${form.promotionName}`}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Set up a promotional offer for this property</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {form.status && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_COLOR[form.status] ?? ''}`}>{form.status}</span>
            )}
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger className="h-9 w-36 font-bold text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => handleSave('Draft')} disabled={saving} className="font-bold">Save Draft</Button>
            <Button onClick={() => handleSave('Active')} disabled={saving} className="gap-2 font-bold">
              <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Activate'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Basic Info */}
        <Section title="Basic Information" color="bg-blue-50/50">
          <Row>
            <Field label="Promotion Code" required hint="Unique code for this promotion">
              <Input value={form.promotionCode ?? ''} onChange={e => set('promotionCode', e.target.value.toUpperCase())}
                placeholder="E.G., SUMMER2026" className="font-mono font-bold" />
            </Field>
            <Field label="Promotion Name" required>
              <Input value={form.promotionName ?? ''} onChange={e => set('promotionName', e.target.value)}
                placeholder="e.g., Summer Special Discount" />
            </Field>
            <Field label="Priority" hint="Higher = applied first in conflicts">
              <Input type="number" value={form.priority ?? 1} onChange={e => set('priority', Number(e.target.value))} min={1} />
            </Field>
          </Row>
          <Row>
            <Field label="Stacking Policy">
              <Select value={form.stackingPolicy ?? 'Exclusive'} onValueChange={v => set('stackingPolicy', v)}>
                <SelectTrigger className="font-semibold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Exclusive">Exclusive</SelectItem>
                  <SelectItem value="Best Deal Only">Best Deal Only</SelectItem>
                  <SelectItem value="Stackable">Stackable</SelectItem>
                  <SelectItem value="StackableWithCoupons">Stackable With Coupons</SelectItem>
                  <SelectItem value="StackableWithMemberOnly">Stackable With Member Only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-6 pt-7">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={!!form.isFlashSale} onCheckedChange={v => set('isFlashSale', !!v)} />
                <div>
                  <p className="text-sm font-bold">Flash Sale</p>
                  <p className="text-xs text-muted-foreground">Mark as time-limited</p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={!!form.memberOnly} onCheckedChange={v => set('memberOnly', !!v)} />
                <div>
                  <p className="text-sm font-bold">Member Only</p>
                  <p className="text-xs text-muted-foreground">Restrict to members</p>
                </div>
              </label>
            </div>
          </Row>
        </Section>

        {/* Promotion Type */}
        <Section title="Promotion Type">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PROMO_TYPES.map(t => (
              <button key={t.value} onClick={() => set('promoType', t.value)}
                className={cn(
                  'p-3 rounded-xl border-2 text-left transition-all',
                  form.promoType === t.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 bg-card'
                )}>
                <span className="text-2xl">{t.icon}</span>
                <p className="text-sm font-extrabold mt-1 text-foreground leading-tight">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{t.desc}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* Package Benefit Configuration (when Package Add-On selected) */}
        {showPackage ? (
          <Section title="Package Benefit Configuration" color="bg-purple-50/40">
            <PackageBenefitConfig value={packageBenefit} onChange={setPackageBenefit} />
          </Section>
        ) : (
          /* Discount Configuration (all other promo types) */
          <Section title="Discount Configuration" color="bg-green-50/40">
            {/* Standard discount row */}
            {!showStayPay && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <Field label="Discount Type" required>
                  <Select
                    value={showFixed ? 'fixed' : 'percent'}
                    onValueChange={v => set('promoType', v === 'fixed' ? 'FixedAmountOff' : (form.promoType === 'FixedAmountOff' ? 'PercentOff' : form.promoType))}
                  >
                    <SelectTrigger className="font-semibold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (AED)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Discount Value" required>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={showFixed ? (form.discountAmount ?? '') : (form.discountPercent ?? '')}
                      onChange={e => showFixed ? set('discountAmount', Number(e.target.value)) : set('discountPercent', Number(e.target.value))}
                      min={0} max={showFixed ? undefined : 100} placeholder="0" className="font-bold"
                    />
                    <span className="text-sm font-bold text-muted-foreground shrink-0">{showFixed ? 'AED' : '%'}</span>
                  </div>
                </Field>
                <Field label="Min Length of Stay">
                  <div className="flex items-center gap-2">
                    <Input type="number" value={form.minLos ?? 1} onChange={e => set('minLos', Number(e.target.value))} min={1} className="font-semibold" />
                    <span className="text-sm font-bold text-muted-foreground shrink-0">nights</span>
                  </div>
                </Field>
              </div>
            )}
            {/* Stay X Pay Y */}
            {showStayPay && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <Field label="Stay Nights" required>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={form.stayNights ?? ''} onChange={e => set('stayNights', Number(e.target.value))} min={1} placeholder="3" />
                    <span className="text-sm font-bold text-muted-foreground shrink-0">nights</span>
                  </div>
                </Field>
                <Field label="Pay Nights" required>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={form.payNights ?? ''} onChange={e => set('payNights', Number(e.target.value))} min={1} placeholder="2" />
                    <span className="text-sm font-bold text-muted-foreground shrink-0">nights</span>
                  </div>
                </Field>
                <Field label="Min Length of Stay">
                  <div className="flex items-center gap-2">
                    <Input type="number" value={form.minLos ?? 1} onChange={e => set('minLos', Number(e.target.value))} min={1} />
                    <span className="text-sm font-bold text-muted-foreground shrink-0">nights</span>
                  </div>
                </Field>
              </div>
            )}
            {/* Subsequent nights extra field */}
            {showSubsequent && (
              <Field label="Discount From Night #">
                <div className="flex items-center gap-2 max-w-xs">
                  <Input type="number" value={form.startNightIndex ?? 2} onChange={e => set('startNightIndex', Number(e.target.value))} min={2} />
                  <span className="text-sm font-bold text-muted-foreground shrink-0">onwards</span>
                </div>
              </Field>
            )}
          </Section>
        )}

        {/* Eligibility / Dates */}
        <Section title="Eligibility & Stay Conditions">
          {/* Travel Period */}
          <Field label="Travel Period" required hint="The stay dates this promotion is valid for">
            <DateRangePicker
              checkin={form.stayStartDate ?? ''}
              checkout={form.stayEndDate ?? ''}
              onCheckinChange={v => set('stayStartDate', v)}
              onCheckoutChange={v => set('stayEndDate', v)}
            />
          </Field>

          {/* Booking Window */}
          <Field label="Booking Window" hint="The window during which guests must book to qualify">
            <DateRangePicker
              checkin={form.bookingStartDate ?? ''}
              checkout={form.bookingEndDate ?? ''}
              onCheckinChange={v => set('bookingStartDate', v)}
              onCheckoutChange={v => set('bookingEndDate', v)}
            />
          </Field>

          <Field label="Applicable Days of Week">
            <div className="flex gap-2 flex-wrap">
              {DAYS.map(d => (
                <button key={d} onClick={() => toggleDay(d)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all',
                    (form.applicableDays ?? []).includes(d)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground hover:border-primary/50'
                  )}>
                  {d}
                </button>
              ))}
              <button onClick={() => set('applicableDays', [])}
                className="px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-dashed border-border text-muted-foreground hover:border-primary/30">
                All Days
              </button>
            </div>
          </Field>
        </Section>


        {/* Inventory Scope */}
        <Section title="Inventory Scope" color="bg-amber-50/30">
          <p className="text-xs text-muted-foreground">Activation requires at least one Room Type and one active AED Rate Plan. Rate Plan scope must match the selected Room Type.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold">Room Types</Label>
              <div className="border rounded-xl p-2 max-h-48 overflow-y-auto space-y-1 bg-card">
                {roomTypes.map(rt => {
                  const checked = splitIds(form.roomTypeIDs).includes(rt.id);
                  return <label key={rt.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={() => toggleScopedId('roomTypeIDs', rt.id)} />
                    <span className="text-sm font-semibold">{rt.roomTypeName || 'Room Type'}</span>
                  </label>;
                })}
                {roomTypes.length === 0 && <p className="text-xs text-muted-foreground p-2">No active room types.</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Rate Plans</Label>
              <div className="border rounded-xl p-2 max-h-48 overflow-y-auto space-y-1 bg-card">
                {ratePlans.map(rp => {
                  const checked = splitIds(form.ratePlanIDs).includes(rp.id);
                  const roomId = Array.isArray((rp as any).roomType) ? (rp as any).roomType[0] : (rp as any).roomType;
                  const room = roomTypes.find(r => r.id === roomId);
                  return <label key={rp.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/40 cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={() => toggleScopedId('ratePlanIDs', rp.id)} />
                    <span className="text-sm">
                      <span className="font-semibold">{rp.ratePlanCode ? '[' + rp.ratePlanCode + '] ' : ''}{rp.ratePlanName}</span>
                      <span className="block text-[10px] text-muted-foreground">{room?.roomTypeName || 'Room'} · {rp.mealPlan || 'Meal plan'} · {rp.nationalityMarket || 'ALL'}</span>
                    </span>
                  </label>;
                })}
                {ratePlans.length === 0 && <p className="text-xs text-muted-foreground p-2">No active Rate Plans.</p>}
              </div>
            </div>
          </div>
          <Row>
            <Field label="Channels">
              <div className="flex flex-wrap gap-2">
                {['Direct','Bedbank','OTA','GDS'].map(ch => {
                  const checked = (form.channels ?? []).includes(ch);
                  return <label key={ch} className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={() => set('channels', checked ? (form.channels ?? []).filter(x => x !== ch) : [...(form.channels ?? []), ch])} />
                    {ch}
                  </label>;
                })}
              </div>
            </Field>
          </Row>
        </Section>

        {/* Market & Buyer Eligibility */}
        <Section title="Market & Buyer Eligibility">
          <Row>
            <Field label="Funding Source">
              <Select value={form.fundingSource ?? 'Supplier Funded'} onValueChange={v => set('fundingSource', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Supplier Funded">Supplier Funded</SelectItem>
                  <SelectItem value="Distributor Funded">Distributor Funded</SelectItem>
                  <SelectItem value="Joint Funded">Joint Funded</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Source Markets" hint="ALL or comma-separated ISO-style codes, e.g. IN,AE,SA,GB">
              <Input value={form.sourceMarkets ?? 'ALL'} onChange={e => set('sourceMarkets', e.target.value.toUpperCase())} placeholder="ALL" />
            </Field>
            <Field label="Agency Segments" hint="Comma-separated buyer segments">
              <Input value={form.agencySegments ?? ''} onChange={e => set('agencySegments', e.target.value)} placeholder="Travel Agent,DMC" />
            </Field>
          </Row>
          <Row>
            <Field label="Member Tiers" hint="Required when Member Only is enabled">
              <Input value={form.memberTiers ?? ''} onChange={e => set('memberTiers', e.target.value)} placeholder="Premium,Gold" />
            </Field>
            <div className="flex items-center gap-2 pt-7">
              <Checkbox checked={!!form.wholeStayRequired} onCheckedChange={v => set('wholeStayRequired', !!v)} />
              <div><p className="text-sm font-bold">Whole Stay Required</p><p className="text-xs text-muted-foreground">Entire stay must fall inside the travel period</p></div>
            </div>
          </Row>
        </Section>

        {/* Commercial Protection */}
        <Section title="Commercial Protection" color="bg-red-50/25">
          <Row>
            <Field label="Minimum Sell Floor AED">
              <Input type="number" min={0} value={form.minimumSellFloorAed ?? 0} onChange={e => set('minimumSellFloorAed', Number(e.target.value))} />
            </Field>
            <Field label="Minimum Margin %">
              <Input type="number" min={0} step="0.1" value={form.minimumMargin ?? 0} onChange={e => set('minimumMargin', Number(e.target.value))} />
            </Field>
            <Field label="Maximum Discount %">
              <Input type="number" min={0} max={100} step="0.1" value={form.maximumDiscount ?? 0} onChange={e => set('maximumDiscount', Number(e.target.value))} />
            </Field>
          </Row>
          <div className="border rounded-xl p-3 bg-card space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={!!form.allowBelowNet} onCheckedChange={v => set('allowBelowNet', !!v)} />
              <div><p className="text-sm font-bold">Allow Below Net</p><p className="text-xs text-muted-foreground">Default OFF. Requires explicit approved override.</p></div>
            </label>
            {form.allowBelowNet && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Override Approver"><Input value={form.overrideApprover ?? ''} onChange={e => set('overrideApprover', e.target.value)} /></Field>
              <div className="flex items-center gap-2 pt-7"><Checkbox checked={!!form.overrideApproved} onCheckedChange={v => set('overrideApproved', !!v)} /><span className="text-sm font-bold">Override Approved</span></div>
              <div className="sm:col-span-2"><Field label="Override Reason"><Textarea rows={2} value={form.overrideReason ?? ''} onChange={e => set('overrideReason', e.target.value)} /></Field></div>
            </div>}
          </div>
        </Section>

        {/* Stacking & Compatibility */}
        <Section title="Stacking & Compatibility">
          <Row>
            <Field label="Stacking Group"><Input value={form.stackingGroup ?? ''} onChange={e => set('stackingGroup', e.target.value)} placeholder="e.g. SUMMER_2026" /></Field>
            <Field label="Compatible Promotion IDs"><Input value={form.compatiblePromotionIds ?? ''} onChange={e => set('compatiblePromotionIds', e.target.value)} placeholder="Comma-separated IDs" /></Field>
            <Field label="Incompatible Promotion IDs"><Input value={form.incompatiblePromotionIds ?? ''} onChange={e => set('incompatiblePromotionIds', e.target.value)} placeholder="Comma-separated IDs" /></Field>
          </Row>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={!!form.sameFamilyStacking} onCheckedChange={v => set('sameFamilyStacking', !!v)} />
            <div><p className="text-sm font-bold">Allow Same-Family Stacking</p><p className="text-xs text-muted-foreground">OFF by default for percentage, free-night and Stay X Pay Y families.</p></div>
          </label>
        </Section>

        {/* Preview Simulator */}
        <Section title="Preview Simulator" color="bg-violet-50/30">
          <p className="text-xs text-muted-foreground">Read-only. Save as Draft first. This simulator does not write rates, inventory or bookings.</p>
          <Row>
            <Field label="Room Type">
              <Select value={previewInput.roomTypeId} onValueChange={v => setPreviewInput(p => ({...p, roomTypeId:v, ratePlanId:''}))}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>{roomTypes.map(r => <SelectItem key={r.id} value={r.id}>{r.roomTypeName || r.id}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Rate Plan">
              <Select value={previewInput.ratePlanId} onValueChange={v => setPreviewInput(p => ({...p, ratePlanId:v}))}>
                <SelectTrigger><SelectValue placeholder="Select rate plan" /></SelectTrigger>
                <SelectContent>{ratePlans.filter(rp => {
                  const roomId = Array.isArray((rp as any).roomType) ? (rp as any).roomType[0] : (rp as any).roomType;
                  return !previewInput.roomTypeId || roomId === previewInput.roomTypeId;
                }).map(rp => <SelectItem key={rp.id} value={rp.id}>{rp.ratePlanCode ? '['+rp.ratePlanCode+'] ' : ''}{rp.ratePlanName}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Source Market"><Input value={previewInput.sourceMarket} onChange={e => setPreviewInput(p => ({...p, sourceMarket:e.target.value.toUpperCase()}))} /></Field>
          </Row>
          <Row>
            <Field label="Check-in"><Input type="date" value={previewInput.checkIn} onChange={e => setPreviewInput(p => ({...p, checkIn:e.target.value}))} /></Field>
            <Field label="Check-out"><Input type="date" value={previewInput.checkOut} onChange={e => setPreviewInput(p => ({...p, checkOut:e.target.value}))} /></Field>
            <Field label="Booking Date"><Input type="date" value={previewInput.bookingDate} onChange={e => setPreviewInput(p => ({...p, bookingDate:e.target.value}))} /></Field>
          </Row>
          <Row>
            <Field label="Base Supplier Net AED"><Input type="number" min={0} value={previewInput.baseNet} onChange={e => setPreviewInput(p => ({...p, baseNet:Number(e.target.value)}))} /></Field>
            <Field label="Base B2B Sell AED"><Input type="number" min={0} value={previewInput.baseSell} onChange={e => setPreviewInput(p => ({...p, baseSell:Number(e.target.value)}))} /></Field>
            <Field label="Agent Extra Markup %"><Input type="number" min={0} max={50} value={previewInput.publicMarkupPct} onChange={e => setPreviewInput(p => ({...p, publicMarkupPct:Number(e.target.value)}))} /></Field>
          </Row>
          <div className="flex justify-end"><Button type="button" variant="outline" onClick={handlePreview} disabled={previewBusy || isNew}>{previewBusy ? 'Simulating…' : 'Run Pricing Preview'}</Button></div>
          {preview && <div className={cn('rounded-xl border p-4 text-sm', preview.eligible ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><p className="text-[10px] text-muted-foreground uppercase">Eligibility</p><p className="font-extrabold">{preview.eligible ? 'ELIGIBLE' : 'REJECTED'}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase">Base Sell</p><p className="font-extrabold">AED {preview.baseSell}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase">Promoted Sell</p><p className="font-extrabold">AED {preview.promotedSell}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase">Final Display</p><p className="font-extrabold">AED {preview.finalDisplayPrice}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase">Discount</p><p className="font-bold">AED {preview.discountAmount}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase">Protected Floor</p><p className="font-bold">AED {preview.protectedFloor}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase">Funding</p><p className="font-bold">{preview.fundingSource}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase">Override</p><p className="font-bold">{preview.overrideApplied ? 'Applied' : 'No'}</p></div>
            </div>
            {(preview.rejectedReasons?.length > 0 || preview.reasons?.length > 0) && <div className="mt-3 pt-3 border-t text-xs">
              {preview.rejectedReasons?.length > 0 && <p className="text-destructive font-semibold">Rejected: {preview.rejectedReasons.join(' · ')}</p>}
              {preview.reasons?.length > 0 && <p className="text-muted-foreground mt-1">Rules: {preview.reasons.join(' · ')}</p>}
            </div>}
          </div>}
        </Section>

        {/* Descriptions */}
        <Section title="Descriptions">
          <Field label="Public Description">
            <Textarea value={form.descriptionPublic ?? ''} onChange={e => set('descriptionPublic', e.target.value)}
              placeholder="What guests see on the booking engine / OTA listing" rows={3} />
          </Field>
          <Field label="Internal Notes">
            <Textarea value={form.descriptionInternal ?? ''} onChange={e => set('descriptionInternal', e.target.value)}
              placeholder="Internal notes for revenue management team" rows={2} />
          </Field>
        </Section>

        {/* Footer */}
        <div className="flex items-center justify-between py-4 border-t border-border">
          <Link to={`/hotels/${hotelId}?tab=promotions`}>
            <Button variant="outline" className="font-bold">Cancel</Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSave('Draft')} disabled={saving} className="font-bold">Save as Draft</Button>
            <Button onClick={() => handleSave('Active')} disabled={saving} className="gap-2 font-bold">
              <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save & Activate'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
