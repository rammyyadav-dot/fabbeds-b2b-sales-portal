export const OFFICIAL_TOURISM_IMAGES = {
  dubaiLoveLake: 'https://www.visitdubai.com/-/media/gathercontent/poi/l/love-lake/love-lake-01.jpg',
  dubaiBluewaters: 'https://www.visitdubai.com/-/media/gathercontent/poi/a/ain-dubai/fallback-image/ain-dubai-bluewaters-island-6.jpg',
  dubaiDesignDistrict: 'https://www.visitdubai.com/-/media/images/leisure/neighbourhood-pages/dubai-design-district/fallback/d3-header-dtcm.jpg?ch=397&cw=397&cx=0.59&cy=0.41&rev=8f69d5054c7d4794b02cade3b2a9ef81',
  dubaiLaMer: 'https://www.visitdubai.com/-/media/gathercontent/article/l/la-mer-dubais-newest-beachfront/fallback-image/newla-mer-dubais-newest-beachfrontherogettyimages.jpg',
  abuDhabiStaycation: 'https://visitabudhabi.ae/-/media/project/vad/landing-page-mfd/hero-banner/box-1/plan-your-perfect-abu-dhabi-staycation.jpg?h=3335&iar=0&w=5000&rev=6ec4f04d51a64bdba94598f22f0071f5',
} as const;

const byDestination: Record<string,string> = {
  Dubai: OFFICIAL_TOURISM_IMAGES.dubaiBluewaters,
  'Abu Dhabi': OFFICIAL_TOURISM_IMAGES.abuDhabiStaycation,
  'Ras Al Khaimah': '/hero-carousel/ras-al-khaimah.jpg',
  Sharjah: OFFICIAL_TOURISM_IMAGES.dubaiDesignDistrict,
  Fujairah: OFFICIAL_TOURISM_IMAGES.dubaiLaMer,
  Ajman: OFFICIAL_TOURISM_IMAGES.dubaiLoveLake,
};

export const PACKAGE_HERO_SLIDES = [
  { image:OFFICIAL_TOURISM_IMAGES.dubaiBluewaters, label:'Dubai · Visit Dubai', title:'City Icons & Waterfront Escapes' },
  { image:OFFICIAL_TOURISM_IMAGES.abuDhabiStaycation, label:'Abu Dhabi · Experience Abu Dhabi', title:'Capital Culture & Luxury' },
  { image:OFFICIAL_TOURISM_IMAGES.dubaiLoveLake, label:'Dubai · Visit Dubai', title:'Desert Romance & Nature' },
  { image:OFFICIAL_TOURISM_IMAGES.dubaiLaMer, label:'Dubai · Visit Dubai', title:'Beach Holidays & City Breaks' },
  { image:OFFICIAL_TOURISM_IMAGES.dubaiDesignDistrict, label:'Dubai · Visit Dubai', title:'Modern UAE City Experiences' },
];

export function packageFallbackImage(destinations:string[]){
  for(const d of destinations){
    if(byDestination[d]) return byDestination[d];
  }
  return OFFICIAL_TOURISM_IMAGES.dubaiBluewaters;
}
