import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@project/components/ui/button';

export default function HorizontalCarousel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: dir * 520, behavior: 'smooth' });
  };

  return (
    <div className="relative group">
      <div ref={ref} className={`flex gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
        {children}
      </div>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={() => scroll(-1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow-md bg-white/95 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={() => scroll(1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow-md bg-white/95 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
