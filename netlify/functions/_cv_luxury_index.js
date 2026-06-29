/**
 * _cv_luxury_index.js — Coachella Valley community pedigree index.
 *
 * Standing luxury/pedigree premium per development, matched by SUBDIVISION /
 * community name (and city as a tiebreak). This works even with owner-entered
 * data and no listing remarks — the property's community alone tells us the
 * tier, so a Southridge or Madison Club home is never valued like a generic
 * tract home.
 *
 * Premiums are applied like any DNA feature adjustment (pct_low/mid/high on the
 * base), keyed by tier. They reflect the persistent value floor of the address
 * itself — gated prestige, architectural pedigree, scarcity — that an AVM with
 * a thin comp set cannot see.
 *
 * Tiers (premium over a generic same-size home in the same city):
 *   S  ultra-trophy / celebrity / signature-architect enclaves
 *   A  established luxury country-club + estate communities
 *   B  upper-mid premium gated/golf communities
 *
 * Extend freely: add `{ names:[...], city, tier }` rows. Matching is
 * normalized + substring, so "Southridge", "South Ridge", "Southridge Dr"
 * all hit. Keep names lowercase.
 */

const TIER_PREMIUM = {
  S: { pct_low: 12, pct_mid: 22, pct_high: 38, label: "Trophy Enclave" },
  A: { pct_low: 7,  pct_mid: 13, pct_high: 22, label: "Luxury Community" },
  B: { pct_low: 3,  pct_mid: 6,  pct_high: 10, label: "Premium Community" },
};

// Coachella Valley luxury developments by tier. Names are matched normalized
// (lowercase, alphanumerics+spaces). City is an optional disambiguation hint.
const COMMUNITIES = [
  // ── Tier S — ultra-trophy / celebrity / signature architect ──────────────
  { tier: "S", city: "palm springs",  names: ["southridge", "south ridge"],
    anchorStreets: ["southridge dr", "southridge drive"] },                              // Bob Hope / Steve McQueen / hillside trophy
  { tier: "S", city: "la quinta",     names: ["the madison club", "madison club"] },
  { tier: "S", city: "indian wells",  names: ["the vintage club", "vintage club"] },
  { tier: "S", city: "palm desert",   names: ["bighorn golf club", "bighorn"] },
  { tier: "S", city: "indian wells",  names: ["the reserve"] },
  { tier: "S", city: "palm desert",   names: ["stone eagle"] },
  { tier: "S", city: "la quinta",     names: ["the quarry", "the hideaway", "hideaway"] },
  { tier: "S", city: "indian wells",  names: ["toscana country club", "toscana"] },
  { tier: "S", city: "rancho mirage", names: ["thunderbird heights", "thunderbird cove"] },

  // ── Tier A — established luxury country-club + estate communities ─────────
  { tier: "A", city: "palm springs",  names: ["old las palmas", "vista las palmas", "las palmas"] },
  { tier: "A", city: "palm springs",  names: ["movie colony", "the mesa", "tennis club"] },
  { tier: "A", city: "rancho mirage", names: ["thunderbird country club", "thunderbird"] },
  { tier: "A", city: "rancho mirage", names: ["tamarisk country club", "tamarisk", "the springs", "mirada", "morningside"] },
  { tier: "A", city: "la quinta",     names: ["andalusia", "pga west", "the citrus", "tradition", "rancho la quinta", "the palms"] },
  { tier: "A", city: "indian wells",  names: ["eldorado country club", "eldorado", "indian wells country club", "the cove"] },
  { tier: "A", city: "palm desert",   names: ["ironwood country club", "ironwood", "the reserve", "marrakesh", "the vintage"] },
  { tier: "A", city: "indian wells",  names: ["the canyons", "desert horizons"] },

  // ── Tier B — upper-mid premium gated/golf ────────────────────────────────
  { tier: "B", city: "la quinta",     names: ["palmilla", "mountain view country club", "trilogy la quinta", "griffin ranch"] },
  { tier: "B", city: "palm desert",   names: ["indian ridge", "the lakes country club", "monterey country club", "palm valley country club", "chaparral"] },
  { tier: "B", city: "rancho mirage", names: ["mission hills country club", "mission hills", "rancho mirage country club", "the springs"] },
  { tier: "B", city: "indian wells",  names: ["mountain cove", "colony 29"] },
  { tier: "B", city: "palm springs",  names: ["andreas hills", "araby cove", "deepwell", "indian canyons", "canyon view"] },
  { tier: "B", city: "rancho mirage", names: ["magnesia falls", "rancho las palmas"] },
  { tier: "B", city: "indio",         names: ["terra lago", "sun city shadow hills", "shadow hills"] },

  // ── Added (Agent 3 / Patch A): 3 missing named CV communities + street anchors ──
  // Tier A — Palm Springs hillside architectural enclave
  { tier: "A", city: "palm springs",  names: ["little tuscany"],
    anchorStreets: ["rose ave", "ridge rd", "crestview dr", "panorama rd"] },
  // Tier A — Sinatra-era Krisel/Alexander modernist tract (Twin Palms Estates)
  { tier: "A", city: "palm springs",  names: ["twin palms"],
    anchorStreets: ["sonora rd", "san lorenzo rd", "via monte vista"] },
  // Tier B — iconic Alexander/Krisel MCM tract
  { tier: "B", city: "palm springs",  names: ["racquet club estates", "racquet club road estates"],
    anchorStreets: ["e francis dr", "vista chino", "san marco way", "via olivera"] },
];

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Look up the community pedigree premium for a property.
 * @param {string} subdivision  e.g. "Southridge", "Palmilla", "The Madison Club"
 * @param {string} city         e.g. "Palm Springs"
 * @returns {{tier, label, pct_low, pct_mid, pct_high, matched}} | null
 */
