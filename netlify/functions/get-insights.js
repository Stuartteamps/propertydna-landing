/**
 * get-insights — serves the on-site "Market Truths" feed the growth-agent
 * publishes daily. Fully internal: reads growth_insight rows from kpi_events
 * (no new table, no external platform). Public read.
 */
const db = require("./_supabase");
const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  const rows = await db.from("kpi_events")
    .select("metadata,created_at")
    .eq("event_type", "growth_insight")
    .order("created_at", { ascending: false })
    .limit(60).get().catch(() => []);
  const seen = new Set();
  const insights = (Array.isArray(rows) ? rows : []).map(r => {
    const m = typeof r.metadata === "string" ? (() => { try { return JSON.parse(r.metadata); } catch { return {}; } })() : (r.metadata || {});
    return { slug: m.slug, title: m.title, body: m.body, tweet: m.tweet, date: (r.created_at || "").slice(0, 10) };
  }).filter(i => i.title && i.slug && !seen.has(i.slug) && seen.add(i.slug));
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, count: insights.length, insights }) };
};
