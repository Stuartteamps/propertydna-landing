const db = require("./_supabase");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
    // Fetch reports from property_reports table (new schema)
    const newReports = await db.from("property_reports")
      .select("id,email,address,city,state,zip,role,report_url,report_pdf_url,status,stripe_session_id,created_at")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(50)
      .get()
      .catch(() => []);

    // Fetch active subscription
    const subs = await db.from("subscriptions")
      .select("id,plan_name,status,current_period_end,cancel_at_period_end")
      .eq("email", normalizedEmail)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .get()
      .catch(() => []);

    let isSubscribed = false;
    let plan = null;
    let periodEnd = null;

    if (Array.isArray(subs) && subs.length > 0) {
      const sub = subs[0];
      const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
      if (!end || end > new Date()) {
        isSubscribed = true;
        plan = sub.plan_name;
        periodEnd = sub.current_period_end;
      }
    }

    // Fallback: check legacy reports table
    if (!isSubscribed) {
      const legacySubs = await db.from("reports")
        .select("property_dna")
        .eq("email", normalizedEmail)
        .eq("role", "SUBSCRIPTION")
        .get()
        .catch(() => []);

      if (Array.isArray(legacySubs)) {
        for (const row of legacySubs) {
          let meta = row.property_dna;
          if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { continue; } }
          if (meta && meta.status === "active") { isSubscribed = true; plan = meta.plan || "monthly"; break; }
        }
      }
    }

    // Normalize reports
    const reports = Array.isArray(newReports) ? newReports.map((r) => ({
      id: r.id,
      address: [r.address, r.city, r.state].filter(Boolean).join(", ") || "Unknown address",
      status: r.status || "completed",
      reportUrl: r.report_url || null,
      reportPdfUrl: r.report_pdf_url || null,
      createdAt: r.created_at,
    })) : [];

    // Log dashboard login KPI
    db.kpi("dashboard_login", normalizedEmail, { reportCount: reports.length, isSubscribed });

    // Log dashboard activity
    db.insert("dashboard_activity", {
      email: normalizedEmail,
      action: "dashboard_login",
      metadata: { report_count: reports.length, is_subscribed: isSubscribed },
    }).catch(() => {});

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ reports, isSubscribed, plan, periodEnd }),
    };
  } catch (err) {
    console.error("[get-reports]", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
