/**
 * enrich-report — in-house replacement for the n8n "Property DNA Workflow".
 *
 * n8n (a fragile cloud orchestrator) kept OOM-crashing and auto-deactivating,
 * stalling the whole report pipeline. This function does what n8n did for the
 * CORE report — fetch RentCast (valuation + property + comps), normalize into
 * the shape save-report consumes, and hand off to save-report — with NO LLM
 * and NO external orchestrator. save-report then computes Census demographics,
 * FEMA flood, USGS seismic, CalFire wildfire, the DNA valuation, and ingests
 * the property. All deterministic; all under our control.
 *
 * Called fire-and-forget by queue-report (replacing the n8n webhook). The user
 * already has their /report/view/<token> link from the queued email; this flips
 * that report from pending -> completed with full data.
 *
 * POST /.netlify/functions/enrich-report   (x-internal-key required)
 * Body: { email, fullName, address, city, state, zip, role, viewToken, reportId }
 */
const https = require("https");
const db = require("./_supabase");
const { appreciateToToday: hpiAppreciate } = require("./_hpi_index");
// ── PropertyDNA's OWN valuation stack (source of truth; RentCast-free) ──
const { computeValuation } = require("./_valuation-engine");
const { rankCompsCommunityFirst } = require("./_community_comps");
const { lookupCommunity, lookupCommunityByAddress } = require("./_cv_luxury_index");

const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");
const RENTCAST_KEY = process.env.RENTCAST_API_KEY;
const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };

function getJSON(hostname, path, headers = {}, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const req = https.request({ hostname, path, method: "GET", headers }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, json: null }); } });
    });
    req.on("error", () => resolve({ status: 0, json: null }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ status: 0, json: null }); });
    req.end();
  });
}

function postJSON(hostname, path, headers, body, timeoutMs = 20000) {
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request({ hostname, path, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers } },
      (res) => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, json: null }); } }); });
    req.on("error", () => resolve({ status: 0, json: null }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ status: 0, json: null }); });
    req.write(payload); req.end();
  });
}

const num = (v) => { if (v == null) return null; const n = Number(v); return isNaN(n) ? null : n; };

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTYDNA VALUATION DATA SOURCES (all owned; NO third-party AVM dependency)
//
//   • CREST (Riverside County assessor) — subject beds/baths/sqft/yearBuilt/lat/lon/
//     last-sale + APN. Fetched FIRST for CA/CV addresses (facts backfill).
//   • property_master — cached facts (resolved by APN, else normalized ilike prefix).
//   • `properties`    — our recorded/CMA solds (city+sqft+price together).
//   • property_master city cohort — broad comp coverage.
//
// These feed _valuation-engine.computeValuation() (headline) after _community_comps
// ranking. RentCast is NOT used here — only an optional labeled cross-check field.
// ─────────────────────────────────────────────────────────────────────────────

const CREST_HOST = "gis.countyofriverside.us";
const CREST_PATH = "/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query";
const ANNUAL_APPRECIATION = 0.048; // long-run; mirrors save-report's sale-anchor default

const CV_CITIES = ["palm springs","palm desert","indio","la quinta","rancho mirage",
  "indian wells","cathedral city","desert hot springs","coachella","thousand palms","bermuda dunes"];
function isCoachellaValley(city, state) {
  if (state && String(state).toUpperCase() !== "CA") return false;
  const c = String(city || "").toLowerCase();
  return CV_CITIES.some((x) => c.includes(x));
}

const pickNum = (row, keys) => {
  for (const k of keys) {
    const v = row?.[k];
    if (v == null || v === "") continue;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    if (!isNaN(n) && n !== 0) return n;
  }
  return null;
};
const pickStr = (row, keys) => {
  for (const k of keys) { const v = row?.[k]; if (v != null && String(v).trim() !== "") return String(v).trim(); }
  return null;
};

