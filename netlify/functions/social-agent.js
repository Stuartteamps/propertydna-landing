/**
 * social-agent — the autonomous Social Publisher.
 *
 * The "brain" on top of social-poster.js. On each (scheduled) run it:
 *   1. Picks a MOVEMENT angle (rotating — attraction, not promotion).
 *   2. Asks Claude to write platform-tailored posts that advance the mission:
 *      defend homebuyers from the data asymmetry built into real estate.
 *   3. mode=publish -> hands each caption to social-poster (auto-skips any
 *      platform without an OAuth token, so it's safe to run before OAuth).
 *      mode=draft   -> emails the week's content to Dan to review/post by hand.
 *
 * Deploy-now / light-up-later: ships in draft mode; after /admin/oauth is
 * granted, set env SOCIAL_AGENT_MODE=publish and it posts autonomously. No
 * code change needed.
 *
 * Scheduled (netlify.toml) OR POST with x-internal-key for manual runs.
 * Body (optional): { mode, angle, platforms }
 */
const https = require("https");
const db = require("./_supabase");

const APP_BASE = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const OWNER = process.env.OWNER_EMAIL || "stuartteamps@gmail.com";

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-internal-key" };

// ── The movement doctrine: attraction, not promotion ────────────────────────
// Each angle is a *reason to care*, not an ad. The product is the proof of the
// thesis, never the headline. Rotated so the feed reads like a cause.
const ANGLES = [
  { key: "expose",    brief: "Name one specific predatory pattern in real estate plainly (cherry-picked comps, an unfinaled permit hidden from a buyer, the buyer-agent incentive to close fast not negotiate hard, dual agency, inflated 'as-is' pricing). Show the buyer how to catch it. No product pitch — the data is the receipt." },
  { key: "educate",   brief: "Teach one concrete due-diligence skill a buyer can use this week (read a FEMA flood zone, check permit finalization, spot a comp that doesn't belong, read days-on-market games). Practical, specific, empowering." },
  { key: "manifesto", brief: "Advance the thesis: buying a home is the biggest financial decision most people make, yet the buyer has the least data in the room. State why that's wrong and why it's changing. This is the movement's 'why'. End with belonging, not a CTA." },
  { key: "proof",     brief: "Share a concrete, credibility-building proof point: we publish our valuation accuracy; a surprising (anonymized) real data finding; the breadth of sources we synthesize. Build trust through transparency." },
  { key: "rally",     brief: "Invite people into the movement. Ask them to demand transparency, share with someone about to buy, or run the data on their own home. Make them feel part of something — 'Save the humans.'" },
];

function pickAngle(i) { return ANGLES[((i % ANGLES.length) + ANGLES.length) % ANGLES.length]; }

// ── Claude ──────────────────────────────────────────────────────────────────
function callClaude(system, user, maxTokens = 1600) {
  const payload = JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_KEY) return reject(new Error("ANTHROPIC_API_KEY not set"));
    const req = https.request({ hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => {
        try { const j = JSON.parse(raw); resolve(j?.content?.[0]?.text || ""); } catch (e) { reject(new Error("claude_parse: " + raw.slice(0, 200))); } }); });
    req.on("error", reject); req.setTimeout(60000, () => { req.destroy(); reject(new Error("claude_timeout")); });
    req.write(payload); req.end();
  });
}

function extractJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no_json_in_model_output");
  return JSON.parse(m[0]);
}

