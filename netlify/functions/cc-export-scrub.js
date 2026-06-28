/**
 * cc-export-scrub — preserve the Constant Contact list before sunsetting CC.
 *
 * Pulls EVERY CC contact (email, name, phone, address, list memberships) and
 * scrubs each against our indexed homes (property_master) by normalized street
 * address. Contacts whose address matches an indexed property are tagged with
 * the APN + RentCast value, so the contact↔home linkage survives CC shutdown.
 *
 * GET /.netlify/functions/cc-export-scrub?key=INTERNAL_API_KEY
 *     &match=1            also match addresses against property_master (slower)
 *     &maxMatchMs=18000   time budget for matching before returning
 *
 * Returns: { total, withAddress, matched, contacts:[...] }. Save the JSON —
 * that IS the preserved, scrubbed list.
 */
const https = require("https");
const db = require("./_supabase");

const CC_API = "api.cc.email";
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
const SUPA_URL = process.env.SUPABASE_URL || "https://neccpdfhmfnvyjgyrysy.supabase.co";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";

function ccGet(path, token) {
  return new Promise((resolve) => {
    https.get({ hostname: CC_API, path, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }, (res) => {
      let raw = ""; res.on("data", (c) => (raw += c));
      res.on("end", () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: null }); } });
    }).on("error", () => resolve({ status: 0, data: null }));
  });
}

// PostgREST exact lookup of property_master rows by normalized street address.
function pmByAddresses(addrs) {
  return new Promise((resolve) => {
    const inList = addrs.map((a) => `"${a.replace(/"/g, '')}"`).join(",");
    const path = `/rest/v1/property_master?select=apn,address,city,state,rentcast_value&address=in.(${encodeURIComponent(inList)})`;
    https.get({ hostname: new URL(SUPA_URL).hostname, path, headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }, (res) => {
      let raw = ""; res.on("data", (c) => (raw += c));
      res.on("end", () => { try { resolve(JSON.parse(raw) || []); } catch { resolve([]); } });
    }).on("error", () => resolve([]));
  });
}

const normAddr = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\b(DRIVE|DR|AVENUE|AVE|STREET|ST|ROAD|RD|LANE|LN|COURT|CT|PLACE|PL|BOULEVARD|BLVD|CIRCLE|CIR|WAY|TERRACE|TER|TRAIL|TRL)\b/g, "").replace(/\s+/g, " ").trim();

async function getToken() {
  const rows = await db.from("oauth_tokens").select("access_token").eq("provider", "constant_contact").limit(1).get().catch(() => null);
  return rows?.[0]?.access_token || process.env.CC_ACCESS_TOKEN || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  const q = event.queryStringParameters || {};
  const key = q.key || event.headers["x-internal-key"];
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  }
  const doMatch = q.match === "1";
  const maxMatchMs = Math.min(parseInt(q.maxMatchMs || "18000", 10), 22000);
  const t0 = Date.now();

  const token = await getToken();
  if (!token) return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "no CC token" }) };

  // Debug: surface the raw first-page CC API status so we can tell an expired
  // token from an empty list.
  if (q.debug === "1") {
    const r = await ccGet("/v3/contacts?status=all&limit=5", token);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      tokenPresent: !!token, tokenLen: token.length,
      ccStatus: r.status,
      ccDataKeys: r.data ? Object.keys(r.data) : null,
      ccContactsCount: r.data && r.data.contacts ? r.data.contacts.length : null,
      ccSnippet: JSON.stringify(r.data).slice(0, 500),
    }, null, 2) };
  }

  // 1) Pull all CC contacts, paginated.
  const contacts = [];
  let path = "/v3/contacts?include=street_addresses,phone_numbers,list_memberships,custom_fields&status=all&limit=500";
  let pages = 0;
  while (path && pages < 60) {
    const r = await ccGet(path, token);
    if (r.status !== 200 || !r.data) break;
    for (const c of r.data.contacts || []) {
      const addr = (c.street_addresses && c.street_addresses[0]) || {};
      contacts.push({
        cc_id: c.contact_id,
        email: (c.email_address && c.email_address.address) || null,
        first_name: c.first_name || null,
        last_name: c.last_name || null,
        phone: (c.phone_numbers && c.phone_numbers[0] && c.phone_numbers[0].phone_number) || null,
        street: addr.street || null,
        city: addr.city || null,
        state: addr.state || null,
        zip: addr.postal_code || null,
        lists: c.list_memberships || [],
        matched_apn: null, matched_value: null,
      });
    }
    path = r.data._links && r.data._links.next && r.data._links.next.href ? r.data._links.next.href : null;
    pages++;
  }

  const withAddress = contacts.filter((c) => c.street);
  let matched = 0;

  // 2) Scrub against indexed homes (property_master) by normalized street.
  if (doMatch && withAddress.length) {
    // Build a lookup of normalized address -> contacts (multiple may share).
    const byNorm = new Map();
    for (const c of withAddress) {
      const n = normAddr(c.street);
      if (!n) continue;
      if (!byNorm.has(n)) byNorm.set(n, []);
      byNorm.get(n).push(c);
    }
    const norms = [...byNorm.keys()];
    // Build chunks of raw street addresses to look up.
    const CHUNK = 40;
    const chunks = [];
    for (let i = 0; i < norms.length; i += CHUNK) {
      const slice = norms.slice(i, i + CHUNK);
      chunks.push(slice.flatMap((n) => byNorm.get(n).map((c) => c.street)));
    }
    // Run lookups in parallel with a concurrency cap so all 2,285 finish within
    // the gateway budget (sequential was too slow and timed out partway).
    const CONCURRENCY = 12;
    const applyRows = (rows) => {
      for (const row of rows) {
        const n = normAddr(row.address);
        const hits = byNorm.get(n);
        if (hits) for (const c of hits) {
          if (!c.matched_apn) { c.matched_apn = row.apn; c.matched_value = row.rentcast_value || null; matched++; }
        }
      }
    };
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      if (Date.now() - t0 > maxMatchMs) break;
      const batch = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((c) => pmByAddresses(c)));
      results.forEach(applyRows);
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      ranAt: new Date().toISOString(),
      total: contacts.length,
      withAddress: withAddress.length,
      matched,
      matchRan: doMatch,
      elapsedMs: Date.now() - t0,
      contacts,
    }),
  };
};
