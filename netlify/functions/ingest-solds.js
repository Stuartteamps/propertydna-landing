/**
 * ingest-solds.js — bulk-ingest normalized MLS sold records into Supabase
 * `properties` so the valuation engine has more/better real comps and the
 * backtest more ground truth.
 *
 *   POST /.netlify/functions/ingest-solds
 *   Header: x-internal-key: $INTERNAL_API_KEY
 *   Body:   { "records": [ { mls_number, address, city, state, zip, apn,
 *                            last_sale_price, last_sale_date, sqft, beds, baths,
 *                            year_built, lot_sqft, unit, subdivision,
 *                            listing_source } , ... ] }
 *   Returns: { inserted, updated, skipped, errors }
 *
 * Dedup order: mls_number -> apn -> (address + city). ADDITIVE ONLY: an existing
 * row is only PATCHed for columns that are currently null/empty; a non-null value
 * is never overwritten with null. Requires the Supabase service key (deployed env).
 */
const db = require("./_supabase");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-key",
  "Content-Type": "application/json",
};

// Columns that live directly on `properties` (everything else -> mls_raw_data).
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
};
const int = (v) => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};
const str = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
const isEmpty = (v) => v === null || v === undefined || v === "";

// Normalize an incoming record into a `properties`-shaped row (null = unknown).
function shape(r) {
  const subdivision = str(r.subdivision);
  const raw = {};
  if (subdivision) raw.subdivision = subdivision;
  if (r.sold_price_sqft) raw.sold_price_sqft = num(r.sold_price_sqft);
  return {
    mls_number: str(r.mls_number),
    address: str(r.address),
    unit: str(r.unit),
    city: str(r.city),
    state: str(r.state) || "CA",
    zip: str(r.zip),
    apn: str(r.apn),
    beds: int(r.beds),
    baths: num(r.baths),
    sqft: int(r.sqft),
    lot_sqft: int(r.lot_sqft),
    year_built: int(r.year_built),
    last_sale_price: int(r.last_sale_price),
    last_sale_date: str(r.last_sale_date),
    listing_source: str(r.listing_source) || "mls_sold_export",
    mls_raw_data: Object.keys(raw).length ? raw : null,
  };
}

// Chunk helper
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function fetchExistingBy(column, values) {
  const map = new Map();
  const uniq = [...new Set(values.filter(Boolean))];
  for (const part of chunk(uniq, 100)) {
    let rows = [];
    try {
      rows = await db
        .from("properties")
        .select("id,mls_number,apn,address,city,state,zip,beds,baths,sqft,lot_sqft,year_built,last_sale_price,last_sale_date,unit,mls_raw_data,listing_source")
        .in(column, part)
        .get();
    } catch (e) {
      // continue — treat as not-found on error
    }
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const key = row[column];
        if (key != null && !map.has(String(key))) map.set(String(key), row);
      }
    }
  }
  return map;
}

const addrKey = (a, c) => `${String(a || "").toLowerCase().replace(/\s+/g, " ").trim()}|${String(c || "").toLowerCase().trim()}`;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };

  const key = event.headers["x-internal-key"] || event.headers["X-Internal-Key"];
  const expected = process.env.INTERNAL_API_KEY;
  if (expected && key !== expected) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  const records = Array.isArray(body.records) ? body.records : null;
  if (!records) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "records[] required" }) };

  // Shape + require at least an address and a sale price to be a useful comp.
  const shaped = records.map(shape).filter((r) => r.address && r.last_sale_price);
  const droppedInvalid = records.length - shaped.length;

  // Pre-fetch existing rows for dedup (mls_number, then apn).
  const byMls = await fetchExistingBy("mls_number", shaped.map((r) => r.mls_number));
  const byApn = await fetchExistingBy("apn", shaped.map((r) => r.apn));

  // Address fallback: fetch existing rows for records that matched neither.
  const needAddr = shaped.filter((r) => !(r.mls_number && byMls.has(r.mls_number)) && !(r.apn && byApn.has(r.apn)));
  const byAddr = new Map();
  if (needAddr.length) {
    const addrRows = await fetchExistingBy("address", needAddr.map((r) => r.address));
    for (const row of addrRows.values()) byAddr.set(addrKey(row.address, row.city), row);
  }

  const findExisting = (r) => {
    if (r.mls_number && byMls.has(r.mls_number)) return byMls.get(r.mls_number);
    if (r.apn && byApn.has(r.apn)) return byApn.get(r.apn);
    const ak = addrKey(r.address, r.city);
    if (byAddr.has(ak)) return byAddr.get(ak);
    return null;
  };

  const DIRECT = ["mls_number", "address", "unit", "city", "state", "zip", "apn", "beds", "baths", "sqft", "lot_sqft", "year_built", "last_sale_price", "last_sale_date", "listing_source"];

  const toInsert = [];
  const toUpdate = []; // { id, patch }
  let skipped = 0;
  const now = new Date().toISOString();
  // Track keys inserted in THIS request so intra-batch dupes don't double-insert.
  const seen = new Set();

  for (const r of shaped) {
    const existing = findExisting(r);
    if (!existing) {
      const dupeKey = r.mls_number ? `m:${r.mls_number}` : r.apn ? `p:${r.apn}` : `a:${addrKey(r.address, r.city)}`;
      if (seen.has(dupeKey)) { skipped++; continue; }
      seen.add(dupeKey);
      const row = { created_at: now, updated_at: now, mls_enrichment_status: "from_mls_sold_export" };
      for (const col of DIRECT) if (!isEmpty(r[col])) row[col] = r[col];
      if (r.mls_raw_data) row.mls_raw_data = r.mls_raw_data;
      toInsert.push(row);
      continue;
    }
    // ADDITIVE patch: only fill columns that are currently empty on the existing row.
    const patch = {};
    for (const col of DIRECT) {
      if (col === "listing_source") continue; // never rewrite provenance of an existing row
      if (!isEmpty(r[col]) && isEmpty(existing[col])) patch[col] = r[col];
    }
    // Merge subdivision into mls_raw_data without clobbering existing keys.
    if (r.mls_raw_data) {
      const cur = existing.mls_raw_data && typeof existing.mls_raw_data === "object" ? existing.mls_raw_data : {};
      const merged = { ...cur };
      let changed = false;
      for (const [k, v] of Object.entries(r.mls_raw_data)) {
        if (isEmpty(cur[k]) && !isEmpty(v)) { merged[k] = v; changed = true; }
      }
      if (changed) patch.mls_raw_data = merged;
    }
    if (Object.keys(patch).length) {
      patch.updated_at = now;
      toUpdate.push({ id: existing.id, patch });
    } else {
      skipped++;
    }
  }

  let inserted = 0, updated = 0;
  const errors = [];

  // Bulk insert (chunked).
  for (const part of chunk(toInsert, 100)) {
    try {
      const res = await db.insert("properties", part);
      inserted += Array.isArray(res) ? res.length : part.length;
    } catch (e) {
      // Fall back to per-row so one bad row doesn't sink the batch.
      for (const row of part) {
        try { await db.insert("properties", row); inserted++; }
        catch (e2) { errors.push(`insert ${row.address}: ${e2.message}`.slice(0, 200)); }
      }
    }
  }

  // Additive updates (per-row PATCH by id).
  for (const u of toUpdate) {
    try {
      await db.from("properties").eq("id", u.id).update(u.patch);
      updated++;
    } catch (e) {
      errors.push(`update ${u.id}: ${e.message}`.slice(0, 200));
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      received: records.length,
      droppedInvalid,
      inserted,
      updated,
      skipped,
      errors: errors.slice(0, 20),
    }),
  };
};
