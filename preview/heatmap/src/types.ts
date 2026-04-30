export interface Parcel {
  id: string;
  address: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;

  // Composite
  score: number;        // 0–100
  confidence: number;   // 0–1

  // Raw property data
  price: number;
  pricePerSqft: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  dom: number;          // days on market
  permits: number;      // recent permit count
  propertyType: 'single_family' | 'condo' | 'multi_family' | 'land';

  // Sub-scores (0–100 each)
  compsScore: number;
  priceDeltaScore: number;
  domScore: number;
  permitsScore: number;
  livability: number;
  rentalDemand: number;

  // 30-day price index sparkline (relative to baseline 100)
  sparkline: number[];

  // Parcel polygon (lon, lat pairs) for zoom > 12 view
  polygon: [number, number][];

  neighborhood: string;
}

export interface FilterWeights {
  comps: number;
  priceDelta: number;
  dom: number;
  permits: number;
  livability: number;
  rentalDemand: number;
}

export interface HoverState {
  parcel: Parcel;
  x: number;
  y: number;
}
