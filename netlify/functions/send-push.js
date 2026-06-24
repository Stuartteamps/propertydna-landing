/**
 * send-push — push dispatch (FCM). Backend scaffold for the Engagement OS.
 * POST { email, title, body, url }  (x-internal-key required)
 *
 * Sends to all device_tokens for the email via FCM. No-ops cleanly until the
 * app registers device tokens AND FCM_SERVER_KEY is set — "scaffold first,
 * light up later," same as social-poster. Agents can call this for native
 * alerts (e.g. Advocate critical) once tokens flow.
 */
const { sendPush } = require("./_engage");
const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  const k = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY)
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  let body = {}; try { body = JSON.parse(event.body || "{}"); } catch {}
  const { email, title, body: msg, url } = body;
  if (!email || !title) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email and title required" }) };
  const r = await sendPush(email, title, msg || "", url || "");
  return { statusCode: 200, headers: CORS, body: JSON.stringify(r) };
};
