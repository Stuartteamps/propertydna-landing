/**
 * ticker-backfill — Backfills the ticker column on property_master for any
 * rows that don't have one yet. Runs in batches to respect IO limits.
 *
 * Trigger manually (auth-gated) or via weekly cron.
 *
 *   curl -X POST https://thepropertydna.com/.netlify/functions/ticker-backfill \
 *        -H "x-internal-key: $INTERNAL_API_KEY" \
 *        -H "Content-Type: application/json" \
 *        -d '{"limit": 10000}'
 */
const db = require("./_supabase");
const { generateTicker } = require("./ticker-lookup");

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async (event) => {
  const internalKey = event.headers["x-internal-key"];
  if (!process.env.INTERNAL_API_KEY || internalKey !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const body = (() => { try { return JSON.parse(event.body || "{}"); } catch { return {}; } })();
  const limit = Math.min(50000, body.limit || 10000);

  const rows = await db.from("property_master")
    .select("apn,address_line1,state,zip")
    .is("ticker", "null").limit(limit).get().catch(() => []);

  if (!Array.isArray(rows) || rows.length === 0) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: "ok", updated: 0, remaining: 0, message: "All rows have tickers." }) };
  }

  let updated = 0;
  for (const row of rows) {
    const ticker = generateTicker({ state: row.state, zip: row.zip, apn: row.apn, address: row.address_line1 });
    await db.from("property_master").eq("apn", row.apn).update({ ticker }).catch(() => {});
    updated++;
    // Light pacing
    if (updated % 100 === 0) await new Promise(r => setTimeout(r, 50));
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ status: "ok", updated, batch_size: limit, ran_at: new Date().toISOString() }),
  };
};
