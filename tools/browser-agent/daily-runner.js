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
 *
 * Credentials live in .daily-creds.json (chmod 600):
 * {
 *   "reddit":  { "clientId": "", "clientSecret": "", "username": "", "password": "" },
 *   "medium":  { "token": "", "userId": "" },
 *   "buffer":  { "token": "" },
 *   "googleAnalytics": { "propertyId": "", "serviceAccountKey": "" }
 * }
 *
 * Manual run: node tools/browser-agent/daily-runner.js
 * Skip an agent: node tools/browser-agent/daily-runner.js --skip reddit,medium
 * Dry run:  node tools/browser-agent/daily-runner.js --dry-run
 */

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

const LOG_FILE     = path.join(__dirname, 'daily-runner.log');
const CREDS_FILE   = path.join(__dirname, '.daily-creds.json');

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP    = (args.find(a => a.startsWith('--skip=')) || args[args.indexOf('--skip') + 1] || '')
                  .replace('--skip=', '').split(',').filter(Boolean);

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
  log('\n[1/5] Constant Contact token refresh');
  results.cc = await runCCRefresh();

  // 2. Reddit post
  log('\n[2/5] Reddit posting');
  results.reddit = await runAgent('reddit', path.join(__dirname, 'agents/reddit.js'));

  // 3. Medium cross-post
  log('\n[3/5] Medium cross-posting');
  results.medium = await runAgent('medium', path.join(__dirname, 'agents/medium.js'));

  // 4. Buffer social post
  log('\n[4/5] Buffer social posting');
  results.buffer = await runAgent('buffer', path.join(__dirname, 'agents/buffer.js'));

  // 5. Google Analytics pull
  log('\n[5/5] Google Analytics daily summary');
  results.ga = await runAgent('ga', path.join(__dirname, 'agents/google-analytics.js'));

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
