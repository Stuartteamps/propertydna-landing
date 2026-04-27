/**
 * Called by n8n after a PropertyDNA report is generated.
 * Updates property_reports status and stores the report URL.
 *
 * n8n HTTP Request node:
 *   POST https://thepropertydna.com/.netlify/functions/save-report
 *   Headers: x-internal-key: $env.INTERNAL_API_KEY
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  // Verify internal key
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
  } = body;

  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email required" }) };

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Try to update an existing pending record first
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
        await db.from("property_reports")
          .eq("stripe_session_id", stripeSessionId)
          .update({
            report_url: reportUrl || null,
            report_pdf_url: reportPdfUrl || null,
            report_data: reportData || null,
            status,
            generation_error: generationError,
            n8n_request_id: n8nRequestId,
          });
        updated = true;
      }
    }

    // Insert new record if nothing to update
    if (!updated) {
      await db.insert("property_reports", {
        email: normalizedEmail,
        address: address || "",
        city: city || null,
        state: state || null,
        zip: zip || null,
        full_address: [address, city, state, zip].filter(Boolean).join(", "),
        report_url: reportUrl || null,
        report_pdf_url: reportPdfUrl || null,
        report_data: reportData || null,
        stripe_session_id: stripeSessionId || null,
        status,
        generation_error: generationError,
        n8n_request_id: n8nRequestId,
      });
    }

    // KPI
    if (status === "completed") {
      db.kpi("report_completed", normalizedEmail, { address, has_pdf: !!reportPdfUrl });
    } else if (status === "failed") {
      db.kpi("report_error", normalizedEmail, { address, error: generationError });
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ saved: true }) };
  } catch (err) {
    console.error("[save-report]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
