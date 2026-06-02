// ─────────────────────────────────────────────────────────────────────────────
// Property Campaign Config
// Add a new entry here to create a QR open house landing page.
// Access via: /open-house?property=YOUR-SLUG&agent=daniel&source=qr
// ─────────────────────────────────────────────────────────────────────────────

export interface PropertyConfig {
  slug: string;
  address: string;
  community: string;
  city: string;
  state: string;
  zip: string;
  price: string;
  beds: string;
  baths: string;
  sqft?: string;
  lotSize?: string;
  yearBuilt?: string;
  mlsNumber?: string;
  latitude?: number;
  longitude?: number;
  description: string;
  campaign: string;
  features?: string[];
  imageUrl?: string;
}

export const PROPERTIES: Record<string, PropertyConfig> = {
  '9520-ekwanok': {
    slug: '9520-ekwanok',
    address: '9520 Ekwanok Dr',
    community: 'Mission Lakes Country Club',
    city: 'Desert Hot Springs',
    state: 'CA',
    zip: '92240',
    price: '$433,000',
    beds: '3',
    baths: '2',
    sqft: '1,842',
    description:
      'Golf course living in Mission Lakes Country Club. Desert lifestyle appeal with mountain views, pool access, and resort-style amenities steps from your door.',
    campaign: 'open_house_9520_ekwanok',
    features: [
      'Attached 2-car garage',
      'Golf course views',
      'Community pool & spa',
      'Low HOA',
      'Short drive to Palm Springs',
    ],
  },

  '40380-tonopah': {
    slug: '40380-tonopah',
    address: '40380 Tonopah Road',
    community: 'Thunderbird Heights',
    city: 'Rancho Mirage',
    state: 'CA',
    zip: '92270',
    price: '$2,999,999',
    beds: '3',
    baths: '4.5',
    sqft: '4,181',
    lotSize: '0.54 ac',
    yearBuilt: '1997',
    mlsNumber: '219143757',
    latitude: 33.7755,
    longitude: -116.4167,
    description:
      "Perched above the valley floor in prestigious Thunderbird Heights — Rancho Mirage's most storied hillside enclave. Contemporary estate on over half an acre with three luxurious suites, four and a half baths, panoramic mountain and city-light views. Stunning new custom kitchen with Sub-Zero and Thermador, saltwater pool and spa, outdoor kitchen with DCS grill, owned solar.",
    campaign: 'open_house_40380_tonopah',
    features: [
      'Saltwater pool & spa with spillways',
      'Outdoor kitchen — DCS grill, smoker, Evo',
      'Sub-Zero & Thermador kitchen, dual dishwashers',
      'Owned solar + generator',
      '4-car garage, EV charger',
      'Panoramic city light + mountain views',
      'Behind 24-hour guard gate',
    ],
  },

  '70629-boothill': {
    slug: '70629-boothill',
    address: '70629 Boothill Road',
    community: 'Thunderbird Heights',
    city: 'Rancho Mirage',
    state: 'CA',
    zip: '92270',
    price: '$3,895,000',
    beds: '4',
    baths: '4.5',
    sqft: '6,452',
    lotSize: '0.63 ac',
    yearBuilt: '1993',
    mlsNumber: '219147462',
    latitude: 33.7748,
    longitude: -116.4180,
    description:
      'Celebrity-owned estate on nearly two-thirds of an acre in the exclusive Thunderbird Heights enclave. 6,452 sqft of expansive light-filled living, four elegant fireplaces, walls of glass framing mountain views. Four bedroom suites, gourmet kitchen with granite island, serene pool area, separate lawn, large dog run. A rare opportunity with extraordinary bones, ready for the next owner to make it their own.',
    campaign: 'open_house_70629_boothill',
    features: [
      'Nearly 0.63 acre estate lot',
      '6,452 sqft — single level',
      '4 fireplaces (living, den, dining, primary)',
      '2 primary suites with retreats',
      'Gourmet kitchen, granite island, walk-in pantry',
      'Pool, separate lawn, dog run',
      '24-hour guard gate',
    ],
  },

  '40231-club-view': {
    slug: '40231-club-view',
    address: '40231 Club View Drive',
    community: 'Thunderbird Country Club Estates',
    city: 'Rancho Mirage',
    state: 'CA',
    zip: '92270',
    price: '$4,300,000',
    beds: '4',
    baths: '4',
    sqft: '4,821',
    lotSize: '0.43 ac',
    yearBuilt: '1955',
    mlsNumber: '219146029',
    latitude: 33.7700,
    longitude: -116.4220,
    description:
      'William Cody mid-century icon on the 18th fairway of Thunderbird Country Club — one of only 28 residences in Thunderbird Estates. Originally built in 1955 for Lawrence "Red" and Jessie Oakes, featured in Architectural Digest in 1962. Walls of glass frame three mountain ranges. Sensitively renovated with high-end finishes — move-in ready, honoring the architectural heritage. Once shared by Hollywood icons.',
    campaign: 'open_house_40231_club_view',
    features: [
      'William Cody architect — 1955, restored',
      'On the 18th fairway, 3-mountain-range views',
      '4,821 sqft with walls of glass',
      '4 bedrooms, 4 baths — all en-suite',
      'Heated private pool, gas-heated spa',
      'Featured in Architectural Digest 1962',
      'Thunderbird Estates — only 28 residences',
    ],
  },

  // ── Add new properties below ──────────────────────────────────────────────
};

export function getProperty(slug: string): PropertyConfig | null {
  return PROPERTIES[slug] ?? null;
}
