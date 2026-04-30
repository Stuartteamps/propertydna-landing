export interface HeatParcel {
  id: string;
  address: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  score: number;
  confidence: number;
  price: number;
  pricePerSqft: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  dom: number;
  permits: number;
  propertyType: 'single_family' | 'condo' | 'multi_family' | 'land';
  compsScore: number;
  priceDeltaScore: number;
  domScore: number;
  permitsScore: number;
  livability: number;
  rentalDemand: number;
  sparkline: number[];
  polygon: [number, number][];
  neighborhood: string;
}

export interface HeatFilterWeights {
  comps: number;
  priceDelta: number;
  dom: number;
  permits: number;
  livability: number;
  rentalDemand: number;
}

export interface HeatHoverState {
  parcel: HeatParcel;
  x: number;
  y: number;
}
