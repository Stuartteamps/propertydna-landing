// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — mock map dataset
//
// Realistic Palm Springs / Coachella Valley assets + a scattered heat grid. All
// of this is replaced 1:1 by live data through `normalizePropertyData.ts`; the UI
// only ever sees PropertyDNAAsset / HeatPoint, never the raw source.
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildFutureScenarios,
  buildIndexSeries,
  buildRiskProfile,
  buildValueHistory,
  calcConfidence,
  calcOpportunity,
  calcRiskAdjustedValue,
  calcValueRange,
  TIME_RANGES,
} from './calculatePropertyDNA';
import type {
  ComparableSale,
  HeatLayerId,
  HeatPoint,
  ImprovementOpportunity,
  MapLayerConfig,
  PermitRecord,
  PropertyDNAAsset,
  RiskFactor,
  SaleHistory,
  TimeRange,
} from './types';

// ── Heat-layer display config (empowerment framing, no agent/lead-gen copy) ────

export const MAP_LAYERS: MapLayerConfig[] = [
  {
    id: 'recent-sales',
    label: 'Recent Closed Sales',
    shortLabel: 'Closed Sales',
    description: 'Where money actually changed hands recently.',
    blurb: 'See what changed — real closings, not asking prices.',
    colorStops: ['#1E2A3A', '#3D6FB0', '#7FB3E8'],
  },
  {
    id: 'price-per-sqft',
    label: 'Price per Sq Ft',
    shortLabel: '$/Sq Ft',
    description: 'Normalized value density across the area.',
    blurb: 'Compare value the way the pros do — per square foot.',
    colorStops: ['#1E2A1E', '#5E8B3A', '#B89355'],
  },
  {
    id: 'days-on-market',
    label: 'Days on Market',
    shortLabel: 'Days on Mkt',
    description: 'How fast homes are absorbed here.',
    blurb: 'Spot leverage — fast markets favor sellers, slow favor buyers.',
    colorStops: ['#2A2620', '#9C7B3A', '#C94B3A'],
  },
  {
    id: 'appreciation',
    label: 'Appreciation Trend',
    shortLabel: 'Appreciation',
    description: 'Trailing value growth momentum.',
    blurb: 'Track your home like a portfolio — where equity is compounding.',
    colorStops: ['#241E2A', '#6A4FA0', '#54C18A'],
  },
  {
    id: 'inventory-pressure',
    label: 'Inventory Pressure',
    shortLabel: 'Inventory',
    description: 'Supply vs. demand tension.',
    blurb: 'Understand the squeeze — tight supply moves prices.',
    colorStops: ['#1E2A2A', '#3A8C8C', '#C9A23A'],
  },
  {
    id: 'risk-score',
    label: 'Risk Score',
    shortLabel: 'Risk',
    description: 'Blended fire, flood, heat & insurance exposure.',
    blurb: 'Understand your risk before it costs you.',
    colorStops: ['#1E2A20', '#B3A33A', '#C94B3A'],
  },
  {
    id: 'permit-opportunity',
    label: 'Permit / ADU Opportunity',
    shortLabel: 'Permits / ADU',
    description: 'Where lots support added square footage.',
    blurb: 'Find hidden equity — room to build, room to add value.',
    colorStops: ['#2A261E', '#9C7B3A', '#54C18A'],
  },
  {
    id: 'future-equity',
    label: 'Future-Equity Opportunity',
    shortLabel: 'Future Equity',
    description: 'Modeled upside over the next cycle.',
    blurb: 'Your data. Your leverage. Where tomorrow’s equity lives.',
    colorStops: ['#1E2433', '#3D6FB0', '#B89355'],
  },
];

export const HEAT_LAYER_IDS: HeatLayerId[] = MAP_LAYERS.map((l) => l.id);

// ── Compact spec → full asset factory ─────────────────────────────────────────

