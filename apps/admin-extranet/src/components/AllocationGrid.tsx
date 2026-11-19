import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type AllotmentEntry = {
  id?: string;
  roomsOnAllotment: number;
  roomsBlocked: number;
  releaseDays: number;
  releaseHour: number;
  onRequest: number;
  isOpen?: boolean;
};

export type AllotmentMap = Record<string, AllotmentEntry>;

interface Props {
  dates: string[];
  roomTypeName: string;
  allotmentMap: AllotmentMap;
  onCellChange: (date: string, field: keyof AllotmentEntry, value: number | boolean) => void;
}

const DEFAULT_ENTRY: AllotmentEntry = {
  roomsOnAllotment: 0,
  roomsBlocked: 0,
  releaseDays: 0,
  releaseHour: 18,
  onRequest: 0,
  isOpen: true,
};

export default function AllocationGrid({ dates, roomTypeName, allotmentMap, onCellChange }: Props) {
  const [expanded, setExpanded] = useState(true);

  const get = (date: string) => ({ ...DEFAULT_ENTRY, ...allotmentMap[date] });

  const thBase = 'sticky top-0 z-20 bg-white border-b border-r border-gray-200 text-center px-1 py-1 min-w-[56px]';
  const tdLeft = 'sticky left-0 z-10 bg-white border-r-2 border-gray-300 px-3 whitespace-nowrap text-sm';
  const tdCell = 'border-r border-gray-200 text-center text-xs px-1 py-1';

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className="border-collapse" style={{ minWidth: 'max-content' }}>
        <thead>
          <tr className="bg-white">
            <th className="sticky left-0 top-0 z-30 bg-white border-b border-r-2 border-gray-300 px-3 py-2 text-left text-sm font-bold text-gray-800 min-w-[200px]">
              {roomTypeName}
            </th>
            {dates.map(date => {
              const d = parseISO(date);
              return (
                <th key={date} className={thBase}>
                  <div className="text-[10px] text-gray-500 font-normal">{format(d, 'EEE')}</div>
                  <div className="text-[10px] text-gray-500 font-normal">{format(d, 'MMM')}</div>
                  <div className="text-xs font-bold text-gray-800">{format(d, 'dd')}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Allocation Status Row - clickable Open/Stop Sales toggle */}
          <tr className="border-b border-gray-200 hover:bg-gray-50">
            <td className={`${tdLeft} py-1.5 font-medium text-gray-700`}>Allocation</td>
            {dates.map(date => {
              const entry = get(date);
              const open = entry.isOpen !== false;
              return (
                <td key={date} className={`${tdCell} py-1.5`}>
                  <button
                    onClick={() => onCellChange(date, 'isOpen', !open)}
                    className={`inline-block text-white text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
                      open ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    {open ? 'Open' : 'Stop'}
                  </button>
                </td>
              );
            })}
          </tr>

          {/* Allocation numbers row (collapsible) */}
          <tr className="border-b border-gray-100 hover:bg-blue-50/30">
            <td className={`${tdLeft} py-1.5 text-blue-600 font-medium cursor-pointer`} onClick={() => setExpanded(!expanded)}>
              <span className="flex items-center gap-1">
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Allocation
              </span>
            </td>
            {dates.map(date => (
              <td key={date} className={`${tdCell} py-1.5`}>
                <EditableCell value={get(date).roomsOnAllotment} onChange={v => onCellChange(date, 'roomsOnAllotment', v)} />
              </td>
            ))}
          </tr>

          {expanded && (
            <>
              {/* Utilization */}
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className={`${tdLeft} py-1.5 pl-7 text-gray-600`}>Utilization</td>
                {dates.map(date => (
                  <td key={date} className={`${tdCell} py-1.5 text-gray-700`}>{get(date).roomsBlocked}</td>
                ))}
              </tr>

              {/* Allotment release day */}
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className={`${tdLeft} py-1.5 pl-7 text-gray-600`}>Allotment release day</td>
                {dates.map(date => (
                  <td key={date} className={`${tdCell} py-1.5 text-gray-500`}>{get(date).releaseDays}d</td>
                ))}
              </tr>

              {/* Left to sell */}
              <tr className="border-b border-gray-100 hover:bg-green-50/30">
                <td className={`${tdLeft} py-1.5 font-semibold text-green-600`}>Left to sell</td>
                {dates.map(date => {
                  const e = get(date);
                  const left = e.roomsOnAllotment - e.roomsBlocked;
                  return (
                    <td key={date} className={`${tdCell} py-1.5 font-bold text-green-600`}>{left}</td>
                  );
                })}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EditableCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));

  if (editing) {
    return (
      <input
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onChange(Number(val) || 0); }}
        onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onChange(Number(val) || 0); } }}
        autoFocus
        className="w-10 text-center text-xs border border-blue-400 rounded outline-none"
      />
    );
  }
  return (
    <span className="cursor-pointer hover:bg-blue-50 px-1 rounded text-gray-800" onClick={() => { setVal(String(value)); setEditing(true); }}>
      {value}
    </span>
  );
}
