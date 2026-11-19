import { format } from 'date-fns';
import { Button } from '@project/components/ui/button';
import { Calendar } from '@project/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@project/components/lib/utils';

interface Props {
  value: string; // yyyy-MM-dd
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export default function DatePickerInput({ value, onChange, placeholder = 'Pick date', className }: Props) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full h-9 justify-start text-left font-normal text-sm gap-2 border-border', className)}
        >
          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {date
            ? <span className="font-medium">{format(date, 'dd MMM yyyy')}</span>
            : <span className="text-muted-foreground text-xs">{placeholder}</span>
          }
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
