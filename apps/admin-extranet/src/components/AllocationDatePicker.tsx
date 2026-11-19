import { useState } from 'react';
import { Calendar } from '@project/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { Button } from '@project/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

type LocalDateRange = { from: Date | undefined; to?: Date | undefined };

interface Props {
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string) => void;
}

const QUICK = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '1 month', days: 31 },
  { label: '2 months', days: 60 },
  { label: '3 months', days: 90 },
];

export default function AllocationDatePicker({ startDate, endDate, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<LocalDateRange>({
    from: parseISO(startDate),
    to: parseISO(endDate),
  });

  const handleQuick = (days: number) => {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    setRange({ from, to: addDays(from, days - 1) });
  };

  const handleApply = () => {
    if (range.from && range.to) {
      onApply(format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd'));
      setOpen(false);
    }
  };

  const fromDate = parseISO(startDate);
  const toDate = parseISO(endDate);
  const totalDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
  const pendingDays = range.from && range.to
    ? Math.round((range.to.getTime() - range.from.getTime()) / 86400000) + 1
    : 0;

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (v) setRange({ from: fromDate, to: toDate }); }}>
      <PopoverTrigger asChild>
        <button className="flex items-stretch border border-gray-300 rounded-lg overflow-hidden hover:border-blue-500 focus:outline-none focus:border-blue-500 transition-colors bg-white shadow-sm">
          <DateBox label="From" date={fromDate} />
          <div className="w-px bg-gray-200 self-stretch" />
          <DateBox label="To" date={toDate} />
          <div className="flex items-center px-3 bg-gray-50 border-l border-gray-200 gap-1.5">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">{totalDays}d</span>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0 shadow-2xl border-gray-200 rounded-xl overflow-hidden" align="start">
        {/* Quick ranges */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
          <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mr-1">Quick</span>
          {QUICK.map(({ label, days }) => (
            <button key={days} onClick={() => handleQuick(days)}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors font-medium text-gray-600">
              {label}
            </button>
          ))}
        </div>

        {/* Calendar */}
        <Calendar
          mode="range"
          selected={range as any}
          onSelect={(r: any) => r && setRange(r)}
          numberOfMonths={2}
          defaultMonth={range.from}
          className="p-3"
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">
            {pendingDays > 0
              ? <><span className="font-semibold text-blue-600">{pendingDays}</span> days selected</>
              : 'Select a start & end date'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="h-8">Cancel</Button>
            <Button size="sm" onClick={handleApply} disabled={!range.from || !range.to}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white px-4">
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DateBox({ label, date }: { label: string; date: Date }) {
  return (
    <div className="px-4 py-2 text-left min-w-[130px] cursor-pointer hover:bg-blue-50/40 transition-colors">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold text-gray-800 mt-0.5">{format(date, 'dd MMM yyyy')}</div>
      <div className="text-[10px] text-gray-400">{format(date, 'EEEE')}</div>
    </div>
  );
}
