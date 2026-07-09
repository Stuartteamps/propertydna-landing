// ─────────────────────────────────────────────────────────────────────────────
// PropertyDNA — Research library
//
// Crawlable, citation-worthy research articles at /research/:slug. Each is
// editorial analysis (not a sales page) that internally links to the relevant
// market pages and encourages running a Property DNA report — the connective
// tissue that makes the whole site read as an intelligence layer.
// ─────────────────────────────────────────────────────────────────────────────

export interface ResearchSection {
  type: 'p' | 'h2' | 'h3' | 'ul' | 'callout';
  text?: string;
  items?: string[];
}

export interface ResearchArticle {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: string;
  date: string;
  readTime: number;
  excerpt: string;
  /** Market page slugs this article links to. */
  relatedMarkets: string[];
  /** Other research slugs to cross-link. */
  relatedResearch: string[];
  sections: ResearchSection[];
  faqs: { q: string; a: string }[];
}

export const researchArticles: ResearchArticle[] = [
  {
    slug: 'palm-springs-market-report',
    title: 'Palm Springs Market Report: What Actually Moves Home Values',
    metaTitle: 'Palm Springs Market Report — Home Value Drivers | Property DNA Research',
    metaDescription:
      'A data-driven Palm Springs market report: how architecture, wildfire zones, and neighborhood provenance move home values far more than square footage alone.',
    category: 'Market Report',
    date: '2026-01-15',
    readTime: 8,
    excerpt:
      'In Palm Springs, provenance and wildfire severity move value as much as square footage. Here is how to read the market like an analyst, not a tourist.',
    relatedMarkets: ['palm-springs-ca', 'rancho-mirage-ca', 'palm-desert-ca'],
    relatedResearch: ['luxury-home-value-drivers', 'mountain-view-home-value'],
    sections: [
      { type: 'p', text: 'Palm Springs is not a single market — it is a dozen micro-markets stacked inside one ZIP-code cluster. A 1,500-square-foot Alexander in Vista Las Palmas and a 1,500-square-foot ranch two miles east can trade at wildly different prices, and the difference is almost never captured by a headline automated valuation.' },
      { type: 'h2', text: 'Provenance is a price input, not a footnote' },
      { type: 'p', text: 'Verified mid-century attribution — Lautner, Frey, Cody, Wexler, Krisel — creates scarcity that behaves like a separate asset class. A documented architect provenance can add a premium that no comps-only model reproduces, because the model treats the home as generic square footage. Property DNA tags provenance with primary-source documentation so it shows up in the value, not just the marketing.' },
      { type: 'h2', text: 'Wildfire severity is now a first-class discount' },
      { type: 'p', text: 'Foothill neighborhoods carry CalFire Very High Fire Hazard Severity Zone designations that increasingly translate into insurance friction and buyer hesitation. Valley-floor parcels usually score none. That single overlay can be worth tens of thousands of dollars of effective value and is one of the most under-priced risks in the market.' },
      { type: 'callout', text: 'Read the live Palm Springs median value, days on market, and neighborhood breakdown on the market page, then run a Property DNA report on any specific address to see how provenance and wildfire severity change its number.' },
      { type: 'h2', text: 'How to read a Palm Springs comp set' },
      { type: 'ul', items: [
        'Filter comps to the same named neighborhood before trusting them.',
        'Discount foothill listings for wildfire severity and insurance cost.',
        'Add a provenance premium only where attribution is documented, never rumored.',
        'Weight the most recent 90 days — Palm Springs is strongly seasonal.',
      ] },
    ],
    faqs: [
      { q: 'What is the biggest driver of Palm Springs home values?', a: 'After location, verified architectural provenance and wildfire severity zone are the two inputs that most often explain why two similar-sized homes trade at very different prices.' },
      { q: 'Are Palm Springs home values seasonal?', a: 'Yes. Velocity peaks November through April, so the most recent 90 days of comps are the most reliable signal for current pricing.' },
    ],
  },
  {
    slug: 'golf-course-home-premium',
    title: 'The Golf-Course Home Premium (and Its Hidden Costs)',
    metaTitle: 'Golf-Course Home Premium & Hidden Costs | Property DNA Research',
    metaDescription:
      'Golf-course frontage commands a premium — but water costs, HOA structure, and membership rules can quietly erase it. How to value a golf home correctly.',
    category: 'Valuation',
    date: '2026-01-22',
    readTime: 7,
    excerpt:
      'Fairway frontage sells. But water costs, HOA dues, and membership structure can quietly erase the premium. Here is how to value a golf home net of its liabilities.',
    relatedMarkets: ['la-quinta-ca', 'palm-desert-ca', 'indian-wells-ca', 'rancho-mirage-ca'],
    relatedResearch: ['hoa-impact-on-home-values', 'luxury-home-value-drivers'],
    sections: [
      { type: 'p', text: 'A home on the fairway almost always lists above an interior lot of the same size. The premium is real — views, prestige, and scarcity all price in. The mistake buyers make is treating that premium as free.' },
      { type: 'h2', text: 'Membership structure changes the number' },
      { type: 'p', text: 'In communities like PGA West, a Resort home and a Private home can look identical on paper and trade on entirely different curves because of membership rights. A valuation that ignores membership structure will misprice both.' },
      { type: 'h2', text: 'Water and HOA are the silent adjustments' },
      { type: 'p', text: 'Golf-course water costs and HOA dues are recurring liabilities that compress net value. In the Coachella Valley’s gated golf inventory — the widest HOA-driven price dispersion in the region — these can move effective value more than a bedroom count.' },
      { type: 'callout', text: 'Property DNA flags fairway frontage for water-cost risk and surfaces HOA pressure separately from the headline valuation, so you see the premium and the liability side by side.' },
    ],
    faqs: [
      { q: 'Is a golf-course home worth the premium?', a: 'It can be, but only after subtracting HOA dues, membership costs, and golf-course water exposure. Value the home net of those recurring liabilities.' },
      { q: 'Does Property DNA account for HOA and golf costs?', a: 'Yes. Fairway frontage is flagged for water-cost risk and HOA pressure is shown separately from the base valuation.' },
    ],
  },
  {
    slug: 'mountain-view-home-value',
    title: 'What a Mountain View Is Actually Worth',
    metaTitle: 'Mountain View Home Value — What a View Is Worth | Property DNA Research',
    metaDescription:
      'Views add value, but not uniformly. How orientation, permanence, and privacy determine what a mountain view is actually worth in a home valuation.',
    category: 'Valuation',
    date: '2026-01-29',
    readTime: 6,
    excerpt:
      'A protected, west-facing mountain view is worth more than an obstructable one. How to price a view like an appraiser instead of a poet.',
    relatedMarkets: ['palm-springs-ca', 'rancho-mirage-ca', 'indian-wells-ca'],
    relatedResearch: ['palm-springs-market-report', 'luxury-home-value-drivers'],
    sections: [
      { type: 'p', text: 'Every listing photo faces the mountains. That does not make every view equally valuable. Appraisers and disciplined buyers price views on three axes: orientation, permanence, and privacy.' },
      { type: 'h2', text: 'Orientation' },
      { type: 'p', text: 'West-facing San Jacinto views at sunset command more than a north-facing sliver. Orientation determines how often the view is actually enjoyed and how it photographs.' },
      { type: 'h2', text: 'Permanence' },
      { type: 'p', text: 'A view over protected land or a golf course is worth more than one that a future build next door can erase. Permanence is the difference between a durable premium and a temporary one.' },
      { type: 'callout', text: 'Run a Property DNA report to see how lot position and orientation factor into a specific address, then compare it against the neighborhood on the market page.' },
    ],
    faqs: [
      { q: 'How much does a mountain view add to a home’s value?', a: 'It varies with orientation, permanence, and privacy. A protected, west-facing view adds far more than an obstructable one, which is why views should be priced on those axes rather than as a flat premium.' },
    ],
  },
  {
    slug: 'pool-roi-analysis',
    title: 'Pool ROI: When a Pool Adds Value and When It Doesn’t',
    metaTitle: 'Pool ROI Analysis — Does a Pool Add Home Value? | Property DNA Research',
    metaDescription:
      'A desert pool can add value or become a liability. How climate, lot size, maintenance cost, and buyer pool determine the real ROI of a swimming pool.',
    category: 'Renovation ROI',
    date: '2026-02-05',
    readTime: 6,
    excerpt:
      'In the desert, a pool is closer to expected than optional — but ROI still depends on lot size, condition, and the buyer pool. Here is the honest math.',
    relatedMarkets: ['palm-desert-ca', 'la-quinta-ca', 'desert-hot-springs-ca'],
    relatedResearch: ['hoa-impact-on-home-values', 'short-term-rental-risk'],
    sections: [
      { type: 'p', text: 'In much of the country a pool is a coin flip on resale. In the Coachella Valley it is closer to table stakes — but that does not mean every pool pays for itself.' },
      { type: 'h2', text: 'The desert baseline' },
      { type: 'p', text: 'For mid-market and luxury desert homes, buyers largely expect a pool. Its absence can be a bigger discount than its presence is a premium — the asymmetry matters.' },
      { type: 'h2', text: 'When a pool is a liability' },
      { type: 'ul', items: [
        'On a small lot where the pool consumes the entire yard.',
        'When the pool is dated or in poor condition and signals deferred maintenance.',
        'For a family-oriented buyer pool worried about safety and upkeep.',
        'Where short-term-rental restrictions cap the income that justified it.',
      ] },
      { type: 'callout', text: 'Property DNA’s Renovation ROI score estimates value-add headroom from building age and condition signals — a starting point before you spend on a pool remodel.' },
    ],
    faqs: [
      { q: 'Does a pool add value to a desert home?', a: 'Usually yes in the Coachella Valley, where buyers expect one — but ROI depends on lot size, condition, and the target buyer. A dated pool on a small lot can be a net liability.' },
    ],
  },
  {
    slug: 'short-term-rental-risk',
    title: 'Short-Term Rental Risk: The Regulation That Can Halve Your Yield',
    metaTitle: 'Short-Term Rental Risk & Home Value | Property DNA Research',
    metaDescription:
      'STR permits, caps, and moratoriums can dramatically change a property’s income and value. How to assess short-term-rental risk before you buy.',
    category: 'Risk',
    date: '2026-02-12',
    readTime: 7,
    excerpt:
      'A vacation-rental income model is only as durable as the local ordinance behind it. How permit caps and moratoriums quietly reprice desert homes.',
    relatedMarkets: ['palm-springs-ca', 'la-quinta-ca', 'desert-hot-springs-ca'],
    relatedResearch: ['pool-roi-analysis', 'hoa-impact-on-home-values'],
    sections: [
      { type: 'p', text: 'Buyers routinely underwrite desert homes on short-term-rental income. That income is a policy variable, not a physical feature — and policy can change faster than a mortgage amortizes.' },
      { type: 'h2', text: 'Permit caps and moratoriums' },
      { type: 'p', text: 'Cities across the Coachella Valley have layered on STR permit caps, junior-permit rules, and outright moratoriums in some neighborhoods. A home purchased at a price that assumed nightly-rental income can reprice sharply if the permit does not transfer or the cap tightens.' },
      { type: 'h2', text: 'How to stress-test the income' },
      { type: 'ul', items: [
        'Confirm whether an existing STR permit transfers on sale.',
        'Check for neighborhood-level caps or moratoriums, not just city-wide rules.',
        'Underwrite a scenario where STR income goes to zero.',
        'Separate durable long-term-rental yield from fragile nightly yield.',
      ] },
      { type: 'callout', text: 'Property DNA’s Rental Potential and Hidden Risk scores help separate durable yield from regulation-dependent income before you commit.' },
    ],
    faqs: [
      { q: 'How does short-term-rental regulation affect home value?', a: 'When a purchase price assumes nightly-rental income, tighter permit caps or a moratorium can reprice the home significantly. Always underwrite a scenario where STR income drops to zero.' },
    ],
  },
  {
    slug: 'hoa-impact-on-home-values',
    title: 'How HOA Dues Quietly Reprice a Home',
    metaTitle: 'HOA Impact on Home Values | Property DNA Research',
    metaDescription:
      'HOA dues, special assessments, and reserve health materially change what a home is worth. How to value a property net of its HOA liabilities.',
    category: 'Valuation',
    date: '2026-02-19',
    readTime: 6,
    excerpt:
      'Two identical homes with different HOA dues are not worth the same. How assessments and reserve health move value more than buyers expect.',
    relatedMarkets: ['palm-desert-ca', 'la-quinta-ca', 'indian-wells-ca', 'rancho-mirage-ca'],
    relatedResearch: ['golf-course-home-premium', 'short-term-rental-risk'],
    sections: [
      { type: 'p', text: 'HOA dues are a recurring liability, and recurring liabilities capitalize into price. A buyer who ignores the dues line is overpaying, even when the sticker price looks like a deal.' },
      { type: 'h2', text: 'The capitalization math' },
      { type: 'p', text: 'A few hundred dollars a month in extra dues is, in present-value terms, tens of thousands of dollars of purchasing power redirected away from the home. In the valley’s gated golf inventory — the widest HOA-driven dispersion in the region — this is one of the largest hidden adjustments in the whole market.' },
      { type: 'h2', text: 'Reserves and special assessments' },
      { type: 'p', text: 'A low reserve balance is a future special assessment waiting to happen. Reserve health belongs in the valuation, not the fine print.' },
      { type: 'callout', text: 'Property DNA surfaces HOA pressure separately from the headline valuation so you can value a home net of its dues and assessment risk.' },
    ],
    faqs: [
      { q: 'Do HOA dues affect a home’s value?', a: 'Yes. Higher recurring dues capitalize into a lower price for an otherwise identical home, and weak reserves add special-assessment risk that belongs in the valuation.' },
    ],
  },
  {
    slug: 'luxury-home-value-drivers',
    title: 'Luxury Home Value Drivers: What the Ultra-High End Actually Prices',
    metaTitle: 'Luxury Home Value Drivers | Property DNA Research',
    metaDescription:
      'At the top of the market, provenance, privacy, and scarcity price above square footage. The value drivers that separate luxury comps from ordinary ones.',
    category: 'Luxury',
    date: '2026-02-26',
    readTime: 8,
    excerpt:
      'At the top of the market, square footage is a rounding error. Provenance, privacy, scarcity, and design pedigree are what actually price. Here is the framework.',
    relatedMarkets: ['indian-wells-ca', 'rancho-mirage-ca', 'palm-desert-ca', 'la-quinta-ca'],
    relatedResearch: ['golf-course-home-premium', 'mountain-view-home-value', 'palm-springs-market-report'],
    sections: [
      { type: 'p', text: 'Standard automated valuation models are trained on the middle of the market, where price scales cleanly with size and beds. At the ultra-high end, that relationship breaks down — which is why headline AVMs are least reliable exactly where the dollars are largest.' },
      { type: 'h2', text: 'The four drivers that actually price' },
      { type: 'ul', items: [
        'Provenance — verified architect or notable-owner history creates a scarcity premium.',
        'Privacy — gated, hillside, or single-loaded-street positions command a durable premium.',
        'Scarcity — clubs like The Vintage Club, Madison Club, and Bighorn trade on turnover so thin every comp is a signal.',
        'Design pedigree — original, coherent architecture outperforms renovated pastiche.',
      ] },
      { type: 'h2', text: 'Why comps mislead at the top' },
      { type: 'p', text: 'With few closings, a single unusual sale can distort a luxury comp set. The discipline is to weight scarcity and provenance explicitly rather than averaging dollars-per-square-foot across homes that are not truly comparable.' },
      { type: 'callout', text: 'Property DNA’s Luxury Score places a property on the luxury spectrum from price-per-sqft and prestige signals — and flags documented provenance where it exists.' },
    ],
    faqs: [
      { q: 'Why are automated valuations less accurate for luxury homes?', a: 'AVMs are trained on the middle of the market where price scales with size. At the top, provenance, privacy, and scarcity dominate, so a size-based model systematically misprices luxury homes.' },
      { q: 'What is the biggest luxury value driver?', a: 'Provenance and scarcity. Verified architectural or ownership history, plus thin turnover in exclusive communities, price above raw square footage.' },
    ],
  },
];

export function getResearchArticle(slug: string): ResearchArticle | undefined {
  return researchArticles.find((a) => a.slug === slug.toLowerCase());
}

export const researchSlugs = researchArticles.map((a) => a.slug);
