const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BASE_URL = process.env.APP_BASE_URL || "https://thepropertydna.com";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { email } = body;
  if (!email || !email.includes("@")) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Valid email required" }) };

  if (!process.env.SUPABASE_SERVICE_KEY) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ reports: [], isSubscribed: false, plan: null }) };
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // ── Fetch from property_reports (new schema, has view_token) ──────
    const newReports = await db.from("property_reports")
      .select("id,email,address,city,state,zip,view_token,report_url,report_pdf_url,status,created_at")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(50)
      .get()
      .catch(() => []);

    // ── Fetch from legacy reports table (has property_dna, view_token may exist) ──
    const legacyReports = await db.from("reports")
      .select("id,address,email,property_dna,created_at")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(50)
      .get()
      .catch(() => []);

    // ── Subscription check ────────────────────────────────────────────
    const subs = await db.from("subscriptions")
      .select("id,plan_name,status,current_period_end")
      .eq("email", normalizedEmail)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .get()
      .catch(() => []);

    let isSubscribed = false;
    let plan = null;

    if (Array.isArray(subs) && subs.length > 0) {
      const sub = subs[0];
      const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
      if (!end || end > new Date()) { isSubscribed = true; plan = sub.plan_name; }
    }

    // Fallback subscription check from legacy reports table
    if (!isSubscribed && Array.isArray(legacyReports)) {
      for (const row of legacyReports) {
        let meta = row.property_dna;
        if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { continue; } }
        if (meta && meta.status === "active") { isSubscribed = true; plan = meta.plan || "monthly"; break; }
      }
    }

    // ── Normalise new reports ────────────────────────────────────────
    const newNorm = Array.isArray(newReports) ? newReports
      .filter(r => r.address || r.city)
      .map(r => {
        const addr = [r.address, r.city, r.state].filter(Boolean).join(", ") || "Property Report";
        const viewUrl = r.view_token
          ? `${BASE_URL}/report/view/${r.view_token}`
          : (r.report_url || null);
        return {
          id: r.id,
          address: addr,
          status: r.status || "completed",
          reportUrl: viewUrl,
          reportPdfUrl: r.report_pdf_url || null,
          createdAt: r.created_at,
          source: "property_reports",
        };
      }) : [];

    // ── Normalise legacy reports ─────────────────────────────────────
    const legacyNorm = Array.isArray(legacyReports) ? legacyReports
      .filter(r => {
        // Skip SUBSCRIPTION pseudo-records and records with no address
        if (!r.address) return false;
        let dna = r.property_dna;
        if (typeof dna === "string") { try { dna = JSON.parse(dna); } catch { return true; } }
        if (dna && dna.status === "active") return false; // subscription record
        return true;
      })
      .map(r => {
        let dna = r.property_dna;
        if (typeof dna === "string") { try { dna = JSON.parse(dna); } catch { dna = {}; } }
        // Try to build view URL from view_token inside dna or report URL
        const viewToken = dna?.viewToken || dna?.view_token || null;
        const viewUrl = viewToken
          ? `${BASE_URL}/report/view/${viewToken}`
          : `${BASE_URL}/report/${r.id}`;
        return {
          id: r.id,
          address: r.address || "Property Report",
          status: "completed",
          reportUrl: viewUrl,
          reportPdfUrl: null,
          createdAt: r.created_at,
          source: "reports",
        };
      }) : [];

    // ── Merge, dedupe by id, sort newest first ───────────────────────
    const seen = new Set();
    const allReports = [...newNorm, ...legacyNorm].filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // KPI
    db.kpi("dashboard_login", normalizedEmail, { reportCount: allReports.length, isSubscribed });
    db.insert("dashboard_activity", {
      email: normalizedEmail,
      action: "dashboard_login",
      metadata: { report_count: allReports.length, is_subscribed: isSubscribed },
    }).catch(() => {});

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ reports: allReports, isSubscribed, plan }),
    };
  } catch (err) {
    console.error("[get-reports]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
