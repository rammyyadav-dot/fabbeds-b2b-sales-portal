import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Badge } from '@project/components/ui/badge';
import { Separator } from '@project/components/ui/separator';
import { Edit2, Save, X, Star, MapPin, Building2, Phone, Mail, User, PhoneCall } from 'lucide-react';
import { GetHotelsOutputType } from 'zitejs/api';

type Hotel = GetHotelsOutputType['hotels'][0];

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Fujairah', 'Ajman', 'Umm Al Quwain'];
const STAR_RATINGS = ['3 Star', '4 Star', '5 Star'];
const STAR_COLORS: Record<string, string> = { '3 Star': 'text-yellow-500', '4 Star': 'text-orange-500', '5 Star': 'text-purple-500' };

interface Props {
  hotel: Hotel;
  onSave: (data: any) => Promise<void>;
  saving?: boolean;
  readOnly?: boolean;
}

export default function HotelProfileTab({ hotel, onSave, saving, readOnly }: Props) {
  const [editing, setEditing] = useState(false);
  const { register, handleSubmit, setValue, watch, reset } = useForm<any>({
    defaultValues: {
      hotelName: hotel.hotelName,
      description: hotel.description,
      status: hotel.status,
      emirate: hotel.emirate,
      location: hotel.location,
      starRating: hotel.starRating,
      reservationEmail: hotel.reservationEmail,
      financeEmail: hotel.financeEmail,
      salesManager: hotel.salesManager,
      mobileNo: hotel.mobileNo,
      hotelCode: hotel.hotelCode,
    },
  });

  const startEdit = () => {
    reset({
      hotelName: hotel.hotelName, description: hotel.description, status: hotel.status,
      emirate: hotel.emirate, location: hotel.location, starRating: hotel.starRating,
      reservationEmail: hotel.reservationEmail, financeEmail: hotel.financeEmail,
      salesManager: hotel.salesManager, mobileNo: hotel.mobileNo,
    });
    setEditing(true);
  };

  const onSubmit = async (data: any) => {
    await onSave({ ...data, id: hotel.id });
    setEditing(false);
  };

  if (!editing) {
    return <HotelProfileView hotel={hotel} onEdit={readOnly ? undefined : startEdit} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <ProfileSection title="Hotel Profile" icon={<Building2 className="w-4 h-4" />}>
        <div className="grid gap-4">
          <Field label="Hotel Name *">
            <Input {...register('hotelName', { required: true })} placeholder="e.g. Burj Al Arab" />
          </Field>
          <Field label="Description">
            <Textarea {...register('description')} rows={3} placeholder="Hotel description..." />
          </Field>
          <Field label="Status">
            <Select value={watch('status')} onValueChange={v => setValue('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </ProfileSection>

      <Separator />

      <ProfileSection title="Location" icon={<MapPin className="w-4 h-4" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Emirate">
            <Select value={watch('emirate')} onValueChange={v => setValue('emirate', v)}>
              <SelectTrigger><SelectValue placeholder="Select emirate" /></SelectTrigger>
              <SelectContent>{EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Address / Location">
            <Input {...register('location')} placeholder="e.g. Jumeirah Beach Road" />
          </Field>
        </div>
      </ProfileSection>

      <Separator />

      <ProfileSection title="Star Category" icon={<Star className="w-4 h-4" />}>
        <div className="grid grid-cols-3 gap-3">
          {STAR_RATINGS.map(r => (
            <button key={r} type="button"
              onClick={() => setValue('starRating', r)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                watch('starRating') === r
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}>
              <Star className={`w-4 h-4 mx-auto mb-1 fill-current ${STAR_COLORS[r] || ''}`} />
              {r}
            </button>
          ))}
        </div>
      </ProfileSection>

      <Separator />

      <ProfileSection title="Contact Details (LPO System)" icon={<PhoneCall className="w-4 h-4" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reservation Email">
            <Input {...register('reservationEmail')} type="email" placeholder="reservations@hotel.com" />
          </Field>
          <Field label="Finance Email">
            <Input {...register('financeEmail')} type="email" placeholder="finance@hotel.com" />
          </Field>
          <Field label="Sales Manager">
            <Input {...register('salesManager')} placeholder="e.g. Ahmed Al Mansouri" />
          </Field>
          <Field label="Mobile No">
            <Input {...register('mobileNo')} placeholder="+971 50 000 0000" />
          </Field>
        </div>
      </ProfileSection>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

function HotelProfileView({ hotel, onEdit }: { hotel: Hotel; onEdit?: () => void }) {
  return (
    <div className="space-y-5">
      {onEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
            <Edit2 className="w-3.5 h-3.5" /> Edit Profile
          </Button>
        </div>
      )}

      <ProfileSection title="Hotel Profile" icon={<Building2 className="w-4 h-4" />}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <InfoRow label="Hotel Name" value={hotel.hotelName} />
            {hotel.hotelCode && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Hotel Code</span>
                <Badge variant="secondary" className="font-mono text-xs w-fit">{hotel.hotelCode}</Badge>
              </div>
            )}
          </div>
          <InfoRow label="Description" value={hotel.description} />
          <InfoRow label="Status">
            <Badge variant={hotel.status === 'Active' ? 'default' : 'secondary'}>{hotel.status || 'Active'}</Badge>
          </InfoRow>
        </div>
      </ProfileSection>

      <Separator />

      <ProfileSection title="Location" icon={<MapPin className="w-4 h-4" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Emirate" value={hotel.emirate} />
          <InfoRow label="Address" value={hotel.location} />
        </div>
      </ProfileSection>

      <Separator />

      <ProfileSection title="Star Category" icon={<Star className="w-4 h-4" />}>
        {hotel.starRating ? (
          <div className="flex items-center gap-2">
            <div className="flex">
              {Array.from({ length: parseInt(hotel.starRating) || 0 }).map((_, i) => (
                <Star key={i} className={`w-5 h-5 fill-current ${STAR_COLORS[hotel.starRating!] || 'text-yellow-400'}`} />
              ))}
            </div>
            <span className="font-medium">{hotel.starRating}</span>
          </div>
        ) : <span className="text-muted-foreground text-sm">Not set</span>}
      </ProfileSection>

      <Separator />

      <ProfileSection title="Contact Details (LPO System)" icon={<PhoneCall className="w-4 h-4" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Reservation Email" icon={<Mail className="w-3.5 h-3.5 text-primary" />} value={hotel.reservationEmail} />
          <InfoRow label="Finance Email" icon={<Mail className="w-3.5 h-3.5 text-primary" />} value={hotel.financeEmail} />
          <InfoRow label="Sales Manager" icon={<User className="w-3.5 h-3.5 text-primary" />} value={hotel.salesManager} />
          <InfoRow label="Mobile No" icon={<Phone className="w-3.5 h-3.5 text-primary" />} value={hotel.mobileNo} />
        </div>
      </ProfileSection>
    </div>
  );
}

function ProfileSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function InfoRow({ label, value, icon, children }: { label: string; value?: string; icon?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children || (
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-medium">{value || <span className="text-muted-foreground">—</span>}</span>
        </div>
      )}
    </div>
  );
}
