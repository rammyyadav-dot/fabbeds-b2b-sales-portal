import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { ScrollArea } from '@project/components/ui/scroll-area';
import { Separator } from '@project/components/ui/separator';
import { FileText, User, Calendar, Calculator } from 'lucide-react';
import DatePickerInput from '@/components/DatePickerInput';
import { SearchHotelsOutputType } from 'zitejs/api';
import QuoteDocuments from '@/components/QuoteDocuments';
import { differenceInDays } from 'date-fns';

type Hotel = SearchHotelsOutputType['hotels'][0];
type RoomType = Hotel['roomTypes'][0];

interface Props {
  hotel: Hotel; onClose: () => void;
  nights?: number; rooms?: number; adults?: number; children?: number;
  checkin?: string; checkout?: string;
}

function genRef() { return `BK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`; }

function getBaseRate(rt: RoomType, adults: number): number {
  if (adults <= 1) return rt.sellRate1 ?? rt.sellRate2 ?? 0;
  if (adults === 2) return rt.sellRate2 ?? rt.sellRate1 ?? 0;
  return rt.sellRate3 ?? rt.sellRate2 ?? rt.sellRate1 ?? 0;
}

function RateSummary({ rt, adults, children, rooms, nights }: { rt: RoomType; adults: number; children: number; rooms: number; nights: number }) {
  const baseRate = getBaseRate(rt, adults);
  const childSupp = children > 0 ? (rt.childSupplementSell ?? 0) : 0;
  const childTotal = childSupp * children;
  const ratePerRoomNight = baseRate + childTotal;
  const subtotal = ratePerRoomNight * nights * rooms;
  const vat = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + vat;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 text-sm">
      <p className="font-bold text-foreground flex items-center gap-1.5"><Calculator className="w-4 h-4 text-primary" />Total Payable Calculation</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Base Rate (Occ {adults}) per room/night</span><span className="font-medium text-foreground">AED {Math.round(baseRate).toLocaleString()}</span>
        </div>
        {children > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Child Supplement × {children} child{children > 1 ? 'ren' : ''}</span><span className="font-medium text-foreground">AED {Math.round(childTotal).toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between font-medium border-t pt-1">
          <span>Rate per room/night</span><span>AED {Math.round(ratePerRoomNight).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>× {nights} night{nights !== 1 ? 's' : ''} × {rooms} room{rooms !== 1 ? 's' : ''}</span>
          <span className="font-medium text-foreground">AED {Math.round(subtotal).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>VAT (5%)</span><span>AED {vat.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-bold text-base border-t pt-1.5 text-primary">
          <span>Total Payable</span><span>AED {grandTotal.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function BookingQuoteDialog({ hotel, onClose, nights: initNights = 0, rooms: initRooms = 1, adults: initAdults = 2, children: initChildren = 0, checkin: initCheckin = '', checkout: initCheckout = '' }: Props) {
  const [tab, setTab] = useState('details');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestNationality, setGuestNationality] = useState('');
  const [checkIn, setCheckIn] = useState(initCheckin);
  const [checkOut, setCheckOut] = useState(initCheckout);
  const [adults, setAdults] = useState(String(initAdults));
  const [children, setChildren] = useState(String(initChildren));
  const [rooms, setRooms] = useState(String(initRooms));
  const [roomTypeId, setRoomTypeId] = useState('');
  const [quoteData, setQuoteData] = useState<any>(null);

  const selectedRoom = hotel.roomTypes.find(r => r.id === roomTypeId);
  const nights = checkIn && checkOut ? Math.max(1, differenceInDays(new Date(checkOut), new Date(checkIn))) : (initNights || 1);
  const A = Number(adults); const C = Number(children); const R = Number(rooms);

  const baseRate = selectedRoom ? getBaseRate(selectedRoom, A) : 0;
  const childSupp = C > 0 && selectedRoom?.childSupplementSell != null ? selectedRoom.childSupplementSell * C : 0;
  const ratePerRoomNight = baseRate + childSupp;
  const subtotal = ratePerRoomNight * nights * R;
  const vat = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + vat;

  const canGenerate = guestName && guestEmail && checkIn && checkOut && roomTypeId;

  const handleGenerate = () => {
    setQuoteData({
      bookingRef: genRef(), hotelName: hotel.hotelName || '',
      roomType: selectedRoom?.roomTypeName || '', mealPlan: selectedRoom?.mealPlan || '',
      checkIn, checkOut, nights, adults: A, children: C, rooms: R,
      guestName, guestEmail, guestPhone,
      baseRate, childSupplement: childSupp / (C || 1), ratePerRoomNight,
      subtotal, vat, grandTotal,
    });
    setTab('documents');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" /> Reservation Request — {hotel.hotelName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 w-fit">
            <TabsTrigger value="details" className="gap-1.5"><User className="w-3.5 h-3.5" />Details</TabsTrigger>
            <TabsTrigger value="documents" disabled={!quoteData} className="gap-1.5"><FileText className="w-3.5 h-3.5" />Documents</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="details" className="px-6 py-4 space-y-4 mt-0">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Guest Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input placeholder="Ahmed Al Mansouri" value={guestName} onChange={e => setGuestName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Nationality</Label><Input placeholder="UAE" value={guestNationality} onChange={e => setGuestNationality(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input type="email" placeholder="guest@email.com" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Phone (WhatsApp)</Label><Input placeholder="+971 50 000 0000" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} /></div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Stay Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Check-in *</Label><DatePickerInput value={checkIn} onChange={setCheckIn} placeholder="Check-in date" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Check-out *</Label><DatePickerInput value={checkOut} onChange={setCheckOut} placeholder="Check-out date" /></div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Adults</Label>
                    <Select value={adults} onValueChange={setAdults}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n} Adult{n>1?'s':''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Children</Label>
                    <Select value={children} onValueChange={setChildren}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n} Child{n!==1?'ren':''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rooms</Label>
                    <Select value={rooms} onValueChange={setRooms}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={String(n)}>{n} Room{n>1?'s':''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Room Type *</Label>
                    <Select value={roomTypeId} onValueChange={setRoomTypeId}>
                      <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                      <SelectContent>
                        {hotel.roomTypes.map(rt => (
                          <SelectItem key={rt.id} value={rt.id}>
                            {rt.roomTypeName}{rt.mealPlan ? ` (${rt.mealPlan})` : ''}{getBaseRate(rt, A) > 0 ? ` — AED ${Math.round(getBaseRate(rt, A)).toLocaleString()}/night` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {selectedRoom && ratePerRoomNight > 0 && checkIn && checkOut && (
                <RateSummary rt={selectedRoom} adults={A} children={C} rooms={R} nights={nights} />
              )}

              <Button className="w-full gap-2" disabled={!canGenerate} onClick={handleGenerate}>
                <FileText className="w-4 h-4" /> Generate Quote Documents
              </Button>
            </TabsContent>

            <TabsContent value="documents" className="px-6 py-4 mt-0">
              {quoteData && <QuoteDocuments data={quoteData} />}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
