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
  marketingRemarks?: string;        // long-form MLS marketing text — shown on welcome page
  campaign: string;
  features?: string[];
  images?: string[];                // relative paths from /public — e.g. /open-house/40380-tonopah/1.jpg
  agent?: {
    name: string;
    phone: string;
    email: string;
  };
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
      "Contemporary estate on over half an acre in Thunderbird Heights with panoramic mountain and city-light views, saltwater pool and spa, outdoor kitchen, and owned solar.",
    marketingRemarks:
      "Perched above the valley floor in prestigious Thunderbird Heights, this exceptional contemporary estate embodies timeless desert glamour and modern luxury living in one of Rancho Mirage's most storied hillside enclaves. Developed in the early 1950s alongside the iconic Thunderbird Country Club, the neighborhood has long been a retreat for celebrities, presidents, and influential figures. Spanning approximately 4,181 square feet on over half an acre, this beautifully maintained and thoughtfully upgraded residence features three luxurious bedroom suites, four and one-half baths, and sweeping mountain and valley views. The expansive great room, anchored by a fireplace and a full entertainer's bar, opens to a spectacular poolside terrace. Multiple conversation areas, a saltwater pool and spa with gentle spillways, and a fully equipped outdoor kitchen with DCS grill, smoker, and Evo grill create a true resort-style experience. A stunning new custom kitchen showcases Sub-Zero and Thermador appliances, dual dishwashers, induction cooktop, double ovens, a full-size wine cooler, and adjacent formal dining. The primary retreat offers dual bathrooms, a large walk-in closet, an attached lounge, gym or office, and patio access with Chocolate Mountain views.",
    campaign: 'open_house_40380_tonopah',
    features: [
      'Saltwater pool & spa with spillways',
      'Outdoor kitchen — DCS grill, smoker, Evo',
      'Sub-Zero & Thermador kitchen, dual dishwashers',
      'Owned solar + backup generator',
      '4-car garage, EV charger, RV-ready',
      'Panoramic city light + mountain views',
      'Behind 24-hour guard gate',
    ],
    images: [
      '/open-house/40380-tonopah/1.jpg',
      '/open-house/40380-tonopah/2.jpg',
      '/open-house/40380-tonopah/3.jpg',
      '/open-house/40380-tonopah/4.jpg',
      '/open-house/40380-tonopah/5.jpg',
    ],
    agent: { name: 'Daniel Stuart', phone: '+16196770900', email: 'stuartteamps@gmail.com' },
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
      'Celebrity-owned estate on nearly two-thirds of an acre in Thunderbird Heights — 6,452 sqft, four fireplaces, walls of glass framing mountain views, gourmet kitchen, serene pool area, separate lawn, dog run.',
    marketingRemarks:
      "Welcome to an extraordinary desert retreat nestled in the exclusive enclave of Thunderbird Heights. Set on nearly two-thirds of an acre, this celebrity-owned estate spans an impressive 6,452 square feet, offering a rare blend of privacy, luxury, and breathtaking natural beauty. From the inviting entry, you are greeted by a spacious, light-filled layout designed for both grand entertaining and relaxed everyday living. Expansive living areas are enhanced by four elegant fireplaces, while walls of glass frame stunning mountain views and flood the home with abundant natural light. The heart of the home features an expansive granite counter and generous gathering spaces that seamlessly connect indoors to out. Rich flagstone floors add warmth and character, complementing the home's timeless desert aesthetic. Newer HVAC systems provide modern comfort and efficiency year-round. With four generously appointed bedrooms and four-and-a-half baths, each space is thoughtfully designed for comfort and privacy. Outdoors, the grounds are equally impressive—enjoy a serene pool area perfect for relaxation, a separate lawn ideal for outdoor games, and a large dog run for your four-legged companions.",
    campaign: 'open_house_70629_boothill',
    features: [
      'Nearly 0.63 acre estate lot',
      '6,452 sqft — single level',
      '4 fireplaces (living, den, dining, primary)',
      '2 primary suites with retreats',
      'Gourmet kitchen, granite island, walk-in pantry',
      'Pool, separate lawn, dog run',
      '24-hour guard gate, celebrity owner',
    ],
    images: [
      '/open-house/70629-boothill/1.jpg',
      '/open-house/70629-boothill/2.jpg',
      '/open-house/70629-boothill/3.jpg',
      '/open-house/70629-boothill/4.jpg',
      '/open-house/70629-boothill/5.jpg',
    ],
    agent: { name: 'Daniel Stuart', phone: '+16196770900', email: 'stuartteamps@gmail.com' },
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
      'William Cody mid-century icon on the 18th fairway of Thunderbird Country Club — one of only 28 residences in Thunderbird Estates. Walls of glass frame three mountain ranges. Sensitively renovated, move-in ready, honoring the architectural heritage.',
    marketingRemarks:
      "Welcome to an extraordinary offering in Thunderbird Estates, one of Rancho Mirage's most exclusive and private enclaves, comprised of just 28 residences. This iconic desert modern home, originally designed in 1955 by renowned mid-century architect William Cody, spans approximately 4,821 square feet with 4 bedrooms and 4 baths, gracefully positioned along the 18th fairway of Thunderbird Country Club. Walls of glass — true to Cody's signature style — frame breathtaking panoramic vistas of three majestic mountain ranges while seamlessly blending indoor and outdoor living. A complete interior remodel showcases refined, high-end finishes and meticulous attention to detail, delivering a move-in ready residence tailored for the most discerning buyer. Grand-scale rooms are flooded with natural light, creating an ambiance that is both sophisticated and inviting. Outdoors, the estate is enveloped by mature, low-maintenance desert landscaping, offering a serene and private setting ideal for poolside entertaining. Rich in history, the home was originally built for Lawrence 'Red' and Jessie Oakes and was featured in Architectural Digest in 1962. Thoughtfully and sensitively renovated, it honors its architectural heritage while embracing modern luxury — ready for its next 70 years.",
    campaign: 'open_house_40231_club_view',
    features: [
      'William Cody architect — 1955, sensitively restored',
      'On the 18th fairway, 3-mountain-range views',
      '4,821 sqft with walls of glass',
      '4 bedrooms, 4 baths — all en-suite',
      'Heated private pool, gas-heated spa',
      'Featured in Architectural Digest 1962',
      'Thunderbird Estates — only 28 residences',
    ],
    images: [
      '/open-house/40231-club-view/1.jpg',
      '/open-house/40231-club-view/2.jpg',
      '/open-house/40231-club-view/3.jpg',
      '/open-house/40231-club-view/4.jpg',
      '/open-house/40231-club-view/5.jpg',
    ],
    agent: { name: 'Daniel Stuart', phone: '+16196770900', email: 'stuartteamps@gmail.com' },
  },

  // ── Add new properties below ──────────────────────────────────────────────
};

export function getProperty(slug: string): PropertyConfig | null {
  return PROPERTIES[slug] ?? null;
}