interface AssetSpec {
  id: string;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  beds: number;
  baths: number;
  sqft: number;
  lotSqft: number;
  yearBuilt: number;
  value: number;
  growthPct: number;        // trailing 1Y appreciation
  fireScore: number;
  floodScore: number;
  heatScore: number;
  insuranceScore: number;
  hoaScore: number;
  permitScore: number;
  aduPotential: PropertyDNAAsset['aduPotential'];
  lotCoveragePct: number;
  zoning: string;
  neighborhood: string;
  topInsight: string;
  nextBestPermit: string;
  unpermittedAdditionFlag: boolean;
}

const RISK_LABELS: Record<RiskFactor['key'], string> = {
  fire: 'Wildfire',
  flood: 'Flood',
  heat: 'Extreme Heat',
  insurance: 'Insurance Cost',
  hoa: 'HOA Exposure',
  permit: 'Permit / Legal',
};

function riskDetail(key: RiskFactor['key'], score: number): string {
  const band = score < 25 ? 'low' : score < 50 ? 'moderate' : score < 75 ? 'elevated' : 'high';
  const map: Record<RiskFactor['key'], string> = {
    fire: `Wildfire exposure is ${band} for this parcel.`,
    flood: `FEMA flood exposure is ${band}.`,
    heat: `Extreme-heat days are ${band} vs. the region.`,
    insurance: `Insurance cost pressure is ${band} here.`,
    hoa: `HOA / special-assessment exposure is ${band}.`,
    permit: `Unpermitted-work / legal risk is ${band}.`,
  };
  return map[key];
}

function buildComps(spec: AssetSpec, seed: number): ComparableSale[] {
  const streets = ['Via Lola', 'E Tahquitz', 'Camino Real', 'N Palm Cyn', 'Vista Chino', 'Ramon Rd'];
  return Array.from({ length: 5 }, (_, i) => {
    const ppsf = Math.round((spec.value / spec.sqft) * (0.9 + ((seed + i) % 5) * 0.04));
    const sqft = spec.sqft + ((i % 3) - 1) * 180;
    return {
      id: `${spec.id}-comp-${i}`,
      address: `${320 + i * 47} ${streets[(seed + i) % streets.length]}`,
      distanceMi: Math.round((0.2 + i * 0.18) * 100) / 100,
      salePrice: Math.round((ppsf * sqft) / 1000) * 1000,
      pricePerSqft: ppsf,
      beds: spec.beds + ((i % 2) - 1),
      baths: spec.baths,
      sqft,
      saleDate: new Date(Date.now() - (30 + i * 42) * 86400000).toISOString(),
      domDays: 12 + ((seed + i) % 6) * 9,
    };
  });
}

function buildSales(spec: AssetSpec): SaleHistory[] {
  const out: SaleHistory[] = [];
  const yearsBack = [9, 5, 2, 0];
  yearsBack.forEach((yb, i) => {
    const factor = Math.pow(1 + spec.growthPct / 100, -(yb)) * (0.7 + i * 0.1);
    const price = Math.round((spec.value * factor) / 1000) * 1000;
    out.push({
      id: `${spec.id}-sale-${i}`,
      date: new Date(Date.now() - yb * 365 * 86400000).toISOString(),
      price,
      pricePerSqft: Math.round(price / spec.sqft),
      event: i === yearsBack.length - 1 ? 'listing' : 'sale',
      source: i % 2 === 0 ? 'county' : 'mls',
    });
  });
  return out;
}

