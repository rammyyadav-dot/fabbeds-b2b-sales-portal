import { Check, ChevronRight, Ticket, ClipboardCheck, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Step = 1 | 2 | 3;

export default function AttractionBookingSteps({
  current,
  detailPath,
}: {
  current: Step;
  detailPath?: string;
}) {
  const navigate = useNavigate();
  const steps = [
    { id: 1 as Step, label: 'Tickets', short: 'Tickets', icon: Ticket },
    { id: 2 as Step, label: 'Review & checkout', short: 'Checkout', icon: ClipboardCheck },
    { id: 3 as Step, label: 'Confirmation', short: 'Confirm', icon: BadgeCheck },
  ];

  return (
    <nav aria-label="Attraction booking progress" className="mb-5">
      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const complete = step.id < current;
            const active = step.id === current;
            const clickable = step.id === 1 && !!detailPath && current > 1;

            return (
              <div key={step.id} className="relative min-w-0">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && navigate(detailPath!)}
                  className={`w-full min-h-[68px] sm:min-h-[76px] px-2 sm:px-4 flex items-center justify-center sm:justify-start gap-2 sm:gap-3 text-left transition-colors ${
                    active ? 'bg-primary/[0.045]' : complete ? 'bg-emerald-50/60' : 'bg-white'
                  } ${clickable ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 border ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : complete
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-muted-foreground border-border'
                  }`}>
                    {complete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </span>
                  <span className="min-w-0 hidden xs:block sm:block">
                    <span className="block text-[9px] sm:text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">Step {step.id}</span>
                    <span className={`block text-[11px] sm:text-sm font-bold truncate ${active ? 'text-primary' : complete ? 'text-emerald-800' : 'text-foreground'}`}>
                      <span className="sm:hidden">{step.short}</span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </span>
                  </span>
                  <span className="sm:hidden text-[10px] font-bold truncate">{step.short}</span>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 text-border bg-white rounded-full z-10" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
