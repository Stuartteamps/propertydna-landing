// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — Market Intelligence Pages
//
// Public, crawlable city market pages at /market/:slug. These are the
// "Bloomberg terminal for a ZIP" surface: median value, recent sales velocity,
// price-per-sqft, direction, days-on-market, inventory, luxury notes, and the
// best neighborhoods — each ending in a CTA to run a Property DNA report.
//
// The copy here is editorial framing of the market. Live figures (median value,
// DOM, inventory) are hydrated at runtime from the get-value-series /
// market-agent feeds by the MarketPage component; anything not yet resolved
// renders as "Data unavailable" rather than a made-up number.
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketNeighborhood {
  name: string;
  note: string;
  /** Optional internal link to a neighborhood page slug. */
  neighborhoodSlug?: string;
}

export interface MarketPageData {
  slug: string;
  city: string;
  state: string;
  county: string;
  /** Geo key used to hydrate live stats from get-value-series (city name). */
  geoQuery: string;
  metaTitle: string;
  metaDescription: string;
  heroHeadline: string;
  heroSub: string;
  /** One-paragraph market thesis. */
  overview: string;
  /** Editorial reads on the sub-markets. */
  luxuryNotes: string;
  bestNeighborhoods: MarketNeighborhood[];
  /** Static fallbacks shown only if the live feed has no value (clearly labeled est.). */
  marketDirectionNote: string;
  faqs: { q: string; a: string }[];
  /** Slugs of related research articles for internal linking. */
  relatedResearch: string[];
}

