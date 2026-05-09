/**
 * Looks up a report by its secure view_token.
 * Checks both property_reports (new) and reports (legacy) tables.
 * No authentication required — the token is the access credential.
 *
 * GET /.netlify/functions/get-report-by-token?token=<view_token>
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const token = (event.queryStringParameters || {}).token;

  if (!token || token.length < 10) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid token" }) };
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Service not configured" }) };
  }

  try {
    // Check new property_reports table first
    const [newRows, legacyRows] = await Promise.all([
      db.from("property_reports")
        .select("id,email,address,city,state,zip,full_address,report_data,enrichment_data,view_token,status,created_at,apn")
        .eq("view_token", token)
        .limit(1)
        .get()
        .catch(() => []),
      db.from("reports")
        .select("id,email,address,full_name,role,property_dna,view_token,created_at")
        .eq("view_token", token)
        .limit(1)
        .get()
        .catch(() => []),
    ]);

    // Prefer new table
    if (Array.isArray(newRows) && newRows.length > 0) {
      const row = newRows[0];

      if (row.status === "pending" || row.status === "generating") {
        return {
          statusCode: 202,
          headers: CORS,
          body: JSON.stringify({ status: row.status, message: "Report is still being generated. Please check back in a moment." }),
        };
      }

      const fullAddress = row.full_address || [row.address, row.city, row.state].filter(Boolean).join(", ");

      // Parse report_data — n8n may have double-encoded it as a JSON string
      let dna = row.report_data || null;
      if (typeof dna === "string") {
        try { dna = JSON.parse(dna); } catch { dna = null; }
      }

      // No usable report data yet — treat as still generating
      const hasData = dna && typeof dna === "object" && (
        dna.normalized || dna.rating || dna.wouldWeBuyIt || dna.narrative
        || dna.sellerAngle || dna.buyerAngle || dna.dnaAdjusted
      );

      if (!hasData) {
        console.log("[get-report-by-token] report_data null or empty for token:", token?.slice(0, 8));
        return {
          statusCode: 202,
          headers: CORS,
          body: JSON.stringify({ status: "generating", message: "Your report is being generated. Please check back in a few minutes." }),
        };
      }

      const client = dna?.normalized?.client || {};
      const enrichment = row.enrichment_data || null;
      const mergedDna = enrichment ? { ...dna, enrichment } : dna;

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          id:           row.id,
          address:      fullAddress,
          full_name:    client.name || null,
          email:        row.email,
          role:         row.role || "Buyer",
          property_dna: mergedDna,
          created_at:   row.created_at,
          status:       row.status,
          apn:          row.apn || dna?.normalized?.property?.apn || null,
        }),
      };
    }

    // Fall back to legacy reports table
    if (Array.isArray(legacyRows) && legacyRows.length > 0) {
      const row = legacyRows[0];
      let dna = row.property_dna;
      if (typeof dna === "string") { try { dna = JSON.parse(dna); } catch { dna = {}; } }
      dna = dna || {};

      const fullAddress = row.address || dna?.normalized?.subject?.address || "";

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          id:           row.id,
          address:      fullAddress,
          full_name:    row.full_name || null,
          email:        row.email,
          role:         row.role || "Buyer",
          property_dna: dna,
          created_at:   row.created_at,
          status:       "completed",
        }),
      };
    }

    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Report not found" }) };
  } catch (err) {
    console.error("[get-report-by-token]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Internal error" }) };
  }
};
