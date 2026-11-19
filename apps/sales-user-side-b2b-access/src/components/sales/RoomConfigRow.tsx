import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { BedDouble } from 'lucide-react';

export interface RoomConfig {
  adults: number;
  children: number;
  childAges: number[];
}

interface Props {
  roomNo: number;
  config: RoomConfig;
  onChange: (config: RoomConfig) => void;
}

export default function RoomConfigRow({ roomNo, config, onChange }: Props) {
  const setAdults = (adults: number) => onChange({ ...config, adults });
  const setChildren = (children: number) => {
    const childAges = Array.from({ length: children }, (_, i) => config.childAges[i] ?? -1);
    onChange({ ...config, children, childAges });
  };
  const setChildAge = (idx: number, age: number) => {
    const childAges = [...config.childAges];
    childAges[idx] = age;
    onChange({ ...config, childAges });
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-background/50">
      <div className="flex items-center gap-1.5">
        <BedDouble className="w-3.5 h-3.5 text-primary" />
        <p className="text-xs font-semibold text-foreground">Room {roomNo}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* Adults */}
        <Select value={String(config.adults)} onValueChange={(v) => setAdults(Number(v))}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} Adult{n > 1 ? 's' : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Children */}
        <Select value={String(config.children)} onValueChange={(v) => setChildren(Number(v))}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} Child{n !== 1 ? 'ren' : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {config.children > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Child Ages</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: config.children }, (_, i) => (
              <Select key={i} value={config.childAges[i] >= 0 ? String(config.childAges[i]) : ''}
                onValueChange={v => setChildAge(i, Number(v))}>
                <SelectTrigger className={`w-24 h-7 text-xs ${(config.childAges[i] ?? -1) < 0 ? 'border-amber-400' : ''}`}>
                  <SelectValue placeholder={`Child ${i + 1}`} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 18 }, (_, age) => (
                    <SelectItem key={age} value={String(age)}>
                      {age === 0 ? '<1 yr (free)' : `${age} yr`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
