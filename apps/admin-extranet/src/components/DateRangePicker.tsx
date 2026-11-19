import { useState, useRef, useEffect } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isSameDay, isWithinInterval,
  parseISO, isBefore, isToday, isAfter,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@project/components/lib/utils';

interface Props {
  checkin: string;
  checkout: string;
  onCheckinChange: (d: string) => void;
  onCheckoutChange: (d: string) => void;
  minDate?: Date;
  allowPast?: boolean;
  startLabel?: string;
  endLabel?: string;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function MonthGrid({
  month, checkin, checkout, hover, selecting, onDay, onHover, allowPast,
}: {
  month: Date; checkin: string; checkout: string;
  hover: Date | null; selecting: 'start' | 'end';
  onDay: (d: Date) => void; onHover: (d: Date | null) => void;
  allowPast?: boolean;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });
  const ci = checkin ? parseISO(checkin) : null;
  const co = checkout ? parseISO(checkout) : null;
  const rangeEnd = co ?? (selecting === 'end' && ci && hover && isAfter(hover, ci) ? hover : null);

  return (
    <div className="min-w-[220px]">
      <p className="text-center text-sm font-semibold text-foreground mb-3">
        {format(month, 'MMMM yyyy')}
      </p>
      <div className="grid grid-cols-7">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground pb-2">{d}</div>
        ))}
        {days.map(day => {
          const inMonth = isSameMonth(day, month);
          const isStart = ci && isSameDay(day, ci);
          const isEnd = co && isSameDay(day, co);
          const inRange = ci && rangeEnd && !isSameDay(day, ci) && !isSameDay(day, rangeEnd) &&
            isWithinInterval(day, { start: ci, end: rangeEnd });
          const isPast = !allowPast && isBefore(day, new Date()) && !isToday(day);
          const isStartEdge = isStart;
          const isEndEdge = isEnd;

          return (
            <div key={day.toISOString()} className="relative flex items-center justify-center h-9">
              {/* Range background strip */}
              {inRange && inMonth && (
                <div className="absolute inset-y-1 inset-x-0 bg-primary/10" />
              )}
              {/* Half-strip on start */}
              {isStartEdge && co && inMonth && (
                <div className="absolute inset-y-1 right-0 left-1/2 bg-primary/10" />
              )}
              {/* Half-strip on end */}
              {isEndEdge && ci && inMonth && (
                <div className="absolute inset-y-1 left-0 right-1/2 bg-primary/10" />
              )}

              <button
                disabled={!inMonth || isPast}
                onClick={() => inMonth && !isPast && onDay(day)}
                onMouseEnter={() => inMonth && !isPast && onHover(day)}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  'relative z-10 w-8 h-8 rounded-full text-xs transition-all duration-100 flex items-center justify-center',
                  !inMonth && 'invisible',
                  isPast && 'text-muted-foreground/30 cursor-not-allowed',
                  inMonth && !isPast && !isStart && !isEnd && 'hover:bg-primary/20 hover:text-primary cursor-pointer',
                  inRange && !isStart && !isEnd && 'text-primary font-medium',
                  isToday(day) && !isStart && !isEnd && 'ring-1 ring-primary text-primary font-semibold',
                  (isStart || isEnd) && 'bg-primary text-primary-foreground font-bold shadow-md',
                )}
              >
                {format(day, 'd')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ checkin, checkout, onCheckinChange, onCheckoutChange, minDate, allowPast, startLabel = 'Start Date', endLabel = 'End Date' }: Props) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [viewMonth, setViewMonth] = useState(() => checkin ? startOfMonth(parseISO(checkin)) : startOfMonth(new Date()));
  const [hover, setHover] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const openPicker = (field: 'start' | 'end') => {
    setSelecting(field);
    setOpen(true);
  };

  const handleDay = (day: Date) => {
    const ds = format(day, 'yyyy-MM-dd');
    if (selecting === 'start') {
      onCheckinChange(ds);
      onCheckoutChange('');
      setSelecting('end');
    } else {
      const ci = checkin ? parseISO(checkin) : null;
      if (ci && isBefore(day, ci)) {
        onCheckinChange(ds);
        onCheckoutChange('');
        setSelecting('end');
      } else {
        onCheckoutChange(ds);
        setOpen(false);
        setSelecting('start');
      }
    }
  };

  const fmt = (d: string) => d ? format(parseISO(d), 'dd MMM yyyy') : null;

  const FieldBox = ({ field, label, value }: { field: 'start' | 'end'; label: string; value: string }) => (  
    <button
      type="button"
      onClick={() => openPicker(field)}
      className={cn(
        'flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all duration-150 bg-background group',
        open && selecting === field
          ? 'border-primary shadow-sm shadow-primary/20'
          : 'border-border hover:border-primary/50',
      )}
    >
      <CalendarDays className={cn('w-4 h-4 shrink-0 transition-colors', open && selecting === field ? 'text-primary' : 'text-muted-foreground group-hover:text-primary/70')} />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className={cn('text-sm font-medium truncate', value ? 'text-foreground' : 'text-muted-foreground/60')}>
          {fmt(value) ?? 'Add date'}
        </p>
      </div>
      {value && (
        <X className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => { e.stopPropagation(); field === 'start' ? (onCheckinChange(''), onCheckoutChange('')) : onCheckoutChange(''); }} />
      )}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      {/* Two field boxes */}
      <div className="flex gap-2">
        <FieldBox field="start" label={startLabel} value={checkin} />
        <FieldBox field="end" label={endLabel} value={checkout} />
      </div>

      {/* Calendar popover */}
      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          style={{ minWidth: 500 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <button type="button" onClick={() => setViewMonth(m => subMonths(m, 1))}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1 text-xs font-medium text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
              <span className={cn('cursor-pointer px-2 py-0.5 rounded-full transition-colors', selecting === 'start' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                onClick={() => setSelecting('start')}>{startLabel}</span>
              <span className="text-border">→</span>
              <span className={cn('cursor-pointer px-2 py-0.5 rounded-full transition-colors', selecting === 'end' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                onClick={() => setSelecting('end')}>{endLabel}</span>
            </div>
            <button type="button" onClick={() => setViewMonth(m => addMonths(m, 1))}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Dual month grids */}
          <div className="flex gap-0 px-4 pb-4">
            <div className="flex-1 px-2">
              <MonthGrid month={viewMonth} checkin={checkin} checkout={checkout}
                hover={hover} selecting={selecting} onDay={handleDay} onHover={setHover} allowPast={allowPast} />
            </div>
            <div className="w-px bg-border mx-2" />
            <div className="flex-1 px-2">
              <MonthGrid month={addMonths(viewMonth, 1)} checkin={checkin} checkout={checkout}
                hover={hover} selecting={selecting} onDay={handleDay} onHover={setHover} allowPast={allowPast} />
            </div>
          </div>

          {/* Footer */}
          {checkin && checkout && (
            <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-muted/20">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{fmt(checkin)}</span>
                <span className="mx-2 text-muted-foreground">→</span>
                <span className="font-semibold text-foreground">{fmt(checkout)}</span>
              </p>
              <button type="button" onClick={() => setOpen(false)}
                className="text-xs font-semibold text-primary hover:underline">Done</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
