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

// Build the normalized object that save-report consumes, from RentCast AVM data.
function buildNormalized({ address, city, state, zip }, avm, props) {
  const subj = (avm && avm.subjectProperty) || (Array.isArray(props) ? props[0] : props) || {};
  const lat = num(avm?.latitude) ?? num(subj.latitude);
  const lon = num(avm?.longitude) ?? num(subj.longitude);
  const detail = (Array.isArray(props) && props[0]) || subj || {};

  const comps = (avm?.comparables || []).map((c) => ({
    rawPrice: num(c.price),
    price: num(c.price) != null ? "$" + Number(c.price).toLocaleString() : null,
    distance: c.distance,
    correlation: c.correlation,
    sqft: num(c.squareFootage),
    lat: num(c.latitude), lon: num(c.longitude),
    address: c.formattedAddress || c.addressLine1 || "",
    propertyType: c.propertyType || null,
  }));

  return {
    subject: {
      address, city: city || subj.city || null, state: state || subj.state || null,
      zip: zip || subj.zipCode || null, lat, lon,
      lastSalePrice: detail.lastSalePrice ?? null, lastSaleDate: detail.lastSaleDate ?? null,
    },
    valuation: { low: num(avm?.priceRangeLow), marketValue: num(avm?.price), high: num(avm?.priceRangeHigh) },
    property: {
      beds: detail.bedrooms ?? subj.bedrooms ?? null,
      baths: detail.bathrooms ?? subj.bathrooms ?? null,
      sqft: detail.squareFootage ?? subj.squareFootage ?? null,
      lotSize: detail.lotSize ?? subj.lotSize ?? null,
      yearBuilt: detail.yearBuilt ?? subj.yearBuilt ?? null,
      propertyType: detail.propertyType ?? subj.propertyType ?? null,
    },
    sale: { lastSalePrice: detail.lastSalePrice ?? null, lastSaleDate: detail.lastSaleDate ?? null },
    comps,
    listing: { remarks: "" },
    source: "enrich-report (in-house, n8n-free)",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL FALLBACK VALUATION (RentCast-independent)
//
// When RentCast is down (403 billing, timeout, network, or no-valuation) we must
// NOT leave the report stuck "pending". We assemble a valuation SEED from data we
// already own, in priority order, and hand it to save-report in the SAME shape
// the RentCast path produces — flagged `valuationSource: 'internal_fallback:*'`
// with a deliberately WIDER low/high range so save-report's accuracy/confidence
// math reports lower certainty than a live AVM.
//
//   A. property_master by address  — cached rentcast_value(+range) → tax_assessed
//   B. sold comps ($/sqft)         — `properties` recorded sales (pull-solds-rivco
//                                    writes these in lockstep with property_history
//                                    sale events; `properties` is the only place
//                                    with city+sqft+price together) then a
//                                    property_master city cohort for broad coverage
//   C. Riverside County CREST      — assessor last-sale (appreciated) / TOTAL_VALUE
//                                    for Coachella Valley addresses
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

// A2. Best-effort cached AVM from property_master via EXACT address equality
// (fast indexed lookup; ilike would time out). Often misses on address-format
// differences, but when it hits it yields the richest cached seed + range.
async function lookupPropertyMasterAvm({ address }) {
  const frag = streetFragment(address);
  if (!frag) return null;
  try {
    const rows = await db.from("property_master")
      .select("apn,address,city,state,zip,lat,lng,property_type,beds,baths,sqft,lot_sqft,year_built,rentcast_value,rentcast_value_low,rentcast_value_high,tax_assessed_value")
      .eq("address", frag).limit(1).get();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (e) {
    console.warn("[enrich-report:property_master avm]", e.message);
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
      .select("address,city,zip,sqft,last_sale_price,current_estimated_value,last_sale_date,latitude,longitude,property_type_normalized")
      .gte("last_sale_price", 50000).limit(250);
    if (city) q = q.ilike("city", city);
    else if (zip) q = q.eq("zip", zip);
    const rows = await q.get();
    if (Array.isArray(rows)) for (const r of rows) {
      const price = Number(r.last_sale_price) || Number(r.current_estimated_value) || null;
      const sqft = Number(r.sqft) || null;
      if (price && price > 50000) out.push({
        price, sqft: sqft && sqft > 200 ? sqft : null,
        address: r.address || null, lat: r.latitude ? Number(r.latitude) : null, lon: r.longitude ? Number(r.longitude) : null,
        date: r.last_sale_date || null, propertyType: r.property_type_normalized || null, src: "properties_sold",
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
              address: r.address || null, lat: r.lat ? Number(r.lat) : null, lon: r.lng ? Number(r.lng) : null,
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
function crestGet(where, timeoutMs = 15000) {
  const qs = new URLSearchParams({ f: "json", outFields: "*", returnGeometry: "false", where, resultRecordCount: "10" }).toString();
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
async function lookupCrest({ address, city }) {
  const frag = streetFragment(address).toUpperCase().replace(/'/g, "''");
  if (!frag) return null;
  const cityClause = city ? ` AND UPPER(SITUS_CITY) = '${String(city).toUpperCase().replace(/'/g, "''")}'` : "";
  let data = await crestGet(`UPPER(SITUS_ADDR) LIKE '${frag}%'${cityClause}`);
  let feat = data?.features?.[0]?.attributes;
  if (!feat && cityClause) { // retry without the city constraint
    data = await crestGet(`UPPER(SITUS_ADDR) LIKE '${frag}%'`);
    feat = data?.features?.[0]?.attributes;
  }
  return feat || null;
}

// Assemble the normalized seed. Returns { normalized, valuationSource } or null
// when no source can produce even a rough estimate (→ caller marks the report
// 'failed', never 'pending').
async function buildInternalFallback({ address, city, state, zip, props }) {
  const rcDetail = (Array.isArray(props) && props[0]) || null; // RentCast property detail may survive an AVM-only failure
  // Resolve the subject + a best-effort cached AVM in parallel (both fast/indexed).
  const [subj, master] = await Promise.all([
    lookupSubjectProperty({ address, city }),
    lookupPropertyMasterAvm({ address }),
  ]);

  // Best-available subject characteristics (mutable — CREST can backfill later).
  let subjSqft = pickNum(rcDetail, ["squareFootage"]) || pickNum(master, ["sqft"]) || pickNum(subj, ["sqft"]);
  let subjBeds = pickNum(rcDetail, ["bedrooms"]) || pickNum(master, ["beds"]) || pickNum(subj, ["beds"]);
  let subjBaths = pickNum(rcDetail, ["bathrooms"]) || pickNum(master, ["baths"]) || pickNum(subj, ["baths"]);
  let subjLot = pickNum(rcDetail, ["lotSize"]) || pickNum(master, ["lot_sqft"]) || pickNum(subj, ["lot_sqft"]);
  let subjYear = pickNum(rcDetail, ["yearBuilt"]) || pickNum(master, ["year_built"]) || pickNum(subj, ["year_built"]);
  let subjType = pickStr(rcDetail, ["propertyType"]) || pickStr(master, ["property_type"]) || pickStr(subj, ["property_type_normalized"]);
  let lat = pickNum(rcDetail, ["latitude"]) || pickNum(master, ["lat"]) || pickNum(subj, ["latitude"]);
  let lon = pickNum(rcDetail, ["longitude"]) || pickNum(master, ["lng"]) || pickNum(subj, ["longitude"]);
  const subjCity = city || pickStr(master, ["city"]) || pickStr(subj, ["city"]) || null;
  const subjState = state || pickStr(master, ["state"]) || pickStr(subj, ["state"]) || null;
  const subjZip = zip || pickStr(master, ["zip"]) || pickStr(subj, ["zip"]) || null;

  let marketValue = null, low = null, high = null, source = null, spread = 0.20;
  const sale = { lastSalePrice: null, lastSaleDate: null };
  // Carry the subject's last recorded sale (anchors save-report's valuation math).
  const subjLastSale = pickNum(subj, ["last_sale_price"]);
  const subjLastSaleDate = pickStr(subj, ["last_sale_date"]);
  if (subjLastSale) { sale.lastSalePrice = subjLastSale; sale.lastSaleDate = subjLastSaleDate; }

  // Fetch comps once — used for the $/sqft seed and always passed through for the map.
  const soldComps = await lookupSoldComps({ city: subjCity, zip: subjZip });

  // ── A. property_master cached AVM, then our own `properties` cached estimate ──
  if (master) {
    const rcVal = pickNum(master, ["rentcast_value"]);
    const rcLow = pickNum(master, ["rentcast_value_low"]);
    const rcHigh = pickNum(master, ["rentcast_value_high"]);
    const assessed = pickNum(master, ["tax_assessed_value"]);
    if (rcVal) {
      marketValue = rcVal; source = "internal_fallback:property_master_avm";
      low = rcLow && rcLow < rcVal ? rcLow : null;   // honor cached range if present
      high = rcHigh && rcHigh > rcVal ? rcHigh : null;
      spread = 0.16;
    } else if (assessed) {
      marketValue = assessed; source = "internal_fallback:property_master_assessed"; spread = 0.25;
    }
  }
  if (!marketValue && subj) {
    const est = pickNum(subj, ["current_estimated_value"]);
    if (est) { marketValue = est; source = "internal_fallback:properties_estimate"; spread = 0.18; }
    else if (subjLastSale) { marketValue = appreciate(subjLastSale, subjLastSaleDate); source = "internal_fallback:properties_last_sale"; spread = 0.22; }
  }

  // ── B. sold-comp $/sqft (only if A produced nothing) ─────────────────────────
  if (!marketValue) {
    const realSold = soldComps.filter((c) => c.src === "properties_sold");
    const pool = realSold.length >= 3 ? realSold : soldComps;
    const psf = medianPsf(pool);
    if (psf && subjSqft) {
      marketValue = Math.round(psf.psf * subjSqft);
      source = `internal_fallback:comps_psf_n${psf.n}`; spread = 0.22;
    } else {
      const mp = medianPrice(pool);
      if (mp) { marketValue = mp.price; source = `internal_fallback:comps_median_n${mp.n}`; spread = 0.28; }
    }
  }

  // ── C. Riverside County CREST assessor (CV addresses only) ───────────────────
  if (!marketValue && isCoachellaValley(subjCity, subjState)) {
    const feat = await lookupCrest({ address, city: subjCity });
    if (feat) {
      const lsa = Number(feat.LAST_SALE_AMOUNT) || null;
      const lsd = crestDate(feat.LAST_SALE_DATE);
      const total = Number(feat.TOTAL_VALUE) || null;
      if (lsa && lsa > 50000) {
        marketValue = appreciate(lsa, lsd); source = "internal_fallback:crest_sale"; spread = 0.20;
        sale.lastSalePrice = lsa; sale.lastSaleDate = lsd;
      } else if (total && total > 50000) {
        marketValue = total; source = "internal_fallback:crest_assessed"; spread = 0.25;
      }
      subjSqft = subjSqft || Number(feat.SQ_FT) || null;
      subjBeds = subjBeds || Number(feat.BEDROOMS) || null;
      subjBaths = subjBaths || Number(feat.BATHROOMS) || null;
      subjYear = subjYear || Number(feat.YEAR_BUILT) || null;
    }
  }

  if (!marketValue || marketValue < 10000) return null; // nothing usable → caller marks 'failed'

  if (low == null) low = Math.round(marketValue * (1 - spread));
  if (high == null) high = Math.round(marketValue * (1 + spread));

  const normalized = {
    subject: {
      address, city: subjCity, state: subjState, zip: subjZip, lat, lon,
      lastSalePrice: sale.lastSalePrice, lastSaleDate: sale.lastSaleDate,
    },
    valuation: { low, marketValue, high },
    property: {
      beds: subjBeds, baths: subjBaths, sqft: subjSqft, lotSize: subjLot,
      yearBuilt: subjYear, propertyType: subjType,
    },
    sale,
    comps: soldComps.slice(0, 12).map(toCompShape),
    listing: { remarks: "" },
    // Flags consumed by the UI + persisted in report_data for transparency.
    valuationSource: source,
    valuationConfidence: "low",
    confidenceNote: "Estimate generated from PropertyDNA's internal property index because the live AVM provider was temporarily unavailable. The wider value range reflects lower certainty than a standard report.",
    source: `enrich-report internal fallback (${source})`,
  };
  return { normalized, valuationSource: source };
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

  // ── PRIMARY: RentCast valuation+comps (only attempted when a key is present) ──
  let avm = null, props = null, avmStatus = 0;
  if (RENTCAST_KEY) {
    const rcHeaders = { "X-Api-Key": RENTCAST_KEY, "Accept": "application/json" };
    const [avmRes, propRes] = await Promise.all([
      getJSON("api.rentcast.io", `/v1/avm/value?address=${q}&compCount=8`, rcHeaders),
      getJSON("api.rentcast.io", `/v1/properties?address=${q}`, rcHeaders),
    ]);
    avmStatus = avmRes.status;
    avm = avmRes.json && !avmRes.json.error ? avmRes.json : null;
    props = Array.isArray(propRes.json) ? propRes.json : null;
  }

  // ── FALLBACK: when RentCast yields no valuation (403 billing, timeout, network,
  // no-valuation, or no key) build an INTERNAL seed so the report never hangs. ──
  let normalized, valuationSource;
  if (avm && avm.price != null) {
    normalized = buildNormalized({ address, city, state, zip }, avm, props);
    valuationSource = "rentcast";
  } else {
    console.warn(`[enrich-report] RentCast unavailable (avmStatus=${avmStatus}) — internal fallback for "${full}"`);
    const fb = await buildInternalFallback({ address, city, state, zip, props });
    if (!fb) {
      // No source produced even a rough seed → mark FAILED (never 'pending').
      const reason = "Valuation data is temporarily unavailable for this address. We couldn't generate an estimate from our internal property index, and our team has been notified. Please try again later.";
      await markFailed({ email, address, city, state, zip, viewToken, reportId }, reason).catch((e) => console.warn("[enrich-report:markFailed]", e.message));
      db.kpi("report_fallback_failed", email, { address, avmStatus });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, status: "failed", valuationSource: "none", reason }) };
    }
    normalized = fb.normalized;
    valuationSource = fb.valuationSource;
    db.kpi("report_internal_fallback", email, { address, valuationSource, avmStatus, marketValue: normalized.valuation.marketValue });
  }

  // Hand off to save-report (does Census/FEMA/USGS/CalFire/DNA/ingest + completion).
  const save = await postJSON("thepropertydna.com", "/.netlify/functions/save-report",
    { "x-internal-key": INTERNAL_KEY || "" },
    {
      email, address, city: city || "", state: state || "", zip: zip || "",
      reportData: { normalized },
      status: "completed",
      viewToken: viewToken || null, reportId: reportId || null,
      features: {},
    }, 25000);

  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({ ok: save.status === 200, saveStatus: save.status, valuationSource, valuation: normalized.valuation, comps: normalized.comps.length, viewToken: save.json?.viewToken || viewToken }),
  };
};