// ── Resend (draft-mode email to Dan) ────────────────────────────────────────
function sendEmail(subject, html) {
  const key = process.env.RESEND_API_KEY; if (!key) return Promise.resolve({ skipped: true });
  const payload = JSON.stringify({ from: "PropertyDNA Social Agent <reports@thepropertydna.com>", to: OWNER, subject, html });
  return new Promise((resolve) => {
    const req = https.request({ hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => { let r = ""; res.on("data", c => r += c); res.on("end", () => resolve({ status: res.statusCode })); });
    req.on("error", () => resolve({ status: 0 })); req.write(payload); req.end();
  });
}

// ── Call sibling social-poster ──────────────────────────────────────────────
function postTo(platform, caption) {
  const payload = JSON.stringify({ platforms: [platform], caption, media_type: "text", source: "social-agent" });
  return new Promise((resolve) => {
    const req = https.request({ hostname: APP_BASE.replace(/^https?:\/\//, ""), path: "/.netlify/functions/social-poster", method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": process.env.INTERNAL_API_KEY || "", "Content-Length": Buffer.byteLength(payload) } },
      (res) => { let r = ""; res.on("data", c => r += c); res.on("end", () => { try { resolve(JSON.parse(r)); } catch { resolve({ _raw: r }); } }); });
    req.on("error", (e) => resolve({ error: e.message })); req.write(payload); req.end();
  });
}

const SYSTEM = `You are the PropertyDNA Social Agent. PropertyDNA gives people free, institutional-grade property intelligence — the same data the agent across the table already has (valuation, flood/fire/quake risk, permit history, comps, a buy/hold/walk verdict).

MISSION (never changes): save humans from asymmetric data. Real estate is rigged so the person with the most at stake has the least information. We flip that. We want the data on every home, in the hands of the humans who live in and buy them.

MOVEMENT: "Take Ownership of Housing." Rallying cry: "Save the humans." You are recruiting people into a cause, not selling an app.

YOU ARE A CLOSER. Every post earns exactly ONE clear next action (run your home's free report · claim your home · share with someone about to buy · demand transparency). Attraction first — value/truth/story that makes the action feel obvious and urgent — never a hard sell. The product is the proof of the thesis, never the headline.

VOICE: confident, plain-spoken, a little defiant on behalf of regular people. No corporate fluff, no hype words, no emoji spam (one tasteful emoji max).

You will be given an ANGLE. Write posts for that angle, tailored per platform:
- linkedin: 120-200 words, B2B-credible, a sharp insight or named pattern. One soft line at the end (e.g. "Free at thepropertydna.com").
- x: <=280 chars, punchy, quotable, one idea. A hook people want to repost.
- instagram: 80-150 words, story/emotion-forward, 8-12 relevant hashtags at the very end.
- facebook: 60-120 words, conversational, community-minded.

Also propose a "visual" concept (one sentence) for a designer/Canva.

Return ONLY valid JSON, no prose:
{"angle":"...","linkedin":"...","x":"...","instagram":"...","facebook":"...","visual":"..."}`;

exports.handler = async (event) => {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  // Auth: scheduled invocations carry next_run; manual HTTP needs the internal key.
  let body = {};
  try { body = JSON.parse((event && event.body) || "{}"); } catch {}
  const isScheduled = !!body.next_run || !(event && event.httpMethod);
  if (!isScheduled) {
    const k = event?.headers?.["x-internal-key"] || event?.headers?.["X-Internal-Key"];
    if (!process.env.INTERNAL_API_KEY || k !== process.env.INTERNAL_API_KEY)
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const mode = body.mode || process.env.SOCIAL_AGENT_MODE || "draft";

  // Rotate the angle by day-of-year so consecutive runs differ.
  const dayIdx = Math.floor(Date.now() / 86400000);
  const angle = body.angle ? (ANGLES.find(a => a.key === body.angle) || pickAngle(dayIdx)) : pickAngle(dayIdx);

  let content;
  try {
    const out = await callClaude(SYSTEM, `ANGLE: ${angle.key}\nBrief: ${angle.brief}\n\nWrite today's posts.`);
    content = extractJson(out);
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "generation_failed", detail: e.message }) };
  }

  const platforms = Array.isArray(body.platforms) && body.platforms.length ? body.platforms : ["linkedin", "x", "instagram", "facebook"];

  let outcome;
  if (mode === "publish") {
    const results = [];
    for (const p of platforms) {
      const caption = content[p] || content.linkedin;
      const r = await postTo(p, caption);
      results.push({ platform: p, result: r?.results?.[0] || r });
    }
    outcome = { mode, angle: angle.key, results };
  } else {
    // draft: email the week's content to Dan
    const block = (label, txt) => `<h3 style="font-family:Arial;margin:18px 0 4px;color:#1a1a1a;">${label}</h3><div style="font-family:Arial;white-space:pre-wrap;color:#333;background:#faf8f5;border:1px solid #eee;padding:12px;">${(txt||"").replace(/</g,"&lt;")}</div>`;
    const html = `<div style="max-width:640px;margin:0 auto;">
      <p style="font-family:Arial;color:#777;">PropertyDNA Social Agent · angle: <b>${angle.key}</b> · ${new Date().toISOString().slice(0,10)}</p>
      <p style="font-family:Arial;color:#444;">Draft mode (OAuth not granted yet). Review + post manually, or grant /admin/oauth and set SOCIAL_AGENT_MODE=publish to auto-post.</p>
      ${block("LinkedIn", content.linkedin)}${block("X / Twitter", content.x)}${block("Instagram", content.instagram)}${block("Facebook", content.facebook)}
      <h3 style="font-family:Arial;margin:18px 0 4px;">Visual concept</h3><div style="font-family:Arial;color:#555;">${content.visual||""}</div>
    </div>`;
    const er = await sendEmail(`📣 This week's PropertyDNA posts — ${angle.key}`, html);
    outcome = { mode, angle: angle.key, emailed: er.status === 200, content };
  }

  db.kpi("social_agent_run", null, { mode, angle: angle.key, platforms });
  return { statusCode: 200, headers: CORS, body: JSON.stringify(outcome) };
};
