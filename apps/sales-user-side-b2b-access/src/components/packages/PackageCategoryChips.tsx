const categories = [
  { value: '', label: 'All Packages' },
  { value: 'Classic', label: '🏛️ Classic' },
  { value: 'Premium', label: '⭐ Premium' },
  { value: 'Luxury', label: '💎 Luxury' },
  { value: 'Honeymoon', label: '💕 Honeymoon' },
  { value: 'Family', label: '👨‍👩‍👧‍👦 Family' },
  { value: 'Adventure', label: '🏔️ Adventure' },
];

export default function PackageCategoryChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {categories.map(c => (
        <button
          key={c.value}
          onClick={() => onChange(c.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border
            ${value === c.value
              ? 'bg-primary text-primary-foreground border-primary shadow-md'
              : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'
            }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
