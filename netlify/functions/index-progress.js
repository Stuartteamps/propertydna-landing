/**
 * index-progress — live progress report for every indexer "agent".
 *
 * Each indexer checkpoints its position to kpi_events under an
 * "<x>_index_progress" event_type with metadata { nextOffset, total, done }.
 * This aggregates the latest checkpoint per target into a measurable-goal
 * report: how far each agent is toward its parcel total, and the overall
 * catch-up percentage. Pairs with run-all-indexers (the driver) and
 * index-stats (the authoritative grand total).
 *
 * Public read (progress counts aren't sensitive):
 *   GET /.netlify/functions/index-progress
 *   → { ok, agents, totalProgressed, totalTarget, overallPct, indexers:[...] }
 */
const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60",
};

const n = (v) => { const x = Number(v); return isNaN(x) ? null : x; };

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  let rows;
  try {
    // All *_index_progress checkpoints, newest first; we keep the latest per target.
    rows = await db.from("kpi_events")
      .select("event_type,email,metadata,created_at")
      .like("event_type", "*index_progress")
      .order("created_at", { ascending: false })
      .limit(3000)
      .get();
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: `query failed: ${e.message}` }) };
  }

  const seen = new Set();
  const indexers = [];
  let totalProgressed = 0;
  let totalTarget = 0;

  for (const r of (Array.isArray(rows) ? rows : [])) {
    const id = `${r.event_type}|${r.email || ""}`;
    if (seen.has(id)) continue;   // keep only the newest checkpoint per target
    seen.add(id);

    const m = r.metadata || {};
    const offset = n(m.nextOffset) ?? n(m.offset) ?? 0;
    const total = n(m.total);
    const done = !!m.done;
    indexers.push({
      agent: r.event_type.replace(/_?index_progress$/, "") || r.event_type,
      target: r.email || null,                       // e.g. "nc_county:Buncombe", "city:PHOENIX"
      progressed: offset,
      total,
      done,
      pct: total ? Math.min(100, Math.round((offset / total) * 100)) : null,
      updatedAt: r.created_at,
    });
    totalProgressed += offset || 0;
    if (total) totalTarget += total;
  }

  // Sort: not-done first, then by lowest pct (what needs attention floats up).
  indexers.sort((a, b) => (a.done === b.done ? (a.pct ?? 0) - (b.pct ?? 0) : a.done ? 1 : -1));

  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({
      ok: true,
      agents: indexers.length,
      totalProgressed,
      totalTarget: totalTarget || null,
      overallPct: totalTarget ? Math.min(100, Math.round((totalProgressed / totalTarget) * 100)) : null,
      indexers,
    }),
  };
};
