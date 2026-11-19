export type Campaign = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  route: string;
  accent: 'green' | 'amber' | 'blue';
};

const u = (photoId: string, width = 1600) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&fm=jpg&q=82&w=${width}`;

export const UAE_HERO_FALLBACK = {
  image: u('photo-1753723254635-def832e978b3', 2600),
  mobileImage: u('photo-1753723254635-def832e978b3', 1200),
  alt: 'Dubai skyline across the water',
  credit: 'Krzysztof / Unsplash',
};

export const UAE_DESTINATIONS = [
  {
    name: 'Dubai',
    subtitle: 'City, beach & resort stays',
    query: 'Dubai',
    image: u('photo-1753723254635-def832e978b3'),
    credit: 'Krzysztof / Unsplash',
  },
  {
    name: 'Abu Dhabi',
    subtitle: 'Culture, islands & luxury',
    query: 'Abu Dhabi',
    image: u('photo-1663920493668-b69ced9f1886'),
    credit: 'Social graam / Unsplash',
  },
  {
    name: 'Ras Al Khaimah',
    subtitle: 'Mountains & beach resorts',
    query: 'Ras Al Khaimah',
    image: u('photo-1766825344244-1f2df18334ca'),
    credit: 'Santhosh Sethumadhavan / Unsplash',
  },
  {
    name: 'Sharjah',
    subtitle: 'Heritage, waterfront & family stays',
    query: 'Sharjah',
    image: u('photo-1747250298470-28ead0337103'),
    credit: 'Subasun Townley / Unsplash',
  },
  {
    name: 'Fujairah',
    subtitle: 'East-coast beach escapes',
    query: 'Fujairah',
    image: u('photo-1634710763673-37120579aeef'),
    credit: 'Riyas Mohammed / Unsplash',
  },
  {
    name: 'Ajman',
    subtitle: 'Beach and city leisure',
    query: 'Ajman',
    image: u('photo-1706413639793-1ad524e698ae'),
    credit: 'DARKROOMLABS / Unsplash',
  },
  {
    name: 'Umm Al Quwain',
    subtitle: 'Heritage and quiet coastal stays',
    query: 'Umm Al Quwain',
    image: u('photo-1764583885014-954026d00c00'),
    credit: 'Vanburn Gonsalves / Unsplash',
  },
] as const;

export const UAE_PRODUCT_CATEGORIES = [
  { title: 'Hotels', subtitle: 'Contracted UAE inventory & allocations.', route: '/search', emoji: '🏨' },
  { title: 'Attractions', subtitle: 'Signature UAE experiences & entry tickets.', route: '/attractions', emoji: '🎟️' },
  { title: 'Transfers', subtitle: 'Airport & point-to-point transfers nationwide.', route: '/transfers', emoji: '🚘' },
  { title: 'Visa', subtitle: 'Fast-track UAE tourist visa processing.', route: '/visa', emoji: '🛂' },
  { title: 'Packages', subtitle: 'Complete UAE holiday packages for travel trade.', route: '/packages', emoji: '🧳' },
] as const;

export const UAE_EXPERIENCES = [
  { title: 'Dubai city stays', query: 'Dubai', subtitle: 'Downtown, Bur Dubai, Deira & more' },
  { title: 'Beach resorts', query: 'Ras Al Khaimah', subtitle: 'RAK and UAE resort inventory' },
  { title: 'Abu Dhabi escapes', query: 'Abu Dhabi', subtitle: 'City and island hotel stays' },
  { title: 'East-coast retreats', query: 'Fujairah', subtitle: 'Fujairah beach hotels' },
  { title: 'Value stays', query: 'Sharjah', subtitle: 'Sharjah and northern emirates' },
] as const;

const CAMPAIGNS: Campaign[] = [
  {
    id: 'trade-deals',
    eyebrow: 'UAE trade deals',
    title: 'Fresh UAE hotel rates for your next client quote.',
    body: 'Search live contracted inventory, compare room and meal plans, then book against your approved agency credit.',
    cta: 'Search UAE hotels',
    route: '/search',
    accent: 'green',
  },
  {
    id: 'rak',
    eyebrow: 'Northern Emirates',
    title: 'Build a Ras Al Khaimah escape in minutes.',
    body: 'Compare valid RAK resort rates, cancellation terms and room options in AED from one B2B workflow.',
    cta: 'Explore Ras Al Khaimah',
    route: '/search?q=Ras+Al+Khaimah',
    accent: 'blue',
  },
  {
    id: 'offline-source',
    eyebrow: 'Need something else?',
    title: 'Can’t find the UAE hotel your client asked for?',
    body: 'Send an offline hotel request to the fabBeds operations team and keep the enquiry inside the same trade workflow.',
    cta: 'Request any UAE hotel',
    route: '/offline-inquiry',
    accent: 'amber',
  },
];

export function getCampaignVariant(seed = new Date()): Campaign {
  const dayKey = Number(seed.toISOString().slice(0, 10).replace(/-/g, ''));
  return CAMPAIGNS[dayKey % CAMPAIGNS.length];
}

export const UAE_FOOTER_DIRECTORY = [
  {
    heading: 'Popular UAE destinations',
    links: ['Dubai hotels', 'Abu Dhabi hotels', 'Ras Al Khaimah hotels', 'Sharjah hotels', 'Fujairah hotels', 'Ajman hotels', 'Umm Al Quwain hotels'],
  },
  {
    heading: 'Travel trade services',
    links: ['UAE hotel tariff', 'UAE attractions', 'UAE transfers', 'UAE visa services', 'UAE packages', 'Groups & MICE', 'Offline hotel sourcing'],
  },
  {
    heading: 'Agency account',
    links: ['Partner sign in', 'My bookings', 'Agency credit account', 'Find a booking', 'Price match request'],
  },
  {
    heading: 'Hotel themes',
    links: ['Dubai city hotels', 'UAE beach resorts', 'Family hotels UAE', 'Business hotels UAE', 'Luxury UAE stays', 'Northern Emirates resorts'],
  },
] as const;
