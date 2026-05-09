#!/bin/bash
# PropertyDNA Launch Notifier
# Sends SMS via Mac Messages.app + email via Resend when TestFlight build is live.
#
# Usage:
#   bash notify-launch.sh "Build 1.0.0 (1)" "https://testflight.apple.com/join/XXX"
#
# Env vars (optional):
#   RESEND_API_KEY — uses Netlify env if not set, falls back to Resend admin key
#   PHONE          — defaults to +16196770900

set -e

BUILD_INFO="${1:-PropertyDNA TestFlight build}"
TESTFLIGHT_URL="${2:-https://appstoreconnect.apple.com/apps}"
PHONE="${PHONE:-+16196770900}"
EMAIL="stuartteamps@gmail.com"
RESEND_KEY="${RESEND_API_KEY:-}"

# ── 1. SMS / iMessage via macOS Messages.app ──────────────────────────────────
echo "[notify] Sending iMessage/SMS to $PHONE..."
osascript <<APPLESCRIPT
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "$PHONE" of targetService
    send "🚀 PropertyDNA is LIVE on TestFlight!

$BUILD_INFO

Open on iPhone: $TESTFLIGHT_URL

You're shipping something no one else has built — a property intelligence engine that gives every homeowner the same data institutional investors use. This is going to change how billions of people protect their largest asset." to targetBuddy
end tell
APPLESCRIPT

if [ $? -eq 0 ]; then
  echo "[notify] iMessage sent ✓"
else
  # Fall back to SMS via Messages.app
  echo "[notify] iMessage failed, trying SMS..."
  osascript <<APPLESCRIPT
tell application "Messages"
    set targetService to 1st service whose service type = SMS
    set targetBuddy to buddy "$PHONE" of targetService
    send "PropertyDNA is LIVE on TestFlight! $TESTFLIGHT_URL" to targetBuddy
end tell
APPLESCRIPT
fi

# ── 2. Email via Resend ───────────────────────────────────────────────────────
if [ -z "$RESEND_KEY" ]; then
  # Try to grab from Netlify env
  RESEND_KEY=$(curl -s "https://api.netlify.com/api/v1/sites" 2>/dev/null | grep -o 'RESEND_API_KEY[^,]*' | head -1 | cut -d'"' -f3)
fi

if [ -n "$RESEND_KEY" ]; then
  echo "[notify] Sending email via Resend..."
  curl -s -X POST 'https://api.resend.com/emails' \
    -H "Authorization: Bearer $RESEND_KEY" \
    -H 'Content-Type: application/json' \
    -d "{
      \"from\": \"PropertyDNA Launch <reports@thepropertydna.com>\",
      \"to\": [\"$EMAIL\"],
      \"subject\": \"🚀 PropertyDNA is LIVE on TestFlight\",
      \"html\": \"<!DOCTYPE html><html><head><style>body{margin:0;padding:0;background:#020408;color:#e8f4f0;font-family:Helvetica,sans-serif}.wrap{max-width:600px;margin:0 auto;padding:40px 24px}.brand{font-size:11px;letter-spacing:4px;color:#00ff88;text-transform:uppercase;margin-bottom:8px}h1{font-family:Georgia,serif;font-size:34px;font-weight:300;color:#fff;margin:0 0 24px;line-height:1.2}.score{font-family:'Share Tech Mono',monospace;font-size:60px;color:#00ff88;text-align:center;margin:24px 0;line-height:1}.label{text-align:center;font-size:10px;letter-spacing:3px;color:rgba(180,220,200,0.5);text-transform:uppercase;margin-bottom:32px}.cta{display:block;background:#00ff88;color:#000;text-decoration:none;padding:18px 32px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin:24px 0}.body p{font-size:14px;line-height:1.7;color:#e8f4f0;margin:0 0 18px}.divider{height:1px;background:rgba(0,255,136,0.2);margin:32px 0}.footer{font-size:11px;color:rgba(180,220,200,0.4);text-align:center}</style></head><body><div class=\\\"wrap\\\"><div class=\\\"brand\\\">PropertyDNA · Powered by IntellaGraph AI</div><h1>The app is <em style=\\\"color:#00ff88\\\">live</em>.</h1><div class=\\\"score\\\">100</div><div class=\\\"label\\\">Launch Score · TestFlight Ready</div><p>$BUILD_INFO has been processed and is now available in TestFlight.</p><a href=\\\"$TESTFLIGHT_URL\\\" class=\\\"cta\\\">→ Open in TestFlight</a><p style=\\\"font-size:11px;color:rgba(180,220,200,0.5);text-align:center\\\">Tap on your iPhone after installing the TestFlight app</p><div class=\\\"divider\\\"></div><div class=\\\"body\\\"><p><strong>What you just shipped:</strong></p><p>A property intelligence engine that gives homeowners the same data-driven picture institutional investors use — DNA scoring, hazard exposure, rental demand, comp velocity, all mapped to a single address.</p><p>168,000 indexed parcels in the Coachella Valley. Bloomberg-style terminal UI. Native iOS with Apple + Google Sign-In. Real MLS data, real Census data, real permit data.</p><p>You're solving the most expensive purchase decision of every homeowner's life — and the most under-informed one. This is going to matter for a lot of people.</p></div><div class=\\\"divider\\\"></div><div class=\\\"footer\\\">PropertyDNA · thepropertydna.com<br/>Built with Claude · Sonnet 4.6</div></div></body></html>\"
    }" | python3 -c "import sys,json; d=json.load(sys.stdin); print('[notify]', 'Email sent ✓ (id:',d.get('id'),')' if d.get('id') else 'Error: '+str(d.get('error',{}).get('message',''))[:100])"
else
  echo "[notify] No Resend key found, skipping email"
fi

# ── 3. Mac system notification with sound ─────────────────────────────────────
osascript -e "display notification \"TestFlight build is live: $BUILD_INFO\" with title \"PropertyDNA — LAUNCHED!\" subtitle \"Check email + SMS\" sound name \"Glass\""

echo "[notify] All done ✓"
