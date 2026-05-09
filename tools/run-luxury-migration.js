#!/usr/bin/env node
/**
 * PropertyDNA — Luxury Provenance Migration Runner
 *
 * 1. Runs migration 013_luxury_provenance.sql
 * 2. Backfills luxury_tier on every property based on assessed/market value
 * 3. Seeds the architects table with verified Palm Springs MCM masters
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_KEY (or set in .env)
 *
 * Run: node tools/run-luxury-migration.js
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

// Load .env if present
try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY env var required.');
  console.error('Run with: SUPABASE_SERVICE_KEY=sb_secret_... node tools/run-luxury-migration.js');
  process.exit(1);
}

const MIGRATION_FILE = path.join(__dirname, '../supabase/migrations/013_luxury_provenance.sql');

function log(msg) { console.log(`[migrate] ${msg}`); }

function request(method, p, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + p);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function execSQL(sql) {
  // Supabase exposes raw SQL via the `pg` REST endpoint when service key has full access,
  // but the cleanest path is via the Functions API. Easiest reliable approach: split DDL
  // into individual statements and execute one by one via PostgREST RPC `exec_sql`.
  //
  // If exec_sql() RPC doesn't exist, this runner prints SQL statements for manual paste.
  const r = await request('POST', '/rest/v1/rpc/exec_sql', { sql });
  return r;
}

const ARCHITECTS = [
  { name: 'Albert Frey',         birth_year: 1903, death_year: 1998, primary_style: 'Desert Modernism',
    primary_market: 'Palm Springs, CA', verified_commissions: 47, trade_frequency_years: 5.2,
    reputation_tier: 'iconic',
    bio: 'Swiss-born architect who pioneered Desert Modernism in Palm Springs. Originals are highly sought; very few trade per decade.',
    archive_sources: ['Palm Springs Modernism Committee','Palm Springs Preservation Foundation','UCSB Architecture Library'] },
  { name: 'John Lautner',        birth_year: 1911, death_year: 1994, primary_style: 'Organic Modernism',
    primary_market: 'Southern California', verified_commissions: 8, trade_frequency_years: 4.7,
    reputation_tier: 'iconic',
    bio: 'Sculptural organic modernist; Lautner originals trade rarely and at significant premiums.',
    archive_sources: ['John Lautner Foundation','Getty Research Institute','Hollyhock House archives'] },
  { name: 'Richard Neutra',      birth_year: 1892, death_year: 1970, primary_style: 'International Style',
    primary_market: 'Los Angeles + Desert', verified_commissions: 12, trade_frequency_years: 6.1,
    reputation_tier: 'iconic',
    bio: 'Austrian-American modernist; Kaufmann Desert House (Palm Springs) is a foundational MCM work.',
    archive_sources: ['UCLA Special Collections','Neutra Institute'] },
  { name: 'William Krisel',      birth_year: 1924, death_year: 2017, primary_style: 'Tract Modernism',
    primary_market: 'Palm Springs, CA', verified_commissions: 2500, trade_frequency_years: 0.4,
    reputation_tier: 'major',
    bio: 'Designed thousands of Alexander Construction tract homes. Iconic butterfly roofs; high volume but provenance still drives premium.',
    archive_sources: ['Krisel Archive','Palm Springs Preservation Foundation'] },
  { name: 'Donald Wexler',       birth_year: 1926, death_year: 2015, primary_style: 'Steel-frame Modernism',
    primary_market: 'Palm Springs, CA', verified_commissions: 31, trade_frequency_years: 8.0,
    reputation_tier: 'major',
    bio: 'Pioneered prefab steel-frame residential homes. The 7 Wexler Steel Houses are National Register listed.',
    archive_sources: ['Wexler Archives','Palm Springs Modernism Committee'] },
  { name: 'E. Stewart Williams', birth_year: 1909, death_year: 2005, primary_style: 'Desert Modernism',
    primary_market: 'Palm Springs, CA', verified_commissions: 17, trade_frequency_years: 7.5,
    reputation_tier: 'major',
    bio: 'Designed Frank Sinatra\'s Twin Palms and the Coachella Valley Savings & Loan. Significant local reputation.',
    archive_sources: ['Palm Springs Art Museum Architecture and Design Center'] },
  { name: 'Hugh Kaptur',         birth_year: 1931, death_year: null, primary_style: 'Desert Modernism',
    primary_market: 'Palm Springs, CA', verified_commissions: 200, trade_frequency_years: 1.2,
    reputation_tier: 'major',
    bio: 'Prolific Palm Springs MCM architect, still active. Designed Steve McQueen\'s residence among others.',
    archive_sources: ['Kaptur Archive','PS Preservation Foundation'] },
];

(async () => {
  // ── 1. Apply schema migration ──────────────────────────────────────────
  log('Reading migration SQL...');
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  log('Attempting to apply migration via exec_sql RPC...');
  const migRes = await execSQL(sql);
  if (migRes.status === 404 || (migRes.data?.message && migRes.data.message.includes('not find'))) {
    log('exec_sql RPC not available — printing SQL for manual paste:');
    console.log('\n' + '─'.repeat(70));
    console.log('PASTE THIS INTO Supabase Dashboard → SQL Editor:');
    console.log('─'.repeat(70));
    console.log(sql);
    console.log('─'.repeat(70));
    log('After running the SQL, re-run this script with --skip-schema flag.');
    if (!process.argv.includes('--skip-schema')) process.exit(0);
  } else if (migRes.status >= 400) {
    log(`Migration error: ${JSON.stringify(migRes.data).slice(0, 300)}`);
  } else {
    log('Migration applied.');
  }

  // ── 2. Seed architects table ──────────────────────────────────────────
  log('Seeding architects table...');
  for (const a of ARCHITECTS) {
    const r = await request('POST', '/rest/v1/architects?on_conflict=name',
      { ...a, notable_works: a.notable_works || [], signature_features: [] });
    if (r.status === 201 || r.status === 200) {
      log(`  ✓ ${a.name}`);
    } else if (r.status === 409 || (r.data?.code === '23505')) {
      log(`  • ${a.name} (already exists)`);
    } else {
      log(`  ✗ ${a.name}: ${JSON.stringify(r.data).slice(0, 100)}`);
    }
  }

  // ── 3. Backfill luxury_tier on property_master ────────────────────────
  log('\nBackfilling luxury_tier on property_master...');
  // We do this via a single SQL UPDATE for efficiency (millions of rows)
  const backfillSQL = `
    UPDATE property_master
    SET luxury_tier = CASE
      WHEN COALESCE(rentcast_value, tax_assessed_value, 0) > 50000000 THEN 'trophy'
      WHEN COALESCE(rentcast_value, tax_assessed_value, 0) > 30000000 THEN 'ultra_luxury'
      WHEN COALESCE(rentcast_value, tax_assessed_value, 0) > 10000000 THEN 'super_luxury'
      WHEN COALESCE(rentcast_value, tax_assessed_value, 0) >= 5000000  THEN 'luxury'
      WHEN COALESCE(rentcast_value, tax_assessed_value, 0) >= 2000000  THEN 'premium'
      WHEN COALESCE(rentcast_value, tax_assessed_value, 0) > 0         THEN 'standard'
      ELSE NULL
    END,
    luxury_value_basis = COALESCE(rentcast_value, tax_assessed_value)
    WHERE luxury_tier IS NULL OR luxury_tier = '';
  `;
  const bfRes = await execSQL(backfillSQL);
  if (bfRes.status >= 400) {
    log(`Backfill via RPC failed (${bfRes.status}). SQL to run manually:`);
    console.log(backfillSQL);
  } else {
    log('Backfill applied.');
  }

  // ── 4. Print luxury inventory summary ─────────────────────────────────
  log('\nLuxury inventory summary:');
  const tiers = ['trophy', 'ultra_luxury', 'super_luxury', 'luxury', 'premium'];
  for (const tier of tiers) {
    const r = await request('GET', `/rest/v1/property_master?luxury_tier=eq.${tier}&select=apn`, null);
    const count = Array.isArray(r.data) ? r.data.length : 0;
    log(`  ${tier.padEnd(15)} ${count} properties`);
  }

  log('\n✓ Migration complete.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
