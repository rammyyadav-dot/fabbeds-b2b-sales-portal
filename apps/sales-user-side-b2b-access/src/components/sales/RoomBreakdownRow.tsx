import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface RoomItem {
  roomNo: number;
  adults: number;
  children: number;
  nightlyTotal: number;
  roomTotal: number;
  sellNightlyTotal: number;
  sellRoomTotal: number;
  isValidOccupancy: boolean;
  occupancyError?: string;
  payingChildren: number;
  freeChildren: number;
  baseRate: number;
  childTotal: number;
  extraBedTotal: number;
}

interface Props {
  room: RoomItem;
  nights: number;
  freeChildAge: number;
}

const aed = (n: number) => `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function RoomBreakdownRow({ room, nights, freeChildAge }: Props) {
  const occupancyLabel = `${room.adults}A${room.children > 0 ? `+${room.children}C` : ''}`;
  // Show sell rates to agents (markup applied, internal pricing hidden)
  const displayNightly = room.sellNightlyTotal || room.nightlyTotal;
  const displayTotal = room.sellRoomTotal || room.roomTotal;

  return (
    <div className={`rounded-lg border p-2.5 space-y-1 ${
      room.isValidOccupancy ? 'border-border bg-background/60' : 'border-destructive/30 bg-destructive/5'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {room.isValidOccupancy
            ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            : <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
          <span className="text-xs font-semibold text-foreground">Room {room.roomNo}</span>
          <span className="text-xs text-muted-foreground">{occupancyLabel}</span>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-foreground">{aed(displayTotal)}</p>
          <p className="text-[10px] text-muted-foreground">{aed(displayNightly)}/night × {nights}N</p>
        </div>
      </div>
      {room.childTotal > 0 && (
        <p className="text-[10px] text-muted-foreground pl-4.5">
          {room.payingChildren} paying child{room.payingChildren !== 1 ? 'ren' : ''}
          {room.freeChildren > 0 ? ` · ${room.freeChildren} free (<${freeChildAge}yr)` : ''}
        </p>
      )}
      {!room.isValidOccupancy && room.occupancyError && (
        <p className="text-[11px] text-destructive font-medium">{room.occupancyError}</p>
      )}
    </div>
  );
}
