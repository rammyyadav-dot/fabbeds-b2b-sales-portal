const CATEGORIES = [
  { value: '', label: 'All', icon: '🌟' },
  { value: 'Theme Parks', label: 'Theme Parks', icon: '🎢' },
  { value: 'Observation Decks', label: 'Observation Decks', icon: '🔭' },
  { value: 'Water Parks', label: 'Water Parks', icon: '🌊' },
  { value: 'Museums', label: 'Museums', icon: '🏛️' },
  { value: 'Zoos', label: 'Zoos', icon: '🦁' },
  { value: 'Landmarks', label: 'Landmarks', icon: '🏛️' },
  { value: 'Tours', label: 'Tours', icon: '🗺️' },
  { value: 'Desert Safari', label: 'Desert Safari', icon: '🏜️' },
  { value: 'Dinner Cruise', label: 'Dinner Cruise', icon: '🚢' },
  { value: 'Parks', label: 'Parks', icon: '🌳' },
  { value: 'Sports & Adventure', label: 'Sports', icon: '🏄' },
  { value: 'Entertainment', label: 'Entertainment', icon: '🎭' },
];

interface Props {
  active: string;
  onChange: (v: string) => void;
}

export default function CategoryChips({ active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {CATEGORIES.map((c) => (
        <button
          key={c.value}
          onClick={() => onChange(c.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors
            ${active === c.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-foreground border-border hover:border-primary/50'
            }`}
        >
          <span>{c.icon}</span>
          {c.label}
        </button>
      ))}
    </div>
  );
}
