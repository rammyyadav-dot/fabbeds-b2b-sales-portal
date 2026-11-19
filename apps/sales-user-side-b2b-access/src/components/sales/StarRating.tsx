import { Star } from 'lucide-react';

interface StarRatingProps {
  stars: number;
  size?: 'sm' | 'md';
}

export default function StarRating({ stars, size = 'sm' }: StarRatingProps) {
  const sz = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${sz} ${i < stars ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}