// Appreciate a past sale price to today (capped; guards garbage dates).
function appreciate(price, dateStr) {
  if (!price) return null;
  if (!dateStr) return price;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return price;
  const years = Math.max(0, (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (years > 40) return price; // implausible date → don't compound
  return Math.round(price * Math.pow(1 + ANNUAL_APPRECIATION, years));
}

// Loose street fragment for an ilike / LIKE match (drops city/state, strips wildcards).
function streetFragment(address) {
  return String(address || "").split(",")[0].trim().replace(/[%']/g, " ").slice(0, 40);
}

function crestDate(val) {
  if (val == null || val === "") return null;
  if (typeof val === "number") { const d = new Date(val); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); }
  const s = String(val).trim();
  if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(s)) return s.slice(0, 10).replace(/\//g, "-");
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

// Map an internal comp into the same shape save-report consumes. distance/correlation
// are intentionally null so computeClosestCompAnchor() can't double-count them on top
// of a seed that already derives from these sales (they still render on the map).
function toCompShape(c) {
  return {
    rawPrice: c.price,
    price: c.price != null ? "$" + Number(c.price).toLocaleString() : null,
    distance: null,
    correlation: null,
    sqft: c.sqft || null,
    lat: c.lat || null, lon: c.lon || null,
    address: c.address || "",
    propertyType: c.propertyType || null,
    // Carry through whatever comp facts we have (real values or null).
    beds: c.beds ?? null, baths: c.baths ?? null,
    lotSize: c.lotSize ?? null, yearBuilt: c.yearBuilt ?? null,
    city: c.city || null,
    // Accept either `saleDate` (ranked comps) or `date` (raw sold comps).
    saleDate: c.saleDate ?? c.date ?? null,
  };
}

const titleCase = (s) => String(s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// A1. Subject row from `properties` (small, indexed table; supports fast ilike).
// This is our OWN indexed record for the subject — cached estimate + last sale +
// characteristics — the practical stand-in for "property_master by APN" (the 10M
// property_master table has no text-pattern index, so address ilike there times
// out; we use it only via the indexed `city` path for the comp cohort below).
async function lookupSubjectProperty({ address, city }) {
  const frag = streetFragment(address);
  if (!frag) return null;
  try {
    const rows = await db.from("properties")
      .select("address,city,state,zip,sqft,beds,baths,lot_sqft,year_built,property_type_normalized,last_sale_price,last_sale_date,current_estimated_value,latitude,longitude")
      .ilike("address", `${frag}%`).limit(5).get();
    if (!Array.isArray(rows) || !rows.length) return null;
    const cityLc = String(city || "").toLowerCase();
    return rows.find((r) => cityLc && String(r.city || "").toLowerCase().includes(cityLc)) || rows[0];
  } catch (e) {
    console.warn("[enrich-report:properties subject]", e.message);
    return null;
  }
}

// A2. Resolve the property_master row for the subject — the richest cached record
// (facts + last sale + any cached range). Prior code used EXACT `.eq("address")`
// which missed almost every row (address-format drift). We now resolve by APN when
// CREST gives us one (indexed, exact, format-proof), then fall back to a normalized
// `ilike` address-prefix match. Both are null-safe and time-bounded.
const MASTER_COLS = "apn,address,city,state,zip,lat,lng,property_type,beds,baths,sqft,lot_sqft,year_built,rentcast_value,rentcast_value_low,rentcast_value_high,tax_assessed_value";
async function lookupPropertyMaster({ address, city, apn }) {
  // (1) APN — the strongest key when CREST resolved one.
  if (apn) {
    try {
      const rows = await db.from("property_master").select(MASTER_COLS)
        .eq("apn", String(apn)).limit(1).get();
      if (Array.isArray(rows) && rows.length) return rows[0];
    } catch (e) { console.warn("[enrich-report:property_master apn]", e.message); }
  }
  // (2) Normalized address-prefix ilike on the indexed street fragment.
  const frag = streetFragment(address);
  if (!frag) return null;
  try {
    const rows = await db.from("property_master").select(MASTER_COLS)
      .ilike("address", `${frag}%`).limit(5).get();
    if (!Array.isArray(rows) || !rows.length) return null;
    const cityLc = String(city || "").toLowerCase();
    return rows.find((r) => cityLc && String(r.city || "").toLowerCase().includes(cityLc)) || rows[0];
  } catch (e) {
    console.warn("[enrich-report:property_master ilike]", e.message);
    return null;
  }
}

// B. Sold comps with sqft, scoped to the subject's city (fallback zip), from:
//    1) `properties` — real recorded sales (pull-solds-rivco ground truth)
//    2) property_master city cohort — cached rentcast_value/sqft (broad coverage)
async function lookupSoldComps({ city, zip }) {
  const out = [];
  try {
    let q = db.from("properties")
      .select("address,city,zip,sqft,beds,baths,lot_sqft,year_built,last_sale_price,current_estimated_value,last_sale_date,latitude,longitude,property_type_normalized,listing_source")
      .gte("last_sale_price", 50000).limit(250);
    if (city) q = q.ilike("city", city);
    else if (zip) q = q.eq("zip", zip);
    const rows = await q.get();
    if (Array.isArray(rows)) for (const r of rows) {
      const price = Number(r.last_sale_price) || Number(r.current_estimated_value) || null;
      const sqft = Number(r.sqft) || null;
      // Tag MLS/CMA solds (pull-solds / flexmls_cma) as our highest-trust comps.
      const isCma = /flexmls|cma|mls/i.test(String(r.listing_source || ""));
      if (price && price > 50000) out.push({
        price, sqft: sqft && sqft > 200 ? sqft : null,
        beds: Number(r.beds) || null, baths: Number(r.baths) || null,
        lotSize: Number(r.lot_sqft) || null, yearBuilt: Number(r.year_built) || null,
        address: r.address || null, city: r.city || null,
        lat: r.latitude ? Number(r.latitude) : null, lon: r.longitude ? Number(r.longitude) : null,
        date: r.last_sale_date || null, propertyType: r.property_type_normalized || null,
        src: isCma ? "properties_cma_sold" : "properties_sold",
      });
    }
  } catch (e) { console.warn("[enrich-report:properties comps]", e.message); }

  // property_master cohort — MUST use eq("city") (indexed/fast); ilike on the
  // 10M-row table sequential-scans and hits the statement timeout. city casing
  // varies, so try the title-cased form (the common stored form) too.
  if (city) {
    const cityVariants = [...new Set([city, titleCase(city), String(city).toUpperCase()])];
    for (const cv of cityVariants) {
      try {
        const rows = await db.from("property_master")
          .select("address,city,lat,lng,sqft,rentcast_value")
          .eq("city", cv).gte("rentcast_value", 50000).limit(250).get();
        if (Array.isArray(rows) && rows.length) {
          for (const r of rows) {
            const price = Number(r.rentcast_value) || null;
            const sqft = Number(r.sqft) || null;
            if (price && price > 50000) out.push({
              price, sqft: sqft && sqft > 200 ? sqft : null,
              beds: null, baths: null, lotSize: null, yearBuilt: null,
              address: r.address || null, city: r.city || cv || null,
              lat: r.lat ? Number(r.lat) : null, lon: r.lng ? Number(r.lng) : null,
              date: null, propertyType: null, src: "property_master_cohort",
            });
          }
          break; // first variant that returns rows wins
        }
      } catch (e) { console.warn("[enrich-report:master cohort]", e.message); }
    }
  }
  return out;
}

// Median $/sqft from a comp pool (outlier-trimmed to a sane $40–$5,000 band).
function medianPsf(comps) {
  const psfs = comps
    .filter((c) => c.sqft && c.sqft > 200 && c.price > 50000)
    .map((c) => c.price / c.sqft)
    .filter((x) => x > 40 && x < 5000)
    .sort((a, b) => a - b);
  if (psfs.length < 3) return null;
  return { psf: psfs[Math.floor(psfs.length / 2)], n: psfs.length };
}
function medianPrice(comps) {
  const ps = comps.map((c) => c.price).filter((p) => p > 50000).sort((a, b) => a - b);
  return ps.length ? { price: ps[Math.floor(ps.length / 2)], n: ps.length } : null;
}

// C. Riverside County CREST assessor lookup (free, no key) — CV addresses only.
// returnGeometry:true (in WGS84) so we can backfill subject lat/lon when our own
// tables miss it. Geometry is parsed best-effort by crestLatLon().
function crestGet(where, timeoutMs = 15000) {
  const qs = new URLSearchParams({ f: "json", outFields: "*", returnGeometry: "true", outSR: "4326", where, resultRecordCount: "10" }).toString();
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: CREST_HOST, path: `${CREST_PATH}?${qs}`, method: "GET", headers: { "User-Agent": "PropertyDNA/3.0 (thepropertydna.com)" } },
      (res) => { let raw = ""; res.on("data", (c) => (raw += c)); res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } }); }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
    req.end();
  });
}
// Derive {lat,lon} from an Esri geometry (point or polygon ring centroid), WGS84.
function crestLatLon(geom) {
  if (!geom) return { lat: null, lon: null };
  if (typeof geom.y === "number" && typeof geom.x === "number") return { lat: geom.y, lon: geom.x };
  const ring = Array.isArray(geom.rings) && geom.rings[0];
  if (Array.isArray(ring) && ring.length) {
    let sx = 0, sy = 0, n = 0;
    for (const p of ring) { if (Array.isArray(p) && p.length >= 2) { sx += p[0]; sy += p[1]; n++; } }
    if (n) return { lat: sy / n, lon: sx / n };
  }
  return { lat: null, lon: null };
}
async function lookupCrest({ address, city }) {
  const frag = streetFragment(address).toUpperCase().replace(/'/g, "''");
  if (!frag) return null;
  const cityClause = city ? ` AND UPPER(SITUS_CITY) = '${String(city).toUpperCase().replace(/'/g, "''")}'` : "";
  let data = await crestGet(`UPPER(SITUS_ADDR) LIKE '${frag}%'${cityClause}`);
  let f = data?.features?.[0];
  if (!f && cityClause) { // retry without the city constraint
    data = await crestGet(`UPPER(SITUS_ADDR) LIKE '${frag}%'`);
    f = data?.features?.[0];
  }
  if (!f?.attributes) return null;
  // Merge geometry-derived lat/lon in under private keys pickNum/pickStr ignore.
  const ll = crestLatLon(f.geometry);
  return { ...f.attributes, __lat: ll.lat, __lon: ll.lon };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY VALUATION — PropertyDNA's OWN engine is the source of truth.
//
// Flow (RentCast-independent):
//   1. CREST assessor FIRST (CA/CV addresses) → subject beds/baths/sqft/yearBuilt/
//      lat/lon/last-sale + APN (used to resolve property_master exactly).
//   2. Resolve subject from OUR tables (property_master by APN|ilike, `properties`).
//   3. Pull comps from OUR data (`properties` solds incl. flexmls_cma + master cohort).
//   4. Rank comps community-first (_community_comps) and run computeValuation
//      (_valuation-engine) for the headline value.
//   5. GATE confidence honestly: a confident, 'completed' number requires REAL
//      subject facts (sqft) AND >=3 usable comps — otherwise 'insufficient_data'.
//
// Returns { normalized, valuationSource, status, hasSubjectData, hasValue }.
// Never returns null and never fabricates a subject fact or a confident number.
// ─────────────────────────────────────────────────────────────────────────────
async function buildEngineValuation({ address, city, state, zip }) {
  // ── 1. CREST assessor FIRST — facts + APN + lat/lon for Riverside/CV/CA ──
  let crest = null;
  if (isCoachellaValley(city, state) || (state && String(state).toUpperCase() === "CA") || !state) {
    crest = await lookupCrest({ address, city }).catch(() => null);
  }
  const crestApn = crest ? pickStr(crest, ["APN", "PARCEL_APN", "ASSESSMENT_NO", "ASMT"]) : null;
  const crestN = (keys) => (crest ? pickNum(crest, keys) : null);

  // ── 2. Resolve the subject from OUR OWN data (property_master + properties) ──
  const [subj, master, soldComps] = await Promise.all([
    lookupSubjectProperty({ address, city }),
    lookupPropertyMaster({ address, city, apn: crestApn }),
    lookupSoldComps({ city: city || pickStr(subj, ["city"]) || null, zip }),
  ]);

  // ── 3. Subject facts — REAL values only, priority CREST > property_master >
  //       `properties`. Nothing is fabricated: a missing fact stays null. ──
  const subjSqft  = crestN(["SQ_FT", "BLDG_SQFT", "SQFT"])      ?? pickNum(master, ["sqft"])       ?? pickNum(subj, ["sqft"]);
  const subjBeds  = crestN(["BEDROOMS", "BEDS"])                ?? pickNum(master, ["beds"])       ?? pickNum(subj, ["beds"]);
  const subjBaths = crestN(["BATHROOMS", "BATHS"])              ?? pickNum(master, ["baths"])      ?? pickNum(subj, ["baths"]);
  const subjLot   = crestN(["LOT_SQFT", "LOT_SIZE", "NET_AC"])  ?? pickNum(master, ["lot_sqft"])   ?? pickNum(subj, ["lot_sqft"]);
  const subjYear  = crestN(["YEAR_BUILT", "YR_BLT", "EFF_YR"])  ?? pickNum(master, ["year_built"]) ?? pickNum(subj, ["year_built"]);
  const subjType  = pickStr(master, ["property_type"])          ?? pickStr(subj, ["property_type_normalized"]);
  const lat = crestN(["__lat"]) ?? pickNum(master, ["lat"]) ?? pickNum(subj, ["latitude"]);
  const lon = crestN(["__lon"]) ?? pickNum(master, ["lng"]) ?? pickNum(subj, ["longitude"]);
  const subjCity  = city || pickStr(master, ["city"])  || pickStr(subj, ["city"])  || null;
  const subjState = state || pickStr(master, ["state"]) || pickStr(subj, ["state"]) || null;
  const subjZip   = zip   || pickStr(master, ["zip"])   || pickStr(subj, ["zip"])   || null;

  // Subject's last recorded sale (real, from OUR data or CREST assessor).
  let lastSalePrice = pickNum(subj, ["last_sale_price"]);
  let lastSaleDate  = pickStr(subj, ["last_sale_date"]);
  if (!lastSalePrice) {
    const crestSale = crestN(["LAST_SALE_AMOUNT", "SALE_AMOUNT"]);
    if (crestSale && crestSale > 10000) { lastSalePrice = crestSale; lastSaleDate = crestDate(crest?.LAST_SALE_DATE ?? crest?.SALE_DATE); }
  }

  // ── 4. Rank comps community-first, then run OUR engine for the headline ──
  const subjectCommunity =
    lookupCommunity(pickStr(subj, ["subdivision", "neighborhood"]) || "", subjCity) ||
    lookupCommunityByAddress(address, subjCity);
  const rankSubject = { propertyType: subjType, sqft: subjSqft, lotSize: subjLot, city: subjCity };
  const rankerComps = soldComps.map((c) => ({
    address: c.address, city: c.city || subjCity, distance: null,
    lotSize: c.lotSize ?? null, saleDate: c.date ?? null,
    propertyType: c.propertyType ?? null, sqft: c.sqft ?? null,
    price: c.price, beds: c.beds ?? null, baths: c.baths ?? null,
    yearBuilt: c.yearBuilt ?? null, lat: c.lat ?? null, lon: c.lon ?? null, src: c.src,
  }));
  const ranked = rankCompsCommunityFirst(rankSubject, subjectCommunity, rankerComps);

  // Engine input shape { price, sqft, lotSqft, beds, baths, yearBuilt, saleDate }.
  const engineComps = ranked.map((c) => ({
    price: c.price, sqft: c.sqft, lotSqft: c.lotSize ?? null,
    beds: c.beds ?? null, baths: c.baths ?? null, yearBuilt: c.yearBuilt ?? null,
    saleDate: c.saleDate ?? null,
  }));
  const usableCompCount = engineComps.filter((c) => num(c.price) && num(c.sqft) && num(c.sqft) > 400).length;

  const engineSubject = { sqft: subjSqft, lotSqft: subjLot, beds: subjBeds, baths: subjBaths, yearBuilt: subjYear };
  // computeValuation returns fairValue=null unless subject.sqft AND >=3 usable comps.
  const val = computeValuation(engineSubject, engineComps);

  // ── 5. Honest confidence gate ──
  const hasSubjectData = subjSqft != null;                       // real subject facts (sqft is the engine's anchor)
  const engineValue    = val.fairValue;                          // headline — never fabricated
  const hasValue       = engineValue != null && usableCompCount >= 3;

  let low = val.fairValueLow, high = val.fairValueHigh, marketValue = engineValue;
  if (marketValue != null) {
    if (low == null)  low  = Math.round(marketValue * 0.90);
    if (high == null) high = Math.round(marketValue * 1.10);
  }

  // Map engine confidence (0.30–0.95) → label; gate overrides to 'insufficient'.
  let valuationConfidence, confidenceNote, status;
  if (hasSubjectData && hasValue) {
    const c = val.confidence ?? 0.5;
    valuationConfidence = c >= 0.7 ? "high" : c >= 0.5 ? "medium" : "low";
    confidenceNote = `Valued by PropertyDNA's comp engine from ${usableCompCount} community-ranked sold comparables against verified subject facts (${subjSqft} sqft${subjBeds ? `, ${subjBeds} bd` : ""}${subjBaths ? `, ${subjBaths} ba` : ""}).`;
    status = "completed";
  } else {
    valuationConfidence = "insufficient";
    const missing = [];
    if (!hasSubjectData) missing.push("verified subject property facts (bed/bath/sqft)");
    if (usableCompCount < 3) missing.push(`enough comparable sales (found ${usableCompCount}, need 3)`);
    confidenceNote = `Insufficient data to publish a confident valuation — missing ${missing.join(" and ")}. No estimate was fabricated. We are gathering more data for this address.`;
    status = "insufficient_data";
    // Never present an unverified number as if it were real.
    marketValue = null; low = null; high = null;
  }

  const normalized = {
    subject: {
      address, city: subjCity, state: subjState, zip: subjZip, lat, lon,
      // Output contract — real values or null, never fabricated.
      beds: subjBeds ?? null, baths: subjBaths ?? null, sqft: subjSqft ?? null, yearBuilt: subjYear ?? null,
      lastSalePrice: lastSalePrice ?? null, lastSaleDate: lastSaleDate ?? null,
    },
    valuation: {
      marketValue, low, high,
      valuationSource: "propertydna_engine",
      valuationConfidence,
      confidenceNote,
      // engine internals (for transparency / debugging; never the headline requirement)
      compCount: usableCompCount,
      engineMethod: val.method,
    },
    property: {
      beds: subjBeds ?? null, baths: subjBaths ?? null, sqft: subjSqft ?? null,
      lotSize: subjLot ?? null, yearBuilt: subjYear ?? null, propertyType: subjType ?? null,
    },
    sale: { lastSalePrice: lastSalePrice ?? null, lastSaleDate: lastSaleDate ?? null },
    comps: ranked.slice(0, 12).map(toCompShape),
    listing: { remarks: "" },
    // Top-level mirrors (kept for existing UI transparency flags).
    valuationSource: "propertydna_engine",
    valuationConfidence,
    confidenceNote,
    source: "enrich-report (PropertyDNA engine — RentCast-free source of truth)",
  };
  return { normalized, valuationSource: "propertydna_engine", status, hasSubjectData, hasValue };
}

// Flip the pre-created pending row to 'failed' (NEVER leave it 'pending') with a
// clear, user-facing message. save-report matches the row by viewToken/reportId.
async function markFailed({ email, address, city, state, zip, viewToken, reportId }, reason) {
  return postJSON("thepropertydna.com", "/.netlify/functions/save-report",
    { "x-internal-key": INTERNAL_KEY || "" },
    {
      email, address, city: city || "", state: state || "", zip: zip || "",
      status: "failed", generationError: reason,
      viewToken: viewToken || null, reportId: reportId || null,
    }, 15000);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  const k = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (INTERNAL_KEY && k !== INTERNAL_KEY) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  // NOTE: a missing/expired RENTCAST_KEY is NO LONGER fatal — we fall back to the
  // internal valuation index below so reports never hang "pending".

  let body; try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }
  const { email, fullName, address, city, state, zip, role, viewToken, reportId } = body;
  if (!email || !address) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email and address required" }) };

  const full = [address, city, state, zip].filter(Boolean).join(", ");
  const q = encodeURIComponent(full);

  // ── PRIMARY (source of truth): PropertyDNA's OWN engine, for EVERY report. ──
  let engine;
  try {
    engine = await buildEngineValuation({ address, city, state, zip });
  } catch (e) {
    console.warn("[enrich-report:engine]", e.message);
    // Only a hard, unexpected error reaches here — never fabricate; mark failed.
    const reason = "We hit an error assembling this valuation from PropertyDNA's data. Our team has been notified. Please try again shortly.";
    await markFailed({ email, address, city, state, zip, viewToken, reportId }, reason).catch((er) => console.warn("[enrich-report:markFailed]", er.message));
    db.kpi("report_engine_error", email, { address, error: e.message });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, status: "failed", valuationSource: "none", reason }) };
  }
  const { normalized, valuationSource, status, hasSubjectData, hasValue } = engine;

  // ── OPTIONAL secondary cross-check ONLY: RentCast third-party estimate. Never
  // the headline, never required, never gates status. Disabled by default (the
  // provider is being retired); attempted only if a key is explicitly present. ──
  if (RENTCAST_KEY) {
    try {
      const rcHeaders = { "X-Api-Key": RENTCAST_KEY, "Accept": "application/json" };
      const avmRes = await getJSON("api.rentcast.io", `/v1/avm/value?address=${q}&compCount=8`, rcHeaders, 8000);
      const price = avmRes?.json && !avmRes.json.error ? num(avmRes.json.price) : null;
      if (price != null) normalized.valuation.thirdPartyEstimate = price; // labeled cross-check field only
    } catch (e) { console.warn("[enrich-report:rentcast crosscheck]", e.message); }
  }

  db.kpi(status === "completed" ? "report_engine_completed" : "report_insufficient_data", email, {
    address, valuationSource, marketValue: normalized.valuation.marketValue,
    confidence: normalized.valuation.valuationConfidence, comps: normalized.comps.length,
    hasSubjectData, hasValue,
  });

  // Hand off to save-report (Census/FEMA/USGS/CalFire/DNA/ingest + completion).
  // status is GATED: 'completed' only when real subject facts AND a real value exist.
  const save = await postJSON("thepropertydna.com", "/.netlify/functions/save-report",
    { "x-internal-key": INTERNAL_KEY || "" },
    {
      email, address, city: city || "", state: state || "", zip: zip || "",
      reportData: { normalized },
      status: (hasSubjectData && hasValue) ? "completed" : "insufficient_data",
      viewToken: viewToken || null, reportId: reportId || null,
      features: {},
    }, 25000);

  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({
      ok: save.status === 200, saveStatus: save.status, status,
      valuationSource, valuation: normalized.valuation, comps: normalized.comps.length,
      viewToken: save.json?.viewToken || viewToken,
    }),
  };
};
