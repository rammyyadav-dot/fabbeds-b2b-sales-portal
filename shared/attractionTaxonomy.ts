// Single source of truth for attraction search taxonomy (CTO audit B6 / F1 / F2).
// Area ("City" field) stays as the fine-grained location; Emirate and Product Category are what agents filter on.
export const EMIRATES = ['Dubai','Abu Dhabi','Sharjah','Ras Al Khaimah','Fujairah','Ajman','Umm Al Quwain'] as const;
export const PRODUCT_CATEGORIES = ['Theme Parks','Water Parks','Observation & Landmarks','Museums & Culture','Heritage & Religious Sites','Desert Safari','Cruises & Yachts','Water Sports & Diving','Adventure & Outdoor','Nature & Wildlife','Tours & Experiences','Entertainment & Leisure'] as const;
export type Emirate = typeof EMIRATES[number];
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

const EMIRATE_RULES: Array<[RegExp, Emirate]> = [
  [/sharjah|khor ?fakkan|kalba|al heerah|al dhaid|mleiha/i, 'Sharjah'],
  [/fujairah|dibba|east coast|masafi|wadi wurayah|sandy beach|bull butting|wadi hail/i, 'Fujairah'],
  [/ras al khaimah|\brak\b|jebel jais|jabal jais|wadi shawka|al marjan|dhayah|jazirat|\bmangroves\b|al hamra|al qawasim|pearl beach/i, 'Ras Al Khaimah'],
  [/ajman|manama|al zorah/i, 'Ajman'],
  [/umm al quwain|\buaq\b/i, 'Umm Al Quwain'],
  [/abu dhabi|yas|saadiyat|al maryah|liwa|corniche|al ain|reem|hudayriat|al wathba/i, 'Abu Dhabi'],
];
export function emirateFromArea(area?: string | null): Emirate {
  const a = String(area || '').replace(/\s+/g, ' ').trim();
  if ((EMIRATES as readonly string[]).includes(a)) return a as Emirate;
  return EMIRATE_RULES.find(([re]) => re.test(a))?.[1] || 'Dubai';
}

const CATEGORY_RULES: Array<[RegExp, ProductCategory]> = [
  [/theme park|aquarium\/theme/, 'Theme Parks'],
  [/water ?park/, 'Water Parks'],
  [/observation|landmark|transport/, 'Observation & Landmarks'],
  [/zoo|aquarium|animal|^nature|cultural \/ nature/, 'Nature & Wildlife'],
  [/safari|desert/, 'Desert Safari'],
  [/cruise|charter|water activity/, 'Cruises & Yachts'],
  [/water sport|diving|beach package/, 'Water Sports & Diving'],
  [/museum|expo|festival|cultural event|^culture$|^cultural$|leisure \/ culture/, 'Museums & Culture'],
  [/heritage/, 'Heritage & Religious Sites'],
  [/adventure|aerial|outdoor activity|^outdoor$|glamping|^sport$/, 'Adventure & Outdoor'],
  [/tour|day trip|excursion|cultural activity|cultural \/ shopping/, 'Tours & Experiences'],
  [/entertainment|indoor|cinema|vr|kids|skating|ski|beach|dining|leisure|activity|sport \/ event|luxury/, 'Entertainment & Leisure'],
];
export function productCategoryFrom(category?: string | null, title?: string | null): ProductCategory {
  const c = String(category || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if ((PRODUCT_CATEGORIES as readonly string[]).includes(String(category || '').trim())) return String(category).trim() as ProductCategory;
  if (/sharjah safari|wildlife/i.test(String(title || ''))) return 'Nature & Wildlife';
  return CATEGORY_RULES.find(([re]) => re.test(c))?.[1] || 'Tours & Experiences';
}
