/**
 * watch-list — Robinhood-style portfolio tracking for properties.
 *
 * GET    ?email=x@y.com            → list user's watched properties
 * POST   {email, address, city, state, zip, ...}  → add property to watch list
 * DELETE ?email=x@y.com&id=<uuid>  → remove from watch list
 * PATCH  {id, ...fields}           → update notify preferences / label
 *
 * On ADD, this fn pulls the current DNA score + estimated value for the
 * address and saves the baseline so future cron diffs can detect movement.
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    if (event.httpMethod === "GET") return await handleList(event);
    if (event.httpMethod === "POST") return await handleAdd(event);
    if (event.httpMethod === "DELETE") return await handleRemove(event);
    if (event.httpMethod === "PATCH") return await handleUpdate(event);
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  } catch (e) {
    console.error("[watch-list]", e.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};

async function handleList(event) {
  const email = (event.queryStringParameters?.email || "").toLowerCase().trim();
  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email required" }) };

  const rows = await db.from("watched_properties")
    .select("id,address,city,state,zip,dna_score_at_watch,dna_score_current,dna_score_last_change_at,estimated_value_at_watch,estimated_value_current,notify_on_score_change,notify_on_value_change,notify_threshold_pct,label,notes,created_at,updated_at")
    .eq("user_email", email)
    .order("updated_at", { ascending: false })
    .get()
    .catch(() => []);

  // Compute change deltas for the client
  const enriched = (rows || []).map(r => {
    const scoreDelta = (r.dna_score_current ?? 0) - (r.dna_score_at_watch ?? 0);
    const valueDelta = (r.estimated_value_current ?? 0) - (r.estimated_value_at_watch ?? 0);
    const valuePct = r.estimated_value_at_watch
      ? Math.round((valueDelta / r.estimated_value_at_watch) * 1000) / 10
      : null;
    return { ...r, score_delta: scoreDelta, value_delta: valueDelta, value_pct_change: valuePct };
  });

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ properties: enriched, count: enriched.length }) };
}

async function handleAdd(event) {
  const body = JSON.parse(event.body || "{}");
  const email = (body.email || "").toLowerCase().trim();
  const address = (body.address || "").trim();
  if (!email || !address) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email and address required" }) };
  }

  // Fetch current DNA score baseline (best-effort; ok if it returns nothing)
  let baseline = { dna_score: null, estimated_value: null, latitude: null, longitude: null, city: null, state: null, zip: null };
  try {
    const lookup = await fetch(`https://thepropertydna.com/.netlify/functions/property-query?address=${encodeURIComponent(address)}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    if (lookup) {
      const p = lookup.property || lookup;
      const v = lookup.valuation || p.valuation || {};
      baseline.dna_score = v.dna_score ?? null;
      baseline.estimated_value = v.estimate ?? p.current_estimated_value ?? null;
      baseline.latitude = p.latitude ?? null;
      baseline.longitude = p.longitude ?? null;
      baseline.city = body.city || p.city || null;
      baseline.state = body.state || p.state || null;
      baseline.zip = body.zip || p.zip || null;
    }
  } catch { /* baseline best-effort */ }

  const row = {
    user_email: email,
    address,
    city: body.city || baseline.city,
    state: body.state || baseline.state,
    zip: body.zip || baseline.zip,
    latitude: baseline.latitude,
    longitude: baseline.longitude,
    dna_score_at_watch: baseline.dna_score,
    dna_score_current: baseline.dna_score,
    estimated_value_at_watch: baseline.estimated_value,
    estimated_value_current: baseline.estimated_value,
    label: body.label || null,
    notes: body.notes || null,
    notify_on_score_change: body.notify_on_score_change !== false,
    notify_on_value_change: body.notify_on_value_change !== false,
    notify_threshold_pct: body.notify_threshold_pct ?? 5,
  };

  let result;
  try {
    result = await db.upsert("watched_properties", row, "user_email,address");
  } catch (e) {
    if (String(e.message).includes("duplicate") || String(e.message).includes("23505")) {
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: "Already watching this address" }) };
    }
    throw e;
  }

  const inserted = Array.isArray(result) && result[0] ? result[0] : row;
  db.kpi("watch_list_add", email, { address, baseline_score: baseline.dna_score });
  return { statusCode: 201, headers: CORS, body: JSON.stringify({ property: inserted }) };
}

async function handleRemove(event) {
  const email = (event.queryStringParameters?.email || "").toLowerCase().trim();
  const id = event.queryStringParameters?.id;
  if (!email || !id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email and id required" }) };

  await db.from("watched_properties").eq("id", id).eq("user_email", email).delete().catch(() => {});
  db.kpi("watch_list_remove", email, { property_id: id });
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ removed: true }) };
}

async function handleUpdate(event) {
  const body = JSON.parse(event.body || "{}");
  const email = (body.email || "").toLowerCase().trim();
  const id = body.id;
  if (!email || !id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email and id required" }) };

  const patch = {};
  ["label", "notes", "notify_on_score_change", "notify_on_value_change", "notify_threshold_pct"].forEach(k => {
    if (body[k] !== undefined) patch[k] = body[k];
  });
  if (Object.keys(patch).length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "no updatable fields" }) };
  }

  const updated = await db.from("watched_properties").eq("id", id).eq("user_email", email).update(patch);
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ property: Array.isArray(updated) ? updated[0] : updated }) };
}
