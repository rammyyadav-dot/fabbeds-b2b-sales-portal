import { Checkbox } from '@project/components/ui/checkbox';
import { Label } from '@project/components/ui/label';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  selected: number[];
  onChange: (days: number[]) => void;
}

export default function DaysSelector({ selected, onChange }: Props) {
  const toggle = (i: number) => {
    const next = selected.includes(i) ? selected.filter(d => d !== i) : [...selected, i];
    onChange(next);
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-medium text-muted-foreground w-14 shrink-0">Days of week</span>
      <div className="flex items-center gap-4 flex-wrap">
        {DAYS.map((d, i) => (
          <div key={d} className="flex items-center gap-1.5">
            <Checkbox
              id={`dow-${i}`}
              checked={selected.includes(i)}
              onCheckedChange={() => toggle(i)}
              className="w-4 h-4"
            />
            <Label htmlFor={`dow-${i}`} className="text-sm cursor-pointer">{d}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}
