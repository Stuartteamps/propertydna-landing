// POST { accessToken } — authenticated user requests deletion of their own
// account. Verifies the access token belongs to a real Supabase session,
// then calls Supabase Admin to permanently delete the auth user and clears
// associated profile rows. Apple Guideline 5.1.1(v) requires this for any
// app that supports account creation.

const https = require("https");
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SUPA_URL = process.env.SUPABASE_URL || "https://neccpdfhmfnvyjgyrysy.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function getCurrentUser(accessToken) {
  return new Promise((resolve) => {
    const u = new URL(SUPA_URL + "/auth/v1/user");
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: "GET",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${accessToken}` },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try { resolve(JSON.parse(raw)); } catch { resolve(null); }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.end();
  });
}

function adminDeleteUser(userId) {
  return new Promise((resolve) => {
    const u = new URL(`${SUPA_URL}/auth/v1/admin/users/${userId}`);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: "DELETE",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("error", () => resolve({ status: 0, body: "" }));
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };

  if (!SERVICE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server misconfiguration" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const accessToken = body.accessToken || (event.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Missing access token" }) };
  }

  const user = await getCurrentUser(accessToken);
  if (!user || !user.id || !user.email) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired session" }) };
  }

  const email = String(user.email).toLowerCase().trim();
  const userId = user.id;

  // Delete the auth user (this is the primary action Apple requires).
  const del = await adminDeleteUser(userId);
  if (del.status >= 400) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to delete account", detail: del.body }) };
  }

  // Best-effort cleanup of related rows. Auth deletion is the authoritative
  // signal; if these calls fail we still report success because the user can
  // no longer sign back in.
  await Promise.allSettled([
    db.from("profiles").eq("email", email).delete(),
    db.from("subscriptions").eq("email", email).delete(),
  ]);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ deleted: true, email }),
  };
};
