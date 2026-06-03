/**
 * _off-market-matcher — find off-market opportunities near an open-house property
 *
 * Queries Supabase `properties` table for homes matching the subject's profile
 * that haven't sold recently (long-tenured owners). For Thunderbird CC and
 * Thunderbird Heights — Riverside County data is in the sovereign index via
 * the CREST API ingest.
 *
 * Used by capture-open-house-lead.js and open-house-followup.js.
 *
 * Match rules:
 *   - same city
 *   - beds within ±1 of subject
 *   - price band: subject ±35% (luxury market — wider band for similars)
 *   - last sale ≥ 5 years ago (or null) — these are the "could be off-market" candidates
 *   - ordered by distance if lat/lon available, else by sqft proximity
 */
const db = require("./_supabase");

function haversineMiles(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lat2 == null) return null;
  const R = 3958.7613;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parsePrice(s) {
  if (typeof s === "number") return s;
  if (!s) return 0;
  return Number(String(s).replace(/[^\d.]/g, "")) || 0;
}

/**
 * Find off-market opportunities for a subject property.
 *
 * @param {Object} subject - property config from properties.ts
 * @param {number} limit   - max number of matches to return (default 3)
 * @returns {Promise<Array>} normalized match objects
 */
async function findOffMarketMatches(subject, limit = 3) {
  if (!subject || !subject.city) return [];

  const subjectPrice = parsePrice(subject.price);
  const subjectBeds  = Number(subject.beds);
  const subjectSqft  = subject.sqft ? Number(String(subject.sqft).replace(/[^\d]/g, "")) : null;

  // Wide net first — REST will filter
  const minPrice = Math.floor(subjectPrice * 0.65);
  const maxPrice = Math.ceil(subjectPrice * 1.35);
  const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 86400000).toISOString().slice(0, 10);

  let candidates = [];

  // Pass 1: similar price band, long-tenured (or unknown sale)
  try {
    candidates = await db.from("properties")
      .select("id,address,city,state,zip,beds,baths,sqft,year_built,latitude,longitude,last_sale_date,last_sale_price,current_estimated_value")
      .eq("city", subject.city)
      .eq("state", subject.state || "CA")
      .gte("current_estimated_value", minPrice)
      .lte("current_estimated_value", maxPrice)
      .lte("last_sale_date", fiveYearsAgo)
      .limit(50)
      .get()
      .catch(() => []);
  } catch {
    candidates = [];
  }

  // Pass 2 (fallback): if first pass empty (e.g., current_estimated_value not populated),
  // match by beds + city only.
  if (!Array.isArray(candidates) || candidates.length === 0) {
    try {
      candidates = await db.from("properties")
        .select("id,address,city,state,zip,beds,baths,sqft,year_built,latitude,longitude,last_sale_date,last_sale_price")
        .eq("city", subject.city)
        .eq("state", subject.state || "CA")
        .gte("beds", Math.max(1, subjectBeds - 1))
        .lte("beds", subjectBeds + 1)
        .limit(80)
        .get()
        .catch(() => []);
    } catch {
      candidates = [];
    }
  }

  if (!Array.isArray(candidates)) return [];

  // Exclude the subject itself
  const subjectAddr = (subject.address || "").toLowerCase().trim();
  let filtered = candidates.filter(p =>
    p.address && p.address.toLowerCase().trim() !== subjectAddr
  );

  // Rank
  for (const p of filtered) {
    p._distance_mi = (subject.latitude && p.latitude)
      ? haversineMiles(subject.latitude, subject.longitude, Number(p.latitude), Number(p.longitude))
      : null;
    p._sqft_delta = (subjectSqft && p.sqft) ? Math.abs(subjectSqft - Number(p.sqft)) : 999999;
  }

  filtered.sort((a, b) => {
    // Prefer matches with distance available, then closest, then sqft proximity
    if (a._distance_mi != null && b._distance_mi != null) return a._distance_mi - b._distance_mi;
    if (a._distance_mi != null) return -1;
    if (b._distance_mi != null) return 1;
    return a._sqft_delta - b._sqft_delta;
  });

  return filtered.slice(0, limit).map(p => ({
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    yearBuilt: p.year_built,
    lastSaleDate: p.last_sale_date,
    lastSalePrice: p.last_sale_price,
    estimatedValue: p.current_estimated_value,
    distanceMi: p._distance_mi ? Math.round(p._distance_mi * 100) / 100 : null,
    dossierUrl: `https://thepropertydna.com/dossier?address=${encodeURIComponent(p.address)}&zip=${encodeURIComponent(p.zip || "")}`,
  }));
}

module.exports = { findOffMarketMatches };
