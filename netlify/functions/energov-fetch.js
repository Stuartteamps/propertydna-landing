/**
 * PropertyDNA — Resilient EnerGov Permit Fetcher
 *
 * Tries every known Tyler EnerGov API pattern for a given address.
 * When Tyler patches one endpoint, we fall back to the next.
 * Any successful result is cached in property_master (owned forever).
 *
 * Coachella Valley city portals:
 *   Palm Springs:    palmspringsca-energovweb.tylerhost.net
 *   Palm Desert:     palmdesertca-energovweb.tylerhost.net
 *   La Quinta:       laquintaca-energovweb.tylerhost.net
 *   Cathedral City:  cathedralcityca-energovweb.tylerhost.net
 *   Desert Hot Springs: dhsca-energovweb.tylerhost.net
 *   Rancho Mirage:   ranchomira-energovweb.tylerhost.net (may use Accela)
 *   Indian Wells:    indianwells-energovweb.tylerhost.net
 *
 * POST /.netlify/functions/energov-fetch
 * Body: { address, city, apn?, pin? }
 */

const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// City → EnerGov hostname mapping
const CITY_HOSTS = {
  "PALM SPRINGS":      "palmspringsca-energovweb.tylerhost.net",
  "PALM DESERT":       "palmdesertca-energovweb.tylerhost.net",
  "LA QUINTA":         "laquintaca-energovweb.tylerhost.net",
  "CATHEDRAL CITY":    "cathedralcityca-energovweb.tylerhost.net",
  "DESERT HOT SPRINGS":"deserhotspringsca-energovweb.tylerhost.net",
  "RANCHO MIRAGE":     "ranchomirageca-energovweb.tylerhost.net",
  "INDIAN WELLS":      "indianwellsca-energovweb.tylerhost.net",
  "INDIO":             "indioca-energovweb.tylerhost.net",
  "COACHELLA":         "coachellaca-energovweb.tylerhost.net",
};

// Endpoint patterns to try in order — when Tyler patches one we move to next
const ENDPOINT_PATTERNS = [
  // Pattern A: Modern SelfService search (v2 API)
  (host, address) => ({
    hostname: host,
    path: `/apps/api/energov/selfservice/search/permits?${new URLSearchParams({ keyword: address, limit: "20" })}`,
    method: "GET",
  }),
  // Pattern B: Older SelfService query (v1 API)
  (host, address) => ({
    hostname: host,
    path: `/apps/api/energov/permit?${new URLSearchParams({ address, pageSize: "20" })}`,
    method: "GET",
  }),
  // Pattern C: EnerGov REST resource
  (host, address) => ({
    hostname: host,
    path: `/EnerGov_Prod/SelfService/api/search?${new URLSearchParams({ q: address, module: "Permits", limit: "20" })}`,
    method: "GET",
  }),
  // Pattern D: CitizenAccess search endpoint (older Tyler deployments)
  (host, address) => ({
    hostname: host,
    path: `/CitizenAccess/Cap/CapHome.aspx?module=Permits&TabName=Permits`,
    method: "GET",
  }),
  // Pattern E: Direct address lookup
  (host, address) => ({
    hostname: host,
    path: `/apps/api/energov/selfservice/parcel/search?${new URLSearchParams({ address, f: "json" })}`,
    method: "GET",
  }),
];

function tryEndpoint(options, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const req = https.request({
      ...options,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": `https://${options.hostname}/apps/SelfService`,
      },
    }, (res) => {
      let raw = "";
      res.on("data", c => (raw += c));
      res.on("end", () => {
        if (res.statusCode === 403 || res.statusCode === 401 || res.statusCode === 429) {
          resolve({ blocked: true, statusCode: res.statusCode });
          return;
        }
        if (res.statusCode !== 200) {
          resolve({ failed: true, statusCode: res.statusCode });
          return;
        }
        try {
          const data = JSON.parse(raw);
          // Only count as success if it looks like permit data
          const items = data?.permits || data?.results || data?.items || data?.data || [];
          if (Array.isArray(items) && items.length > 0) {
            resolve({ success: true, statusCode: 200, data, permits: items });
          } else if (data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length > 2) {
            resolve({ success: true, statusCode: 200, data, permits: [] });
          } else {
            resolve({ failed: true, statusCode: 200, reason: "empty or unrecognized response" });
          }
        } catch {
          resolve({ failed: true, statusCode: 200, reason: "not JSON" });
        }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ failed: true, reason: "timeout" }); });
    req.on("error", () => resolve({ failed: true, reason: "connection error" }));
    req.end();
  });
}

function normalizePermits(rawPermits, host) {
  if (!Array.isArray(rawPermits)) return [];
  return rawPermits.map(p => {
    // EnerGov field names vary by version — try all known patterns
    const desc = p.description || p.workDescription || p.DESCRIPTION || p.work_description || "";
    const type = p.permitType || p.permit_type || p.type || p.PERMIT_TYPE || p.module || "";
    const num  = p.permitNumber || p.permit_number || p.recordNumber || p.PERMIT_NUM || p.id || "";
    const status = p.status || p.permitStatus || p.STATUS || "unknown";
    const applied = p.appliedDate || p.applied_date || p.fileDate || p.FILE_DATE || null;
    const issued  = p.issuedDate  || p.issued_date  || p.ISSUED_DATE || null;
    const finaled = p.finalDate   || p.final_date   || p.FINAL_DATE  || null;
    const value   = p.estimatedValue || p.estimated_value || p.jobValue || p.JOB_VALUE || null;

    // Map to our permit categories
    const category = classifyPermit(type, desc);

    return {
      permitNumber: num,
      type,
      description: desc,
      status,
      category,
      appliedDate: applied,
      issuedDate:  issued,
      finalDate:   finaled,
      estimatedValue: value ? parseFloat(String(value).replace(/[^0-9.]/g, "")) || null : null,
      source: host,
    };
  });
}

