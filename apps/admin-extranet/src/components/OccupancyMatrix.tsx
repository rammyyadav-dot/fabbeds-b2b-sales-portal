import { cn } from '@project/components/lib/utils';

interface Props {
  maxAdults: number;
  maxChildren: number;
  maxTotal: number;
  maxAdultsWithKids: number;
  minTotal: number;
  minAdults: number;
  extraBeds: number;
  extraBedCountsTowardMax: boolean;
}

function isValid(a: number, c: number, p: Props): boolean {
  if (a < p.minAdults) return false;
  if (a + c < p.minTotal) return false;
  if (a > p.maxAdults) return false;
  if (c > p.maxChildren) return false;
  if (c > 0 && a > p.maxAdultsWithKids) return false;
  const total = p.extraBedCountsTowardMax ? a + c + p.extraBeds : a + c;
  if (total > p.maxTotal) return false;
  return true;
}

export default function OccupancyMatrix(props: Props) {
  const { maxAdults, maxChildren } = props;
  if (maxAdults <= 0 || maxChildren < 0) return null;

  const adultCols = Array.from({ length: maxAdults + 1 }, (_, i) => i);
  const childRows = Array.from({ length: maxChildren + 1 }, (_, i) => i);

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-extrabold text-blue-900">Allowed Occupancy Matrix</p>
        <p className="text-xs text-blue-700 mt-0.5">All valid adult × child combinations based on your rules. <span className="font-semibold">Green = bookable, Red = blocked.</span></p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-blue-700 font-bold px-2 py-1 text-right pr-3">Children ↓ / Adults →</th>
              {adultCols.map(a => (
                <th key={a} className="px-2 py-1 text-center font-bold text-blue-800 w-10">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {childRows.map(c => (
              <tr key={c}>
                <td className="text-right pr-3 font-bold text-blue-800 py-0.5">{c}</td>
                {adultCols.map(a => {
                  const valid = isValid(a, c, props);
                  const isZeroZero = a === 0 && c === 0;
                  return (
                    <td key={a} className="px-1 py-0.5 text-center">
                      <span className={cn(
                        'inline-flex items-center justify-center w-8 h-7 rounded font-bold text-xs',
                        isZeroZero ? 'bg-muted text-muted-foreground' :
                        valid ? 'bg-green-100 text-green-800 border border-green-300' :
                                'bg-red-100 text-red-700 border border-red-200'
                      )}>
                        {isZeroZero ? '–' : valid ? '✓' : '✗'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-green-100 border border-green-300 inline-block" /> Valid</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-100 border border-red-200 inline-block" /> Blocked</span>
      </div>
    </div>
  );
}
