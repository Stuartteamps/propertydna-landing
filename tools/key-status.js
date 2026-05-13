#!/usr/bin/env node
/**
 * Key Status — shows expiry status for all tracked API keys.
 * Run from Claude terminal: ! node tools/key-status.js
 *
 * Reads from Netlify env (requires netlify CLI logged in) or .env.local fallback.
 */
const { execSync } = require('child_process');

const KEYS = [
  // JWT keys (expiry encoded in token)
  { name: 'N8N_API_KEY',       type: 'jwt',    envVar: 'N8N_API_KEY',       autoRotate: true,  rotateNote: 'auto-rotated by key-watchdog.js (Mon 8AM PST)' },
  { name: 'CC_ACCESS_TOKEN',   type: 'jwt',    envVar: 'CC_ACCESS_TOKEN',   autoRotate: false, rotateNote: 'auto-rotated by auto-refresh-cc-token.js (Wed 11:59 PM PST) — expected to show 0d daily' },
  { name: 'CC_REFRESH_TOKEN',  type: 'static', envVar: 'CC_REFRESH_TOKEN',  autoRotate: false, rotateNote: 'long-lived, renewed with each CC token refresh' },

  // Static keys (no expiry — track manually)
  { name: 'ANTHROPIC_API_KEY', type: 'static', envVar: 'ANTHROPIC_API_KEY', autoRotate: false, rotateNote: 'no expiry — rotate annually or if compromised' },
  { name: 'RESEND_API_KEY',    type: 'static', envVar: 'RESEND_API_KEY',    autoRotate: false, rotateNote: 'no expiry' },
  { name: 'STRIPE_SECRET_KEY', type: 'static', envVar: 'STRIPE_SECRET_KEY', autoRotate: false, rotateNote: 'no expiry' },
  { name: 'RENTCAST_API_KEY',  type: 'static', envVar: 'RENTCAST_API_KEY',  autoRotate: false, rotateNote: 'no expiry' },
  { name: 'NETLIFY_PAT',       type: 'static', envVar: 'NETLIFY_PAT',       autoRotate: false, rotateNote: 'no expiry — check netlify.com if auth issues' },
  { name: 'TRACERFY_API_KEY',  type: 'jwt',    envVar: 'TRACERFY_API_KEY',  autoRotate: false, rotateNote: 'exp: 2072 (effectively permanent)' },
];

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

function decodeJwtExp(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.exp ? payload.exp * 1000 : null;
  } catch { return null; }
}

function daysLeft(ms) {
  return Math.round((ms - Date.now()) / 86400000);
}

function getNetlifyEnv(varName) {
  try {
    const raw = execSync(
      `netlify env:get ${varName} --site=784437c8-12f8-470b-bb0b-ccf5ec9c0a4a 2>/dev/null`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return raw || null;
  } catch { return null; }
}

async function main() {
  console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BOLD}  PropertyDNA — API Key Status  [warhorse7308]${RESET}`);
  console.log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  console.log(`${DIM}Fetching from Netlify env...${RESET}\n`);

  const rows = [];

  for (const k of KEYS) {
    const value = getNetlifyEnv(k.envVar);

    if (!value) {
      rows.push({ ...k, status: 'MISSING', days: null, label: '  MISSING  ' });
      continue;
    }

    if (k.type === 'jwt') {
      const exp = decodeJwtExp(value);
      if (!exp) {
        rows.push({ ...k, status: 'NO-EXPIRY', days: null, label: ' NO-EXPIRY ' });
      } else {
        const days = daysLeft(exp);
        const expDate = new Date(exp).toISOString().split('T')[0];
        if (days < 0) {
          rows.push({ ...k, status: 'EXPIRED',  days, expDate, label: '  EXPIRED  ' });
        } else if (days <= 3) {
          rows.push({ ...k, status: 'CRITICAL', days, expDate, label: ' CRITICAL  ' });
        } else if (days <= 14) {
          rows.push({ ...k, status: 'WARNING',  days, expDate, label: '  WARNING  ' });
        } else {
          rows.push({ ...k, status: 'OK',       days, expDate, label: '    OK     ' });
        }
      }
    } else {
      rows.push({ ...k, status: 'STATIC', days: null, label: '  STATIC   ' });
    }
  }

  const maxName = Math.max(...rows.map(r => r.name.length));

  for (const r of rows) {
    let color, labelStr;
    switch (r.status) {
      case 'OK':        color = GREEN;  labelStr = `${GREEN}✓ OK       ${RESET}`; break;
      case 'STATIC':    color = DIM;    labelStr = `${DIM}  STATIC   ${RESET}`; break;
      case 'NO-EXPIRY': color = DIM;    labelStr = `${DIM}  ∞ NONE   ${RESET}`; break;
      case 'WARNING':   color = YELLOW; labelStr = `${YELLOW}⚠ WARNING  ${RESET}`; break;
      case 'CRITICAL':  color = RED;    labelStr = `${RED}${BOLD}! CRITICAL ${RESET}`; break;
      case 'EXPIRED':   color = RED;    labelStr = `${RED}${BOLD}✗ EXPIRED  ${RESET}`; break;
      case 'MISSING':   color = RED;    labelStr = `${RED}  MISSING  ${RESET}`; break;
      default:          color = DIM;    labelStr = `${DIM}  UNKNOWN  ${RESET}`; break;
    }

    const namePad = r.name.padEnd(maxName + 2);
    const daysStr = r.days !== null
      ? (r.days < 0 ? `${RED}${r.days}d PAST DUE${RESET}` : `${r.days <= 14 ? YELLOW : ''}${r.days}d${RESET}`)
      : '';
    const dateStr = r.expDate ? ` (expires ${r.expDate})` : '';
    const noteStr = `${DIM}${r.rotateNote || ''}${RESET}`;

    console.log(`  ${namePad} ${labelStr} ${daysStr}${dateStr}`);
    console.log(`  ${' '.repeat(maxName + 2)} ${DIM}${r.rotateNote}${RESET}\n`);
  }

  const critical = rows.filter(r => ['EXPIRED', 'CRITICAL', 'WARNING'].includes(r.status));
  if (critical.length > 0) {
    console.log(`${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`${RED}${BOLD}  ACTION REQUIRED${RESET}`);
    for (const r of critical) {
      if (r.autoRotate) {
        console.log(`  ${r.name}: will be auto-rotated on next watchdog run (Mon 8 AM PST)`);
        console.log(`  To force now: curl -X POST https://thepropertydna.com/.netlify/functions/key-watchdog`);
      } else {
        console.log(`  ${r.name}: rotate manually — ${r.rotateNote}`);
      }
    }
    console.log(`${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  } else {
    console.log(`${GREEN}  All keys healthy.${RESET}\n`);
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
