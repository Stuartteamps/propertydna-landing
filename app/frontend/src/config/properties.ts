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
  // ── Add new properties below ──────────────────────────────────────────────
  // 'your-slug': {
  //   slug: 'your-slug',
  //   address: '123 Main St',
  //   community: 'Community Name',
  //   city: 'Palm Springs',
  //   state: 'CA',
  //   zip: '92262',
  //   price: '$X,XXX,XXX',
  //   beds: '4',
  //   baths: '3',
  //   description: 'Property description.',
  //   campaign: 'open_house_your_slug',
  // },
};

export function getProperty(slug: string): PropertyConfig | null {
  return PROPERTIES[slug] ?? null;
}
