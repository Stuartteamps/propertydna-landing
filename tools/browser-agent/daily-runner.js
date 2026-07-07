#!/usr/bin/env node
/**
 * PropertyDNA — Daily Automation Runner
 *
 * Runs every morning at 7:00 AM via launchd (installed by install-daily-runner.sh).
 *
 * What it does each day:
 *   1. Refresh Constant Contact OAuth token
 *   2. Post one Reddit item from the queue
 *   3. Cross-post one article to Medium
 *   4. Schedule a social post via Buffer
 *   5. Pull Google Analytics summary
 *   6. Provenance research (Tuesday + Friday only) — Wikipedia + Wikidata
 *      verification of notable_owners + architect_commissions; drafts Reddit posts
 *      for newly-verified properties
 *
 * Credentials live in .daily-creds.json (chmod 600):
 * {
 *   "reddit":      { "clientId": "", "clientSecret": "", "username": "", "password": "" },
 *   "medium":      { "token": "", "userId": "" },
 *   "buffer":      { "token": "" },
 *   "googleAnalytics": { "propertyId": "", "serviceAccountKey": "" },
 * }
 * Provenance researcher needs no credentials — uses Wikipedia + Wikidata (free, public).
 *
 * Manual run: node tools/browser-agent/daily-runner.js
 * Skip an agent: node tools/browser-agent/daily-runner.js --skip reddit,medium
 * Dry run:  node tools/browser-agent/daily-runner.js --dry-run
 * Force research today: node tools/browser-agent/daily-runner.js --force-research
 */

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

const LOG_FILE     = path.join(__dirname, 'daily-runner.log');
const CREDS_FILE   = path.join(__dirname, '.daily-creds.json');

const args           = process.argv.slice(2);
const DRY_RUN        = args.includes('--dry-run');
const FORCE_RESEARCH = args.includes('--force-research');
const SKIP           = (args.find(a => a.startsWith('--skip=')) || args[args.indexOf('--skip') + 1] || '')
                         .replace('--skip=', '').split(',').filter(Boolean);

// Provenance research runs Tuesday (2) and Friday (5) to manage API costs.
// Override any day with --force-research.
const RESEARCH_DAYS = new Set([2, 5]);
function researchScheduledToday() {
  return FORCE_RESEARCH || RESEARCH_DAYS.has(new Date().getDay());
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function separator() { log('─'.repeat(60)); }

async function runAgent(name, agentPath) {
  if (SKIP.includes(name)) {
    log(`[${name}] SKIPPED (--skip flag)`);
    return { status: 'skipped', reason: 'flag' };
  }
  if (DRY_RUN) {
    log(`[${name}] DRY RUN — would execute`);
    return { status: 'dry_run' };
  }
  try {
    const agent = require(agentPath);
    return await agent.run();
  } catch (e) {
    log(`[${name}] ERROR loading agent: ${e.message}`);
    return { status: 'error', error: e.message };
  }
}

async function runCCRefresh() {
  if (SKIP.includes('cc')) {
    log('[CC] SKIPPED (--skip flag)');
    return { status: 'skipped' };
  }
  if (DRY_RUN) {
    log('[CC] DRY RUN — would refresh CC token');
    return { status: 'dry_run' };
  }
  try {
    log('[CC] Running CC token refresh...');
    execSync(`node ${path.join(__dirname, 'refresh-cc-token.js')}`, {
      stdio: 'inherit', timeout: 120000, cwd: __dirname,
    });
    return { status: 'ok' };
  } catch (e) {
    log(`[CC] Refresh failed: ${e.message}`);
    return { status: 'error', error: e.message };
  }
}

(async () => {
  separator();
  log(`PropertyDNA Daily Runner — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`);
  if (DRY_RUN) log('*** DRY RUN MODE — no posts will be made ***');
  separator();

  const results = {};

  // 1. Constant Contact token refresh
  log('\n[1/6] Constant Contact token refresh');
  results.cc = await runCCRefresh();

  // 2. Reddit posting — re-enabled 2026-05-13. Agent auto-skips BANNED_SUBS
  // (r/realtors, r/realtor, r/RealEstate). Queue targets luxury/HENRY/architecture
  // /investing subs which tolerate brand mentions when content is informative.
  log('\n[2/6] Reddit posting');
  results.reddit = await runAgent('reddit', path.join(__dirname, 'agents/reddit.js'));

  // 3. Medium cross-post — DISABLED. Medium killed integration tokens for accounts
  // post-2023 (verified in browser 2026-05-10). Cross-post via Buffer's Medium
  // channel instead — connect at buffer.com/manage/channels.
  log('\n[3/6] Medium cross-posting — SKIPPED (use Buffer Medium channel instead)');
  results.medium = { status: 'disabled', reason: 'use_buffer_channel_instead' };

  // 4. Buffer social post
  log('\n[4/6] Buffer social posting');
  results.buffer = await runAgent('buffer', path.join(__dirname, 'agents/buffer.js'));

  // 5. Google Analytics pull
  log('\n[5/6] Google Analytics daily summary');
  results.ga = await runAgent('ga', path.join(__dirname, 'agents/google-analytics.js'));

  // 6. Provenance research — Tuesday + Friday only (or --force-research)
  if (researchScheduledToday()) {
    log('\n[6/6] Provenance research (Wikipedia + Wikidata verify + draft)');
    // Pass --mode=both so a single run verifies unverified rows AND drafts posts
    // for anything that gets upgraded to verified in the same pass.
    process.argv.push('--mode=both');
    results.research = await runAgent('research', path.join(__dirname, 'agents/provenance-researcher.js'));
    process.argv.pop();
  } else {
    const nextDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const next = [2, 5].map(d => nextDay[d]).join('/');
    log(`\n[6/6] Provenance research — SKIPPED (runs ${next} only; use --force-research to override)`);
    results.research = { status: 'skipped', reason: 'off_schedule' };
  }

  separator();
  log('Daily runner complete. Summary:');
  for (const [agent, result] of Object.entries(results)) {
    const icon = result.status === 'posted' || result.status === 'ok' ? '✓'
               : result.status === 'skipped' ? '-'
               : result.status === 'nothing_to_post' ? '○'
               : result.status === 'dry_run' ? '~'
               : '✗';
    log(`  ${icon} ${agent}: ${result.status}${result.error ? ' — ' + result.error : ''}${result.url ? ' → ' + result.url : ''}`);
  }
  separator();
  log('');

})().catch(e => {
  log(`FATAL: ${e.message}`);
  process.exit(1);
});
