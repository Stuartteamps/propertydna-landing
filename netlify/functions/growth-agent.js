/**
 * growth-agent — the daily distribution engine.
 *
 * Every morning it generates fresh, ready-to-fire guerrilla content promoting the
 * free "is this listing overpriced?" checker (/price-check) — a Reddit value-post,
 * 3 tweet/X posts, and an Instagram caption — all in the PropertyDNA voice, on the
 * mission (defend humans from asymmetric pricing). NO personal name anywhere;
 * sender + reply-to are always PropertyDNA.
 *
 * Delivery: emails the day's kit to the owner ready to post. If social OAuth is
 * ever connected + SOCIAL_AGENT_MODE=publish, this is where auto-posting hooks in
 * (today: 0 tokens → email-only, which still runs the growth loop daily).
 *
 * Scheduled daily (netlify.toml). Also callable via HTTP with x-internal-key.
 */
const https = require("https");
const { callClaude, resendSend, OWNER, APP_BASE, db } = require("./_engage");
const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };

// Buffer bridge — posts to ALL your Buffer-connected platforms (X/FB/LinkedIn/IG)
// in one call, no Meta app review. Set BUFFER_ACCESS_TOKEN (+ optional
// BUFFER_PROFILE_IDS comma-list; if omitted we auto-fetch all your profiles).
function bufferGet(path) {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  return new Promise((resolve) => {
    https.get({ hostname: "api.bufferapp.com", path: `${path}${path.includes("?") ? "&" : "?"}access_token=${token}` }, (res) => {
      let r = ""; res.on("data", c => r += c); res.on("end", () => { try { resolve(JSON.parse(r)); } catch { resolve(null); } });
    }).on("error", () => resolve(null));
  });
}
async function bufferProfileIds() {
  if (process.env.BUFFER_PROFILE_IDS) return process.env.BUFFER_PROFILE_IDS.split(",").map(s => s.trim()).filter(Boolean);
  const profiles = await bufferGet("/1/profiles.json");
  return Array.isArray(profiles) ? profiles.map(p => p.id) : [];
}
function bufferPost(text, profileIds) {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  const form = `access_token=${encodeURIComponent(token)}&text=${encodeURIComponent(text)}&now=true&` +
    profileIds.map(id => `profile_ids[]=${encodeURIComponent(id)}`).join("&");
  const body = Buffer.from(form);
  return new Promise((resolve) => {
    const req = https.request({ hostname: "api.bufferapp.com", path: "/1/updates/create.json", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": body.length } },
      (res) => { let r = ""; res.on("data", c => r += c); res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(r) }); } catch { resolve({ status: res.statusCode }); } }); });
    req.on("error", () => resolve({ status: 0 })); req.write(body); req.end();
  });
}

// Path B — Meta DIRECT, free (no Buffer subscription). Posts text to your own
// Facebook Page feed via the Graph API. Needs META_PAGE_ACCESS_TOKEN + META_PAGE_ID
// (a long-lived Page token you generate once for your OWN page — no app review).
function metaPagePost(text) {
  const token = process.env.META_PAGE_ACCESS_TOKEN, pageId = process.env.META_PAGE_ID;
  if (!token || !pageId) return Promise.resolve({ status: 0, skipped: true });
  const form = `message=${encodeURIComponent(text)}&access_token=${encodeURIComponent(token)}`;
  const body = Buffer.from(form);
  return new Promise((resolve) => {
    const req = https.request({ hostname: "graph.facebook.com", path: `/v19.0/${pageId}/feed`, method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": body.length } },
      (res) => { let r = ""; res.on("data", c => r += c); res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(r) }); } catch { resolve({ status: res.statusCode }); } }); });
    req.on("error", () => resolve({ status: 0 })); req.write(body); req.end();
  });
}

const SYSTEM = `You are PropertyDNA's growth engine. Mission: defend home buyers from predatory pricing and asymmetric data by giving them the truth for free. The product to promote is the free, no-login tool at ${'{URL}'} — paste any home + asking price, get "overpriced by X%" judged against real recorded sales.

Write TODAY's distribution kit. Rules:
- Brand voice: PropertyDNA. NEVER use a personal name, agent name, phone, or DRE number. It is PropertyDNA speaking, not a person.
- Punchy, credible, a little rebellious ("the data your agent hoped you'd never see"). No hype, no emojis overload (max 1-2).
- Each piece must stand alone, feel fresh (vary the angle daily), and drive to the tool.

Return ONLY valid JSON, no prose, this exact shape:
{
 "reddit": {"title": "...", "body": "... (value-first, mentions the free tool once, invites feedback)"},
 "tweets": ["...", "...", "..."],
 "instagram": "caption with 3-5 hashtags",
 "angle": "one-line description of today's angle"
}`;

function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

