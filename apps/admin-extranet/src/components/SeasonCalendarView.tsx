import { useMemo } from 'react';
import { GetSeasonsOutputType } from 'zitejs/api';
import { format, eachDayOfInterval, parseISO } from 'date-fns';

type Season = GetSeasonsOutputType['seasons'][0];

const TYPE_COLORS: Record<string, string> = {
  Peak: 'bg-red-400 text-white',
  High: 'bg-orange-400 text-white',
  Shoulder: 'bg-yellow-400 text-white',
  Low: 'bg-blue-400 text-white',
};
const TYPE_BG: Record<string, string> = {
  Peak: 'bg-red-100',
  High: 'bg-orange-100',
  Shoulder: 'bg-yellow-100',
  Low: 'bg-blue-100',
};

interface Props { seasons: Season[]; year: number; }

export default function SeasonCalendarView({ seasons, year }: Props) {
  const seasonMap = useMemo(() => {
    const map: Record<string, Season> = {};
    seasons.forEach(s => {
      if (!s.startDate || !s.endDate) return;
      try {
        const days = eachDayOfInterval({ start: parseISO(s.startDate), end: parseISO(s.endDate) });
        days.forEach(d => { map[format(d, 'yyyy-MM-dd')] = s; });
      } catch {}
    });
    return map;
  }, [seasons]);

  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(TYPE_COLORS).map(([type, cls]) => (
          <span key={type} className={`px-2 py-0.5 rounded-full font-medium ${cls}`}>{type}</span>
        ))}
      </div>
      {/* 12-month grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map(m => <MonthBlock key={m} year={year} month={m} seasonMap={seasonMap} />)}
      </div>
    </div>
  );
}

function MonthBlock({ year, month, seasonMap }: { year: number; month: number; seasonMap: Record<string, Season> }) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <p className="text-xs font-semibold text-center mb-2">{format(firstDay, 'MMMM')}</p>
      <div className="grid grid-cols-7 gap-px text-center">
        {DAYS.map((d, i) => <span key={i} className="text-[9px] text-muted-foreground font-medium">{d}</span>)}
        {Array.from({ length: startOffset }).map((_, i) => <span key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = format(new Date(year, month, day), 'yyyy-MM-dd');
          const season = seasonMap[key];
          const colorClass = season?.seasonType ? TYPE_BG[season.seasonType] || 'bg-muted' : '';
          return (
            <span key={day} className={`text-[9px] rounded-sm py-0.5 leading-4 ${colorClass}`}>
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}
