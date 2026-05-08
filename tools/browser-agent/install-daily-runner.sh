#!/bin/bash
# Install the PropertyDNA daily runner as a launchd job (runs 7:00 AM daily)
# Usage: bash tools/browser-agent/install-daily-runner.sh

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="$DIR/daily-runner.js"
LOG="$DIR/daily-runner.log"
PLIST_SRC="$DIR/com.propertydna.daily-runner.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.propertydna.daily-runner.plist"

# Find node
NODE=$(which node || which /usr/local/bin/node || which /opt/homebrew/bin/node)
if [ -z "$NODE" ]; then
  echo "ERROR: node not found in PATH"
  exit 1
fi

echo "Installing PropertyDNA Daily Runner..."
echo "  Node: $NODE"
echo "  Runner: $RUNNER"
echo "  Log: $LOG"

# Create plist with actual paths
sed \
  -e "s|RUNNER_PATH|$RUNNER|g" \
  -e "s|LOG_PATH|$LOG|g" \
  -e "s|WORKING_DIR|$DIR|g" \
  -e "s|/usr/local/bin/node|$NODE|g" \
  "$PLIST_SRC" > "$PLIST_DEST"

# Unload if already loaded
launchctl unload "$PLIST_DEST" 2>/dev/null || true

# Load
launchctl load "$PLIST_DEST"

echo ""
echo "✓ Daily runner installed — runs every day at 7:00 AM"
echo "  Log: $LOG"
echo "  Plist: $PLIST_DEST"
echo ""
echo "To run now:  node $RUNNER"
echo "To dry run:  node $RUNNER --dry-run"
echo "To unload:   launchctl unload $PLIST_DEST"