export const marketPages: MarketPageData[] = [
  {
    slug: 'palm-springs-ca',
    city: 'Palm Springs',
    state: 'CA',
    county: 'Riverside County',
    geoQuery: 'Palm Springs',
    metaTitle: 'Palm Springs, CA Real Estate Market — Home Values, Trends & Comps | Property DNA',
    metaDescription:
      'Palm Springs housing market intelligence: median home value, price per square foot, days on market, inventory, luxury trends, and the best neighborhoods — all confidence-scored by Property DNA.',
    heroHeadline: 'The Palm Springs market, read like an asset class.',
    heroSub:
      'Median value, absorption velocity, price-per-square-foot, and neighborhood-level trajectory for every corner of Palm Springs — grounded in Riverside County records and recorded sales.',
    overview:
      'Palm Springs holds the densest concentration of mid-century-modern housing stock in the United States, and that architectural pedigree drives value as powerfully as square footage. Wildfire severity along the foothills and neighborhood provenance (Old Las Palmas, Movie Colony, Vista Las Palmas, Twin Palms) create some of the widest intra-city price dispersion in the Coachella Valley.',
    luxuryNotes:
      'The top of the market is architect-driven: verified Lautner, Frey, Cody, Wexler, and Krisel homes command provenance premiums that no automated valuation model captures on its own. Property DNA tags these attributions with primary-source documentation.',
    bestNeighborhoods: [
      { name: 'Old Las Palmas', note: 'Estate-scale lots, celebrity provenance, the top pricing tier in the city.' },
      { name: 'Movie Colony', note: 'Walkable to downtown, strong mid-century inventory, high buyer demand.' },
      { name: 'Vista Las Palmas', note: 'Alexander-built modernism with mountain backdrops; premium per-sqft.' },
      { name: 'Twin Palms', note: 'Iconic Alexander tract homes; entry point into architectural pedigree.' },
      { name: 'Indian Canyons', note: 'Golf-adjacent, gated, favored by second-home buyers.' },
    ],
    marketDirectionNote:
      'Palm Springs is seasonally driven — velocity peaks Nov–Apr. Track the live figures above for current direction.',
    faqs: [
      { q: 'What is the median home value in Palm Springs?', a: 'The live median value updates from recorded sales in the panel above. Palm Springs spans entry condos to multi-million-dollar architectural estates, so the median is best read alongside the neighborhood breakdown.' },
      { q: 'Is the Palm Springs market appreciating or cooling?', a: 'Market direction is shown live above from recent absorption and price trend. Palm Springs is strongly seasonal, so 90-day velocity is the most reliable read.' },
      { q: 'Which Palm Springs neighborhoods hold value best?', a: 'Architecturally significant enclaves — Old Las Palmas, Vista Las Palmas, Movie Colony, Twin Palms — have historically shown the most resilient pricing thanks to provenance scarcity.' },
    ],
    relatedResearch: ['palm-springs-market-report', 'luxury-home-value-drivers', 'mountain-view-home-value'],
  },
  {
    slug: 'la-quinta-ca',
    city: 'La Quinta',
    state: 'CA',
    county: 'Riverside County',
    geoQuery: 'La Quinta',
    metaTitle: 'La Quinta, CA Real Estate Market — Home Values, Trends & Comps | Property DNA',
    metaDescription:
      'La Quinta housing market data: median value, price per square foot, days on market, inventory, PGA West and country-club trends, and the best neighborhoods — confidence-scored by Property DNA.',
    heroHeadline: 'La Quinta — every fairway and street, priced.',
    heroSub:
      'PGA West, The Quarry, Madison Club, and Tradition read very differently from the open market. Property DNA segments La Quinta by country club and corridor with recorded-sale comps.',
    overview:
      'La Quinta has the most active 90-day comparable turnover in the Coachella Valley, which makes absorption-rate velocity the sharpest signal for whether a listing is priced ahead of or behind the market. Country-club membership structure (PGA West Resort vs. Private) creates valuation deltas that headline AVMs routinely miss.',
    luxuryNotes:
      'The Madison Club and The Quarry anchor the ultra-luxury tier; PGA West Private and Tradition form the deep luxury market. HOA and membership costs materially move net value and are surfaced separately in every report.',
    bestNeighborhoods: [
      { name: 'Madison Club', note: 'Ultra-private, the top pricing tier in La Quinta.' },
      { name: 'The Quarry', note: 'Golf-driven exclusivity; scarce inventory, strong holds.' },
      { name: 'PGA West (Private)', note: 'Membership-gated pricing distinct from the Resort courses.' },
      { name: 'Tradition', note: 'Old-guard luxury against the Santa Rosa mountains.' },
      { name: 'La Quinta Cove', note: 'Entry point; high rental demand near the village.' },
    ],
    marketDirectionNote: 'La Quinta turns over fast — 90-day comp velocity is the most reliable direction signal.',
    faqs: [
      { q: 'How current are La Quinta comparable sales?', a: 'Comparables refresh on a roughly 24-hour cadence and always reflect the most recent closed sales in the market window.' },
      { q: 'Does Property DNA separate PGA West Resort from Private?', a: 'Yes. Membership structure is a first-class valuation input, because Resort and Private homes trade on different curves.' },
    ],
    relatedResearch: ['golf-course-home-premium', 'hoa-impact-on-home-values', 'short-term-rental-risk'],
  },
  {
    slug: 'rancho-mirage-ca',
    city: 'Rancho Mirage',
    state: 'CA',
    county: 'Riverside County',
    geoQuery: 'Rancho Mirage',
    metaTitle: 'Rancho Mirage, CA Real Estate Market — Home Values, Trends & Comps | Property DNA',
    metaDescription:
      'Rancho Mirage market intelligence: median home value, price per square foot, days on market, inventory, country-club luxury trends, and the best neighborhoods — scored by Property DNA.',
    heroHeadline: 'Rancho Mirage — the valley’s quiet luxury core.',
    heroSub:
      'Thunderbird, Tamarisk, Mission Hills, and the gated boulevards along Frank Sinatra Drive. Property DNA maps Rancho Mirage’s country-club dispersion against recorded sales.',
    overview:
      'Rancho Mirage carries a disproportionate share of the valley’s legacy estate inventory. Its gated country clubs — Thunderbird, Tamarisk, Mission Hills — form distinct micro-markets where provenance and lot position drive value more than raw square footage.',
    luxuryNotes:
      'Thunderbird Heights and Tamarisk Country Club anchor the estate tier, with a long lineage of notable ownership that provenance-aware buyers pay up for. Property DNA flags these histories where documented.',
    bestNeighborhoods: [
      { name: 'Thunderbird Heights', note: 'Hillside estates with valley views; top of the market.' },
      { name: 'Tamarisk Country Club', note: 'Legacy estate lots, deep provenance.' },
      { name: 'Mission Hills', note: 'Large gated golf community; broad price band.' },
      { name: 'The Springs', note: 'Established country-club living with strong amenities.' },
    ],
    marketDirectionNote: 'Estate inventory is thin — single high-value trades can move the median sharply.',
    faqs: [
      { q: 'Why does the Rancho Mirage median jump around?', a: 'Estate inventory is thin, so a handful of high-value closings can swing the median. Read it alongside price-per-sqft and the neighborhood breakdown.' },
      { q: 'Does Property DNA cover the gated country clubs?', a: 'Yes — Thunderbird, Tamarisk, Mission Hills and The Springs are each indexed at the parcel level.' },
    ],
    relatedResearch: ['luxury-home-value-drivers', 'golf-course-home-premium', 'hoa-impact-on-home-values'],
  },
  {
    slug: 'palm-desert-ca',
    city: 'Palm Desert',
    state: 'CA',
    county: 'Riverside County',
    geoQuery: 'Palm Desert',
    metaTitle: 'Palm Desert, CA Real Estate Market — Home Values, Trends & Comps | Property DNA',
    metaDescription:
      'Palm Desert housing market data: median value, price per square foot, days on market, inventory, Bighorn and country-club luxury trends, and the best neighborhoods — scored by Property DNA.',
    heroHeadline: 'Palm Desert — the widest luxury band in the valley.',
    heroSub:
      'From El Paseo condos to Bighorn estates, Palm Desert has the largest HOA-driven price dispersion in the Coachella Valley. Property DNA surfaces HOA cost trends beside the valuation.',
    overview:
      'Palm Desert’s gated golf-club inventory produces the valley’s widest intra-city price range. Bighorn, The Reserve, and Indian Ridge trade at a multiple of the open market, and golf-course water costs plus HOA structure are decisive net-value inputs.',
    luxuryNotes:
      'Bighorn and The Reserve anchor the ultra-luxury tier; Indian Ridge and Ironwood form the deep-luxury country-club market. Fairway and green frontage are tagged separately for water-cost and HOA-pressure risk.',
    bestNeighborhoods: [
      { name: 'Bighorn', note: 'Ultra-luxury mountainside golf; top pricing tier.' },
      { name: 'The Reserve', note: 'Private, design-forward estates; scarce inventory.' },
      { name: 'Indian Ridge', note: 'Established gated golf; broad, liquid price band.' },
      { name: 'El Paseo Corridor', note: 'Walkable luxury condos and shops; strong rental demand.' },
    ],
    marketDirectionNote: 'HOA and water costs move net value materially — read them alongside the headline price.',
    faqs: [
      { q: 'Does Property DNA cover Bighorn and gated communities?', a: 'Yes. Every gated community in Palm Desert — Bighorn, The Reserve, Indian Ridge, Marrakesh, Ironwood — is indexed at the parcel level.' },
      { q: 'Are golf-course and HOA costs reflected?', a: 'Yes. Fairway frontage is flagged for water-cost risk, and HOA pressure is surfaced separately from the headline valuation.' },
    ],
    relatedResearch: ['golf-course-home-premium', 'hoa-impact-on-home-values', 'pool-roi-analysis'],
  },
  {
    slug: 'indian-wells-ca',
    city: 'Indian Wells',
    state: 'CA',
    county: 'Riverside County',
    geoQuery: 'Indian Wells',
    metaTitle: 'Indian Wells, CA Real Estate Market — Home Values, Trends & Comps | Property DNA',
    metaDescription:
      'Indian Wells market intelligence: median home value, price per square foot, days on market, inventory, resort-luxury trends, and the best communities — confidence-scored by Property DNA.',
    heroHeadline: 'Indian Wells — the valley’s highest median, by design.',
    heroSub:
      'A small, affluent, tightly-zoned city where nearly every parcel sits inside a gated golf or resort community. Property DNA reads Indian Wells at the community level.',
    overview:
      'Indian Wells carries one of the highest median home values in the Coachella Valley, a function of tight zoning, resort adjacency (the BNP Paribas tennis complex, luxury hotels), and a housing stock dominated by gated golf communities. Low turnover makes each closed comp unusually informative.',
    luxuryNotes:
      'The Vintage Club and Toscana anchor the ultra-luxury tier. Resort-branded residences carry amenity premiums that Property DNA separates from underlying land and structure value.',
    bestNeighborhoods: [
      { name: 'The Vintage Club', note: 'Ultra-exclusive dual-course club; top of the market.' },
      { name: 'Toscana Country Club', note: 'Newer estate construction; strong luxury demand.' },
      { name: 'Indian Wells Country Club', note: 'Legacy club with a broad estate band.' },
      { name: 'Desert Horizons', note: 'Established gated golf; relative value entry.' },
    ],
    marketDirectionNote: 'Turnover is low — treat every closed comp as a high-signal data point.',
    faqs: [
      { q: 'Why is Indian Wells so expensive?', a: 'Tight zoning, resort adjacency, and a housing stock dominated by gated golf communities keep the median among the valley’s highest.' },
      { q: 'How reliable are comps with low turnover?', a: 'Each closed sale carries more weight. Property DNA widens the comp window and flags recency so you can judge confidence.' },
    ],
    relatedResearch: ['luxury-home-value-drivers', 'golf-course-home-premium', 'palm-springs-market-report'],
  },
  {
    slug: 'desert-hot-springs-ca',
    city: 'Desert Hot Springs',
    state: 'CA',
    county: 'Riverside County',
    geoQuery: 'Desert Hot Springs',
    metaTitle: 'Desert Hot Springs, CA Real Estate Market — Home Values, Trends & Comps | Property DNA',
    metaDescription:
      'Desert Hot Springs market data: median home value, price per square foot, days on market, inventory, value trends, and the best neighborhoods — confidence-scored by Property DNA.',
    heroHeadline: 'Desert Hot Springs — the valley’s value frontier.',
    heroSub:
      'The most affordable entry into the Coachella Valley, with hot-spring geology, boutique-spa zoning, and the highest rental-yield potential in the region. Property DNA scores it honestly.',
    overview:
      'Desert Hot Springs is the Coachella Valley’s value and yield frontier. Its mineral-hot-spring geology supports a boutique-spa economy, and comparatively low entry prices produce some of the strongest rental-yield math in the region — offset by higher relative market volatility.',
    luxuryNotes:
      'The luxury tier is niche and spa-driven (Mission Lakes, boutique hot-spring estates). Most value here is in yield and appreciation runway rather than provenance premium.',
    bestNeighborhoods: [
      { name: 'Mission Lakes Country Club', note: 'Gated golf with the city’s most established values.' },
      { name: 'Skyborne', note: 'Newer master-planned community; family demand.' },
      { name: 'Hot Springs / Spa District', note: 'Boutique-spa and short-term-rental potential.' },
    ],
    marketDirectionNote: 'Higher volatility than the down-valley cities — yield and appreciation runway lead the thesis.',
    faqs: [
      { q: 'Is Desert Hot Springs a good rental market?', a: 'It has among the strongest rental-yield math in the valley thanks to low entry prices, though with higher relative volatility. Property DNA scores rental potential explicitly.' },
      { q: 'What drives value in Desert Hot Springs?', a: 'Entry price, rental yield, spa-district zoning, and appreciation runway — more than the provenance premiums seen down-valley.' },
    ],
    relatedResearch: ['short-term-rental-risk', 'pool-roi-analysis', 'palm-springs-market-report'],
  },
];

export function getMarketPage(slug: string): MarketPageData | undefined {
  return marketPages.find((m) => m.slug === slug.toLowerCase());
}

export const marketSlugs = marketPages.map((m) => m.slug);