function buildPermits(spec: AssetSpec, seed: number): PermitRecord[] {
  const base: Omit<PermitRecord, 'id'>[] = [
    { date: new Date(Date.now() - 320 * 86400000).toISOString(), type: 'Re-roof', description: 'Tear-off & re-roof, class A', value: 24000, status: 'final', source: 'county' },
    { date: new Date(Date.now() - 900 * 86400000).toISOString(), type: 'Pool / Spa', description: 'In-ground pool + equipment', value: 68000, status: 'final', source: 'county' },
    { date: new Date(Date.now() - 140 * 86400000).toISOString(), type: 'Solar PV', description: '7.2kW rooftop solar', value: 31000, status: 'active', source: 'county' },
  ];
  const out = base.slice(0, 2 + (seed % 2)).map((p, i) => ({ ...p, id: `${spec.id}-permit-${i}` }));
  if (spec.aduPotential === 'strong') {
    out.push({
      id: `${spec.id}-permit-adu`,
      date: new Date(Date.now() - 30 * 86400000).toISOString(),
      type: 'ADU (pre-check)',
      description: 'Detached ADU feasibility on file',
      value: 0,
      status: 'pending',
      isAdu: true,
      source: 'estimate',
    });
  }
  return out;
}

function buildOpportunities(spec: AssetSpec): ImprovementOpportunity[] {
  const specs: { title: string; description: string; cost: number; add: number; conf: number }[] = [
    { title: 'Detached ADU (casita)', description: 'Add ~600 sqft rentable casita on the rear lot.', cost: 165000, add: 285000, conf: spec.aduPotential === 'strong' ? 0.82 : 0.55 },
    { title: 'Kitchen + great-room refresh', description: 'Open the kitchen, premium finishes, lighting.', cost: 72000, add: 118000, conf: 0.78 },
    { title: 'Desert-scape + curb appeal', description: 'Low-water landscape, lighting, entry refresh.', cost: 28000, add: 52000, conf: 0.74 },
    { title: 'Primary suite + bath expansion', description: 'Reconfigure to a true spa primary suite.', cost: 95000, add: 140000, conf: 0.66 },
    { title: 'Solar + battery + efficiency', description: 'Cut carrying cost, lift appraised value.', cost: 41000, add: 63000, conf: 0.7 },
  ];
  return specs
    .map((s, i) => {
      const { netGain, roiPct } = calcOpportunity(s.cost, s.add);
      return {
        id: `${spec.id}-opp-${i}`,
        title: s.title,
        description: s.description,
        estimatedCost: s.cost,
        valueAdded: s.add,
        netGain,
        roiPct,
        confidence: s.conf,
      };
    })
    .sort((a, b) => b.netGain - a.netGain);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function buildAsset(spec: AssetSpec, idx: number): PropertyDNAAsset {
  const seed = idx + 1;
  const pricePerSqft = Math.round(spec.value / spec.sqft);
  const valueRange = calcValueRange(spec.value, 0.07 + (seed % 3) * 0.01);

  const factors: RiskFactor[] = (
    [
      ['fire', spec.fireScore],
      ['flood', spec.floodScore],
      ['heat', spec.heatScore],
      ['insurance', spec.insuranceScore],
      ['hoa', spec.hoaScore],
      ['permit', spec.permitScore],
    ] as [RiskFactor['key'], number][]
  ).map(([key, score]) => ({
    key,
    label: RISK_LABELS[key],
    level: score < 25 ? 'low' : score < 50 ? 'moderate' : score < 75 ? 'elevated' : 'high',
    score,
    detail: riskDetail(key, score),
  }));

  const riskProfile = buildRiskProfile(factors, seed);
  const riskAdjustedValue = calcRiskAdjustedValue(spec.value, riskProfile.overall);
  const comparableSales = buildComps(spec, seed);
  const confidenceScore = calcConfidence({ compCount: comparableSales.length, valueRange, riskOverall: riskProfile.overall });

  const changePct: Record<TimeRange, number> = {
    '1M': Math.round((spec.growthPct / 12) * 10) / 10,
    '6M': Math.round((spec.growthPct / 2) * 10) / 10,
    '1Y': spec.growthPct,
    '3Y': Math.round(spec.growthPct * 2.6 * 10) / 10,
    '5Y': Math.round(spec.growthPct * 4.1 * 10) / 10,
  };
  const indexSeries = TIME_RANGES.map((r) => buildIndexSeries(r, changePct[r], seed + 7));

  const heatValues: Record<HeatLayerId, number> = {
    'recent-sales': clamp01(0.3 + (seed % 6) * 0.11),
    'price-per-sqft': clamp01(pricePerSqft / 950),
    'days-on-market': clamp01(((spec.permitScore + 20) % 100) / 100),
    appreciation: clamp01(spec.growthPct / 12),
    'inventory-pressure': clamp01(0.25 + (seed % 5) * 0.14),
    'risk-score': clamp01(riskProfile.overall / 100),
    'permit-opportunity': clamp01(spec.aduPotential === 'strong' ? 0.9 : spec.aduPotential === 'possible' ? 0.55 : 0.2),
    'future-equity': clamp01(0.4 + (changePct['5Y'] / 120)),
  };

  return {
    id: spec.id,
    address: spec.address,
    city: spec.city,
    state: 'CA',
    zip: spec.zip,
    lat: spec.lat,
    lon: spec.lon,
    lng: spec.lon,
    propertyType: 'single_family',
    beds: spec.beds,
    baths: spec.baths,
    sqft: spec.sqft,
    lotSqft: spec.lotSqft,
    yearBuilt: spec.yearBuilt,

    dnaValue: spec.value,
    riskAdjustedValue,
    confidenceScore,
    valueRange,
    pricePerSqft,

    neighborhoodTrendPct: spec.growthPct,
    marketMomentum: {
      label: spec.growthPct > 8 ? 'Accelerating' : spec.growthPct > 4 ? 'Steady' : 'Cooling',
      score: Math.round((spec.growthPct - 5) * 12),
      direction: spec.growthPct > 6 ? 'up' : spec.growthPct < 3 ? 'down' : 'flat',
    },
    topInsight: spec.topInsight,

    valueHistory: buildValueHistory(spec.value, spec.growthPct, seed),
    saleHistory: buildSales(spec),
    comparableSales,

    permits: buildPermits(spec, seed),
    unpermittedAdditionFlag: spec.unpermittedAdditionFlag,
    aduPotential: spec.aduPotential,
    lotCoveragePct: spec.lotCoveragePct,
    zoning: spec.zoning,
    nextBestPermit: spec.nextBestPermit,

    riskProfile,

    opportunities: buildOpportunities(spec),

    neighborhood: {
      name: spec.neighborhood,
      currentIndex: indexSeries[2].points[indexSeries[2].points.length - 1].value,
      cityIndex: 100 + spec.growthPct * 0.82,
      zipIndex: 100 + spec.growthPct * 1.04,
      series: indexSeries,
      changePct,
    },

    futureScenarios: buildFutureScenarios(riskAdjustedValue, Math.max(2.5, spec.growthPct * 0.7), seed + 3),

    heatValues,
  };
}

// ── Source specs (Palm Springs core) ──────────────────────────────────────────

const SPECS: AssetSpec[] = [
  {
    id: 'ps-001', address: '697 N Farrell Dr', city: 'Palm Springs', zip: '92262', lat: 33.8389, lon: -116.5295,
    beds: 4, baths: 3, sqft: 2480, lotSqft: 10890, yearBuilt: 1962, value: 1485000, growthPct: 9.4,
    fireScore: 22, floodScore: 14, heatScore: 64, insuranceScore: 38, hoaScore: 8, permitScore: 18,
    aduPotential: 'strong', lotCoveragePct: 28, zoning: 'R-1-A', neighborhood: 'Movie Colony East',
    topInsight: 'Mid-century pedigree + oversized lot — strongest ADU upside on the block.',
    nextBestPermit: 'Detached ADU — lot coverage supports ~600 sqft.', unpermittedAdditionFlag: false,
  },
  {
    id: 'ps-002', address: '1234 S Camino Real', city: 'Palm Springs', zip: '92264', lat: 33.8002, lon: -116.5402,
    beds: 3, baths: 2, sqft: 1820, lotSqft: 8250, yearBuilt: 1974, value: 925000, growthPct: 6.8,
    fireScore: 18, floodScore: 22, heatScore: 70, insuranceScore: 44, hoaScore: 0, permitScore: 30,
    aduPotential: 'possible', lotCoveragePct: 34, zoning: 'R-1-B', neighborhood: 'Deepwell Estates',
    topInsight: 'Below neighborhood $/sqft — a kitchen refresh closes most of the gap.',
    nextBestPermit: 'Kitchen / great-room remodel — fastest value-per-dollar.', unpermittedAdditionFlag: true,
  },
  {
    id: 'ps-003', address: '450 W Vista Chino', city: 'Palm Springs', zip: '92262', lat: 33.8421, lon: -116.5468,
    beds: 5, baths: 4, sqft: 3360, lotSqft: 15600, yearBuilt: 1958, value: 2240000, growthPct: 11.2,
    fireScore: 26, floodScore: 10, heatScore: 62, insuranceScore: 52, hoaScore: 0, permitScore: 14,
    aduPotential: 'strong', lotCoveragePct: 24, zoning: 'R-1-A', neighborhood: 'Old Las Palmas',
    topInsight: 'Trophy address with index outperforming the city by 3.1% annually.',
    nextBestPermit: 'Guest casita + pool house — premium-tier comps support it.', unpermittedAdditionFlag: false,
  },
  {
    id: 'ps-004', address: '88 Vista Verde Cir', city: 'Palm Springs', zip: '92264', lat: 33.7894, lon: -116.5331,
    beds: 2, baths: 2, sqft: 1390, lotSqft: 0, yearBuilt: 1986, value: 612000, growthPct: 4.6,
    fireScore: 12, floodScore: 16, heatScore: 72, insuranceScore: 40, hoaScore: 58, permitScore: 42,
    aduPotential: 'none', lotCoveragePct: 0, zoning: 'PUD', neighborhood: 'Canyon Sands',
    topInsight: 'HOA-heavy condo — value tracks the complex; watch special assessments.',
    nextBestPermit: 'Interior modernization within HOA architectural guidelines.', unpermittedAdditionFlag: false,
  },
  {
    id: 'ps-005', address: '2025 E Tahquitz Cyn Way', city: 'Palm Springs', zip: '92262', lat: 33.8235, lon: -116.5142,
    beds: 4, baths: 3, sqft: 2710, lotSqft: 11200, yearBuilt: 1969, value: 1320000, growthPct: 8.1,
    fireScore: 20, floodScore: 12, heatScore: 66, insuranceScore: 36, hoaScore: 0, permitScore: 22,
    aduPotential: 'strong', lotCoveragePct: 30, zoning: 'R-1-A', neighborhood: 'Sunmor',
    topInsight: 'Sunmor demand is tight — fast absorption and rising $/sqft.',
    nextBestPermit: 'Detached ADU — short-term-rental zoning is favorable here.', unpermittedAdditionFlag: false,
  },
  {
    id: 'ps-006', address: '356 Camino Sur', city: 'Palm Springs', zip: '92262', lat: 33.8467, lon: -116.5371,
    beds: 3, baths: 3, sqft: 2150, lotSqft: 9600, yearBuilt: 1965, value: 1075000, growthPct: 7.3,
    fireScore: 24, floodScore: 11, heatScore: 63, insuranceScore: 42, hoaScore: 0, permitScore: 26,
    aduPotential: 'possible', lotCoveragePct: 32, zoning: 'R-1-A', neighborhood: 'Vista Las Palmas',
    topInsight: 'Architectural-district premium not yet fully priced into this parcel.',
    nextBestPermit: 'Primary-suite expansion to match district comps.', unpermittedAdditionFlag: false,
  },
  {
    id: 'ps-007', address: '770 E Stevens Rd', city: 'Palm Springs', zip: '92262', lat: 33.8398, lon: -116.5418,
    beds: 4, baths: 4, sqft: 2980, lotSqft: 13400, yearBuilt: 1956, value: 1760000, growthPct: 10.1,
    fireScore: 28, floodScore: 9, heatScore: 61, insuranceScore: 48, hoaScore: 0, permitScore: 16,
    aduPotential: 'strong', lotCoveragePct: 26, zoning: 'R-1-A', neighborhood: 'Movie Colony',
    topInsight: 'Movie Colony scarcity + large lot = highest modeled 5-year equity here.',
    nextBestPermit: 'Detached ADU + pool house bundle.', unpermittedAdditionFlag: false,
  },
  {
    id: 'ps-008', address: '145 W Crestview Dr', city: 'Palm Springs', zip: '92264', lat: 33.7951, lon: -116.5489,
    beds: 3, baths: 2, sqft: 1680, lotSqft: 7800, yearBuilt: 1979, value: 798000, growthPct: 5.4,
    fireScore: 30, floodScore: 18, heatScore: 69, insuranceScore: 46, hoaScore: 0, permitScore: 38,
    aduPotential: 'possible', lotCoveragePct: 36, zoning: 'R-1-B', neighborhood: 'Los Compadres',
    topInsight: 'Entry-tier value play — landscape + curb appeal is the cheapest lift.',
    nextBestPermit: 'Desert-scape + entry refresh before any structural work.', unpermittedAdditionFlag: true,
  },
];

export const MOCK_ASSETS: PropertyDNAAsset[] = SPECS.map(buildAsset);

/** Map default camera — Palm Springs core. */
export const MOCK_MAP_CENTER: [number, number] = [-116.5388, 33.8255];
export const MOCK_MAP_ZOOM = 12.4;

// ── Heat grid (decoupled from pins; powers the heat overlay) ───────────────────

function buildHeatGrid(count: number): HeatPoint[] {
  const out: HeatPoint[] = [];
  // Cluster around the asset centroid with a couple of hotspots.
  const hotspots: [number, number, number][] = [
    [33.8389, -116.5295, 1], // Movie Colony
    [33.8002, -116.5402, 0.7],
    [33.8467, -116.5371, 0.9], // Las Palmas
  ];
  for (let i = 0; i < count; i++) {
    const r1 = Math.sin(i * 7.13) * 0.5 + 0.5;
    const r2 = Math.cos(i * 3.71) * 0.5 + 0.5;
    const lat = 33.79 + r1 * 0.07;
    const lon = -116.56 + r2 * 0.06;
    // Intensity peaks near hotspots.
    let near = 0;
    for (const [hlat, hlon, w] of hotspots) {
      const d = Math.hypot(lat - hlat, lon - hlon);
      near = Math.max(near, w * Math.max(0, 1 - d / 0.04));
    }
    const jitter = (k: number) => Math.max(0, Math.min(1, near * 0.7 + (Math.sin(i * k) * 0.5 + 0.5) * 0.4));
    out.push({
      lat,
      lon,
      values: {
        'recent-sales': jitter(1.1),
        'price-per-sqft': jitter(2.3),
        'days-on-market': jitter(3.7),
        appreciation: jitter(4.1),
        'inventory-pressure': jitter(5.9),
        'risk-score': jitter(6.3),
        'permit-opportunity': jitter(7.7),
        'future-equity': jitter(8.1),
      },
    });
  }
  return out;
}

export const MOCK_HEAT_POINTS: HeatPoint[] = buildHeatGrid(260);

/** Single entry point the page calls — swap internals for live fetch later. */
export function getMockMapData(): { assets: PropertyDNAAsset[]; heatPoints: HeatPoint[] } {
  return { assets: MOCK_ASSETS, heatPoints: MOCK_HEAT_POINTS };
}