function classifyPermit(type, description) {
  const t = (type || "").toLowerCase();
  const d = (description || "").toLowerCase();
  if (d.includes("kitchen") || d.includes("bath") || d.includes("remodel") || t.includes("remodel") || t.includes("alteration")) return "remodel";
  if (d.includes("addition") || d.includes("adu") || d.includes("accessory dwelling")) return "addition";
  if (d.includes("pool") || d.includes("spa")) return "pool";
  if (d.includes("solar") || d.includes("pv ")) return "solar";
  if (d.includes("roof") || d.includes("hvac") || d.includes("mechanical") || d.includes("plumb") || d.includes("electrical")) return "mechanical";
  if (d.includes("new construction") || d.includes("new build") || t.includes("new")) return "new_construction";
  if (t.includes("demo")) return "demolition";
  return "general";
}

function permitValueAdjustments(permits) {
  const now = Date.now();
  const fiveYrs  = 5  * 365.25 * 24 * 3600 * 1000;
  const tenYrs   = 10 * 365.25 * 24 * 3600 * 1000;
  let remodels = 0, pools = 0, additions = 0, solar = 0, recentAny = 0;
  for (const p of permits) {
    const ms = p.appliedDate ? new Date(p.appliedDate).getTime() : 0;
    const age = ms > 0 ? now - ms : Infinity;
    if (p.category === "remodel"  && age < fiveYrs) remodels++;
    if (p.category === "pool"     && age < tenYrs)  pools++;
    if (p.category === "addition" && age < fiveYrs) additions++;
    if (p.category === "solar"    && age < tenYrs)  solar++;
    if (age < fiveYrs) recentAny++;
  }
  return {
    fullyRemodeled:  remodels >= 2,
    recentRemodel:   remodels > 0,
    recentPool:      pools > 0,
    recentAddition:  additions > 0,
    recentSolar:     solar > 0,
    recentPermits:   recentAny,
    totalPermits:    permits.length,
    estimatedValuePct: Math.min(20, remodels * 4 + pools * 5 + additions * 6 + solar * 2),
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const { address, city, apn, pin } = body;
  const cityKey = (city || "").toUpperCase().trim();

  if (!address) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "address required" }) };

  const host = CITY_HOSTS[cityKey];
  if (!host) {
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ found: false, reason: `No EnerGov portal mapped for city: ${city}`, cachedOnly: true }),
    };
  }

  // Check cache first — if we already have permit data, return it
  const cachePin = apn || pin;
  if (cachePin) {
    const cached = await db.from("property_master")
      .select("apn,energov_permits,energov_fetched_at")
      .eq("apn", cachePin)
      .limit(1)
      .get()
      .catch(() => []);
    if (Array.isArray(cached) && cached.length > 0 && cached[0].energov_permits) {
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ found: true, fromCache: true, permits: cached[0].energov_permits, fetchedAt: cached[0].energov_fetched_at }),
      };
    }
  }

  // Try each endpoint pattern until one works
  const attemptLog = [];
  let permits = [];
  let succeeded = false;
  let workingPattern = null;

  for (let i = 0; i < ENDPOINT_PATTERNS.length; i++) {
    const opts = ENDPOINT_PATTERNS[i](host, address);
    const result = await tryEndpoint(opts);
    attemptLog.push({ pattern: i + 1, path: opts.path, result: result.blocked ? "blocked" : result.success ? "success" : "failed", statusCode: result.statusCode });

    if (result.success) {
      permits = normalizePermits(result.permits, host);
      succeeded = true;
      workingPattern = i + 1;
      break;
    }
    if (result.blocked) break; // Cloudflare blocking — stop trying
  }

  const adjustments = permitValueAdjustments(permits);

  // Cache successful result in property_master
  if (succeeded && cachePin) {
    db.from("property_master")
      .eq("apn", cachePin)
      .update({
        energov_permits:    permits,
        energov_adjustments: adjustments,
        energov_fetched_at:  new Date().toISOString(),
        energov_pattern_used: workingPattern,
      })
      .catch(() => {});
  }

  // Log endpoint health for monitoring
  db.insert("energov_endpoint_log", {
    city:       cityKey,
    host,
    address:    address.slice(0, 100),
    succeeded,
    pattern_used: workingPattern,
    attempts:   attemptLog,
    permit_count: permits.length,
    logged_at:  new Date().toISOString(),
  }).catch(() => {});

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      found:          succeeded,
      city:           cityKey,
      host,
      permits,
      adjustments,
      patternUsed:    workingPattern,
      attemptLog,
      fromCache:      false,
    }),
  };
};

// Export helpers for use by index-properties
exports.classifyPermit = classifyPermit;
exports.permitValueAdjustments = permitValueAdjustments;
exports.CITY_HOSTS = CITY_HOSTS;
