/**
 * watch-list-diff — daily DNA-score + value-change diff cron.
 *
 * Runs every day at 13:00 UTC (6 AM PDT). For each watched property:
 *   1. Re-runs the DNA score lookup
 *   2. Compares current vs stored values
 *   3. If score or value moved beyond user threshold, emails the user
 *   4. Persists updated current values for tomorrow's diff
 *
 * Schedule: [functions."watch-list-diff"] schedule = "0 13 * * *"
 *
 * Idempotent — won't fire two alerts for the same change unless the
 * delta crosses threshold again in either direction.
 */
const https = require("https");
const db = require("./_supabase");

const SITE_BASE   = (process.env.APP_BASE_URL || "https://thepropertydna.com").replace(/\/$/, "");
const SENDER      = process.env.SENDER_EMAIL || "reports@thepropertydna.com";
const SENDER_NAME = process.env.SENDER_NAME  || "PropertyDNA";
const REPLY_TO    = process.env.REPLY_TO_EMAIL || "stuartteamps@gmail.com";

const COOLDOWN_HOURS = 20; // don't fire two alerts on the same property within 20h

// ── Resend ───────────────────────────────────────────────────────────────
function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Promise.resolve({ status: 0, error: "no_resend_key" });
  const payload = JSON.stringify({ from: `${SENDER_NAME} <${SENDER}>`, to, reply_to: REPLY_TO, subject, html, text });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: { _raw: raw } }); } });
    });
    req.on("error", err => resolve({ status: 0, data: { error: err.message } }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, data: { error: "timeout" } }); });
    req.write(payload);
    req.end();
  });
}

// ── DNA score lookup ─────────────────────────────────────────────────────
async function fetchDna(address) {
  return new Promise((resolve) => {
    const path = `/.netlify/functions/property-query?address=${encodeURIComponent(address)}`;
    https.get({ hostname: "thepropertydna.com", path, headers: { "Accept": "application/json", "User-Agent": "watch-list-diff/1.0" } }, (res) => {
      let raw = ""; res.on("data", c => raw += c);
      res.on("end", () => {
        try {
          const data = JSON.parse(raw);
          const p = data.property || data;
          const v = data.valuation || p.valuation || {};
          resolve({
            dna_score: v.dna_score ?? null,
            estimate:  v.estimate ?? p.current_estimated_value ?? null,
          });
        } catch { resolve({ dna_score: null, estimate: null }); }
      });
    }).on("error", () => resolve({ dna_score: null, estimate: null }))
      .setTimeout(8000);
  });
}

// ── Email template ───────────────────────────────────────────────────────
const fmtUSD = (n) => n == null ? "—" : n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${Math.round(n/1_000)}K` : `$${n.toLocaleString()}`;

function buildAlertEmail({ email, changes }) {
  const subject = changes.length === 1
    ? `${changes[0].address} — ${changes[0].score_delta != null ? `DNA ${changes[0].score_delta > 0 ? "↑" : "↓"} ${Math.abs(changes[0].score_delta)}` : `value ${changes[0].value_pct >= 0 ? "↑" : "↓"} ${Math.abs(changes[0].value_pct).toFixed(1)}%`}`
    : `${changes.length} watched properties moved overnight`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f7f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e0d8;">
<tr><td style="padding:32px 40px 16px;border-bottom:1px solid #e5e0d8;">
  <p style="margin:0;font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;">PropertyDNA · Watch List</p>
  <p style="margin:10px 0 0;font-size:22px;color:#1a1a1a;">${changes.length} ${changes.length === 1 ? "property" : "properties"} moved overnight</p>
</td></tr>
<tr><td style="padding:24px 40px 8px;">
  <p style="margin:0 0 18px;font-size:14px;color:#444;line-height:1.7;">Here's what shifted on your watch list while you slept:</p>
</td></tr>
${changes.map(c => `
<tr><td style="padding:14px 40px;border-top:1px solid #f0ece4;">
  <p style="margin:0 0 6px;font-size:17px;color:#1a1a1a;font-family:Georgia,serif;">${c.address}</p>
  ${c.score_delta != null && c.score_delta !== 0 ? `<p style="margin:0 0 4px;font-size:13px;color:${c.score_delta > 0 ? "#00cc77" : "#ff4444"};">
    DNA Score: ${c.score_was} → <strong>${c.score_now}</strong> (${c.score_delta > 0 ? "+" : ""}${c.score_delta})</p>` : ""}
  ${c.value_pct != null && Math.abs(c.value_pct) >= 0.1 ? `<p style="margin:0 0 4px;font-size:13px;color:${c.value_pct > 0 ? "#00cc77" : "#ff4444"};">
    Estimated value: ${fmtUSD(c.value_was)} → <strong>${fmtUSD(c.value_now)}</strong> (${c.value_pct > 0 ? "+" : ""}${c.value_pct.toFixed(1)}%)</p>` : ""}
  <p style="margin:8px 0 0;font-size:11px;"><a href="${SITE_BASE}/property-dna?address=${encodeURIComponent(c.address)}" style="color:#C9A84C;text-decoration:none;">Open report →</a></p>
