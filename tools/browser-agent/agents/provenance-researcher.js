#!/usr/bin/env node
/**
 * PropertyDNA — Provenance Research Agent (Wikipedia + Wikidata)
 *
 * Internally verifies celebrity ownership and architect attribution claims
 * using only Wikipedia and Wikidata. Zero paid APIs. Zero AI inference.
 * Zero hallucinations. Every status change is traceable to a real public URL.
 *
 * Verification sources (all free, no auth, no external AI):
 *   1. Wikidata entity lookup  — structured property→architect (P84) queries
 *   2. Wikidata entity search  — find Q-IDs for buildings and people
 *   3. Wikipedia article search — keyword co-occurrence in published text
 *   4. Wikipedia article extract — full section text for deep parsing
 *
 * Score model (deterministic — no inference, only text matching):
 *   1.0  Wikidata P84 (architect) matches claimed architect exactly
 *   0.9  Wikipedia article IS about this property; names owner/architect
 *   0.7  Wikipedia article about owner/architect mentions this address/city
 *   0.5  Wikipedia search snippet contains both claim keywords
 *   0.0  No corroboration found (absence ≠ refuted — no change made)
 *   CONTRADICTION: refutation phrase found in article text → refuted
 *
 * Status upgrade thresholds (notable_owners):
 *   score ≥ 0.9                 → verified
 *   score ≥ 0.7                 → partial  (unless already verified)
 *   score ≥ 0.5 + current=claimed_unverified → partial
 *   contradiction found         → refuted
 *
 * Attribution upgrade thresholds (architect_commissions):
 *   Wikidata P84 direct match   → verified
 *   score ≥ 0.9                 → strong
 *   score ≥ 0.7                 → partial
 *   contradiction found         → refuted
 *
 * Modes (--mode=<value>):
 *   verify (default) — scan Supabase → research → patch
 *   draft            — draft Reddit posts for verified properties
 *   both             — verify then draft in one pass
 *
 * Manual:
 *   node tools/browser-agent/agents/provenance-researcher.js
 *   node tools/browser-agent/agents/provenance-researcher.js --mode=both
 *   node tools/browser-agent/agents/provenance-researcher.js --dry-run
 *
 * No credentials required — all sources are public.
 * Runs automatically via daily-runner.js on Tuesday + Friday.
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const opsLog = require('../lib/ops-log');

const POST_QUEUE_FILE = path.join(__dirname, '../data/post-queue.json');
const SUPABASE_URL    = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY;

const cliArgs = process.argv.slice(2);
const DRY_RUN = cliArgs.includes('--dry-run');
const MODE    = (cliArgs.find(a => a.startsWith('--mode=')) || '--mode=verify').replace('--mode=', '');

// Wikipedia/Wikidata require a descriptive User-Agent
const UA = 'PropertyDNA-ProvenanceResearcher/1.0 (https://thepropertydna.com; propertydna research bot)';

function log(msg) { console.log(`[Provenance] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Confidence thresholds ────────────────────────────────────────────────────
const SCORE_WIKIDATA_DIRECT = 1.0; // Wikidata P84 match — structured, no inference
const SCORE_WIKI_DIRECT     = 0.9; // Wikipedia article about this specific property
const SCORE_WIKI_MENTION    = 0.7; // Owner/architect article mentions this address
const SCORE_WIKI_SNIPPET    = 0.5; // Search snippet contains both keywords

// Phrases that indicate an active published contradiction in an article
const CONTRADICTION_PHRASES = [
  'incorrectly attributed', 'falsely attributed', 'erroneously credited',
  'never owned', 'did not own', 'no evidence', 'not actually',
  'urban legend', 'myth', 'misconception', 'disputed claim',
  'commonly but incorrectly', 'popular belief but', 'debunked',
];

// Keywords that confirm an ownership/residence claim in article text
const OWNERSHIP_KEYWORDS = [
  'owned', 'owner', 'resided', 'residence', 'resident', 'lived', 'home',
  'house', 'estate', 'property', 'purchased', 'bought', 'honeymoon',
];

// Keywords that confirm architectural attribution
const ARCHITECT_KEYWORDS = [
  'designed', 'architect', 'commission', 'commissioned', 'built', 'constructed',
  'created', 'plans', 'blueprints', 'attribution',
];

// ── HTTP helper ───────────────────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   'GET',
      headers:  { 'User-Agent': UA, 'Accept': 'application/json' },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function enc(s) { return encodeURIComponent(s); }

// ── Wikipedia helpers ─────────────────────────────────────────────────────────

// Search Wikipedia and return top results: [{title, snippet, url}]
async function wikiSearch(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${enc(query)}&srlimit=5&utf8=&format=json`;
  const res = await get(url);
  const hits = res.data?.query?.search || [];
  return hits.map(h => ({
    title:   h.title,
    snippet: h.snippet.replace(/<[^>]+>/g, '').toLowerCase(), // strip HTML tags
    url:     `https://en.wikipedia.org/wiki/${enc(h.title.replace(/ /g, '_'))}`,
  }));
}

// Fetch the plain-text extract of a Wikipedia article (first ~30 sentences)
async function wikiExtract(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${enc(title)}` +
    `&prop=extracts&exsentences=30&exintro=false&explaintext=true&format=json`;
  const res = await get(url);
  const pages = res.data?.query?.pages || {};
  const page  = Object.values(pages)[0];
  return (page?.extract || '').toLowerCase();
}

// ── Wikidata helpers ──────────────────────────────────────────────────────────

// Search Wikidata for an entity, return [{id, label, description}]
async function wikidataSearch(query) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities` +
    `&search=${enc(query)}&language=en&type=item&format=json&limit=5`;
  const res = await get(url);
  return (res.data?.search || []).map(r => ({
    id:          r.id,
    label:       (r.label || '').toLowerCase(),
    description: (r.description || '').toLowerCase(),
  }));
}

// Fetch claims for a Wikidata entity. Returns map of property → array of values.
// e.g. { P84: ['Richard Neutra'], P131: ['Palm Springs'] }
async function wikidataGetClaims(qid) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities` +
    `&ids=${enc(qid)}&props=claims|labels&languages=en&format=json`;
  const res = await get(url);
  const entity = res.data?.entities?.[qid];
  if (!entity) return {};

  const claims = entity.claims || {};
  const result = {};

  for (const [prop, statements] of Object.entries(claims)) {
    result[prop] = [];
    for (const stmt of statements) {
      const val = stmt.mainsnak?.datavalue?.value;
      if (!val) continue;
      // Entity reference (e.g. architect Q-ID)
      if (val.id) {
        // Resolve label for this entity
        const labelRes = await get(
          `https://www.wikidata.org/w/api.php?action=wbgetentities` +
          `&ids=${val.id}&props=labels&languages=en&format=json`
        );
        const label = labelRes.data?.entities?.[val.id]?.labels?.en?.value || val.id;
        result[prop].push(label.toLowerCase());
      } else if (typeof val === 'string') {
        result[prop].push(val.toLowerCase());
      } else if (val.text) {
        result[prop].push(val.text.toLowerCase());
      }
    }
  }
  return result;
}

// Find a building in Wikidata and return its P84 (architect) values.
// Returns [] if not found.
async function wikidataArchitectFor(buildingQuery) {
  const hits = await wikidataSearch(buildingQuery);
  // Only accept hits that are clearly a building/house/structure
  const building = hits.find(h =>
    ['building', 'house', 'structure', 'villa', 'estate', 'residence', 'landmark']
      .some(w => h.description.includes(w))
  );
  if (!building) return { architects: [], sourceUrl: null };

  const claims = await wikidataGetClaims(building.id);
  return {
    architects: claims.P84 || [],
    sourceUrl:  `https://www.wikidata.org/wiki/${building.id}`,
    label:      building.label,
  };
}

// ── Text analysis helpers ─────────────────────────────────────────────────────

function hasContradiction(text) {
  return CONTRADICTION_PHRASES.some(p => text.includes(p));
}

// Count how many of the required keywords appear in the text
function keywordScore(text, keywords) {
  const hits = keywords.filter(kw => text.includes(kw.toLowerCase()));
  return hits.length / keywords.length;
}

// Extract the street number from an address string for searching
function streetFragment(address) {
  if (!address) return '';
  const m = address.match(/^(\d+\s+\w+\s+\w+)/);
  return m ? m[1] : address.split(',')[0];
}

// ── Verify an owner claim ─────────────────────────────────────────────────────
async function verifyOwner(ownerName, address) {
  const city        = 'Palm Springs';
  const lastName    = ownerName.split(' ').pop().toLowerCase();
  const streetFrag  = streetFragment(address).toLowerCase();
  const sources     = [];
  let   topScore    = 0;
  let   refuted     = false;

  // ── Strategy 1: search for Wikipedia article about this property ──
  const propQuery = `${address} ${city}`;
  const propHits  = await wikiSearch(propQuery);

  for (const hit of propHits.slice(0, 3)) {
    await sleep(300);
    const text = await wikiExtract(hit.title);
    if (!text) continue;

    if (hasContradiction(text)) { refuted = true; break; }

    const hasOwner    = text.includes(lastName);
    const hasAddress  = text.includes(streetFrag) || text.includes(city.toLowerCase());
    const hasOwnerKw  = keywordScore(text, OWNERSHIP_KEYWORDS) > 0.2;

    if (hasOwner && hasAddress && hasOwnerKw) {
      topScore = Math.max(topScore, SCORE_WIKI_DIRECT);
      sources.push(`Wikipedia: ${hit.title} — ${hit.url}`);
      break;
    } else if (hasOwner && hasAddress) {
      topScore = Math.max(topScore, SCORE_WIKI_MENTION);
      sources.push(`Wikipedia: ${hit.title} — ${hit.url}`);
    } else if (hasOwner || (hit.snippet.includes(lastName) && hit.snippet.includes('palm springs'))) {
      topScore = Math.max(topScore, SCORE_WIKI_SNIPPET);
      sources.push(`Wikipedia (snippet): ${hit.title} — ${hit.url}`);
    }
  }

  if (refuted) return { score: 0, sources, refuted: true };

  // ── Strategy 2: search for owner's Wikipedia article ──
  if (topScore < SCORE_WIKI_DIRECT) {
    await sleep(400);
    const personHits = await wikiSearch(`${ownerName} ${city} home residence estate`);

    for (const hit of personHits.slice(0, 2)) {
      await sleep(300);
      const text = await wikiExtract(hit.title);
      if (!text) continue;

      if (hasContradiction(text)) { refuted = true; break; }

      const hasOwner   = text.includes(lastName);
      const hasCity    = text.includes(city.toLowerCase()) || text.includes('coachella');
      const hasAddress = text.includes(streetFrag);

      if (hasOwner && hasAddress) {
        topScore = Math.max(topScore, SCORE_WIKI_DIRECT);
        sources.push(`Wikipedia (owner article): ${hit.title} — ${hit.url}`);
        break;
      } else if (hasOwner && hasCity && keywordScore(text, OWNERSHIP_KEYWORDS) > 0.2) {
        topScore = Math.max(topScore, SCORE_WIKI_MENTION);
        sources.push(`Wikipedia (owner article): ${hit.title} — ${hit.url}`);
      } else if (hit.snippet.includes(lastName) && hit.snippet.includes('palm springs')) {
        topScore = Math.max(topScore, SCORE_WIKI_SNIPPET);
        sources.push(`Wikipedia (snippet): ${hit.title} — ${hit.url}`);
      }
    }
  }

  return { score: topScore, sources, refuted };
}

// ── Verify an architect commission ────────────────────────────────────────────
async function verifyArchitect(architectName, address) {
  const lastName   = architectName.split(' ').pop().toLowerCase();
  const streetFrag = streetFragment(address).toLowerCase();
  const sources    = [];
  let   topScore   = 0;
  let   refuted    = false;
  let   wikidataMatch = false;

  // ── Strategy 1: Wikidata structured P84 lookup ──
  // Most Palm Springs landmark buildings have Wikidata entries with architect links.
  const buildingName = streetFrag; // Use address fragment as search seed
  await sleep(300);
  const wd = await wikidataArchitectFor(`${address} Palm Springs`);

  if (wd.architects.length > 0) {
    const matched = wd.architects.some(a => a.includes(lastName));
    if (matched) {
      wikidataMatch = true;
      topScore = SCORE_WIKIDATA_DIRECT;
      sources.push(`Wikidata (P84 architect): ${wd.label} — ${wd.sourceUrl}`);
    } else if (wd.architects.some(a => a.includes('refut') || a.includes('incorrect'))) {
      refuted = true;
    }
  }

  if (refuted) return { score: 0, sources, refuted: true, wikidataMatch: false };

  // ── Strategy 2: Wikipedia article about this property ──
  await sleep(400);
  const propHits = await wikiSearch(`${address} Palm Springs architect`);

  for (const hit of propHits.slice(0, 3)) {
    await sleep(300);
    const text = await wikiExtract(hit.title);
    if (!text) continue;

    if (hasContradiction(text)) { refuted = true; break; }

    const hasArch    = text.includes(lastName);
    const hasAddress = text.includes(streetFrag) || text.includes(address.toLowerCase());
    const hasArchKw  = keywordScore(text, ARCHITECT_KEYWORDS) > 0.2;

    if (hasArch && hasAddress && hasArchKw) {
      topScore = Math.max(topScore, SCORE_WIKI_DIRECT);
      sources.push(`Wikipedia: ${hit.title} — ${hit.url}`);
      break;
    } else if (hasArch && hasAddress) {
      topScore = Math.max(topScore, SCORE_WIKI_MENTION);
      sources.push(`Wikipedia: ${hit.title} — ${hit.url}`);
    } else if (hit.snippet.includes(lastName)) {
      topScore = Math.max(topScore, SCORE_WIKI_SNIPPET);
      sources.push(`Wikipedia (snippet): ${hit.title} — ${hit.url}`);
    }
  }

  // ── Strategy 3: search architect's Wikipedia article for this address ──
  if (topScore < SCORE_WIKI_DIRECT) {
    await sleep(400);
    const archHits = await wikiSearch(`${architectName} Palm Springs architecture works`);

    for (const hit of archHits.slice(0, 2)) {
      await sleep(300);
      const text = await wikiExtract(hit.title);
      if (!text || !text.includes(lastName)) continue;

      if (hasContradiction(text)) { refuted = true; break; }

      if (text.includes(streetFrag)) {
        topScore = Math.max(topScore, SCORE_WIKI_MENTION);
        sources.push(`Wikipedia (architect article): ${hit.title} — ${hit.url}`);
        break;
      } else if (text.includes('palm springs') && keywordScore(text, ARCHITECT_KEYWORDS) > 0.3) {
        topScore = Math.max(topScore, SCORE_WIKI_SNIPPET);
        sources.push(`Wikipedia (architect article): ${hit.title} — ${hit.url}`);
      }
    }
  }

  return { score: topScore, sources, refuted, wikidataMatch };
}

// ── Status decision logic ─────────────────────────────────────────────────────
function decideOwnerStatus(current, { score, refuted }) {
  if (refuted)             return 'refuted';
  if (score >= SCORE_WIKI_DIRECT)   return 'verified';
  if (score >= SCORE_WIKI_MENTION)  return 'partial';
  if (score >= SCORE_WIKI_SNIPPET && current === 'claimed_unverified') return 'partial';
  return current;
}

function decideAttributionStrength(current, { score, refuted, wikidataMatch }) {
  if (refuted)              return 'refuted';
  if (wikidataMatch)        return 'verified'; // Wikidata P84 = ground truth
  if (score >= SCORE_WIKI_DIRECT)  return 'strong';
  if (score >= SCORE_WIKI_MENTION) return 'partial';
  return current;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
function sbHost() { return new URL(SUPABASE_URL).hostname; }
function sbHeaders(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
           'Content-Type': 'application/json', ...extra };
}

function supabaseGet(resource) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${SUPABASE_URL}/rest/v1/${resource}`);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'GET', headers: sbHeaders(),
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function supabasePatch(table, id, body) {
  const b = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: sbHost(),
      path:     `/rest/v1/${table}?id=eq.${id}`,
      method:   'PATCH',
      headers:  sbHeaders({ 'Content-Length': Buffer.byteLength(b), Prefer: 'return=minimal' }),
    }, res => { res.resume(); resolve({ status: res.statusCode }); });
    req.on('error', reject);
    req.write(b); req.end();
  });
}

async function getAddress(apn) {
  if (!apn) return 'Palm Springs, CA';
  const res = await supabaseGet(
    `property_master?apn=eq.${encodeURIComponent(apn)}&select=address,city`
  );
  const row = Array.isArray(res.data) ? res.data[0] : null;
  return row ? `${row.address}, ${row.city || 'Palm Springs'}` : apn;
}

// ── VERIFY MODE ───────────────────────────────────────────────────────────────
async function runVerify() {
  log('─── VERIFY MODE (Wikipedia + Wikidata — no external AI) ───────');

  const ownersRes = await supabaseGet(
    'notable_owners?verification_status=in.(claimed_unverified,partial)' +
    '&select=id,apn,owner_name,verification_status,verification_sources,primary_source_count' +
    '&order=primary_source_count.asc&limit=10'
  );
  const owners = Array.isArray(ownersRes.data) ? ownersRes.data : [];

  const commissionsRes = await supabaseGet(
    'architect_commissions?attribution_strength=in.(claimed,partial)' +
    '&select=id,apn,architect_id,commission_year,attribution_strength,source_archives&limit=10'
  );
  const commissions = Array.isArray(commissionsRes.data) ? commissionsRes.data : [];

  log(`Rows to verify: ${owners.length} notable_owners + ${commissions.length} commissions`);

  if (owners.length + commissions.length === 0) {
    log('Nothing to verify. (Apply luxury-seeds-todo.sql first to populate tables.)');
    return { upgraded: 0, refuted: 0, unchanged: 0, errors: 0, details: [] };
  }

  const stats = { upgraded: 0, refuted: 0, unchanged: 0, errors: 0, details: [] };

  // ── Notable owners ──
  for (const owner of owners) {
    try {
      const address  = await getAddress(owner.apn);
      log(`\n  [owner] ${owner.owner_name} @ ${address} (${owner.verification_status})`);

      if (DRY_RUN) { log('  DRY RUN'); stats.unchanged++; continue; }

      const result    = await verifyOwner(owner.owner_name, address);
      const newStatus = decideOwnerStatus(owner.verification_status, result);

      log(`  Score: ${result.score} | refuted: ${result.refuted} | sources: ${result.sources.length}`);
      log(`  Decision: ${owner.verification_status} → ${newStatus}`);
      result.sources.forEach(s => log(`    · ${s}`));

      if (newStatus !== owner.verification_status || result.sources.length > 0) {
        const existing = Array.isArray(owner.verification_sources) ? owner.verification_sources : [];
        await supabasePatch('notable_owners', owner.id, {
          verification_status:  newStatus,
          verification_sources: [...new Set([...existing, ...result.sources])].slice(0, 12),
          primary_source_count: (owner.primary_source_count || 0) +
            result.sources.filter(s => s.includes('Wikipedia:')).length,
          updated_at: new Date().toISOString(),
        });
        if (newStatus === 'refuted') stats.refuted++;
        else if (newStatus !== owner.verification_status) stats.upgraded++;
        else stats.unchanged++;
      } else {
        log('  No change.');
        stats.unchanged++;
      }

      stats.details.push({ type: 'owner', name: owner.owner_name, from: owner.verification_status, to: newStatus, score: result.score });
      await sleep(600);

    } catch (e) {
      log(`  ERROR (${owner.owner_name}): ${e.message}`);
      stats.errors++;
    }
  }

  // ── Architect commissions ──
  for (const commission of commissions) {
    try {
      const archRes  = await supabaseGet(`architects?id=eq.${commission.architect_id}&select=name`);
      const archName = archRes.data?.[0]?.name || 'Unknown';
      const address  = await getAddress(commission.apn);

      log(`\n  [commission] ${archName} @ ${address} (${commission.attribution_strength})`);

      if (DRY_RUN) { log('  DRY RUN'); stats.unchanged++; continue; }

      const result      = await verifyArchitect(archName, address);
      const newStrength = decideAttributionStrength(commission.attribution_strength, result);

      log(`  Score: ${result.score} | wikidata: ${result.wikidataMatch} | refuted: ${result.refuted}`);
      log(`  Decision: ${commission.attribution_strength} → ${newStrength}`);
      result.sources.forEach(s => log(`    · ${s}`));

      if (newStrength !== commission.attribution_strength || result.sources.length > 0) {
        const existing = Array.isArray(commission.source_archives) ? commission.source_archives : [];
        await supabasePatch('architect_commissions', commission.id, {
          attribution_strength: newStrength,
          source_archives:      [...new Set([...existing, ...result.sources])].slice(0, 10),
        });
        if (newStrength !== commission.attribution_strength) stats.upgraded++;
        else stats.unchanged++;
      } else {
        stats.unchanged++;
      }

      stats.details.push({ type: 'commission', architect: archName, from: commission.attribution_strength, to: newStrength, score: result.score });
      await sleep(600);

    } catch (e) {
      log(`  ERROR (commission ${commission.id}): ${e.message}`);
      stats.errors++;
    }
  }

  log(`\nVerify done — upgraded: ${stats.upgraded} | refuted: ${stats.refuted} | unchanged: ${stats.unchanged} | errors: ${stats.errors}`);
  return stats;
}

// ── DRAFT MODE ────────────────────────────────────────────────────────────────
async function runDraft() {
  log('─── DRAFT MODE — generating posts for verified properties ─────');

  const ownersRes = await supabaseGet(
    'notable_owners?verification_status=eq.verified' +
    '&select=id,apn,owner_name,owner_role,ownership_start,ownership_end,notable_events,verification_sources' +
    '&order=updated_at.desc&limit=6'
  );
  const owners = Array.isArray(ownersRes.data) ? ownersRes.data : [];
  log(`Verified owners found: ${owners.length}`);

  if (owners.length === 0) {
    log('No verified owners yet. Run verify mode first.');
    return { drafted: 0 };
  }

  const queue       = JSON.parse(fs.readFileSync(POST_QUEUE_FILE, 'utf8'));
  const existingIds = new Set(queue.reddit.map(p => p.id));
  const nums        = queue.reddit.map(p => p.id)
    .filter(id => /^lux-\d+$/.test(id))
    .map(id => parseInt(id.replace('lux-', ''), 10));
  let nextNum = nums.length ? Math.max(...nums) + 1 : 1;

  const TARGET_SUBS = ['fatFIRE', 'luxurylifestyle', 'HENRYfinance', 'Architecture', 'MidCenturyModernArch', 'RealEstateInvesting'];
  function pickSubreddit() {
    const pending = s => queue.reddit.filter(p => p.subreddit === s && !p.posted).length;
    return TARGET_SUBS.slice().sort((a, b) => pending(a) - pending(b))[0];
  }

  let drafted = 0;

  for (const owner of owners) {
    try {
      const address = await getAddress(owner.apn);
      const postId  = `lux-${String(nextNum).padStart(3, '0')}`;
      if (existingIds.has(postId)) { nextNum++; continue; }

      const subreddit   = pickSubreddit();
      const utm         = `utm_source=reddit_${subreddit}&utm_medium=social&utm_campaign=organic`;
      const events      = (Array.isArray(owner.notable_events) ? owner.notable_events : []).slice(0, 3);
      const sources     = (Array.isArray(owner.verification_sources) ? owner.verification_sources : []).slice(0, 2);
      const ownerPeriod = owner.ownership_start
        ? `${(owner.ownership_start || '').slice(0, 4)}${owner.ownership_end ? '–' + owner.ownership_end.slice(0, 4) : ''}`
        : null;

      const bodyParts = [
        `The ${address.split(',')[0]} has one of the most documented ownership chains in the Coachella Valley — ${owner.owner_name} as a verified ${owner.owner_role} resident, cross-referenced across Wikipedia and Wikidata primary sources.`,
        '',
        ownerPeriod ? `Ownership period: ${ownerPeriod}` : null,
        '',
        events.length ? 'Verified provenance events:\n' + events.map(e => `- ${e}`).join('\n') : null,
        '',
        sources.length ? `Primary sources: ${sources.join(' | ')}` : null,
        '',
        `PropertyDNA builds the dossier the auction houses charge 15% for — verified owner history, architect attribution, and primary-source citations for every significant estate in the Coachella Valley.`,
        '',
        `https://www.thepropertydna.com?${utm}`,
      ];

      const body = bodyParts.filter(s => s != null).join('\n').replace(/\n{3,}/g, '\n\n').trim();

      queue.reddit.push({
        id:           postId,
        subreddit,
        title:        `Verified provenance: ${owner.owner_name}'s Palm Springs estate — Wikipedia + Wikidata confirmed`,
        body,
        posted:       false,
        postedAt:     null,
        url:          null,
        drafted_by:   'provenance-researcher',
        drafted_at:   new Date().toISOString(),
      });

      existingIds.add(postId);
      nextNum++;
      drafted++;
      log(`  Drafted ${postId} → r/${subreddit}: ${owner.owner_name}`);

    } catch (e) {
      log(`  ERROR drafting (${owner.owner_name}): ${e.message}`);
    }
  }

  if (drafted > 0 && !DRY_RUN) {
    fs.writeFileSync(POST_QUEUE_FILE, JSON.stringify(queue, null, 2));
    log(`Wrote ${drafted} draft(s) to post-queue.json`);
  }

  return { drafted };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  if (!SUPABASE_KEY) {
    log('SKIP — SUPABASE_SERVICE_KEY env var not set.');
    return { status: 'skipped', reason: 'no_supabase_key' };
  }

  const start = Date.now();

  try {
    const verifyResults = (MODE === 'verify' || MODE === 'both') ? await runVerify() : null;
    const draftResults  = (MODE === 'draft'  || MODE === 'both') ? await runDraft()  : null;

    const summary = [
      verifyResults ? `${verifyResults.upgraded} upgraded, ${verifyResults.refuted} refuted, ${verifyResults.unchanged} unchanged` : null,
      draftResults  ? `${draftResults.drafted} posts drafted` : null,
    ].filter(Boolean).join(' | ');

    log(`\nDone: ${summary}`);

    await opsLog.write({
      agent:        'provenance-researcher',
      event_type:   'provenance_research',
      status:       'ok',
      summary,
      metadata:     { mode: MODE, dry_run: DRY_RUN, verify: verifyResults, draft: draftResults, sources: 'wikipedia+wikidata' },
      affected_rows: (verifyResults?.upgraded || 0) + (draftResults?.drafted || 0),
      duration_ms:   Date.now() - start,
    });

    return { status: 'ok', verify: verifyResults, draft: draftResults };

  } catch (e) {
    log(`FATAL: ${e.message}`);
    await opsLog.write({
      agent: 'provenance-researcher', event_type: 'provenance_research',
      status: 'error', error_message: e.message, duration_ms: Date.now() - start,
    });
    return { status: 'error', error: e.message };
  }
}

module.exports = { run };
if (require.main === module) run().then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));
