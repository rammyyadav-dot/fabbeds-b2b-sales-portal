import { Check } from 'lucide-react';
import { cn } from '@project/components/lib/utils';

const STEPS = [
  { label: 'Context' },
  { label: 'Upload' },
  { label: 'Preview' },
  { label: 'Mapping' },
  { label: 'Validate' },
  { label: 'Commit' },
];

export default function WizardStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {STEPS.map((step, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
              i < current && 'bg-primary border-primary text-primary-foreground',
              i === current && 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20',
              i > current && 'bg-background border-border text-muted-foreground',
            )}>
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn(
              'text-[10px] whitespace-nowrap font-medium',
              i === current ? 'text-primary' : 'text-muted-foreground',
            )}>{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn('w-8 sm:w-12 h-0.5 mx-1 mb-4', i < current ? 'bg-primary' : 'bg-border')} />
          )}
        </div>
      ))}
    </div>
  );
}
