import { useState, useEffect } from 'react';
import { getHotels, getRoomTypes, GetHotelsOutputType, GetRoomTypesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Calculator, Search } from 'lucide-react';

type Hotel = GetHotelsOutputType['hotels'][0];
type RoomType = GetRoomTypesOutputType['roomTypes'][0];

export interface PricingSearchParams {
  hotelId: string;
  roomTypeId: string;
  checkinDate: string;
  checkoutDate: string;
  adults: number;
  children: number;
  minimumMarginFloor: number;
}

interface Props {
  onSearch: (params: PricingSearchParams) => void;
  loading: boolean;
}

export default function PricingSearchForm({ onSearch, loading }: Props) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [form, setForm] = useState<PricingSearchParams>({
    hotelId: '', roomTypeId: '', checkinDate: '', checkoutDate: '',
    adults: 2, children: 0, minimumMarginFloor: 0,
  });

  useEffect(() => { getHotels({}).then(r => setHotels(r.hotels)); }, []);

  useEffect(() => {
    if (form.hotelId) {
      getRoomTypes({ hotelId: form.hotelId }).then(r => {
        setRoomTypes(r.roomTypes);
        setForm(f => ({ ...f, roomTypeId: '' }));
      });
    }
  }, [form.hotelId]);

  const set = (k: keyof PricingSearchParams, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  const canSearch = form.hotelId && form.roomTypeId && form.checkinDate && form.checkoutDate && form.checkinDate < form.checkoutDate;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-foreground">Rate Engine Parameters</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Hotel</Label>
          <Select value={form.hotelId} onValueChange={v => set('hotelId', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select hotel" /></SelectTrigger>
            <SelectContent>{hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.hotelName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Room Type</Label>
          <Select value={form.roomTypeId} onValueChange={v => set('roomTypeId', v)} disabled={!form.hotelId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select room" /></SelectTrigger>
            <SelectContent>{roomTypes.map(r => <SelectItem key={r.id} value={r.id}>{r.roomTypeName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Check-in</Label>
          <Input type="date" className="h-9 text-sm" value={form.checkinDate} onChange={e => set('checkinDate', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Check-out</Label>
          <Input type="date" className="h-9 text-sm" value={form.checkoutDate} onChange={e => set('checkoutDate', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Adults</Label>
          <Select value={String(form.adults)} onValueChange={v => set('adults', Number(v))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{[1,2,3].map(n => <SelectItem key={n} value={String(n)}>{n} Adult{n>1?'s':''}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Children</Label>
          <Select value={String(form.children)} onValueChange={v => set('children', Number(v))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{[0,1,2,3].map(n => <SelectItem key={n} value={String(n)}>{n} Child{n!==1?'ren':''}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Min Margin Floor (AED)</Label>
          <Input type="number" min={0} className="h-9 text-sm" value={form.minimumMarginFloor} onChange={e => set('minimumMarginFloor', Number(e.target.value))} placeholder="0" />
        </div>
        <div className="flex items-end">
          <Button className="w-full h-9 gap-2" disabled={!canSearch || loading} onClick={() => onSearch(form)}>
            <Search className="w-4 h-4" />
            {loading ? 'Calculating…' : 'Run Engine'}
          </Button>
        </div>
      </div>
    </div>
  );
}
