import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isBefore, parseISO, startOfDay } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { Calendar } from '@project/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { CalendarIcon, Plus, Minus, X } from 'lucide-react';

export type DateRange = { from: string; to: string };

interface Props {
  ranges: DateRange[];
  onChange: (ranges: DateRange[]) => void;
}

function isoToday() {
  return format(new Date(), 'yyyy-MM-dd');
}

function toLocalDate(value: string) {
  return value ? parseISO(value) : undefined;
}

function DatePicker({
  value,
  onChange,
  placeholder,
  minDate,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = toLocalDate(value);
  const minimum = startOfDay(toLocalDate(minDate || isoToday()) || new Date());
  const [month, setMonth] = useState<Date>(selected || minimum);

  useEffect(() => {
    if (open) setMonth(selected || minimum);
  }, [open, value, minDate]);

  const disabled = (date: Date) => isBefore(startOfDay(date), minimum);

  const choose = (date?: Date) => {
    if (!date) return;
    const normalized = startOfDay(date);
    if (disabled(normalized)) return;
    onChange(format(normalized, 'yyyy-MM-dd'));
    setMonth(normalized);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-[210px] justify-start text-left font-normal text-sm gap-2 border-border bg-background"
        >
          <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          {selected
            ? <span className="font-semibold">{format(selected, 'dd MMM yyyy')}</span>
            : <span className="text-muted-foreground">{placeholder}</span>
          }
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0 shadow-xl" align="start" sideOffset={6}>
        <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/30">
          <div>
            <p className="text-xs font-semibold">{placeholder}</p>
            <p className="text-[10px] text-muted-foreground">
              {minDate ? `Earliest: ${format(minimum, 'dd MMM yyyy')}` : 'Past dates are disabled'}
            </p>
          </div>
          {value && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              aria-label="Clear selected date"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <Calendar
          mode="single"
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          onSelect={choose}
          disabled={disabled}
          initialFocus
        />

        <div className="border-t px-3 py-2 flex items-center gap-2 bg-muted/20">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => choose(minimum)}>
            Earliest
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => choose(addDays(minimum, 6))}>
            +7 days
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => choose(addDays(minimum, 29))}>
            +30 days
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DateRangesInput({ ranges, onChange }: Props) {
  const today = useMemo(() => isoToday(), []);

  const update = (i: number, field: 'from' | 'to', val: string) => {
    const next = ranges.map((r, idx) => {
      if (idx !== i) return r;

      if (field === 'from') {
        const nextTo = r.to && val && r.to < val ? '' : r.to;
        return { ...r, from: val, to: nextTo };
      }

      return { ...r, to: val };
    });
    onChange(next);
  };

  const add = () => onChange([...ranges, { from: '', to: '' }]);
  const remove = (i: number) => onChange(ranges.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2.5">
      {ranges.map((r, i) => {
        const invalidOrder = !!(r.from && r.to && r.to < r.from);
        return (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            {i === 0
              ? <span className="text-sm font-medium text-muted-foreground w-20 shrink-0">Period</span>
              : <span className="w-20 shrink-0" />
            }

            <DatePicker
              value={r.from}
              onChange={v => update(i, 'from', v)}
              placeholder="From date"
              minDate={today}
            />

            <span className="text-muted-foreground text-sm">→</span>

            <DatePicker
              value={r.to}
              onChange={v => update(i, 'to', v)}
              placeholder="To date"
              minDate={r.from || today}
            />

            {i === 0 ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={add}
                className="h-9 w-9 rounded-full bg-green-500 text-white hover:bg-green-600 shrink-0"
                title="Add another date range"
              >
                <Plus className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => remove(i)}
                className="h-9 w-9 rounded-full bg-red-500 text-white hover:bg-red-600 shrink-0"
                title="Remove this date range"
              >
                <Minus className="w-4 h-4" />
              </Button>
            )}

            {invalidOrder && (
              <span className="text-xs font-medium text-destructive">To date must be after From date</span>
            )}
          </div>
        );
      })}

      <div className="pl-20 text-[11px] text-muted-foreground">
        Past dates are disabled. Selecting a new From date automatically clears an earlier To date.
      </div>
    </div>
  );
}
