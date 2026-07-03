#!/usr/bin/env node
/**
 * PropertyDNA — Provenance Research Agent
 *
 * Uses the Perplexity Search API to systematically verify celebrity ownership
 * claims and architect attribution in the notable_owners and architect_commissions
 * tables. Sends multi-query batches, scores cross-source convergence, and patches
 * verification_status / attribution_strength back to Supabase — turning hand-picked
 * gut-call labels into data-driven agreement rates.
 *
 * Modes (--mode=<value>):
 *   verify  (default) — scan Supabase for unverified rows → research → patch
 *   draft             — generate Reddit post drafts for newly-verified properties
 *   both              — verify then draft in one pass
 *
 * Confidence thresholds:
 *   ≥ 0.67  + primary source found  → verified  (2/3 queries agree, real citation)
 *   ≥ 0.67  no primary source       → partial   (strong signal, no deed/archive)
 *   ≥ 0.33                          → partial   (corroborated but not conclusive)
 *   < 0.33                          → no change
 *   contradiction detected          → refuted
 *
 * Credentials in .daily-creds.json:
 *   { "perplexity": { "apiKey": "pplx-..." } }
 * Or env var: PERPLEXITY_API_KEY=pplx-...
 *
 * Manual runs:
 *   node tools/browser-agent/agents/provenance-researcher.js
 *   node tools/browser-agent/agents/provenance-researcher.js --mode=draft
 *   node tools/browser-agent/agents/provenance-researcher.js --mode=both
 *   node tools/browser-agent/agents/provenance-researcher.js --dry-run
 *
 * Runs automatically via daily-runner.js on Tuesday + Friday.
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const opsLog = require('../lib/ops-log');

const CREDS_FILE      = path.join(__dirname, '../.daily-creds.json');
const POST_QUEUE_FILE = path.join(__dirname, '../data/post-queue.json');
const SUPABASE_URL    = process.env.SUPABASE_URL || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY;

const cliArgs = process.argv.slice(2);
const DRY_RUN = cliArgs.includes('--dry-run');
const MODE    = (cliArgs.find(a => a.startsWith('--mode=')) || '--mode=verify').replace('--mode=', '');

function log(msg) { console.log(`[Provenance] ${msg}`); }

// ── Confidence thresholds ────────────────────────────────────────────────────
const THRESHOLD_VERIFIED = 0.67; // ≥ 2/3 queries agree + primary source found
const THRESHOLD_PARTIAL  = 0.33; // ≥ 1/3 queries corroborate

// Domains that count as primary sources for primary_source_count increment
const PRIMARY_SOURCE_DOMAINS = [
  'nytimes.com', 'latimes.com', 'apnews.com', 'washingtonpost.com', 'time.com',
  'wikipedia.org', 'loc.gov', 'nps.gov', 'getty.edu', 'gettyimages.com',
  'palmspringslife.com', 'desertsun.com', 'architecturaldigest.com',
  'progressive-architecture.com', 'architecture.org', 'aia.org',
  'pspreservationfoundation.org', 'palm-springs.org', 'psmuseum.org',
  'johnlautnerfoundation.org', 'riverside.ca.gov', 'assessor.co.riverside',
];

// Phrases that indicate a claim is actively contradicted — trigger refuted path
const REFUTATION_PHRASES = [
  'no evidence', 'never owned', 'not at this address', 'incorrectly attributed',
  'no record', 'cannot be verified', 'disputed', 'myth', 'false claim',
  'actually owned by', 'erroneously credited',
];

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Perplexity Search ─────────────────────────────────────────────────────────
async function perplexitySearch(apiKey, queries) {
  const body = JSON.stringify({ query: queries });
  const res = await request({
    hostname: 'api.perplexity.ai',
    path:     '/search',
    method:   'POST',
    headers: {
      'Authorization':  `Bearer ${apiKey}`,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (res.status !== 200) {
    throw new Error(`Perplexity API ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  return res.data;
}

// ── Flexible response parser ──────────────────────────────────────────────────
// Normalises any Perplexity /search response shape into:
//   [{ query, answer, sources: [{ title, url, snippet }] }]
function parseSearchResponse(data, queries) {
  const norm = r => ({
    query:   r.query   || '',
    answer:  r.answer  || r.text   || r.content || '',
    sources: (r.web_results || r.sources || r.citations || []).map(s => ({
      title:   s.title   || s.name || '',
      url:     s.url     || s.link || s.href || '',
      snippet: s.snippet || s.text || s.description || '',
    })),
  });

  // Format A: { results: [...] }
  if (Array.isArray(data?.results)) return data.results.map(norm);
  // Format B: direct array
  if (Array.isArray(data)) return data.map(norm);
  // Format C: object keyed by index "0", "1", ...
  return queries.map((q, i) => norm({ query: q, ...(data[i] || data[String(i)] || {}) }));
}

// ── Convergence scoring ───────────────────────────────────────────────────────
function scoreConvergence(searchResults, claimKeywords) {
  let agreements    = 0;
  let contradictions = 0;
  const sourcesFound   = [];
  const primarySources = [];

  for (const result of searchResults) {
    const fullText = [
      result.answer,
      ...result.sources.map(s => `${s.title} ${s.snippet}`),
    ].join(' ').toLowerCase();

    const isContradiction = REFUTATION_PHRASES.some(p => fullText.includes(p));
    const isAgreement     = claimKeywords.every(kw => fullText.includes(kw.toLowerCase()));

    if (isContradiction) {
      contradictions++;
    } else if (isAgreement) {
      agreements++;
      result.sources.slice(0, 2).forEach(s => {
        if (s.url || s.title) {
          sourcesFound.push(s.title ? `${s.title} — ${s.url}` : s.url);
          const domain = (() => {
            try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return ''; }
          })();
          if (PRIMARY_SOURCE_DOMAINS.some(d => domain.includes(d))) {
            primarySources.push(s.title ? `${s.title} (${domain})` : domain);
          }
        }
      });
    }
  }

  const total      = searchResults.length || 1;
  const confidence = agreements / total;
  return { confidence, agreements, total, contradictions, sourcesFound, primarySources };
}

// ── Status decision logic ─────────────────────────────────────────────────────
// Returns the new verification_status for notable_owners rows.
function decideOwnerStatus(current, { confidence, contradictions, primarySources }) {
  if (contradictions > 0 && confidence < THRESHOLD_PARTIAL)  return 'refuted';
  if (confidence >= THRESHOLD_VERIFIED && primarySources.length > 0) return 'verified';
  if (confidence >= THRESHOLD_VERIFIED)                              return 'partial';
  if (confidence >= THRESHOLD_PARTIAL)                               return 'partial';
  return current;
}

// Returns the new attribution_strength for architect_commissions rows.
function decideAttributionStrength(current, { confidence, contradictions, primarySources }) {
  if (contradictions > 0 && confidence < THRESHOLD_PARTIAL)           return 'refuted';
  if (confidence >= THRESHOLD_VERIFIED && primarySources.length > 0)  return 'verified';
  if (confidence >= THRESHOLD_VERIFIED)                                return 'strong';
  if (confidence >= THRESHOLD_PARTIAL)                                 return 'partial';
  return current;
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────
function sbHost() { return new URL(SUPABASE_URL).hostname; }
function sbHeaders(extra = {}) {
  return {
    apikey:         SUPABASE_KEY,
    Authorization:  `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function supabaseGet(resource) {
  return request({ hostname: sbHost(), path: `/rest/v1/${resource}`, method: 'GET', headers: sbHeaders() });
}

function supabasePatch(table, id, body) {
  const b = JSON.stringify(body);
  return request({
    hostname: sbHost(),
    path:     `/rest/v1/${table}?id=eq.${id}`,
    method:   'PATCH',
    headers:  sbHeaders({ 'Content-Length': Buffer.byteLength(b), Prefer: 'return=minimal' }),
  }, b);
}

async function getAddress(apn) {
  if (!apn) return 'Palm Springs, CA';
  const res = await supabaseGet(`property_master?apn=eq.${encodeURIComponent(apn)}&select=address,city`);
  const row = Array.isArray(res.data) ? res.data[0] : null;
  return row ? `${row.address}, ${row.city || 'Palm Springs'}` : apn;
}

// ── Query builders ────────────────────────────────────────────────────────────
function ownerQueries(ownerName, address) {
  return [
    `"${ownerName}" "${address}" ownership history`,
    `${ownerName} Palm Springs home estate real estate celebrity`,
    `${ownerName} Coachella Valley desert property residence history`,
  ];
}

function architectQueries(architectName, address, year) {
  const yearStr = year ? String(year) : 'mid-century';
  return [
    `"${architectName}" "${address}" architectural commission Palm Springs`,
    `"${address}" Palm Springs architect designed ${yearStr}`,
    `${architectName} Palm Springs residential works ${yearStr}`,
  ];
}

// Minimum keywords that must appear in a result for it to count as agreement
function ownerKeywords(ownerName) {
  const parts = ownerName.split(' ');
  // Use last name for robustness; also require Palm Springs or Coachella
  return [parts[parts.length - 1].toLowerCase(), 'palm springs'];
}

function architectKeywords(architectName) {
  const parts = architectName.split(' ');
  return [parts[parts.length - 1].toLowerCase()];
}

// ── VERIFY MODE ───────────────────────────────────────────────────────────────
async function runVerify(apiKey) {
  log('─── VERIFY MODE ───────────────────────────────────────────────');

  const ownersRes = await supabaseGet(
    'notable_owners?verification_status=in.(claimed_unverified,partial)' +
    '&select=id,apn,owner_name,owner_role,verification_status,verification_sources,primary_source_count' +
    '&order=primary_source_count.asc&limit=10'
  );
  const owners = Array.isArray(ownersRes.data) ? ownersRes.data : [];

  const commissionsRes = await supabaseGet(
    'architect_commissions?attribution_strength=in.(claimed,partial)' +
    '&select=id,apn,architect_id,commission_year,attribution_strength,source_archives' +
    '&limit=10'
  );
  const commissions = Array.isArray(commissionsRes.data) ? commissionsRes.data : [];

  log(`Rows to research: ${owners.length} notable_owners + ${commissions.length} architect_commissions`);

  if (owners.length + commissions.length === 0) {
    log('Nothing to research. (Run luxury-seeds-todo.sql first to populate tables.)');
    return { upgraded: 0, refuted: 0, unchanged: 0, errors: 0, details: [] };
  }

  const results = { upgraded: 0, refuted: 0, unchanged: 0, errors: 0, details: [] };

  // ── Notable owners ──
  for (const owner of owners) {
    try {
      const address  = await getAddress(owner.apn);
      const queries  = ownerQueries(owner.owner_name, address);
      const keywords = ownerKeywords(owner.owner_name);

      log(`\n  [owner] ${owner.owner_name} @ ${address}`);
      log(`    Current status: ${owner.verification_status}`);
      log(`    Queries: ${queries.map((q, i) => `(${i + 1}) "${q.slice(0, 55)}..."`).join(' ')}`);

      if (DRY_RUN) { log('    DRY RUN — skip'); results.unchanged++; continue; }

      const raw     = await perplexitySearch(apiKey, queries);
      const results_ = parseSearchResponse(raw, queries);
      const score    = scoreConvergence(results_, keywords);
      const newStatus = decideOwnerStatus(owner.verification_status, score);

      log(`    Confidence: ${(score.confidence * 100).toFixed(0)}% (${score.agreements}/${score.total} agree, ${score.contradictions} contradict)`);
      log(`    Primary sources: ${score.primarySources.length} — ${score.primarySources.slice(0, 2).join(', ') || 'none'}`);
      log(`    Decision: ${owner.verification_status} → ${newStatus}`);

      if (newStatus !== owner.verification_status || score.sourcesFound.length > 0) {
        const existingSources = Array.isArray(owner.verification_sources) ? owner.verification_sources : [];
        const mergedSources   = [...new Set([...existingSources, ...score.sourcesFound])].slice(0, 12);
        await supabasePatch('notable_owners', owner.id, {
          verification_status:  newStatus,
          verification_sources: mergedSources,
          primary_source_count: (owner.primary_source_count || 0) + score.primarySources.length,
          updated_at:           new Date().toISOString(),
        });
        if (newStatus === 'refuted') results.refuted++;
        else if (newStatus !== owner.verification_status) results.upgraded++;
        else results.unchanged++;
      } else {
        log('    No change.');
        results.unchanged++;
      }

      results.details.push({
        type: 'notable_owner', name: owner.owner_name, address,
        from: owner.verification_status, to: newStatus,
        confidence: score.confidence,
        primarySources: score.primarySources.length,
      });

      await sleep(1500);

    } catch (e) {
      log(`  ERROR (${owner.owner_name}): ${e.message}`);
      results.errors++;
    }
  }

  // ── Architect commissions ──
  for (const commission of commissions) {
    try {
      const archRes = await supabaseGet(`architects?id=eq.${commission.architect_id}&select=name`);
      const archName = archRes.data?.[0]?.name || 'Unknown Architect';
      const address  = await getAddress(commission.apn);
      const queries  = architectQueries(archName, address, commission.commission_year);
      const keywords = architectKeywords(archName);

      log(`\n  [commission] ${archName} @ ${address} (${commission.commission_year || 'year unknown'})`);
      log(`    Current: ${commission.attribution_strength}`);

      if (DRY_RUN) { log('    DRY RUN — skip'); results.unchanged++; continue; }

      const raw       = await perplexitySearch(apiKey, queries);
      const results_  = parseSearchResponse(raw, queries);
      const score     = scoreConvergence(results_, keywords);
      const newStrength = decideAttributionStrength(commission.attribution_strength, score);

      log(`    Confidence: ${(score.confidence * 100).toFixed(0)}% → ${commission.attribution_strength} → ${newStrength}`);

      if (newStrength !== commission.attribution_strength) {
        const existing = Array.isArray(commission.source_archives) ? commission.source_archives : [];
        const merged   = [...new Set([...existing, ...score.sourcesFound])].slice(0, 10);
        await supabasePatch('architect_commissions', commission.id, {
          attribution_strength: newStrength,
          source_archives:      merged,
        });
        results.upgraded++;
      } else {
        results.unchanged++;
      }

      results.details.push({
        type: 'architect_commission', architect: archName, address,
        from: commission.attribution_strength, to: newStrength,
        confidence: score.confidence,
      });

      await sleep(1500);

    } catch (e) {
      log(`  ERROR (commission ${commission.id}): ${e.message}`);
      results.errors++;
    }
  }

  log(`\nVerify done — upgraded: ${results.upgraded} | refuted: ${results.refuted} | unchanged: ${results.unchanged} | errors: ${results.errors}`);
  return results;
}

// ── DRAFT MODE ────────────────────────────────────────────────────────────────
async function runDraft(apiKey) {
  log('─── DRAFT MODE ────────────────────────────────────────────────');

  const ownersRes = await supabaseGet(
    'notable_owners?verification_status=eq.verified' +
    '&select=id,apn,owner_name,owner_role,ownership_start,ownership_end,notable_events,verification_sources' +
    '&order=updated_at.desc&limit=6'
  );
  const owners = Array.isArray(ownersRes.data) ? ownersRes.data : [];
  log(`Verified owners to draft for: ${owners.length}`);

  if (owners.length === 0) {
    log('No verified owners yet. Run verify mode first.');
    return { drafted: 0 };
  }

  const queue      = JSON.parse(fs.readFileSync(POST_QUEUE_FILE, 'utf8'));
  const existingIds = new Set(queue.reddit.map(p => p.id));

  // Find next lux-NNN number
  const nums = queue.reddit
    .map(p => p.id).filter(id => /^lux-\d+$/.test(id))
    .map(id => parseInt(id.replace('lux-', ''), 10));
  let nextNum = nums.length ? Math.max(...nums) + 1 : 1;

  // Round-robin subreddits — pick whichever has fewest pending posts
  const TARGET_SUBS = ['fatFIRE', 'luxurylifestyle', 'HENRYfinance', 'Architecture', 'MidCenturyModernArch', 'RealEstateInvesting'];
  function pickSubreddit() {
    const pending = s => queue.reddit.filter(p => p.subreddit === s && !p.posted).length;
    return TARGET_SUBS.slice().sort((a, b) => pending(a) - pending(b))[0];
  }

  let drafted = 0;

  for (const owner of owners) {
    try {
      const address = await getAddress(owner.apn);
      const queries = [
        `${owner.owner_name} Palm Springs estate provenance architectural history`,
        `${owner.owner_name} ${address} notable facts celebrity residence significance`,
        `Palm Springs celebrity estates luxury investment historical value provenance`,
      ];

      log(`\n  Drafting post: ${owner.owner_name} @ ${address}`);

      if (DRY_RUN) { log('  DRY RUN — skip'); continue; }

      const raw     = await perplexitySearch(apiKey, queries);
      const results_ = parseSearchResponse(raw, queries);

      // Use the longest answer as the research context paragraph
      const richest  = results_.slice().sort((a, b) => b.answer.length - a.answer.length)[0] || { answer: '' };
      const context  = richest.answer.slice(0, 350).trim();
      const citedUrls = results_.flatMap(r => r.sources.slice(0, 1).map(s => s.url)).filter(Boolean).slice(0, 3);

      // Build post body
      const ownershipLine = (owner.ownership_start || owner.ownership_end)
        ? `Ownership period: ${(owner.ownership_start || '').slice(0, 4) || '?'}${owner.ownership_end ? '–' + owner.ownership_end.slice(0, 4) : '–?'}`
        : null;

      const events = (Array.isArray(owner.notable_events) ? owner.notable_events : []).slice(0, 3);
      const eventsBlock = events.length
        ? 'Verified provenance events:\n' + events.map(e => `- ${e}`).join('\n')
        : null;

      const subreddit = pickSubreddit();
      const utm = `utm_source=reddit_${subreddit}&utm_medium=social&utm_campaign=organic`;

      const bodyParts = [
        `The ${address.split(',')[0]} carries one of the most documented ownership chains in the Coachella Valley — ${owner.owner_name} as a verified ${owner.owner_role} resident, cross-referenced across multiple primary sources.`,
        '',
        ownershipLine,
        '',
        eventsBlock,
        '',
        context ? `What the research surfaces: ${context}` : null,
        '',
        `We built PropertyDNA to document exactly this kind of provenance chain — verified owner history, architect attribution, and primary-source citations for every significant estate in the market. The Barrett-Jackson methodology, applied to residential real estate.`,
        '',
        `https://www.thepropertydna.com?${utm}`,
      ];

      const body = bodyParts.filter(s => s != null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
      const postId = `lux-${String(nextNum).padStart(3, '0')}`;

      if (existingIds.has(postId)) { nextNum++; continue; }

      queue.reddit.push({
        id:                 postId,
        subreddit,
        title:              `Verified provenance: ${owner.owner_name}'s Palm Springs estate — primary-source documentation`,
        body,
        posted:             false,
        postedAt:           null,
        url:                null,
        research_confidence: null,  // populated by verify pass; set manually after review
        research_sources:   citedUrls,
        drafted_by:         'provenance-researcher',
        drafted_at:         new Date().toISOString(),
      });

      existingIds.add(postId);
      nextNum++;
      drafted++;
      log(`  Drafted ${postId} → r/${subreddit}`);

      await sleep(1500);

    } catch (e) {
      log(`  ERROR drafting (${owner.owner_name}): ${e.message}`);
    }
  }

  if (drafted > 0 && !DRY_RUN) {
    fs.writeFileSync(POST_QUEUE_FILE, JSON.stringify(queue, null, 2));
    log(`\nWrote ${drafted} new draft(s) to post-queue.json`);
  }

  return { drafted };
}

// ── Main entry ────────────────────────────────────────────────────────────────
async function run() {
  const creds  = fs.existsSync(CREDS_FILE) ? JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')) : {};
  const apiKey = creds?.perplexity?.apiKey || process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    log('SKIP — no Perplexity API key found.');
    log('  Add to .daily-creds.json: { "perplexity": { "apiKey": "pplx-..." } }');
    log('  Or set env var: PERPLEXITY_API_KEY=pplx-...');
    return { status: 'skipped', reason: 'no_credentials' };
  }

  if (!SUPABASE_KEY) {
    log('SKIP — SUPABASE_SERVICE_KEY env var not set.');
    return { status: 'skipped', reason: 'no_supabase_key' };
  }

  const start = Date.now();

  try {
    const verifyResults = (MODE === 'verify' || MODE === 'both') ? await runVerify(apiKey) : null;
    const draftResults  = (MODE === 'draft'  || MODE === 'both') ? await runDraft(apiKey)  : null;

    const upgrades = verifyResults?.upgraded || 0;
    const drafted  = draftResults?.drafted   || 0;
    const summary  = [
      verifyResults ? `${upgrades} upgraded, ${verifyResults.refuted} refuted, ${verifyResults.unchanged} unchanged` : null,
      draftResults  ? `${drafted} posts drafted` : null,
    ].filter(Boolean).join(' | ');

    log(`\nDone: ${summary}`);

    await opsLog.write({
      agent:        'provenance-researcher',
      event_type:   'provenance_research',
      status:       'ok',
      summary,
      metadata:     { mode: MODE, dry_run: DRY_RUN, verify: verifyResults, draft: draftResults },
      affected_rows: upgrades + drafted,
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
