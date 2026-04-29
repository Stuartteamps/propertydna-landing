/**
 * Called by n8n after a PropertyDNA report is generated.
 * Updates property_reports status, stores the report URL,
 * generates a secure view_token, and computes DNA adjusted valuation.
 *
 * n8n HTTP Request node:
 *   POST https://thepropertydna.com/.netlify/functions/save-report
 *   Headers: x-internal-key: $env.INTERNAL_API_KEY
 *
 * Response includes viewToken so n8n can pass it to send-report-email.
 */
const crypto = require("crypto");
const db = require("./_supabase");
const { ingestProperty } = require("./property-ingest");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

// DNA feature adjustments — mirrors valuation_feature_adjustments seed data
const DNA_ADJUSTMENTS = {
  waterfront:               { pct_low: 8,  pct_mid: 12, pct_high: 20 },
  lakefront:                { pct_low: 6,  pct_mid: 10, pct_high: 18 },
  golf_course:              { pct_low: 3,  pct_mid: 5,  pct_high: 9  },
  mountain_view:            { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  premium_community:        { pct_low: 3,  pct_mid: 6,  pct_high: 10 },
  fully_remodeled:          { pct_low: 5,  pct_mid: 8,  pct_high: 14 },
  updated:                  { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  original_condition:       { pct_low: -8, pct_mid: -5, pct_high: -2 },
  pool:                     { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  no_pool_desert_penalty:   { pct_low: -4, pct_mid: -2, pct_high: 0  },
  corner_lot:               { pct_low: -2, pct_mid: 0,  pct_high: 2  },
  oversized_lot:            { pct_low: 2,  pct_mid: 5,  pct_high: 10 },
  gated_community:          { pct_low: 2,  pct_mid: 4,  pct_high: 7  },
  short_term_rental_friendly: { pct_low: 3, pct_mid: 6, pct_high: 12 },
};

const FEATURE_LABELS = {
  waterfront: "Waterfront",
  lakefront: "Lakefront",
  golf_course: "Golf Course Adjacent",
  mountain_view: "Mountain View",
  premium_community: "Premium Community",
  fully_remodeled: "Fully Remodeled",
  updated: "Updated (Partial)",
  original_condition: "Original/Dated Condition",
  pool: "Pool",
  no_pool_desert_penalty: "No Pool (Desert Market)",
  corner_lot: "Corner Lot",
  oversized_lot: "Oversized Lot",
  gated_community: "Gated Community",
  short_term_rental_friendly: "STR Friendly Zone",
};

function computeDnaAdjustment(rawLow, rawMid, rawHigh, features = {}) {
  let totalLow = 0, totalMid = 0, totalHigh = 0;
  const drivers = [];

  for (const [key, active] of Object.entries(features)) {
    if (!active) continue;
    const adj = DNA_ADJUSTMENTS[key];
    if (!adj) continue;
    totalLow  += adj.pct_low;
    totalMid  += adj.pct_mid;
    totalHigh += adj.pct_high;
    drivers.push({
      key,
      label: FEATURE_LABELS[key] || key.replace(/_/g, " "),
      pct: adj.pct_mid,
    });
  }

  // Cap total adjustment at +/-35%
  totalLow  = Math.max(-35, Math.min(35, totalLow));
  totalMid  = Math.max(-35, Math.min(35, totalMid));
  totalHigh = Math.max(-35, Math.min(35, totalHigh));

  const apply = (base, pct) => (base ? Math.round(base * (1 + pct / 100)) : null);

  const featureCount = Object.values(features).filter(Boolean).length;
  const confidence = Math.max(0.55, 0.85 - featureCount * 0.03);

  return {
    adjLow:    apply(rawLow,  totalLow),
    adjMid:    apply(rawMid,  totalMid),
    adjHigh:   apply(rawHigh, totalHigh),
    rawLow,
    rawMid,
    rawHigh,
    confidence: Math.round(confidence * 100) / 100,
    drivers: drivers.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 5),
    totalPctMid: totalMid,
  };
}

// Extract raw valuation numbers from reportData
function extractValuation(reportData) {
  if (!reportData) return { low: null, mid: null, high: null };
  const val = reportData?.normalized?.valuation ?? {};
  const parse = (v) => {
    if (!v || v === "—") return null;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  };
  return {
    low: parse(val.low),
    mid: parse(val.marketValue),
    high: parse(val.high),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const {
    email, address, city, state, zip,
    reportUrl, reportPdfUrl, reportData,
    stripeSessionId, status = "completed",
    generationError = null, n8nRequestId = null,
    features = {},  // DNA feature flags from n8n
  } = body;

  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email required" }) };

  const normalizedEmail = email.toLowerCase().trim();
  const viewToken = crypto.randomUUID();

  // Compute DNA adjusted valuation if reportData is present
  let dnaAdjusted = null;
  let featureProfile = null;
  const hasFeatures = Object.values(features).some(Boolean);

  if (reportData) {
    const { low, mid, high } = extractValuation(reportData);
    if (low || mid || high) {
      dnaAdjusted = computeDnaAdjustment(low, mid, high, features);
      featureProfile = { low, mid, high, dnaAdjusted };
    }
  }

  // Merge DNA adjustment into reportData so the hosted view can render it
  let enrichedReportData = reportData;
  if (reportData && dnaAdjusted) {
    enrichedReportData = { ...reportData, dnaAdjusted };
  }

  try {
    let reportId = null;
    let updated = false;

    if (stripeSessionId) {
      const existing = await db.from("property_reports")
        .select("id")
        .eq("stripe_session_id", stripeSessionId)
        .eq("status", "pending")
        .limit(1)
        .get()
        .catch(() => []);

      if (Array.isArray(existing) && existing.length > 0) {
        reportId = existing[0].id;
        await db.from("property_reports")
          .eq("stripe_session_id", stripeSessionId)
          .update({
            report_url: reportUrl || null,
            report_pdf_url: reportPdfUrl || null,
            report_data: enrichedReportData || null,
            view_token: viewToken,
            status,
            generation_error: generationError,
            n8n_request_id: n8nRequestId,
          });
        updated = true;
      }
    }

    if (!updated) {
      const inserted = await db.insert("property_reports", {
        email: normalizedEmail,
        address: address || "",
        city: city || null,
        state: state || null,
        zip: zip || null,
        full_address: [address, city, state, zip].filter(Boolean).join(", "),
        report_url: reportUrl || null,
        report_pdf_url: reportPdfUrl || null,
        report_data: enrichedReportData || null,
        stripe_session_id: stripeSessionId || null,
        view_token: viewToken,
        status,
        generation_error: generationError,
        n8n_request_id: n8nRequestId,
      });
      if (Array.isArray(inserted) && inserted.length > 0) {
        reportId = inserted[0].id;
      }
    }

    // Store DNA feature profile if we have one
    if (reportId && featureProfile) {
      const { low, mid, high, dnaAdjusted: dna } = featureProfile;
      db.insert("property_feature_profiles", {
        report_id: reportId,
        address: [address, city, state].filter(Boolean).join(", ") || null,
        features,
        raw_low:   low,
        raw_mid:   mid,
        raw_high:  high,
        adj_low:   dna.adjLow,
        adj_mid:   dna.adjMid,
        adj_high:  dna.adjHigh,
        confidence: dna.confidence,
        drivers:   dna.drivers,
      }).catch((e) => console.warn("[dna profile]", e.message));
    }

    if (status === "completed") {
      db.kpi("report_completed", normalizedEmail, { address, has_pdf: !!reportPdfUrl, has_dna: !!dnaAdjusted });

      // Fire-and-forget: permanently map all report data into the sovereignty layer.
      // This is what makes PropertyDNA the source of truth over time.
      ingestProperty({
        reportData:  enrichedReportData,
        address,
        unit:        body.unit || null,
        city,
        state,
        zip,
        reportId,
        features,
        dnaAdjusted,
        email:       normalizedEmail,
      }).then(result => {
        if (result.propertyId) {
          db.kpi("property_mapped", normalizedEmail, {
            address,
            propertyId:   result.propertyId,
            permits:      result.permitsIngested,
            desirability: result.desirabilityScore,
          });
        }
      }).catch(e => console.warn("[save-report:ingest]", e.message));

    } else if (status === "failed") {
      db.kpi("report_error", normalizedEmail, { address, error: generationError });
    }

    const APP_BASE = process.env.APP_BASE_URL || "https://thepropertydna.com";

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        saved: true,
        reportId,
        viewToken,
        viewUrl: `${APP_BASE}/report/view/${viewToken}`,
        dnaAdjusted: dnaAdjusted || null,
      }),
    };
  } catch (err) {
    console.error("[save-report]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
