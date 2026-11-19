export interface MarkupRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  appliesTo: 'all' | 'category' | 'emirate' | 'hotel';
  target?: string;
  priority: number; // higher = takes precedence
}

export const markupRules: MarkupRule[] = [
  {
    id: 'r1',
    name: 'Global Markup',
    type: 'percentage',
    value: 15,
    appliesTo: 'all',
    priority: 1,
  },
  {
    id: 'r2',
    name: 'Luxury Category Markup',
    type: 'percentage',
    value: 12,
    appliesTo: 'category',
    target: 'Luxury',
    priority: 2,
  },
  {
    id: 'r3',
    name: 'Standard Category Markup',
    type: 'percentage',
    value: 20,
    appliesTo: 'category',
    target: 'Standard',
    priority: 2,
  },
  {
    id: 'r4',
    name: 'Burj Al Arab Special',
    type: 'percentage',
    value: 8,
    appliesTo: 'hotel',
    target: 'h2',
    priority: 3,
  },
  {
    id: 'r5',
    name: 'Sharjah Emirate Markup',
    type: 'fixed',
    value: 50,
    appliesTo: 'emirate',
    target: 'Sharjah',
    priority: 2,
  },
];

export function applyMarkup(
  basePrice: number,
  hotelId: string,
  category: string,
  emirate: string,
  rules: MarkupRule[] = markupRules
): number {
  // Find the highest priority applicable rule
  const applicable = rules
    .filter((r) => {
      if (r.appliesTo === 'all') return true;
      if (r.appliesTo === 'category' && r.target === category) return true;
      if (r.appliesTo === 'emirate' && r.target === emirate) return true;
      if (r.appliesTo === 'hotel' && r.target === hotelId) return true;
      return false;
    })
    .sort((a, b) => b.priority - a.priority);

  if (applicable.length === 0) return basePrice;

  const rule = applicable[0];
  if (rule.type === 'percentage') {
    return Math.round(basePrice * (1 + rule.value / 100));
  } else {
    return Math.round(basePrice + rule.value);
  }
}

export function getAppliedRule(
  hotelId: string,
  category: string,
  emirate: string,
  rules: MarkupRule[] = markupRules
): MarkupRule | undefined {
  return rules
    .filter((r) => {
      if (r.appliesTo === 'all') return true;
      if (r.appliesTo === 'category' && r.target === category) return true;
      if (r.appliesTo === 'emirate' && r.target === emirate) return true;
      if (r.appliesTo === 'hotel' && r.target === hotelId) return true;
      return false;
    })
    .sort((a, b) => b.priority - a.priority)[0];
}
