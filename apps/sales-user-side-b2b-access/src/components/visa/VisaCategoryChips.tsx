import { Palmtree, Briefcase, Plane, GraduationCap, Globe, FileCheck, ArrowRightLeft } from 'lucide-react';

const CATEGORIES = [
  { value: '', label: 'All Visas', icon: Globe },
  { value: 'Tourist', label: 'Tourist Visa', icon: Palmtree },
  { value: 'Business', label: 'Business Visa', icon: Briefcase },
  { value: 'Employment', label: 'Employment Visa', icon: FileCheck },
  { value: 'Student', label: 'Student Visa', icon: GraduationCap },
  { value: 'eVisa', label: 'e-Visa', icon: Globe },
  { value: 'Entry', label: 'Entry Visa', icon: Plane },
  { value: 'Transit', label: 'Transit Visa', icon: ArrowRightLeft },
];

interface Props { value: string; onChange: (v: string) => void; }

export default function VisaCategoryChips({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map(c => {
        const Icon = c.icon;
        const active = value === c.value;
        return (
          <button key={c.value} onClick={() => onChange(c.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border
              ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>
            <Icon className="w-3.5 h-3.5" /> {c.label}
          </button>
        );
      })}
    </div>
  );
}
