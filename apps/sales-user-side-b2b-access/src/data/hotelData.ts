export interface RoomRate {
  roomType: string;
  mealPlan: string;
  basePrice: number; // AED per night
}

export interface Hotel {
  id: string;
  name: string;
  location: string;
  emirate: string;
  stars: number;
  category: 'Luxury' | 'Deluxe' | 'Standard';
  rooms: RoomRate[];
  amenities: string[];
}

export const hotels: Hotel[] = [
  {
    id: 'h1',
    name: 'Atlantis The Palm',
    location: 'Palm Jumeirah, Dubai',
    emirate: 'Dubai',
    stars: 5,
    category: 'Luxury',
    amenities: ['Pool', 'Spa', 'Beach', 'Casino', 'Kids Club'],
    rooms: [
      { roomType: 'Deluxe Room', mealPlan: 'BB', basePrice: 1400 },
      { roomType: 'Deluxe Room', mealPlan: 'HB', basePrice: 1750 },
      { roomType: 'Ocean Suite', mealPlan: 'BB', basePrice: 2800 },
      { roomType: 'Ocean Suite', mealPlan: 'HB', basePrice: 3200 },
      { roomType: 'Royal Bridge Suite', mealPlan: 'BB', basePrice: 8500 },
    ],
  },
  {
    id: 'h2',
    name: 'Burj Al Arab Jumeirah',
    location: 'Jumeirah Beach, Dubai',
    emirate: 'Dubai',
    stars: 5,
    category: 'Luxury',
    amenities: ['Private Beach', 'Spa', 'Helicopter Pad', 'Butler Service'],
    rooms: [
      { roomType: 'Deluxe Suite', mealPlan: 'BB', basePrice: 5200 },
      { roomType: 'Deluxe Suite', mealPlan: 'HB', basePrice: 5800 },
      { roomType: 'Ocean Suite', mealPlan: 'BB', basePrice: 7500 },
      { roomType: 'Royal Suite', mealPlan: 'BB', basePrice: 18000 },
    ],
  },
  {
    id: 'h3',
    name: 'Jumeirah Beach Hotel',
    location: 'Jumeirah, Dubai',
    emirate: 'Dubai',
    stars: 5,
    category: 'Luxury',
    amenities: ['Beach', 'Pool', 'Spa', 'Kids Club', 'Restaurants'],
    rooms: [
      { roomType: 'Sea View Room', mealPlan: 'BB', basePrice: 900 },
      { roomType: 'Sea View Room', mealPlan: 'HB', basePrice: 1150 },
      { roomType: 'Beit Al Bahar Villa', mealPlan: 'BB', basePrice: 3500 },
    ],
  },
  {
    id: 'h4',
    name: 'Address Downtown Dubai',
    location: 'Downtown, Dubai',
    emirate: 'Dubai',
    stars: 5,
    category: 'Luxury',
    amenities: ['Infinity Pool', 'Spa', 'Burj Khalifa View', 'Fine Dining'],
    rooms: [
      { roomType: 'Superior Room', mealPlan: 'RO', basePrice: 750 },
      { roomType: 'Superior Room', mealPlan: 'BB', basePrice: 880 },
      { roomType: 'Deluxe Suite', mealPlan: 'RO', basePrice: 1600 },
      { roomType: 'Deluxe Suite', mealPlan: 'BB', basePrice: 1750 },
    ],
  },
  {
    id: 'h5',
    name: 'Sofitel Dubai The Palm',
    location: 'Palm Jumeirah, Dubai',
    emirate: 'Dubai',
    stars: 5,
    category: 'Deluxe',
    amenities: ['Private Beach', 'Pool', 'Spa', 'Restaurants'],
    rooms: [
      { roomType: 'Prestige Room', mealPlan: 'BB', basePrice: 680 },
      { roomType: 'Prestige Room', mealPlan: 'HB', basePrice: 850 },
      { roomType: 'Luxury Suite', mealPlan: 'BB', basePrice: 1400 },
    ],
  },
  {
    id: 'h6',
    name: 'Hilton Abu Dhabi Yas Island',
    location: 'Yas Island, Abu Dhabi',
    emirate: 'Abu Dhabi',
    stars: 5,
    category: 'Luxury',
    amenities: ['Beach', 'Pool', 'Spa', 'Near F1 Circuit'],
    rooms: [
      { roomType: 'King Room', mealPlan: 'BB', basePrice: 620 },
      { roomType: 'King Room', mealPlan: 'HB', basePrice: 780 },
      { roomType: 'Suite', mealPlan: 'BB', basePrice: 1100 },
    ],
  },
  {
    id: 'h7',
    name: 'Emirates Palace Mandarin Oriental',
    location: 'Corniche, Abu Dhabi',
    emirate: 'Abu Dhabi',
    stars: 5,
    category: 'Luxury',
    amenities: ['Private Beach', 'Gold ATM', 'Spa', 'Marina'],
    rooms: [
      { roomType: 'Palace Room', mealPlan: 'BB', basePrice: 1800 },
      { roomType: 'Palace Room', mealPlan: 'HB', basePrice: 2100 },
      { roomType: 'Palace Suite', mealPlan: 'BB', basePrice: 4500 },
      { roomType: 'Crown Prince Suite', mealPlan: 'BB', basePrice: 12000 },
    ],
  },
  {
    id: 'h8',
    name: 'Hyatt Regency Sharjah',
    location: 'Al Majaz, Sharjah',
    emirate: 'Sharjah',
    stars: 4,
    category: 'Deluxe',
    amenities: ['Pool', 'Spa', 'Beach Club', 'Restaurants'],
    rooms: [
      { roomType: 'Standard Room', mealPlan: 'RO', basePrice: 380 },
      { roomType: 'Standard Room', mealPlan: 'BB', basePrice: 460 },
      { roomType: 'Deluxe Room', mealPlan: 'BB', basePrice: 580 },
      { roomType: 'Suite', mealPlan: 'BB', basePrice: 950 },
    ],
  },
  {
    id: 'h9',
    name: 'Rotana Ras Al Khaimah',
    location: 'Al Hamra, Ras Al Khaimah',
    emirate: 'Ras Al Khaimah',
    stars: 5,
    category: 'Deluxe',
    amenities: ['Beach', 'Golf', 'Spa', 'Pool'],
    rooms: [
      { roomType: 'Superior Room', mealPlan: 'BB', basePrice: 520 },
      { roomType: 'Deluxe Room', mealPlan: 'BB', basePrice: 680 },
      { roomType: 'Suite', mealPlan: 'BB', basePrice: 1100 },
    ],
  },
  {
    id: 'h10',
    name: 'Citymax Hotel Bur Dubai',
    location: 'Bur Dubai, Dubai',
    emirate: 'Dubai',
    stars: 3,
    category: 'Standard',
    amenities: ['Pool', 'Restaurant', 'Gym'],
    rooms: [
      { roomType: 'Standard Room', mealPlan: 'RO', basePrice: 220 },
      { roomType: 'Standard Room', mealPlan: 'BB', basePrice: 280 },
      { roomType: 'Superior Room', mealPlan: 'BB', basePrice: 340 },
    ],
  },
];

export const MEAL_PLAN_LABELS: Record<string, string> = {
  RO: 'Room Only',
  BB: 'Bed & Breakfast',
  HB: 'Half Board',
  FB: 'Full Board',
  AI: 'All Inclusive',
};

export const EMIRATES = ['All', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Fujairah', 'Ajman'];
export const CATEGORIES = ['All', 'Luxury', 'Deluxe', 'Standard'];
export const STARS = [0, 3, 4, 5];
