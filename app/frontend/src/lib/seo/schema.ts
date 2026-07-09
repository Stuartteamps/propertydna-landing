// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — Schema.org builders
//
// Produces the JSON-LD graphs that let Google rich results AND AI assistants
// (ChatGPT, Perplexity, Gemini, AI Overviews) understand and cite a page:
// RealEstateListing + Residence + PostalAddress + GeoCoordinates, FAQPage,
// BreadcrumbList, Organization, and Article. Everything is pruned of empty
// fields by <JsonLd/> so we never emit fabricated data.
// ─────────────────────────────────────────────────────────────────────────────
import type { PublicProperty } from '@/lib/property-dna/publicProperty';
import { propertyUrl } from '@/lib/property-dna/publicProperty';
import { SITE_ORIGIN, SITE_NAME } from './head';

export const ORGANIZATION_SCHEMA = {
  '@type': 'Organization',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: SITE_NAME,
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/icon-512.png`,
  description:
    'PropertyDNA is the residential real-estate intelligence layer — institutional-grade home values, comparable sales, risk, and buyer/seller insight for any property.',
  sameAs: ['https://apps.apple.com/app/id6768064079'],
};

/** RealEstateListing + Residence + provider, built from a PublicProperty. */
export function propertySchema(p: PublicProperty) {
  const url = propertyUrl(p.slug);
  const name = `${p.address}${p.city ? `, ${p.city}` : ''}${p.state ? `, ${p.state}` : ''}`;

  const residence: Record<string, unknown> = {
    '@type': ['SingleFamilyResidence', 'Residence'],
    name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: p.address,
      addressLocality: p.city ?? undefined,
      addressRegion: p.state ?? undefined,
      postalCode: p.zip ?? undefined,
      addressCountry: 'US',
    },
    geo:
      p.lat != null && p.lon != null
        ? { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lon }
        : undefined,
    floorSize: p.sqft != null ? { '@type': 'QuantitativeValue', value: p.sqft, unitCode: 'FTK' } : undefined,
    numberOfRooms: p.beds ?? undefined,
    numberOfBathroomsTotal: p.baths ?? undefined,
    yearBuilt: p.yearBuilt ?? undefined,
  };

  const listing: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': `${url}#listing`,
    url,
    name: `${name} — Home Value & Property DNA Report`,
    description: `Estimated value, comparable sales, market trends, risk factors and Property DNA Score for ${name}.`,
    dateModified: p.lastUpdated ?? undefined,
    mainEntity: residence,
    about: residence,
    provider: ORGANIZATION_SCHEMA,
    offers:
      p.estimatedValue != null
        ? {
            '@type': 'Offer',
            price: p.estimatedValue,
            priceCurrency: 'USD',
            priceSpecification:
              p.lowRange != null && p.highRange != null
                ? {
                    '@type': 'PriceSpecification',
                    minPrice: p.lowRange,
                    maxPrice: p.highRange,
                    priceCurrency: 'USD',
                  }
                : undefined,
            availability: 'https://schema.org/InStock',
          }
        : undefined,
  };

  return listing;
}

export function faqSchema(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `${SITE_ORIGIN}${t.path}`,
    })),
  };
}

export function articleSchema(a: {
  title: string;
  description: string;
  slug: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    url: `${SITE_ORIGIN}/research/${a.slug}`,
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    image: a.image ? `${SITE_ORIGIN}${a.image}` : `${SITE_ORIGIN}/og-image.png`,
    author: ORGANIZATION_SCHEMA,
    publisher: ORGANIZATION_SCHEMA,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_ORIGIN}/research/${a.slug}` },
  };
}

/** Default FAQ set for a property page, filled from the property where possible. */
export function propertyFaqItems(p: PublicProperty): { q: string; a: string }[] {
  const name = `${p.address}${p.city ? `, ${p.city}` : ''}`;
  const value =
    p.estimatedValue != null
      ? `PropertyDNA estimates ${name} is worth approximately $${p.estimatedValue.toLocaleString()}${
          p.lowRange != null && p.highRange != null
            ? ` (range $${p.lowRange.toLocaleString()}–$${p.highRange.toLocaleString()})`
            : ''
        }${p.confidenceScore != null ? `, with a ${p.confidenceScore}/100 confidence score` : ''}.`
      : `A confident automated value is not yet available for ${name}. Run a full Property DNA report for the latest estimate.`;

  const comps =
    p.valuation.comparableSalesUsed.length > 0
      ? `The estimate uses ${p.valuation.comparableSalesUsed.length} nearby comparable sale${
          p.valuation.comparableSalesUsed.length === 1 ? '' : 's'
        }, weighted by distance, size, and recency.`
      : 'Comparable sales were limited in the current market window, which is disclosed in the report.';

  const accuracy =
    p.confidenceScore != null
      ? `This estimate carries a ${p.confidenceScore}/100 confidence score based on data completeness and comparable support. It is an analytical estimate, not a formal appraisal.`
      : 'PropertyDNA estimates are analytical, confidence-scored, and transparent about their data limitations — they are not formal appraisals.';

  const drivers = p.valuation.keyDrivers.length
    ? `The strongest value drivers here are ${p.valuation.keyDrivers.slice(0, 3).join(', ')}.`
    : "Value is driven by location, living area, condition, comparable sales, and the neighborhood's market trend.";

  return [
    { q: `What is ${name} worth?`, a: value },
    { q: 'What comps were used?', a: comps },
    { q: 'How accurate is the Property DNA estimate?', a: accuracy },
    { q: "What affects this property's value?", a: drivers },
  ];
}
