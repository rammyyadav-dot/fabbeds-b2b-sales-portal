import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Baby } from 'lucide-react';

interface Props {
  count: number;
  ages: string[];
  onChange: (ages: string[]) => void;
}

export default function ChildAgesInput({ count, ages, onChange }: Props) {
  if (count === 0) return null;

  const handleAge = (idx: number, val: string) => {
    const next = [...ages];
    next[idx] = val;
    onChange(next);
  };

  return (
    <div className="space-y-2 bg-muted/30 border border-border rounded-lg p-3">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Baby className="w-3 h-3" />
        Child Ages <span className="text-destructive ml-0.5">*</span>
        <span className="text-[10px] text-muted-foreground/70 ml-1">(required for all children)</span>
      </Label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium">Child {i + 1}</p>
            <Select value={ages[i] ?? ''} onValueChange={(v) => handleAge(i, v)}>
              <SelectTrigger className={`h-9 text-sm ${!ages[i] ? 'border-destructive/50' : ''}`}>
                <SelectValue placeholder="Select age" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">&lt; 1 yr</SelectItem>
                {Array.from({ length: 17 }, (_, age) => age + 1).map(age => (
                  <SelectItem key={age} value={String(age)}>{age} yr</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {ages.slice(0, count).some(a => !a) && (
        <p className="text-[10px] text-destructive">Please select an age for each child to continue.</p>
      )}
    </div>
  );
}
