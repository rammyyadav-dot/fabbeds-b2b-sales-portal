import { getDaysInMonth, getDay } from 'date-fns';

export type DayRates = {
  hbAdult?: number; hbChild?: number;
  fbAdult?: number; fbChild?: number;
  aiAdult?: number; aiChild?: number;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COL_GROUPS = [
  { label: 'Half Board',    headerBg: 'bg-orange-100',  cols: ['hbAdult', 'hbChild'] },
  { label: 'Full Board',    headerBg: 'bg-emerald-100', cols: ['fbAdult', 'fbChild'] },
  { label: 'All Inclusive', headerBg: 'bg-sky-100',     cols: ['aiAdult', 'aiChild'] },
];

const COL_DEFS = [
  { key: 'hbAdult', sub: 'Adult', cellBg: 'bg-orange-50',  inputBorder: 'border-orange-200 focus:ring-orange-400' },
  { key: 'hbChild', sub: 'Child', cellBg: 'bg-orange-50/50', inputBorder: 'border-orange-200 focus:ring-orange-400' },
  { key: 'fbAdult', sub: 'Adult', cellBg: 'bg-emerald-50', inputBorder: 'border-emerald-200 focus:ring-emerald-400' },
  { key: 'fbChild', sub: 'Child', cellBg: 'bg-emerald-50/50', inputBorder: 'border-emerald-200 focus:ring-emerald-400' },
  { key: 'aiAdult', sub: 'Adult', cellBg: 'bg-sky-50',     inputBorder: 'border-sky-200 focus:ring-sky-400' },
  { key: 'aiChild', sub: 'Child', cellBg: 'bg-sky-50/50',  inputBorder: 'border-sky-200 focus:ring-sky-400' },
];

interface Props {
  year: number;
  month: number;
  rates: Record<string, DayRates>;
  onChange: (date: string, key: keyof DayRates, value: string) => void;
}

export default function MealPlanGridTable({ year, month, rates, onChange }: Props) {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          {/* Group header row */}
          <tr>
            <th className="sticky left-0 z-10 bg-muted/40 border border-border px-4 py-3 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground" rowSpan={2}>
              Date
            </th>
            {COL_GROUPS.map(g => (
              <th key={g.label} colSpan={2}
                className={`border border-border px-3 py-3 text-center font-bold text-sm ${g.headerBg}`}>
                {g.label}
              </th>
            ))}
          </tr>
          {/* Sub-header row */}
          <tr>
            {COL_DEFS.map(c => (
              <th key={c.key}
                className={`border border-border px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide ${c.cellBg}`}>
                {c.sub}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map(day => {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayName = DAY_NAMES[getDay(new Date(year, month - 1, day))];
            const dayRates = rates[date] ?? {};
            const isWeekend = dayName === 'Fri' || dayName === 'Sat';
            return (
              <tr key={day} className={isWeekend ? 'bg-muted/30' : 'bg-white hover:bg-muted/10'}>
                <td className="sticky left-0 z-10 bg-inherit border border-border px-4 py-2 whitespace-nowrap">
                  <span className="font-bold text-sm text-foreground">{day}</span>
                  <span className={`ml-1.5 text-xs font-medium ${isWeekend ? 'text-orange-500' : 'text-muted-foreground'}`}>{dayName}</span>
                </td>
                {COL_DEFS.map(c => (
                  <td key={c.key} className={`border border-border px-2 py-1.5 ${c.cellBg}`}>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" step="0.01" min={0}
                        value={dayRates[c.key as keyof DayRates] ?? ''}
                        onChange={e => onChange(date, c.key as keyof DayRates, e.target.value)}
                        className={`w-20 h-8 px-2 text-sm font-mono font-medium border rounded bg-white focus:outline-none focus:ring-2 ${c.inputBorder}`}
                        placeholder="0.00"
                      />
                      <span className="text-xs font-semibold text-muted-foreground">AED</span>
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
