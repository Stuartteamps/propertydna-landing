/**
 * Looks up a property_report by its secure view_token.
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
    const rows = await db.from("property_reports")
      .select("id,email,address,city,state,zip,full_address,role,report_data,view_token,status,created_at")
      .eq("view_token", token)
      .limit(1)
      .get();

    if (!Array.isArray(rows) || rows.length === 0) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Report not found" }) };
    }

    const row = rows[0];

    if (row.status === "pending" || row.status === "generating") {
      return {
        statusCode: 202,
        headers: CORS,
        body: JSON.stringify({ status: row.status, message: "Report is still being generated. Please check back in a moment." }),
      };
    }

    const fullAddress = row.full_address || [row.address, row.city, row.state].filter(Boolean).join(", ");
    const dna = row.report_data || {};
    const client = dna?.normalized?.client || {};

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        id:          row.id,
        address:     fullAddress,
        full_name:   client.name  || null,
        email:       row.email,
        role:        row.role     || "Buyer",
        property_dna: dna,
        created_at:  row.created_at,
        status:      row.status,
      }),
    };
  } catch (err) {
    console.error("[get-report-by-token]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Internal error" }) };
  }
};
