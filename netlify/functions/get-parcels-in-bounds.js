/**
 * get-parcels-in-bounds — Returns indexed Coachella Valley parcels in a viewport
 *
 * POST { minLat, maxLat, minLon, maxLon, classCode? }
 * Returns up to 800 parcels with: apn, address, centroid (lat/lon), classCode,
 * yearBuilt, sqft, salePrice, conditionScore, renovationRatio
 *
 * Source: RivCo PARCELS_CREST (layer 50) — geometry-enabled
 * + property_history JSONB enrichment for our DNA scores when available
 *
 * Public-safe (no owner names, no skip-trace data, no contact info)
 */
const https = require("https");
const db = require("./_supabase");

const RIVCO_LAYER_50 = "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

function get(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { "User-Agent": "PropertyDNA/1.0" } }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
  });
}

// Compute polygon centroid from ArcGIS rings array
function centroid(rings) {
  if (!rings || !rings[0] || !rings[0].length) return null;
  const pts = rings[0];
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p[0]; sy += p[1]; }
  return { lon: +(sx / pts.length).toFixed(6), lat: +(sy / pts.length).toFixed(6) };
}

// Filter to residential class codes only — exclude commercial common areas, easements
const RESIDENTIAL_CLASS_PREFIX = ["S-", "MH", "MFR", "Single Family", "CO-", "Condo", "Townhouse"];
function isResidential(classCode) {
  if (!classCode) return false;
  const c = String(classCode);
  return RESIDENTIAL_CLASS_PREFIX.some(p => c.startsWith(p)) || c.toLowerCase().includes("residential") || c.toLowerCase().includes("single family") || c.toLowerCase().includes("condo");
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  // Allow both GET (query params) and POST
  let body = {};
  if (event.httpMethod === "POST") {
    try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  } else {
    body = event.queryStringParameters || {};
  }

  const minLat = parseFloat(body.minLat);
  const maxLat = parseFloat(body.maxLat);
  const minLon = parseFloat(body.minLon);
  const maxLon = parseFloat(body.maxLon);
  const limit = Math.min(parseInt(body.limit) || 800, 1500);
  const onlyResidential = body.residentialOnly !== "false" && body.residentialOnly !== false;

  if ([minLat, maxLat, minLon, maxLon].some(v => isNaN(v))) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "minLat,maxLat,minLon,maxLon required" }) };
  }

  // Reject too-large viewports (prevents abuse)
  if ((maxLat - minLat) > 0.25 || (maxLon - minLon) > 0.25) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Bounding box too large — zoom in" }) };
  }

  const envelope = { xmin: minLon, ymin: minLat, xmax: maxLon, ymax: maxLat, spatialReference: { wkid: 4326 } };
  const url = `${RIVCO_LAYER_50}?geometry=${encodeURIComponent(JSON.stringify(envelope))}&geometryType=esriGeometryEnvelope&inSR=4326&outFields=APN,SITUS_STREET,SITUS_CITY,STREET_NUMBER,CLASS_CODE,ZIP_CODE&returnGeometry=true&outSR=4326&f=json&resultRecordCount=${limit}`;

  const res = await get(url, 8000);
  if (!res || !Array.isArray(res.features)) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Upstream parcel service unavailable" }) };
  }

  // Build parcels with centroid
  let parcels = res.features.map(f => {
    const a = f.attributes || {};
    const c = centroid(f.geometry?.rings);
    if (!c) return null;
    if (onlyResidential && !isResidential(a.CLASS_CODE)) return null;
    const streetNum = a.STREET_NUMBER ? `${a.STREET_NUMBER} ` : "";
    return {
      apn: a.APN,
      address: a.SITUS_STREET ? `${streetNum}${a.SITUS_STREET}` : "",
      city:    a.SITUS_CITY || "",
      zip:     a.ZIP_CODE || "",
      classCode: a.CLASS_CODE,
      lat: c.lat,
      lon: c.lon,
    };
  }).filter(Boolean);

  // Enrich with our DNA scores from property_history (single batched query)
  if (parcels.length > 0) {
    const apns = parcels.map(p => String(p.apn).replace(/[^0-9]/g, "")).filter(Boolean);
    if (apns.length > 0) {
      try {
        const enriched = await db.from("property_history")
          .select("apn,data")
          .in("apn", apns.slice(0, 800))
          .eq("source", "rivco_assessor_crest")
          .limit(800)
          .get();
        const byApn = new Map();
        for (const row of (enriched || [])) {
          const apnNorm = String(row.apn).replace(/[^0-9]/g, "");
          if (!byApn.has(apnNorm)) byApn.set(apnNorm, row.data || {});
        }
        parcels = parcels.map(p => {
          const apnNorm = String(p.apn).replace(/[^0-9]/g, "");
          const d = byApn.get(apnNorm);
          if (!d) return p;
          return {
            ...p,
            sqft:            d.sqft || null,
            yearBuilt:       d.yearBuilt || null,
            assessedValue:   d.totalValue || null,
            improvValue:     d.improvValue || null,
            landValue:       d.landValue || null,
            conditionScore:  d.conditionScore || null,
            renovationRatio: d.renovationRatio || null,
            // Detected features without exposing the full object
            isRemodeled: !!(d.detectedFeatures?.fully_remodeled),
            hasUpdated:  !!(d.detectedFeatures?.updated),
            isOriginal:  !!(d.detectedFeatures?.original_condition),
          };
        });
      } catch { /* fall through with non-enriched data */ }
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      count: parcels.length,
      parcels,
      bbox: { minLat, maxLat, minLon, maxLon },
    }),
  };
};
