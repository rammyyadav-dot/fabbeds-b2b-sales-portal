import { Sun, Sunset, Moon, MapPin, Utensils } from 'lucide-react';

interface Day {
  id: string;
  dayNumber: number;
  dayTitle: string;
  dayDescription: string;
  morningActivity: string;
  afternoonActivity: string;
  eveningActivity: string;
  mealsIncluded: string;
  overnightLocation: string;
}

const mealLabels: Record<string, string> = {
  'Breakfast Only': '🍳 Breakfast',
  'Half Board': '🍳 Breakfast + 🍽️ Dinner',
  'Full Board': '🍳 Breakfast + 🥗 Lunch + 🍽️ Dinner',
  'No Meals': 'No meals included',
};

function ActivitySlot({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm text-foreground">{text}</p>
      </div>
    </div>
  );
}

export default function ItineraryTimeline({ days }: { days: Day[] }) {
  if (days.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No itinerary details available yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-border" />

      <div className="space-y-0">
        {days.map((day, idx) => (
          <div key={day.id} className="relative pl-12 pb-6">
            {/* Day circle */}
            <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-extrabold shadow-md z-10">
              D{day.dayNumber}
            </div>

            <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
              <h4 className="font-bold text-sm text-foreground mb-1">{day.dayTitle}</h4>
              {day.dayDescription && (
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{day.dayDescription}</p>
              )}

              <div className="space-y-0.5">
                <ActivitySlot icon={<Sun className="w-3.5 h-3.5 text-amber-500" />} label="Morning" text={day.morningActivity} />
                <ActivitySlot icon={<Sunset className="w-3.5 h-3.5 text-orange-500" />} label="Afternoon" text={day.afternoonActivity} />
                <ActivitySlot icon={<Moon className="w-3.5 h-3.5 text-indigo-500" />} label="Evening" text={day.eveningActivity} />
              </div>

              {/* Footer badges */}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                {day.mealsIncluded && day.mealsIncluded !== 'No Meals' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-500/10 px-2 py-1 rounded-full">
                    <Utensils className="w-3 h-3" /> {mealLabels[day.mealsIncluded] || day.mealsIncluded}
                  </span>
                )}
                {day.overnightLocation && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-500/10 px-2 py-1 rounded-full">
                    <MapPin className="w-3 h-3" /> Overnight: {day.overnightLocation}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
