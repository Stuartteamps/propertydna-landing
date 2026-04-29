/**
 * Called on every OAuth sign-in to capture the user in our database.
 * Safe to call multiple times — upserts on email.
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "" };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: "" }; }

  const { email, fullName, avatarUrl, provider, supabaseUserId } = body;
  if (!email?.includes("@")) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email required" }) };

  const normalized = email.toLowerCase().trim();

  try {
    // Upsert profile — captures every OAuth user
    await db.upsert("profiles", {
      email: normalized,
      full_name: fullName || null,
      avatar_url: avatarUrl || null,
      auth_provider: provider || "unknown",
      supabase_user_id: supabaseUserId || null,
      last_login_at: new Date().toISOString(),
    }, "email").catch(() => {});

    // KPI event
    db.kpi("user_signin", normalized, {
      provider: provider || "unknown",
      full_name: fullName || null,
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("[upsert-profile]", err.message);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false }) }; // fail open
  }
};
