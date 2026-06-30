/**
 * crm-setup.js — stand up the `contacts` CRM table and (optionally) bulk-insert
 * a batch of contacts. Uses the service key. DDL goes through the exec_sql RPC
 * (same path run-luxury-migration.js uses); if that RPC is absent, returns the
 * DDL so it can be pasted in the Supabase SQL editor.
 *
 * POST /.netlify/functions/crm-setup?key=INTERNAL_API_KEY
 *   body: { create?: true, contacts?: [ {email,first_name,...,matched_apn,...} ] }
 */
const https = require("https");
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
const SUPA_URL = process.env.SUPABASE_URL || "https://neccpdfhmfnvyjgyrysy.supabase.co";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";

const DDL = `
create table if not exists contacts (
  id bigserial primary key,
  email text, first_name text, last_name text, phone text,
  address text, city text, state text, zip text,
  matched_apn text, assessed_value numeric, market_value numeric,
  beds numeric, sqft numeric, year_built integer,
  segment text, source text default 'cc_scrub',
  created_at timestamptz default now()
);
create index if not exists contacts_apn_idx on contacts(matched_apn);
create index if not exists contacts_value_idx on contacts(assessed_value desc);
create index if not exists contacts_email_idx on contacts(email);
`;

function req(method, path, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({ hostname: new URL(SUPA_URL).hostname, path, method,
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json",
        Prefer: "return=minimal", ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}) } },
      (res) => { let d=""; res.on("data",c=>d+=c); res.on("end",()=>{ try{resolve({status:res.statusCode,data:d?JSON.parse(d):null});}catch{resolve({status:res.statusCode,data:d});} }); });
    r.on("error",(e)=>resolve({status:0,err:e.message}));
    r.setTimeout(25000,()=>{r.destroy();resolve({status:0,err:"timeout"});});
    if (payload) r.write(payload); r.end();
  });
}

const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isFinite(n) && v !== "" && v != null ? n : null; };

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const key = q.key || event.headers["x-internal-key"];
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY)
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };

  let body = {}; try { body = JSON.parse(event.body || "{}"); } catch {}
  const out = { ok: true };

  // 1) Create the table via exec_sql RPC
  if (body.create) {
    const r = await req("POST", "/rest/v1/rpc/exec_sql", { sql: DDL });
    out.create = { status: r.status, exec_sql_works: r.status >= 200 && r.status < 300 };
    if (!out.create.exec_sql_works) { out.create.ddl_to_paste = DDL; out.create.note = "exec_sql RPC unavailable — paste DDL in Supabase SQL editor, then re-run with contacts."; }
  }

  // 2) Bulk insert contacts (PostgREST handles arrays natively)
  if (Array.isArray(body.contacts) && body.contacts.length) {
    const rows = body.contacts.map((c) => ({
      email: c.email || null, first_name: c.first_name || null, last_name: c.last_name || null,
      phone: c.phone || null, address: c.address || null, city: c.city || null,
      state: c.state || null, zip: c.zip || null, matched_apn: c.matched_apn || c.apn || null,
      assessed_value: num(c.assessed_value), market_value: num(c.market_value),
      beds: num(c.beds), sqft: num(c.sqft), year_built: num(c.year_built),
      segment: c.segment || null, source: c.source || "cc_scrub",
    }));
    const ins = await req("POST", "/rest/v1/contacts", rows);
    out.insert = { status: ins.status, attempted: rows.length, ok: ins.status >= 200 && ins.status < 300, err: ins.data && ins.data.message ? ins.data.message : undefined };
  }
  return { statusCode: 200, headers: CORS, body: JSON.stringify(out, null, 2) };
};
