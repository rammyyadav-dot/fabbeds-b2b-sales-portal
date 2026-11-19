import { useState } from 'react';
import type { MouseEvent } from 'react';
import { Calendar } from '@project/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { ArrowRight, X } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

type DateRange = { from: Date | undefined; to?: Date | undefined };

interface Props {
  checkIn: string;
  checkOut: string;
  onCheckInChange: (date: string) => void;
  onCheckOutChange: (date: string) => void;
}

export default function DateRangePicker({ checkIn, checkOut, onCheckInChange, onCheckOutChange }: Props) {
  const [open, setOpen] = useState(false);

  const from = checkIn ? new Date(checkIn + 'T00:00:00') : undefined;
  const to = checkOut ? new Date(checkOut + 'T00:00:00') : undefined;
  const nights = from && to ? differenceInDays(to, from) : 0;

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) { onCheckInChange(''); onCheckOutChange(''); return; }
    onCheckInChange(range.from ? format(range.from, 'yyyy-MM-dd') : '');
    onCheckOutChange(range.to ? format(range.to, 'yyyy-MM-dd') : '');
    if (range.from && range.to) setOpen(false);
  };

  const clear = (e: MouseEvent) => {
    e.stopPropagation();
    onCheckInChange(''); onCheckOutChange('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-stretch border border-border rounded-xl overflow-hidden hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all bg-card"
        >
          <div className="flex-1 px-4 py-3 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Check-in</p>
            <p className={`text-sm font-semibold mt-0.5 ${from ? 'text-foreground' : 'text-muted-foreground/50'}`}>
              {from ? format(from, 'EEE, d MMM yyyy') : 'Add date'}
            </p>
          </div>
          <div className="flex items-center px-3 bg-muted/30 border-x border-border gap-1">
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            {nights > 0 && (
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                {nights}N
              </span>
            )}
          </div>
          <div className="flex-1 px-4 py-3 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Check-out</p>
            <p className={`text-sm font-semibold mt-0.5 ${to ? 'text-foreground' : 'text-muted-foreground/50'}`}>
              {to ? format(to, 'EEE, d MMM yyyy') : 'Add date'}
            </p>
          </div>
          {(from || to) && (
            <div className="flex items-center px-3 border-l border-border">
              <button type="button" onClick={clear} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-2xl border-border" align="start">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">
            {!from ? '📅 Select check-in date' : !to ? '📅 Now select check-out' : `✓ ${nights} night${nights !== 1 ? 's' : ''} selected`}
          </p>
          {(from || to) && (
            <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Clear</button>
          )}
        </div>
        <Calendar
          mode="range"
          selected={{ from, to }}
          onSelect={handleSelect as any}
          numberOfMonths={2}
          disabled={{ before: new Date() }}
          initialFocus
          className="p-3"
        />
      </PopoverContent>
    </Popover>
  );
}
