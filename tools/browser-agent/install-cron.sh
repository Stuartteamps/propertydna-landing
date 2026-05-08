#!/bin/bash
# Installs the CC token refresh as a daily macOS launchd job.
# Run once: bash tools/browser-agent/install-cron.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="com.propertydna.cc-refresh.plist"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

echo "=== PropertyDNA CC Token Auto-Refresh Installer ==="
echo ""

# Step 1: Save credentials
if [ ! -f "$SCRIPT_DIR/.cc-creds.json" ]; then
  echo "Enter your Constant Contact login credentials."
  echo "(These are stored locally in $SCRIPT_DIR/.cc-creds.json — never committed to git)"
  echo ""
  read -p "CC Email: " CC_EMAIL
  read -s -p "CC Password: " CC_PASSWORD
  echo ""

  CC_EMAIL="$CC_EMAIL" CC_PASSWORD="$CC_PASSWORD" \
    node "$SCRIPT_DIR/refresh-cc-token.js" --save-creds
else
  echo "✓ Credentials already saved at $SCRIPT_DIR/.cc-creds.json"
fi

# Step 2: Test the script runs successfully
echo ""
echo "Testing token refresh (will open headless browser)..."
if node "$SCRIPT_DIR/refresh-cc-token.js"; then
  echo "✓ Token refresh works!"
else
  echo "✗ Token refresh failed. Check $SCRIPT_DIR/refresh.log"
  exit 1
fi

# Step 3: Install launchd job
mkdir -p "$LAUNCH_AGENTS"
cp "$SCRIPT_DIR/$PLIST" "$LAUNCH_AGENTS/$PLIST"

# Unload if already loaded
launchctl unload "$LAUNCH_AGENTS/$PLIST" 2>/dev/null || true
launchctl load "$LAUNCH_AGENTS/$PLIST"

echo ""
echo "✓ Launchd job installed and loaded"
echo "  Runs: every day at 1:00 AM"
echo "  Log:  $SCRIPT_DIR/refresh.log"
echo ""
echo "To check status:  launchctl list | grep propertydna"
echo "To run now:       launchctl start com.propertydna.cc-refresh"
echo "To uninstall:     launchctl unload ~/Library/LaunchAgents/$PLIST && rm ~/Library/LaunchAgents/$PLIST"
echo ""
echo "=== Done ==="
