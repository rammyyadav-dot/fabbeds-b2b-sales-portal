import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DailyRate {
  date: string;
  displayRate: number;
  status: string;
}

interface Props {
  startDate: string;
  endDate: string;
  onSelect: (start: string, end: string) => void;
  dailyRates?: DailyRate[];
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function MonthGrid({
  year, month, startDate, endDate, hoverDate, selecting, dailyRates, onDateClick, onDateHover,
}: {
  year: number; month: number;
  startDate: string; endDate: string; hoverDate: string; selecting: boolean;
  dailyRates: DailyRate[];
  onDateClick: (d: string) => void;
  onDateHover: (d: string) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const rangeEnd = selecting && hoverDate ? (hoverDate > startDate ? hoverDate : startDate) : endDate;
  const rangeStart = selecting && hoverDate ? (hoverDate > startDate ? startDate : hoverDate) : startDate;

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toIso(year, month, d));

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, idx) => {
          if (!iso) return <div key={`e-${idx}`} />;
          const isPast = iso < today;
          const isDisabled = isPast;

          const isStart = iso === startDate;
          const isEnd = iso === endDate && !selecting;
          const inRange = rangeStart && rangeEnd && iso > rangeStart && iso < rangeEnd;
          const isRangeStart = iso === rangeStart && rangeEnd && rangeStart !== rangeEnd;
          const isRangeEnd = iso === rangeEnd && rangeStart && rangeStart !== rangeEnd;

          let cellBg = '';
          let innerCls = '';

          if (isStart || isEnd || isRangeStart || isRangeEnd) {
            innerCls = 'bg-primary text-primary-foreground rounded-full';
          }
          if (inRange) cellBg = 'bg-primary/10';
          if (isRangeStart) cellBg = 'bg-primary/10 rounded-l-full';
          if (isRangeEnd) cellBg = 'bg-primary/10 rounded-r-full';

          return (
            <div key={iso} className={`relative ${cellBg}`} onMouseEnter={() => !isDisabled && onDateHover(iso)}>
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && onDateClick(iso)}
                className={`w-full flex items-center justify-center py-1 transition-colors
                  ${isDisabled ? 'opacity-25 cursor-not-allowed' : !innerCls ? 'hover:bg-primary/10 rounded-md cursor-pointer' : ''}`}
              >
                <span className={`w-7 h-7 flex items-center justify-center text-xs font-medium ${innerCls}`}>
                  {new Date(iso + 'T00:00:00').getDate()}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangeCalendar({ startDate, endDate, onSelect, dailyRates = [] }: Props) {
  const today = new Date();
  const initYear = startDate ? parseInt(startDate.slice(0, 4)) : today.getFullYear();
  const initMonth = startDate ? parseInt(startDate.slice(5, 7)) - 1 : today.getMonth();

  const [leftYear, setLeftYear] = useState(initYear);
  const [leftMonth, setLeftMonth] = useState(initMonth);
  const [selecting, setSelecting] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [hoverDate, setHoverDate] = useState('');

  const handlePrev = () => {
    const p = addMonths(leftYear, leftMonth, -1);
    setLeftYear(p.year); setLeftMonth(p.month);
  };
  const handleNext = () => {
    const p = addMonths(leftYear, leftMonth, 1);
    setLeftYear(p.year); setLeftMonth(p.month);
  };

  const handleDateClick = (iso: string) => {
    if (!selecting) {
      setTempStart(iso);
      setSelecting(true);
      setHoverDate('');
    } else {
      const start = iso < tempStart ? iso : tempStart;
      const end = iso < tempStart ? tempStart : iso;
      if (start === end) { setSelecting(false); return; }
      setSelecting(false);
      setHoverDate('');
      onSelect(start, end);
    }
  };

  const displayStart = selecting ? tempStart : startDate;

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm p-3 w-[280px]">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={handlePrev} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <span className="text-sm font-bold text-foreground">
          {MONTHS[leftMonth]} {leftYear}
        </span>
        <button type="button" onClick={handleNext} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      <MonthGrid
        year={leftYear} month={leftMonth}
        startDate={displayStart} endDate={selecting ? '' : endDate}
        hoverDate={hoverDate} selecting={selecting}
        dailyRates={dailyRates}
        onDateClick={handleDateClick}
        onDateHover={setHoverDate}
      />

      {selecting && (
        <p className="text-center text-[10px] text-primary font-medium mt-2">
          Now select your check-out date →
        </p>
      )}
    </div>
  );
}
