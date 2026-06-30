/**
 * ingest-cma-solds.js — load parsed FlexMLS CMA solds into Supabase `properties`
 * so the production valuation engine has a real RentCast-free comp database.
 * Dedups on mls_number (skips existing). Run from repo root.
 */
const fs = require("fs");
const path = require("path");
const db = require("../../netlify/functions/_supabase");

const CSV = path.join(__dirname, "solds-from-cma.csv");
const num = (v) => { const n = parseFloat(String(v||"").replace(/[^0-9.]/g,"")); return isNaN(n)?null:n; };

(async () => {
  const lines = fs.readFileSync(CSV, "utf8").split("\n").filter(Boolean);
  const hdr = lines[0].split(",");
  const col = (name) => hdr.indexOf(name);
  const recs = lines.slice(1).map(l => {
    const c = l.split(",");
    return {
      mls_number: (c[col("mls")]||"").trim() || null,
      address: (c[col("address")]||"").trim(),
      city: (c[col("city")]||"").trim(),
      state: (c[col("state")]||"CA").trim(),
      last_sale_price: num(c[col("actual_price")]),
      last_sale_date: (c[col("sold_date")]||"").trim() || null,
      beds: num(c[col("beds")]),
      baths: num(c[col("baths")]),
      sqft: num(c[col("sqft")]),
      lot_sqft: num(c[col("lot_sqft")]),
      year_built: num(c[col("year_built")]),
      listing_source: "flexmls_cma",
    };
  }).filter(r => r.address && r.last_sale_price);

  // Skip rows already present by mls_number
  const existing = new Set();
  let off = 0;
  while (off < 20000) {
    const b = await db.from("properties").select("mls_number").eq("listing_source","flexmls_cma").range(off, off+999).get().catch(()=>[]);
    if (!Array.isArray(b) || !b.length) break;
    b.forEach(r => r.mls_number && existing.add(r.mls_number));
    off += b.length; if (b.length < 1000) break;
  }

  let inserted = 0, skipped = 0, failed = 0;
  for (const r of recs) {
    if (r.mls_number && existing.has(r.mls_number)) { skipped++; continue; }
    try { await db.insert("properties", { ...r, created_at: new Date().toISOString() }); inserted++; }
    catch (e) { failed++; if (failed <= 3) console.log("fail:", r.address, e.message); }
    if ((inserted+skipped+failed) % 200 === 0) console.log(`  ${inserted+skipped+failed}/${recs.length} (ins ${inserted}, skip ${skipped}, fail ${failed})`);
  }
  console.log(`DONE: ${recs.length} parsed | inserted ${inserted} | skipped(existing) ${skipped} | failed ${failed}`);
})();
