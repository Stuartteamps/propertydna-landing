// Programmatic SEO landing pages — one per indexed market.
// These hydrate /coverage/:slug routes with city-specific copy that ranks
// for long-tail searches like "free property report Palm Springs" or
// "Greenwich CT real estate data tool". Every page links back to the
// App Store + /analyze so they convert as well as they rank.

export interface CityLandingPage {
  slug: string;
  city: string;
  state: string;
  county: string;
  metaTitle: string;
  metaDescription: string;
  heroHeadline: string;
  heroSub: string;
  parcelCountLabel: string;
  notable: string;        // Hook — what makes this market different
  riskCallouts: string[]; // Local risk factors PropertyDNA flags
  faqSlots: { q: string; a: string }[];
}

export const cityLandingPages: CityLandingPage[] = [
  {
    slug: 'palm-springs-ca',
    city: 'Palm Springs',
    state: 'CA',
    county: 'Riverside County',
    metaTitle: 'Free Palm Springs Property Reports | PropertyDNA',
    metaDescription: 'Pull a free property intelligence report on any Palm Springs home — valuation, permit history, wildfire zone, comps, 5-year trajectory. All 29,000+ Palm Springs parcels indexed.',
    heroHeadline: 'Every Palm Springs property — institutionally analyzed, free.',
    heroSub: 'PropertyDNA indexes every parcel in the city of Palm Springs from the Riverside County Assessor record. Valuation, comparable sales, permit history, CalFire wildfire severity, and a confidence-scored verdict — for free on iOS or the web.',
    parcelCountLabel: '29,000+ Palm Springs parcels indexed',
    notable: 'Palm Springs is the densest mid-century-modern stock in the United States — pedigree provenance and wildfire severity drive value as much as square footage. Both are explicit in every PropertyDNA report.',
    riskCallouts: [
      'CalFire wildfire severity zone (Very High for foothill neighborhoods)',
      'Mid-century architect attribution (Lautner, Frey, Wexler, Cody — provenance verified)',
      'Riverside County permit history with assessor cross-check',
      'Comparable trajectory by named neighborhood (Old Las Palmas, Movie Colony, Twin Palms, Vista Las Palmas)',
    ],
    faqSlots: [
      { q: 'Is the Palm Springs property report really free?', a: 'Yes. The PropertyDNA iOS app is 100% free for any Palm Springs property in our index. No subscription. No upsells. The web report is also free for one address; $4.99/report for additional pulls.' },
      { q: 'Does PropertyDNA flag mid-century pedigree?', a: 'Yes. Verified architect attributions (John Lautner, Albert Frey, William F. Cody, Donald Wexler, Hugh Kaptur, William Krisel) are tagged with primary-source documentation in the report.' },
      { q: 'Is wildfire risk specific to my Palm Springs address?', a: 'Yes. CalFire FHSZ maps are joined at the parcel level. Foothill addresses in Las Palmas Heights and Araby Cove typically score Moderate-to-Very-High; valley-floor parcels usually score none.' },
    ],
  },
  {
    slug: 'palm-desert-ca',
    city: 'Palm Desert',
    state: 'CA',
    county: 'Riverside County',
    metaTitle: 'Free Palm Desert Property Reports | PropertyDNA',
    metaDescription: 'Every Palm Desert parcel — valuation, risk, permit history, comps. Free iOS app + free web report.',
    heroHeadline: 'Palm Desert intelligence, on every parcel.',
    heroSub: 'Indian Ridge, Bighorn, The Reserve, El Paseo — every named country club and corridor in Palm Desert is indexed at the parcel level with permit history, valuation, and comparable trajectory.',
    parcelCountLabel: '32,000+ Palm Desert parcels indexed',
    notable: 'Palm Desert\'s gated golf-club inventory has the largest HOA-driven price dispersion in the Coachella Valley — PropertyDNA surfaces HOA cost trends alongside the valuation.',
    riskCallouts: [
      'Country club valuation deltas (Bighorn, The Reserve, Indian Ridge)',
      'Golf-course-exposure water-cost flag',
      'CalFire wildfire severity (varies by foothill exposure)',
      'County permit history including ADU additions',
    ],
    faqSlots: [
      { q: 'Does PropertyDNA cover gated communities like Bighorn?', a: 'Yes. Every gated community in Palm Desert is indexed at the parcel level. Bighorn, The Reserve, Indian Ridge, Marrakesh, Ironwood — all covered.' },
      { q: 'Does the report flag golf-course exposure?', a: 'Yes. Properties with direct fairway or green frontage are tagged for water-cost risk and HOA pressure separately from the headline valuation.' },
    ],
  },
  {
    slug: 'la-quinta-ca',
    city: 'La Quinta',
    state: 'CA',
    county: 'Riverside County',
    metaTitle: 'Free La Quinta Property Reports | PropertyDNA',
    metaDescription: 'Free property intelligence on any La Quinta home — PGA West, The Quarry, Tradition. Every parcel indexed.',
    heroHeadline: 'La Quinta — every fairway, every street, indexed.',
    heroSub: 'PGA West, The Quarry, Madison Club, Tradition. PropertyDNA indexes every La Quinta parcel with valuation, permit history, and a five-year trajectory grounded in named comparable sales.',
    parcelCountLabel: '24,000+ La Quinta parcels indexed',
    notable: 'La Quinta has the most active 90-day comp turnover in the Valley — PropertyDNA reports flag absorption-rate velocity so buyers can see if a listing is priced ahead of or behind the market.',
    riskCallouts: [
      'Active 90-day comp velocity tracking',
      'Country club valuation segmentation (PGA West Resort vs PGA West Private)',
      'Permit history with renovation flag',
      'CalFire FHSZ designation',
    ],
    faqSlots: [
      { q: 'How current is the comparable sales data?', a: 'Comparables refresh on a 24-hour cadence from RentCast MLS. Reports always show the most recent 90 days with absorption-rate velocity.' },
    ],
  },
  {
    slug: 'indio-ca',
    city: 'Indio',
    state: 'CA',
    county: 'Riverside County',
    metaTitle: 'Free Indio Property Reports | PropertyDNA',
    metaDescription: 'Every Indio parcel indexed. Free valuation, risk, comps for any address.',
    heroHeadline: 'Indio — fastest-growing Coachella Valley market.',
    heroSub: 'Indio has the highest 24-month price-growth percentage in the Coachella Valley. PropertyDNA segments new construction vs resale inventory and flags hot pockets at the neighborhood level.',
    parcelCountLabel: '40,000+ Indio parcels indexed',
    notable: 'Indio\'s new construction supply and Coachella + Stagecoach festival economics drive a price dynamic distinct from neighboring Palm Desert. PropertyDNA surfaces this separately.',
    riskCallouts: [
      'New construction vs resale segmentation',
      'Festival proximity short-term-rental income flag',
      'Permit history including STR licensing',
      'Comparable trajectory at neighborhood level',
    ],
    faqSlots: [
      { q: 'Does the report cover short-term rental income potential?', a: 'Yes. PropertyDNA flags STR licensing status and proximity-to-festival-grounds rental economics on every Indio report.' },
    ],
  },
  {
    slug: 'rancho-mirage-ca',
    city: 'Rancho Mirage',
    state: 'CA',
    county: 'Riverside County',
    metaTitle: 'Free Rancho Mirage Property Reports | PropertyDNA',
    metaDescription: 'Free PropertyDNA reports on every Rancho Mirage parcel — Thunderbird, Tamarisk, Mission Hills, every gated community indexed.',
    heroHeadline: 'Rancho Mirage — every legacy estate, indexed.',
    heroSub: 'Thunderbird, Tamarisk, Mission Hills, The Springs, Mirada Estates. PropertyDNA covers every Rancho Mirage parcel with valuation, comp trajectory, and permit history at the address level.',
    parcelCountLabel: '14,000+ Rancho Mirage parcels indexed',
    notable: 'Rancho Mirage has the highest celebrity-owner-history density in the Coachella Valley — PropertyDNA cross-references verified celebrity ownership on the dossier layer.',
    riskCallouts: [
      'Legacy-estate provenance flagging',
      'Verified celebrity ownership history (where documented)',
      'CalFire wildfire severity for canyon-adjacent parcels',
      'HOA cost trend by named community',
    ],
    faqSlots: [
      { q: 'Does PropertyDNA tag celebrity-owned homes?', a: 'Where ownership is documented in public records and primary sources, yes. The luxury dossier layer surfaces this for A-tier estates.' },
    ],
  },
  {
    slug: 'greenwich-ct',
    city: 'Greenwich',
    state: 'CT',
    county: 'Fairfield County',
    metaTitle: 'Free Greenwich CT Property Reports | PropertyDNA',
    metaDescription: 'Every Greenwich parcel indexed — Belle Haven, Conyers Farm, Round Hill, Backcountry. Free valuation, permit, comp report.',
    heroHeadline: 'Greenwich — backcountry to waterfront, indexed.',
    heroSub: 'PropertyDNA covers Belle Haven, Conyers Farm, Round Hill, Mid-Country, and Backcountry Greenwich at the parcel level with valuation, permit history, and comparable trajectory.',
    parcelCountLabel: 'Full Greenwich parcel coverage',
    notable: 'Greenwich has the highest off-market transaction percentage of any market in our coverage — public-record absorption velocity dramatically understates true demand. PropertyDNA flags this gap explicitly.',
    riskCallouts: [
      'Off-market transaction-volume adjustment',
      'Coastal flood zone (FEMA NFHL) for waterfront parcels',
      'Backcountry land-use zoning constraints',
      'Verified provenance for landmark estates',
    ],
    faqSlots: [
      { q: 'Does PropertyDNA cover off-market Greenwich transactions?', a: 'Off-market deals by definition do not show in MLS data; PropertyDNA flags the off-market gap and adjusts the absorption-rate trend so buyers see a more honest market velocity number.' },
    ],
  },
  {
    slug: 'new-canaan-ct',
    city: 'New Canaan',
    state: 'CT',
    county: 'Fairfield County',
    metaTitle: 'Free New Canaan CT Property Reports | PropertyDNA',
    metaDescription: 'New Canaan parcels indexed — mid-century modern provenance, valuation, comps. Free iOS app + web report.',
    heroHeadline: 'New Canaan — Harvard Five country, indexed.',
    heroSub: 'New Canaan is the densest concentration of Harvard Five modernist architecture in the U.S. (Philip Johnson, Marcel Breuer, John Johansen). PropertyDNA verifies pedigree on every documented commission.',
    parcelCountLabel: 'Full New Canaan parcel coverage',
    notable: 'New Canaan\'s glass-house provenance is treated as a verifiable cultural asset class. PropertyDNA primary-source-verifies every claimed architect attribution.',
    riskCallouts: [
      'Architect attribution verification (Harvard Five + adjacent)',
      'Conservation easement disclosure',
      'CT school district valuation premium',
      'Comparable trajectory adjusted for mid-century-modern scarcity',
    ],
    faqSlots: [
      { q: 'How does PropertyDNA verify Harvard Five attribution?', a: 'Every claim references original drawings, building permits, or period press. Unverified or rumored attributions do not enter the A-tier dossier.' },
    ],
  },
  {
    slug: 'westport-ct',
    city: 'Westport',
    state: 'CT',
    county: 'Fairfield County',
    metaTitle: 'Free Westport CT Property Reports | PropertyDNA',
    metaDescription: 'Every Westport parcel indexed — Compo Beach, Old Hill, Coleytown. Free property intelligence.',
    heroHeadline: 'Westport — every parcel, every beach access, indexed.',
    heroSub: 'Compo Beach, Old Hill, Saugatuck Shores, Coleytown — PropertyDNA covers every Westport parcel with flood-zone designation, school-district premium adjustment, and comparable trajectory.',
    parcelCountLabel: 'Full Westport parcel coverage',
    notable: 'Westport has the highest FEMA flood-zone exposure of the Connecticut tri-state luxury corridor. PropertyDNA breaks down NFHL designation at the parcel level.',
    riskCallouts: [
      'FEMA NFHL flood-zone exposure at parcel level',
      'Beach access valuation premium',
      'Westport school district trajectory',
      'Saugatuck waterfront permit history',
    ],
    faqSlots: [
      { q: 'Is flood insurance required for Westport waterfront?', a: 'For AE, A, V designations, lender-required flood insurance applies. PropertyDNA flags the designation and links to current NFHL maps.' },
    ],
  },
  {
    slug: 'darien-ct',
    city: 'Darien',
    state: 'CT',
    county: 'Fairfield County',
    metaTitle: 'Free Darien CT Property Reports | PropertyDNA',
    metaDescription: 'Darien parcels indexed — Tokeneke, Noroton, every neighborhood. Free PropertyDNA report.',
    heroHeadline: 'Darien — every Tokeneke estate, indexed.',
    heroSub: 'Tokeneke, Noroton, every waterfront point — PropertyDNA covers Darien at the parcel level with valuation, permit history, and comparable trajectory.',
    parcelCountLabel: 'Full Darien parcel coverage',
    notable: 'Darien has the highest median household income of any town in Connecticut. PropertyDNA segments comparable trajectory by named neighborhood so micro-market trends are visible.',
    riskCallouts: [
      'Coastal FEMA flood-zone exposure',
      'School-district valuation premium',
      'Permit history with major-renovation flag',
      'Comparable trajectory at neighborhood resolution',
    ],
    faqSlots: [
      { q: 'Does the report break down Darien by neighborhood?', a: 'Yes. Tokeneke, Noroton, Noroton Heights, Long Neck Point, Pear Tree Point — each is reported separately so the comp set is geographically honest.' },
    ],
  },
  {
    slug: 'miami-fl',
    city: 'Miami',
    state: 'FL',
    county: 'Miami-Dade County',
    metaTitle: 'Free Miami FL Property Reports | PropertyDNA',
    metaDescription: 'Every Miami-Dade parcel — flood, permit, comps, valuation. Free iOS app + web report.',
    heroHeadline: 'Miami — every parcel, every flood zone, indexed.',
    heroSub: 'PropertyDNA covers Miami-Dade County at the parcel level: Coconut Grove, Coral Gables, Brickell, Edgewater, Indian Creek. FEMA flood-zone designation joined at the address level.',
    parcelCountLabel: 'Full Miami-Dade parcel coverage',
    notable: 'Miami has the highest sea-level-rise insurance exposure of any U.S. metro in our coverage. PropertyDNA shows FEMA SFHA, base flood elevation, and an explicit insurance-cost trajectory.',
    riskCallouts: [
      'FEMA Special Flood Hazard Area (SFHA) designation',
      'Base flood elevation by parcel',
      'Insurance-cost trajectory and policy non-renewal risk',
      'Permit history including post-Andrew code retrofit',
    ],
    faqSlots: [
      { q: 'Why is FEMA flood designation so important in Miami?', a: 'AE/V designations require flood insurance, can cost $3,000–$15,000/yr, and increasingly trigger policy non-renewal. PropertyDNA shows the designation and the cost trajectory.' },
    ],
  },
  {
    slug: 'fort-lauderdale-fl',
    city: 'Fort Lauderdale',
    state: 'FL',
    county: 'Broward County',
    metaTitle: 'Free Fort Lauderdale Property Reports | PropertyDNA',
    metaDescription: 'Every Broward County parcel indexed — flood, permit, comps, valuation. Free iOS + web.',
    heroHeadline: 'Fort Lauderdale — every parcel, indexed and risk-scored.',
    heroSub: 'PropertyDNA covers Broward County: Las Olas Isles, Coral Ridge, Rio Vista, Harbor Beach. Flood designation, permit history, and comparable trajectory at the address level.',
    parcelCountLabel: 'Full Broward County parcel coverage',
    notable: 'Broward\'s waterway-canal inventory has dramatically different insurance economics from upland parcels. PropertyDNA segments inventory by waterway exposure.',
    riskCallouts: [
      'Waterway-canal exposure segmentation',
      'FEMA SFHA + base flood elevation',
      'Insurance-cost trajectory by zone',
      'Hurricane-code permit retrofit status',
    ],
    faqSlots: [
      { q: 'Does the report cover canal vs upland properties differently?', a: 'Yes. Canal-frontage parcels carry different insurance economics, hurricane exposure, and valuation logic; PropertyDNA reports them separately.' },
    ],
  },
  {
    slug: 'westchester-ny',
    city: 'Westchester',
    state: 'NY',
    county: 'Westchester County',
    metaTitle: 'Free Westchester NY Property Reports | PropertyDNA',
    metaDescription: 'Every Westchester County parcel indexed — Scarsdale, Bronxville, Rye, Bedford, Chappaqua, Pound Ridge.',
    heroHeadline: 'Westchester — every town, every parcel, indexed.',
    heroSub: 'PropertyDNA covers Westchester County at the parcel level: Scarsdale, Bronxville, Rye, Bedford, Chappaqua, Pound Ridge, Larchmont. Valuation, comp trajectory, permit history, school-district premium.',
    parcelCountLabel: 'Full Westchester County parcel coverage',
    notable: 'Westchester has the largest school-district premium dispersion in the Northeast — PropertyDNA explicitly adjusts comparable trajectory for school-district transitions.',
    riskCallouts: [
      'School-district premium and trajectory tracking',
      'Coastal FEMA designation (Mamaroneck, Rye, Larchmont)',
      'Septic vs municipal water disclosure',
      'Property-tax trajectory by named municipality',
    ],
    faqSlots: [
      { q: 'How does PropertyDNA handle school-district transitions?', a: 'When a town crosses between school districts, PropertyDNA segments comparables by district so the valuation is not contaminated by inappropriate cross-district comps.' },
    ],
  },
];

export function getCityLandingPage(slug: string) {
  return cityLandingPages.find(p => p.slug === slug);
}
