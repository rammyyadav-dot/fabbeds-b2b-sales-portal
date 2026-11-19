const EXACT_IMAGES: Array<[RegExp,string]> = [
  [/burj khalifa/i, '/attraction-images/burj-khalifa.jpg'],
  [/museum of the future/i, '/attraction-images/museum-future.jpg'],
  [/dubai frame/i, '/attraction-images/dubai-frame.jpg'],
  [/sheikh zayed grand mosque/i, '/attraction-images/grand-mosque.jpg'],
  [/qasr al watan|presidential palace/i, '/attraction-images/qasr-al-watan.jpg'],
  [/emirates palace/i, '/attraction-images/emirates-palace.jpg'],
  [/ferrari world/i, '/attraction-images/ferrari-world.jpg'],
  [/warner bros/i, '/attraction-images/warner-bros-world.jpg'],
  [/seaworld/i, '/attraction-images/seaworld-abu-dhabi.jpg'],
  [/yas waterworld/i, '/attraction-images/yas-waterworld.jpg'],
  [/yas marina|f1 yas/i, '/attraction-images/yas-marina.jpg'],
  [/aquaventure|lost chambers|dolphin bay/i, '/attraction-images/aquaventure.jpg'],
  [/jebel jais|ras al khaimah|rak |al marjan|al hamra/i, '/attraction-images/ras-al-khaimah.jpg'],
];

const CATEGORY_IMAGES: Array<[RegExp,string]> = [
  [/theme park|entertainment|indoor activity|vr|gaming|kids/i, '/attraction-images/ferrari-world.jpg'],
  [/waterpark|water park|aquarium|diving|snorkel|water sport|beach|cruise|yacht|boat|kayak|sailing/i, '/attraction-images/seaworld-abu-dhabi.jpg'],
  [/museum|heritage|cultural|landmark|religious/i, '/attraction-images/qasr-al-watan.jpg'],
  [/adventure|safari|desert|glamping|outdoor|sport|aerial|skydive|balloon/i, '/attraction-images/ras-al-khaimah.jpg'],
  [/observation|city tour|scenic|walking|photography/i, '/attraction-images/burj-khalifa.jpg'],
  [/dining|food|luxury/i, '/attraction-images/emirates-palace.jpg'],
];

export function resolveAttractionImage(params: {
  title?: string;
  city?: string;
  category?: string;
  coverImage?: string;
  coverImageUrl?: string;
}) {
  // Images loaded per attraction (uploaded cover, then credited stock hotlink) always win.
  if (params.coverImage) return params.coverImage;
  if (params.coverImageUrl) return params.coverImageUrl;
  const title = params.title || '';
  const city = params.city || '';
  const category = params.category || '';

  for (const [pattern, image] of EXACT_IMAGES) {
    if (pattern.test(title)) return image;
  }

  for (const [pattern, image] of CATEGORY_IMAGES) {
    if (pattern.test(category + ' ' + title)) return image;
  }

  if (/abu dhabi|yas|saadiyat|corniche|al ain/i.test(city)) return '/attraction-images/qasr-al-watan.jpg';
  if (/ras al khaimah|jebel jais|al marjan|al hamra|rak/i.test(city)) return '/attraction-images/ras-al-khaimah.jpg';
  if (/dubai|jumeirah|marina|deira|creek|difc|business bay|al quoz|hatta/i.test(city)) return '/attraction-images/burj-khalifa.jpg';
  return '/attraction-images/ras-al-khaimah.jpg';
}

export const ATTRACTION_HERO_IMAGES = [
  { image:'/attraction-images/ferrari-world.jpg', alt:'Ferrari World Abu Dhabi' },
  { image:'/attraction-images/aquaventure.jpg', alt:'Atlantis Aquaventure Dubai' },
  { image:'/attraction-images/seaworld-abu-dhabi.jpg', alt:'SeaWorld Abu Dhabi' },
  { image:'/attraction-images/burj-khalifa.jpg', alt:'Burj Khalifa Dubai' },
  { image:'/attraction-images/qasr-al-watan.jpg', alt:'Qasr Al Watan Abu Dhabi' },
  { image:'/attraction-images/ras-al-khaimah.jpg', alt:'Ras Al Khaimah adventure' },
];