exports.handler = async (event) => {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  let body = {}; try { body = JSON.parse((event && event.body) || "{}"); } catch {}
  const isScheduled = !!body.next_run || !(event && event.httpMethod);
  if (!isScheduled) { const k = event?.headers?.["x-internal-key"]; if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) }; }

  const url = `${APP_BASE}/price-check`;
  // Vary the daily angle so content never repeats.
  const angles = ["a real overpriced-listing example", "why Zillow's Zestimate misleads buyers", "the buyer-agent conflict of interest", "how to spot an inflated list price in 5 seconds", "a first-time-buyer protection angle", "the 'run it before you offer' habit", "luxury / trophy-home overpricing", "renting vs owning your home's data"];
  const dayIdx = (body.day != null ? Number(body.day) : (new Date().getUTCFullYear() * 366 + new Date().getUTCMonth() * 31 + new Date().getUTCDate())) % angles.length;
  const todaysAngle = angles[dayIdx];

  let kit;
  try {
    const raw = await callClaude(
      SYSTEM.replace("{URL}", url),
      `Today's angle: ${todaysAngle}. Tool URL: ${url}. Generate the JSON kit.`,
      1200
    );
    const jStart = raw.indexOf("{"), jEnd = raw.lastIndexOf("}");
    kit = JSON.parse(raw.slice(jStart, jEnd + 1));
  } catch (e) {
    kit = {
      reddit: { title: "Free tool: is a listing overpriced? (real sold comps, not Zillow)", body: `Built a free, no-login tool that values any home against real recorded sales and tells you if the asking price is inflated, and by how much. Coachella Valley is dialed in. Feedback welcome: ${url}` },
      tweets: [`Run any listing through this before you offer. It'll tell you if you're overpaying — free, no login. ${url}`],
      instagram: `Before you offer, know the truth. Free overpriced-check: ${url} #realestate #homebuying #propertydna`,
      angle: todaysAngle,
    };
  }

  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a1a1a;">
  <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B89355;">PropertyDNA · Daily Growth Kit</p>
  <h2 style="font-family:Georgia,serif;font-weight:400;">Today's angle: ${esc(kit.angle || todaysAngle)}</h2>
  <p style="color:#666;font-size:13px;">Copy-paste ready. Post the Reddit one first (highest intent), then a tweet + the IG caption with a real listing screenshot.</p>
  <h3 style="font-family:Georgia,serif;">Reddit</h3>
  <p style="font-weight:bold;">${esc(kit.reddit?.title)}</p>
  <p style="white-space:pre-wrap;background:#f7f5f1;padding:14px;border-radius:4px;">${esc(kit.reddit?.body)}</p>
  <h3 style="font-family:Georgia,serif;">X / Twitter</h3>
  ${(kit.tweets || []).map(t => `<p style="white-space:pre-wrap;background:#f7f5f1;padding:12px;border-radius:4px;">${esc(t)}</p>`).join("")}
  <h3 style="font-family:Georgia,serif;">Instagram</h3>
  <p style="white-space:pre-wrap;background:#f7f5f1;padding:12px;border-radius:4px;">${esc(kit.instagram)}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
  <p style="font-size:12px;color:#888;">Tool: <a href="${url}">${url}</a> · Connect a social account at ${APP_BASE}/admin/oauth to auto-post this daily.</p>
  </div>`;

  // "email" (default) = deliver kit to owner. "publish" = auto-post via Buffer to
  // all connected platforms (needs BUFFER_ACCESS_TOKEN) AND email the owner a copy.
  const mode = body.mode || process.env.GROWTH_AGENT_MODE || "email";
  let posted = 0; const channels = [];
  if (mode === "publish") {
    const post = (kit.tweets && kit.tweets[0]) || kit.instagram || `See if any listing is overpriced — free: ${url}`;
    const text = post.includes(url) ? post : `${post} ${url}`;
    // Path A — Buffer (all connected platforms in one call)
    if (process.env.BUFFER_ACCESS_TOKEN) {
      const ids = await bufferProfileIds();
      if (ids.length) { const r = await bufferPost(text, ids); if (r.status && r.status < 300) { posted += ids.length; channels.push(`buffer:${ids.length}`); } }
    }
    // Path B — Meta direct (free, your own FB Page)
    if (process.env.META_PAGE_ACCESS_TOKEN && process.env.META_PAGE_ID) {
      const r = await metaPagePost(text); if (r.status && r.status < 300) { posted += 1; channels.push("facebook"); }
    }
  }
  // Always email the owner the full kit (record + manual channels like Reddit).
  const r = await resendSend({ to: OWNER, from: "PropertyDNA Growth <reports@thepropertydna.com>", subject: `📈 Today's growth kit — ${kit.angle || todaysAngle}${posted ? ` (auto-posted: ${channels.join(", ")})` : ""}`, html });
  const emailed = r.status && r.status < 300 ? 1 : 0;
  // INTERNAL CONTENT CHANNEL: publish today's value-post to OUR OWN on-site feed
  // (/insights), stored in kpi_events (no external platform, no new table). This
  // is the fully-internal distribution surface — SEO-indexed content on our own
  // domain, growing daily, independent of any social platform.
  const slug = `${new Date().toISOString().slice(0, 10)}-${String(kit.angle || todaysAngle).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "")}`;
  db.kpi("growth_insight", null, {
    slug, title: kit.reddit?.title || kit.angle || todaysAngle,
    body: kit.reddit?.body || "", tweet: (kit.tweets && kit.tweets[0]) || "", url,
  });
  db.kpi("growth_agent_run", null, { angle: kit.angle || todaysAngle, mode, emailed, posted, channels, slug });
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, angle: kit.angle || todaysAngle, mode, emailed, posted, channels, published_insight: slug, kit }) };
};