</td></tr>`).join("")}
<tr><td style="padding:24px 40px;border-top:1px solid #e5e0d8;background:#faf8f5;">
  <p style="margin:0 0 8px;font-size:12px;color:#666;">Manage your watch list + alert thresholds at <a href="${SITE_BASE}/watch" style="color:#C9A84C;">thepropertydna.com/watch</a></p>
  <p style="margin:0;font-size:11px;color:#999;">PropertyDNA · save the humans</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `${changes.length} watched ${changes.length === 1 ? "property" : "properties"} moved overnight.`, "",
    ...changes.flatMap(c => [
      `📍 ${c.address}`,
      c.score_delta != null && c.score_delta !== 0 ? `   DNA Score: ${c.score_was} → ${c.score_now} (${c.score_delta > 0 ? "+" : ""}${c.score_delta})` : "",
      c.value_pct != null && Math.abs(c.value_pct) >= 0.1 ? `   Est. value: ${fmtUSD(c.value_was)} → ${fmtUSD(c.value_now)} (${c.value_pct > 0 ? "+" : ""}${c.value_pct.toFixed(1)}%)` : "",
      `   ${SITE_BASE}/property-dna?address=${encodeURIComponent(c.address)}`, "",
    ]).filter(Boolean),
    `Manage at ${SITE_BASE}/watch`,
  ].join("\n");

  return { subject, html, text };
}

// ── Main ─────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const dryRun = event?.queryStringParameters?.dry_run === "1";
  const now = Date.now();
  const cooldownCutoff = new Date(now - COOLDOWN_HOURS * 3600 * 1000).toISOString();

  // Pull all active watch list rows
  const rows = await db.from("watched_properties")
    .select("id,user_email,address,dna_score_at_watch,dna_score_current,estimated_value_at_watch,estimated_value_current,notify_on_score_change,notify_on_value_change,notify_threshold_pct,last_alerted_at")
    .limit(2000)
    .get()
    .catch(() => []);

  if (!Array.isArray(rows) || rows.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ status: "ok", scanned: 0, alerts: 0 }) };
  }

  // Group by user email; we'll batch alerts per user
  const byEmail = {};
  let scanned = 0, refreshed = 0;
  const updatePromises = [];

  for (const row of rows) {
    scanned++;
    const dna = await fetchDna(row.address);
    refreshed++;

    const scoreWas = row.dna_score_current ?? row.dna_score_at_watch;
    const scoreNow = dna.dna_score;
    const valueWas = row.estimated_value_current ?? row.estimated_value_at_watch;
    const valueNow = dna.estimate;

    const scoreDelta = (scoreNow != null && scoreWas != null) ? (scoreNow - scoreWas) : null;
    const valuePct = (valueNow != null && valueWas) ? ((valueNow - valueWas) / valueWas) * 100 : null;
    const threshold = row.notify_threshold_pct ?? 5;

    const scoreCross = row.notify_on_score_change && scoreDelta != null && Math.abs(scoreDelta) >= 5;
    const valueCross = row.notify_on_value_change && valuePct != null && Math.abs(valuePct) >= threshold;

    const cooldownClear = !row.last_alerted_at || row.last_alerted_at < cooldownCutoff;

    if ((scoreCross || valueCross) && cooldownClear) {
      if (!byEmail[row.user_email]) byEmail[row.user_email] = [];
      byEmail[row.user_email].push({
        address: row.address,
        score_was: scoreWas, score_now: scoreNow, score_delta: scoreCross ? scoreDelta : null,
        value_was: valueWas, value_now: valueNow, value_pct: valueCross ? valuePct : null,
        id: row.id,
      });
    }

    // Persist refreshed current values regardless of alert
    if (!dryRun && (scoreNow != null || valueNow != null)) {
      updatePromises.push(
        db.from("watched_properties").eq("id", row.id).update({
          dna_score_current:        scoreNow ?? row.dna_score_current,
          estimated_value_current:  valueNow ?? row.estimated_value_current,
          dna_score_last_change_at: scoreDelta != null && scoreDelta !== 0 ? new Date().toISOString() : row.dna_score_last_change_at,
        }).catch(() => {})
      );
    }

    // Light pacing — don't blow the property-query endpoint
    await new Promise(r => setTimeout(r, 50));
  }

  await Promise.all(updatePromises);

  // Send alerts
  let alertCount = 0;
  const sendPromises = [];
  for (const [email, changes] of Object.entries(byEmail)) {
    const tmpl = buildAlertEmail({ email, changes });
    if (dryRun) {
      console.log(`[dry-run] would alert ${email}: ${changes.length} changes`);
      alertCount++;
      continue;
    }
    sendPromises.push((async () => {
      const r = await sendEmail({ to: email, ...tmpl });
      if (r.status >= 200 && r.status < 300) {
        alertCount++;
        // Mark all affected rows so cooldown kicks in
        await Promise.all(changes.map(c =>
          db.from("watched_properties").eq("id", c.id).update({ last_alerted_at: new Date().toISOString() }).catch(() => {})
        ));
        db.kpi("watch_list_alert_sent", email, { changes: changes.length });
      } else {
        console.error("[watch-list-diff] alert failed", email, r.status, r.data);
      }
    })());
  }
  await Promise.all(sendPromises);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "ok", scanned, refreshed, alerts: alertCount, dry_run: dryRun, ran_at: new Date(now).toISOString() }),
  };
};
