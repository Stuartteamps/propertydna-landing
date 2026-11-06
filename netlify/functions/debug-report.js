/**
 * debug-report — owner-only diagnostic tool
 * Returns the raw database row for a given token or email so we can
 * see exactly what n8n saved and diagnose blank report issues.
 *
 * GET  /.netlify/functions/debug-report?token=<view_token>
 * GET  /.netlify/functions/debug-report?email=<email>&limit=5
 *
 * Requires: x-internal-key header (same key n8n uses)
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  // Auth check
  const key = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey) {
    // Fail closed — do not expose report rows when auth is not configured
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Not configured" }) };
  }
  if (key !== expectedKey) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const { token, email, limit = "3" } = event.queryStringParameters || {};

  try {
    if (token) {
      // Lookup by token
      const [newRows, legacyRows] = await Promise.all([
        db.from("property_reports")
          .select("id,email,address,status,view_token,n8n_request_id,created_at,report_data,enrichment_data")
          .eq("view_token", token)
          .limit(1)
          .get()
          .catch(() => []),
        db.from("reports")
          .select("id,email,address,view_token,created_at,property_dna")
          .eq("view_token", token)
          .limit(1)
          .get()
          .catch(() => []),
      ]);

      const newRow = Array.isArray(newRows) && newRows[0] ? newRows[0] : null;
      const legRow = Array.isArray(legacyRows) && legacyRows[0] ? legacyRows[0] : null;

      const diagnose = (row, table) => {
        if (!row) return null;
        const rd = row.report_data || row.property_dna;
        let parsed = rd;
        if (typeof rd === "string") { try { parsed = JSON.parse(rd); } catch { parsed = null; } }
        return {
          table,
          id: row.id,
          email: row.email,
          address: row.address,
          status: row.status,
          view_token: row.view_token,
          n8n_request_id: row.n8n_request_id,
          created_at: row.created_at,
          report_data_type: typeof rd,
          report_data_is_null: rd == null,
          report_data_keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
          has_normalized: !!(parsed?.normalized),
          has_rating: !!(parsed?.rating),
          has_narrative: !!(parsed?.narrative || parsed?.sellerAngle),
          has_dna_adjusted: !!(parsed?.dnaAdjusted),
          has_enrichment: !!(row.enrichment_data || parsed?.enrichment),
          report_data_preview: parsed
            ? JSON.stringify(parsed).slice(0, 500)
            : String(rd).slice(0, 200),
        };
      };

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          token,
          property_reports: diagnose(newRow, "property_reports"),
          legacy_reports:   diagnose(legRow, "reports"),
        }, null, 2),
      };
    }

    if (email) {
      // Lookup recent rows by email
      const rows = await db.from("property_reports")
        .select("id,email,address,status,view_token,n8n_request_id,created_at")
        .eq("email", email.toLowerCase().trim())
        .order("created_at", { ascending: false })
        .limit(Number(limit) || 3)
        .get()
        .catch(() => []);

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          email,
          count: Array.isArray(rows) ? rows.length : 0,
          rows: Array.isArray(rows) ? rows.map(r => ({
            id: r.id,
            address: r.address,
            status: r.status,
            view_token: r.view_token,
            n8n_request_id: r.n8n_request_id,
            created_at: r.created_at,
            view_url: r.view_token
              ? `https://thepropertydna.com/report/view/${r.view_token}`
              : null,
          })) : [],
        }, null, 2),
      };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Provide ?token=... or ?email=..." }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
