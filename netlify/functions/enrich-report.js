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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  const k = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (INTERNAL_KEY && k !== INTERNAL_KEY) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  if (!RENTCAST_KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "RENTCAST_API_KEY not set" }) };

  let body; try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }
  const { email, fullName, address, city, state, zip, role, viewToken, reportId } = body;
  if (!email || !address) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email and address required" }) };

  const full = [address, city, state, zip].filter(Boolean).join(", ");
  const q = encodeURIComponent(full);
  const rcHeaders = { "X-Api-Key": RENTCAST_KEY, "Accept": "application/json" };

  // RentCast: valuation+comps (primary) and property detail (best-effort).
  const [avmRes, propRes] = await Promise.all([
    getJSON("api.rentcast.io", `/v1/avm/value?address=${q}&compCount=8`, rcHeaders),
    getJSON("api.rentcast.io", `/v1/properties?address=${q}`, rcHeaders),
  ]);
  const avm = avmRes.json && !avmRes.json.error ? avmRes.json : null;
  const props = Array.isArray(propRes.json) ? propRes.json : null;

  if (!avm || avm.price == null) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "rentcast_no_valuation", rcStatus: avmRes.status }) };
  }

  const normalized = buildNormalized({ address, city, state, zip }, avm, props);

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
    body: JSON.stringify({ ok: save.status === 200, saveStatus: save.status, valuation: normalized.valuation, comps: normalized.comps.length, viewToken: save.json?.viewToken || viewToken }),
  };
};
