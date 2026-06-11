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
  // Florida — Dan flagged FL as top install source. Expand FL coverage.
  {
    slug: 'miami-beach-fl',
    city: 'Miami Beach',
    state: 'FL',
    county: 'Miami-Dade County',
    metaTitle: 'Free Miami Beach Property Reports | PropertyDNA',
    metaDescription: 'Every Miami Beach parcel indexed — flood zone, base flood elevation, insurance trajectory, permit history. Free iOS + web.',
    heroHeadline: 'Miami Beach — barrier island risk, surfaced.',
    heroSub: 'PropertyDNA indexes every Miami Beach parcel: South Beach, Mid-Beach, North Beach, Sunset Islands, Star Island. FEMA flood zones, base flood elevation, sea-level-rise insurance trajectory at the address level.',
    parcelCountLabel: 'Full Miami Beach parcel coverage',
    notable: 'Miami Beach is a barrier island — every parcel is in or near a Special Flood Hazard Area. PropertyDNA shows FEMA designation, base flood elevation, insurance-cost trajectory, and policy non-renewal risk explicitly. Most listing presentations bury this.',
    riskCallouts: [
      'FEMA SFHA designation by parcel (AE/V zones dominant)',
      'Base flood elevation vs ground elevation',
      'Insurance-cost trajectory + non-renewal risk',
      'Citizens Insurance vs private carrier flag',
      'Sea-level-rise projection at parcel resolution',
    ],
    faqSlots: [
      { q: 'Is Miami Beach uninsurable in some zones?', a: 'Increasingly, yes. Several major carriers stopped writing new policies on certain Miami Beach SFHA parcels in 2025. PropertyDNA flags non-renewal risk so buyers can verify carrier availability before signing.' },
      { q: 'Does the report flag base flood elevation?', a: 'Yes. Every Miami Beach report shows FEMA base flood elevation alongside the parcel\'s ground elevation, so buyers can see how much elevation buffer (if any) the property has.' },
      { q: 'What about Star Island or Sunset Islands?', a: 'Indexed at the parcel level. The barrier-island risk profile differs by causeway and elevation; PropertyDNA reports them separately.' },
    ],
  },
  {
    slug: 'coral-gables-fl',
    city: 'Coral Gables',
    state: 'FL',
    county: 'Miami-Dade County',
    metaTitle: 'Free Coral Gables Property Reports | PropertyDNA',
    metaDescription: 'Coral Gables parcels indexed — Riviera, Old Cutler, Cocoplum, every gated community. FEMA flood + insurance trajectory.',
    heroHeadline: 'Coral Gables — every Mediterranean revival, indexed.',
    heroSub: 'Coral Gables\' Mediterranean Revival inventory is some of the most architecturally significant in Florida. PropertyDNA indexes every Coral Gables parcel with provenance flagging, valuation, permit history, and flood-zone designation.',
    parcelCountLabel: 'Full Coral Gables parcel coverage',
    notable: 'Coral Gables has the highest concentration of pre-1940 Mediterranean Revival housing stock in South Florida. Architect provenance and hurricane-code retrofit status drive value as much as square footage — both are explicit in every PropertyDNA report.',
    riskCallouts: [
      'Mediterranean Revival architect attribution flag',
      'Pre-2002 vs post-2002 hurricane-code retrofit status',
      'FEMA flood zone designation',
      'Coral Gables Historic Preservation Board overlay',
    ],
    faqSlots: [
      { q: 'Does PropertyDNA flag historic-district restrictions?', a: 'Yes. Coral Gables\' Historic Preservation Board overlay is surfaced on every report so buyers know what renovation restrictions apply before submitting an offer.' },
      { q: 'How does hurricane-code status affect insurance?', a: 'Post-2002 hurricane-code retrofit dramatically reduces insurance premiums. PropertyDNA pulls the retrofit status from county permit records and flags it on every Coral Gables report.' },
    ],
  },
  {
    slug: 'boca-raton-fl',
    city: 'Boca Raton',
    state: 'FL',
    county: 'Palm Beach County',
    metaTitle: 'Free Boca Raton Property Reports | PropertyDNA',
    metaDescription: 'Every Boca Raton parcel indexed — Royal Palm Yacht, St Andrews, every gated community. Free FEMA + permit report.',
    heroHeadline: 'Boca Raton — every gate, every dock, indexed.',
    heroSub: 'Royal Palm Yacht & Country Club, St Andrews, Boca Bath & Tennis, The Sanctuary. PropertyDNA covers every Boca Raton parcel with FEMA flood designation, dock-and-waterway risk, and HOA cost trajectory.',
    parcelCountLabel: 'Full Boca Raton parcel coverage',
    notable: 'Boca Raton\'s gated-community inventory has the steepest insurance-cost dispersion in Palm Beach County. PropertyDNA segments HOA-included flood policies vs owner-required flood policies separately.',
    riskCallouts: [
      'HOA-included vs owner-required flood policy flag',
      'FEMA SFHA designation at parcel',
      'Dock + waterway exposure for Intracoastal parcels',
      'Country club valuation segmentation',
    ],
    faqSlots: [
      { q: 'Does the report show whether the HOA covers flood insurance?', a: 'Yes. Many Boca Raton gated communities include master flood policies that cover some hazards but not all. PropertyDNA flags coverage scope so buyers know what additional policies they need.' },
    ],
  },
  {
    slug: 'west-palm-beach-fl',
    city: 'West Palm Beach',
    state: 'FL',
    county: 'Palm Beach County',
    metaTitle: 'Free West Palm Beach Property Reports | PropertyDNA',
    metaDescription: 'West Palm Beach parcels indexed — El Cid, SoSo, Northwood, downtown corridor. FEMA + permit + comps.',
    heroHeadline: 'West Palm Beach — every street, indexed.',
    heroSub: 'El Cid, SoSo, Northwood, downtown corridor. PropertyDNA covers every West Palm Beach parcel with valuation, FEMA designation, permit history, and gentrification-trajectory tracking.',
    parcelCountLabel: 'Full West Palm Beach parcel coverage',
    notable: 'West Palm Beach has the highest gentrification velocity in Palm Beach County — micro-neighborhood trajectory matters as much as the citywide median. PropertyDNA reports this at the named-neighborhood resolution.',
    riskCallouts: [
      'Neighborhood-level gentrification velocity',
      'FEMA flood designation by parcel',
      'Pre-1970 vs post-2002 build flag',
      'Property tax trajectory',
    ],
    faqSlots: [
      { q: 'Does PropertyDNA report El Cid separately from SoSo?', a: 'Yes. Each named neighborhood is reported separately so comp sets are not contaminated by inappropriate cross-neighborhood data.' },
    ],
  },
  {
    slug: 'tampa-fl',
    city: 'Tampa',
    state: 'FL',
    county: 'Hillsborough County',
    metaTitle: 'Free Tampa Property Reports | PropertyDNA',
    metaDescription: 'Every Tampa-area parcel indexed — Hillsborough County. FEMA flood + Hurricane Helene/Milton flood-line trajectory.',
    heroHeadline: 'Tampa — Hurricane Helene + Milton flood-line, indexed.',
    heroSub: 'PropertyDNA covers Hillsborough County at the parcel level with FEMA designation, Hurricane Helene (Sept 2024) and Hurricane Milton (Oct 2024) inundation overlay, and insurance-cost trajectory.',
    parcelCountLabel: 'Hillsborough County parcel coverage in progress',
    notable: 'Helene and Milton changed Tampa Bay\'s flood-risk map permanently. Properties that were never in a Special Flood Hazard Area before now sit in revised AE designations. PropertyDNA shows the post-storm FEMA revision alongside the original 2020 map so buyers see exactly what changed.',
    riskCallouts: [
      'Pre-Helene vs post-Milton FEMA designation comparison',
      'Inundation overlay from 2024 storms',
      'Citizens Insurance vs private carrier availability',
      'Hurricane-code retrofit status',
    ],
    faqSlots: [
      { q: 'How did Helene and Milton change Tampa\'s flood zones?', a: 'FEMA issued post-storm revisions that expanded SFHA in numerous Tampa Bay neighborhoods. PropertyDNA shows the original and revised designation so buyers can see whether their target parcel\'s designation changed.' },
      { q: 'Can I still get private flood insurance in Tampa?', a: 'In many SFHA-designated Tampa parcels, private carriers have withdrawn — Citizens Property Insurance becomes the only option. PropertyDNA flags carrier availability for every Tampa parcel.' },
    ],
  },
  {
    slug: 'naples-fl',
    city: 'Naples',
    state: 'FL',
    county: 'Collier County',
    metaTitle: 'Free Naples FL Property Reports | PropertyDNA',
    metaDescription: 'Naples parcels indexed — Port Royal, Olde Naples, Pelican Bay. FEMA flood + insurance trajectory free.',
    heroHeadline: 'Naples — every estate, every gate, indexed.',
    heroSub: 'Port Royal, Olde Naples, Pelican Bay, Quail West, Pine Ridge. PropertyDNA covers every Naples parcel with FEMA flood-zone designation, post-Ian inundation overlay, and waterfront permit history.',
    parcelCountLabel: 'Collier County parcel coverage in progress',
    notable: 'Hurricane Ian (2022) reshaped Naples flood risk and insurance economics permanently. PropertyDNA shows pre-Ian and post-Ian FEMA designations side-by-side so buyers see exactly what changed at their address.',
    riskCallouts: [
      'Pre-Ian vs post-Ian FEMA flood designation',
      'Dock-and-waterway exposure on Gordon River parcels',
      'Insurance-cost trajectory and non-renewal risk',
      'Country club valuation segmentation',
    ],
    faqSlots: [
      { q: 'Did Hurricane Ian change Naples flood zones?', a: 'FEMA revised SFHA designations in numerous Naples sub-areas after Ian. PropertyDNA shows the original and revised maps so buyers know whether their parcel\'s designation changed.' },
      { q: 'Are Port Royal estates uninsurable?', a: 'No, but private carrier availability has narrowed dramatically. PropertyDNA flags carrier availability for every Naples waterfront parcel.' },
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

// ── Long-tail "city + topic" landing pages ─────────────────────────────────
// Each generates a /coverage/<city-state>/<topic> URL that ranks for very
// specific searches like "miami beach FEMA flood zones" or "tampa hurricane
// insurance map" — high intent, very low competition.

export interface CityTopicPage {
  citySlug: string;
  topicSlug: string;
  topicLabel: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  sections: { heading: string; body: string }[];
}

const FLOOD_TOPIC = {
  topicSlug: 'fema-flood-zones',
  topicLabel: 'FEMA Flood Zones',
};

const INSURANCE_TOPIC = {
  topicSlug: 'insurance-crisis',
  topicLabel: 'Hurricane Insurance',
};

const PERMIT_TOPIC = {
  topicSlug: 'permit-history',
  topicLabel: 'Permit History',
};

export const cityTopicPages: CityTopicPage[] = [
  // Miami flood
  {
    citySlug: 'miami-fl', topicSlug: FLOOD_TOPIC.topicSlug, topicLabel: FLOOD_TOPIC.topicLabel,
    metaTitle: 'Miami FEMA Flood Zones by Address | Free Property Report',
    metaDescription: 'Pull the FEMA flood zone designation for any Miami-Dade address. AE, A, V, X zones explained, base flood elevation surfaced, free in the PropertyDNA iOS app.',
    intro: 'Every Miami-Dade parcel has a FEMA flood zone designation that materially changes the insurance cost, the lender requirement, and the resale trajectory. PropertyDNA pulls it for free on every report.',
    sections: [
      { heading: 'How FEMA flood zones are assigned in Miami', body: 'FEMA NFHL maps are joined to every Miami-Dade parcel via address geocode. Zone X is low-risk. Zone AE/A is the standard Special Flood Hazard Area requiring federal flood insurance under any mortgage. Zone V designates coastal high-hazard.' },
      { heading: 'Which Miami neighborhoods carry the highest flood exposure', body: 'Barrier islands (Miami Beach, Fisher Island, Key Biscayne, Bal Harbour) carry the highest SFHA percentages. Downtown Brickell + Edgewater have mixed exposure. Coral Gables + Coconut Grove are mostly Zone X with pockets near the Bay.' },
      { heading: 'What changes when a parcel is in SFHA', body: 'Lender-mandated flood insurance ($1,800-$8,000/yr typical), reduced private-carrier availability, mandatory disclosure to future buyers, and increasingly tight underwriting standards on resale.' },
    ],
  },
  // Tampa flood
  {
    citySlug: 'tampa-fl', topicSlug: FLOOD_TOPIC.topicSlug, topicLabel: FLOOD_TOPIC.topicLabel,
    metaTitle: 'Tampa Bay FEMA Flood Zones — Pre-Helene + Post-Milton',
    metaDescription: 'Pull pre-storm and post-storm FEMA flood designation for any Tampa Bay address. Helene + Milton revisions integrated. Free in the PropertyDNA iOS app.',
    intro: 'Hurricane Helene (September 2024) and Hurricane Milton (October 2024) caused FEMA to revise flood-zone designations across Hillsborough County. PropertyDNA shows the pre-storm and post-storm designation side-by-side for every parcel.',
    sections: [
      { heading: 'Why Helene and Milton changed Tampa flood maps', body: 'Both storms produced inundation in areas not previously designated SFHA. FEMA used the post-storm evidence to issue revised NFHL maps that expanded AE designations across multiple Hillsborough and Pinellas sub-areas.' },
      { heading: 'What this means for current Tampa buyers', body: 'A Tampa Bay parcel that was Zone X in 2024 may now be Zone AE in 2026. The buyer pays the post-revision insurance premium, not the seller\'s legacy rate. PropertyDNA flags this gap explicitly.' },
      { heading: 'Citizens Insurance vs private carrier availability', body: 'In post-revised AE areas, private carrier availability has tightened. Citizens Property Insurance becomes the default. PropertyDNA shows carrier availability so buyers know what they\'re walking into before submitting an offer.' },
    ],
  },
  // Naples flood
  {
    citySlug: 'naples-fl', topicSlug: FLOOD_TOPIC.topicSlug, topicLabel: FLOOD_TOPIC.topicLabel,
    metaTitle: 'Naples FEMA Flood Zones — Pre-Ian + Post-Ian',
    metaDescription: 'Pull pre-Ian and post-Ian FEMA flood designation for any Collier County address. Free in the PropertyDNA iOS app.',
    intro: 'Hurricane Ian (September 2022) caused FEMA to revise Collier County flood-zone maps significantly. PropertyDNA shows the pre-Ian and post-Ian designations side-by-side at the parcel level.',
    sections: [
      { heading: 'What changed in Naples after Ian', body: 'FEMA expanded SFHA designations across Olde Naples, Port Royal, parts of Pelican Bay, and Gordon River frontage. Many parcels that were Zone X before Ian are now Zone AE.' },
      { heading: 'How carriers responded', body: 'Several private carriers withdrew from post-revised AE areas. Citizens Insurance grew rapidly in Collier County. Insurance-cost trajectory on affected parcels has risen 200-400% in three years.' },
      { heading: 'What to verify before submitting an offer', body: 'Always ask for a written binding insurance quote on the specific parcel before closing. The seller\'s legacy premium is no guide to what the new owner will pay.' },
    ],
  },
  // Tampa insurance
  {
    citySlug: 'tampa-fl', topicSlug: INSURANCE_TOPIC.topicSlug, topicLabel: INSURANCE_TOPIC.topicLabel,
    metaTitle: 'Tampa Hurricane Insurance Crisis — Citizens vs Private',
    metaDescription: 'Hurricane insurance availability and cost trajectory for every Tampa Bay address. Citizens vs private carrier flag. Free PropertyDNA report.',
    intro: 'Tampa Bay\'s homeowner insurance market is the most volatile in the United States in 2026. PropertyDNA flags Citizens-only markets and shows insurance-cost trajectory at the parcel level.',
    sections: [
      { heading: 'Why Tampa private carriers withdrew', body: 'Helene + Milton + reinsurance market repricing forced multiple private carriers to non-renew Tampa policies. Citizens Property Insurance became the carrier of last resort for a growing percentage of Tampa parcels.' },
      { heading: 'How to verify carrier availability before offering', body: 'Get binding quotes from three private carriers BEFORE submitting an offer. If two refuse, you are in a Citizens-only market — price the premium delta into your monthly carrying cost.' },
      { heading: 'Wind-mitigation discounts that survive the crisis', body: 'Properties with documented hurricane-code retrofit features (impact glazing, hurricane shutters, tie-downs, post-2002 build) carry 30-60% premium discounts that hold even in Citizens. PropertyDNA pulls retrofit status from county permit records.' },
    ],
  },
  // Naples insurance
  {
    citySlug: 'naples-fl', topicSlug: INSURANCE_TOPIC.topicSlug, topicLabel: INSURANCE_TOPIC.topicLabel,
    metaTitle: 'Naples Hurricane Insurance — Citizens vs Private by Parcel',
    metaDescription: 'Hurricane insurance availability for every Naples address. Citizens vs private carrier flag, post-Ian impact. Free PropertyDNA report.',
    intro: 'Hurricane Ian rewrote the Naples insurance market. PropertyDNA shows carrier availability and premium trajectory at the parcel level.',
    sections: [
      { heading: 'Naples post-Ian carrier withdrawal', body: 'Multiple private carriers stopped writing new policies in post-revised AE areas. Citizens Property Insurance share rose dramatically across Collier County in the 12 months after Ian.' },
      { heading: 'Premium delta from pre-Ian to 2026', body: 'For barrier-island and Gordon River parcels, the median private-market premium has tripled. PropertyDNA flags the trajectory so buyers can underwrite the actual cost.' },
      { heading: 'What hurricane mitigation actually buys you', body: 'Documented hurricane-code retrofit (post-2002 build, impact glazing, shutters, tie-downs) lowers Citizens premium by 30-60%. Without documentation, no discount applies.' },
    ],
  },
  // Palm Springs permits
  {
    citySlug: 'palm-springs-ca', topicSlug: PERMIT_TOPIC.topicSlug, topicLabel: PERMIT_TOPIC.topicLabel,
    metaTitle: 'Palm Springs Permit History by Address — Free Report',
    metaDescription: 'Pull the full Riverside County permit record for any Palm Springs parcel. Unpermitted renovation flag. Free in the PropertyDNA iOS app.',
    intro: 'Palm Springs\' mid-century stock has been renovated repeatedly over decades. PropertyDNA pulls the full Riverside County Assessor permit record for every parcel so buyers can verify what was permitted and what was not.',
    sections: [
      { heading: 'Why permit verification matters in Palm Springs', body: 'Mid-century properties often carry unpermitted additions, converted garages, casita conversions, and pool additions. The county permit record is the source of truth — anything not in the record is unpermitted work.' },
      { heading: 'What unpermitted renovation costs you after closing', body: 'Code enforcement can require retroactive permitting or demolition at the new owner\'s cost. Insurance carriers may exclude damage to or caused by unpermitted improvements. Resale value reflects the gap.' },
      { heading: 'How PropertyDNA surfaces the gap', body: 'Every Palm Springs report cross-references listing-advertised improvements against the permit record. If the listing says "renovated kitchen" and no kitchen permit exists in the last 20 years, the report flags it.' },
    ],
  },
  // Greenwich permits
  {
    citySlug: 'greenwich-ct', topicSlug: PERMIT_TOPIC.topicSlug, topicLabel: PERMIT_TOPIC.topicLabel,
    metaTitle: 'Greenwich CT Permit History by Address — Free Report',
    metaDescription: 'Pull the full Greenwich Building Department permit record for any address. Unpermitted renovation flag. Free PropertyDNA report.',
    intro: 'Greenwich estates often carry decades of renovation history. PropertyDNA pulls the full town permit record for every parcel so buyers can verify provenance and condition.',
    sections: [
      { heading: 'Why permit verification matters in Greenwich', body: 'Large estates with multiple renovation cycles are common. Backcountry properties carry land-use restrictions that permit records reveal. PropertyDNA surfaces this on every report.' },
      { heading: 'What to verify against the permit record', body: 'Every advertised renovation — kitchen, bathroom, basement, pool house, ADU — should have a corresponding permit. If not, the work is unpermitted and the liability transfers to the new owner.' },
      { heading: 'Conservation easement disclosure', body: 'Many Greenwich backcountry parcels carry conservation easements that limit development. PropertyDNA flags these on every Greenwich report.' },
    ],
  },
  // Miami permits
  {
    citySlug: 'miami-fl', topicSlug: PERMIT_TOPIC.topicSlug, topicLabel: PERMIT_TOPIC.topicLabel,
    metaTitle: 'Miami Permit History + Hurricane Code Retrofit by Address',
    metaDescription: 'Pull the full Miami-Dade Building Department permit record for any address. Hurricane code retrofit flag. Free PropertyDNA report.',
    intro: 'Post-Andrew Florida adopted enhanced hurricane-code standards in 2002. PropertyDNA pulls the full Miami-Dade permit record to surface what retrofit work has been documented for every parcel.',
    sections: [
      { heading: 'Why hurricane-code status changes your insurance', body: 'A post-2002 code-compliant roof + impact glazing + shutters = 30-60% premium discount. Without documentation, no discount applies. PropertyDNA pulls the permit record so buyers can verify what discounts they can actually claim.' },
      { heading: 'Unpermitted renovation in Miami', body: 'Miami-Dade is one of the most active code-enforcement jurisdictions in Florida. Unpermitted additions trigger lien-and-fine processes that survive the closing.' },
      { heading: 'What to demand from the seller', body: 'Always request a written Seller\'s Statement of Permits with permit numbers for every advertised improvement. Anything without a permit number should be treated as unpermitted in your underwriting.' },
    ],
  },
];

export function getCityTopicPage(citySlug: string, topicSlug: string) {
  return cityTopicPages.find(p => p.citySlug === citySlug && p.topicSlug === topicSlug);
}
