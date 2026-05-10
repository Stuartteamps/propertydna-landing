/**
 * Sona Agent Control Endpoint
 *
 * Stores agent state in Supabase. Dan submits code/confirmation here.
 * Agent polls here to advance the workflow.
 *
 * Persisted in `sona_state` table (single row, id=1):
 *   { phase, code, confirm, message, updated_at }
 *
 * Phases:
 *   idle | awaiting_code | logging_in | filling | awaiting_publish_confirm
 *   | publishing | completed | cancelled | error
 */

const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
};

async function getState() {
  const rows = await db.from("sona_state").select("*").eq("id", 1).get().catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : { id: 1, phase: "idle", code: null, confirm: null, message: null };
}

async function setState(patch) {
  const current = await getState();
  const merged = { ...current, ...patch, id: 1, updated_at: new Date().toISOString() };
  await db.upsert("sona_state", merged, "id").catch(e => console.error("[sona-state upsert]", e.message));
  return merged;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  // Public read endpoint — agent and UI both poll this
  if (event.httpMethod === "GET") {
    const state = await getState();
    return { statusCode: 200, headers: CORS, body: JSON.stringify(state) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  // Internal-only — agent updates phase/message
  if (event.headers["x-internal-key"] === process.env.INTERNAL_API_KEY) {
    const state = await setState(body);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(state) };
  }

  // Public — Dan submitting code or confirmation word
  const { code, confirm } = body;
  const patch = {};
  if (code && /^\d{6}$/.test(String(code).trim())) patch.code = String(code).trim();
  if (confirm) patch.confirm = String(confirm).trim();

  if (!Object.keys(patch).length) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Provide a 6-digit code or confirmation word" }) };
  }

  const state = await setState(patch);
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, phase: state.phase }) };
};
