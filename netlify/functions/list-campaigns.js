/**
 * list-campaigns — Returns all campaigns ordered by created_at desc
 * GET — auth: x-internal-key
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const internalKey = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const campaigns = await db.from("campaigns")
      .select("id,name,type,status,subject,total_contacts,sent_count,opened_count,clicked_count,bounced_count,unsubscribed_count,launched_at,completed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .get();

    return { statusCode: 200, headers: CORS, body: JSON.stringify(campaigns || []) };
  } catch (err) {
    console.error("[list-campaigns]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