function lookupCommunity(subdivision, city = "") {
  const sub = norm(subdivision);
  const cty = norm(city);
  if (!sub && !cty) return null;

  let best = null;
  for (const row of COMMUNITIES) {
    for (const name of row.names) {
      const n = norm(name);
      // Match if the community name appears in the subdivision (or vice-versa
      // for very short names). Require length >= 4 to avoid false hits.
      const hit = n.length >= 4 && (sub.includes(n) || (n.length >= 8 && n.includes(sub) && sub.length >= 4));
      if (!hit) continue;
      // City must agree if both are present (prevents cross-city name clashes).
      const cityOk = !row.city || !cty || cty.includes(norm(row.city)) || norm(row.city).includes(cty);
      if (!cityOk) continue;
      // Prefer the highest tier on multiple matches (S > A > B), and longer name match.
      const rank = { S: 3, A: 2, B: 1 }[row.tier];
      if (!best || rank > best._rank || (rank === best._rank && n.length > best._len)) {
        const p = TIER_PREMIUM[row.tier];
        best = { tier: row.tier, label: `${p.label}: ${name.replace(/\b\w/g, c => c.toUpperCase())}`,
                 pct_low: p.pct_low, pct_mid: p.pct_mid, pct_high: p.pct_high,
                 matched: name, _rank: rank, _len: n.length };
      }
    }
  }
  if (best) { delete best._rank; delete best._len; }
  return best;
}

/**
 * lookupCommunityByAddress — infer a COMP's CV community from its street line.
 *
 * RentCast comps do not return a subdivision, so for community-first comp ranking
 * we infer a comp's enclave from its street address. Only matches when a community
 * row defines `anchorStreets` (a verified, high-signal seed). Returns the same
 * shape as lookupCommunity, plus { via: "street" }. Null when no confident hit.
 *
 * Backwards-compatible: additive export; lookupCommunity is unchanged.
 *
 * @param {string} addressLine  e.g. "2175 Southridge Dr, Palm Springs, CA"
 * @param {string} city         optional disambiguation hint
 * @returns {{tier,label,pct_low,pct_mid,pct_high,matched,via}} | null
 */
function lookupCommunityByAddress(addressLine, city = "") {
  const addr = norm(addressLine);
  const cty  = norm(city);
  if (!addr) return null;
  let best = null;
  for (const row of COMMUNITIES) {
    if (!row.anchorStreets || !row.anchorStreets.length) continue;
    const cityOk = !row.city || !cty || cty.includes(norm(row.city)) || norm(row.city).includes(cty);
    if (!cityOk) continue;
    for (const st of row.anchorStreets) {
      const n = norm(st);
      if (n.length >= 4 && addr.includes(n)) {
        const rank = { S: 3, A: 2, B: 1 }[row.tier];
        if (!best || rank > best._rank) {
          const p = TIER_PREMIUM[row.tier];
          best = {
            tier: row.tier,
            label: `${p.label}: ${row.names[0].replace(/\b\w/g, (c) => c.toUpperCase())}`,
            pct_low: p.pct_low, pct_mid: p.pct_mid, pct_high: p.pct_high,
            matched: row.names[0], via: "street", _rank: rank,
          };
        }
      }
    }
  }
  if (best) delete best._rank;
  return best;
}

module.exports = { lookupCommunity, lookupCommunityByAddress, TIER_PREMIUM, COMMUNITIES };
