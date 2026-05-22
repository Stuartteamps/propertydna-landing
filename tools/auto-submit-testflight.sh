#!/bin/bash
# PropertyDNA — Automated TestFlight Submission Pipeline
#
# Triggered by xcode-watcher.sh once Xcode finishes installing.
# Builds, archives, exports, and uploads to App Store Connect.
#
# Required env vars (set by watcher or manually):
#   APP_STORE_CONNECT_KEY_ID     — e.g. ABC1234567 (from App Store Connect → Users → Keys)
#   APP_STORE_CONNECT_ISSUER_ID  — e.g. 6e1b9a8e-... (UUID at top of Keys page)
#   APP_STORE_CONNECT_KEY_PATH   — path to AuthKey_XXXX.p8 (App Store Connect API key, NOT Apple Sign-In)
#
# Without these env vars, the script stops at the IPA export step and prints
# the manual upload command you can run after creating the API key.

set -e

# ── Config ────────────────────────────────────────────────────────────────────
TEAM_ID="8NR9GCA6GQ"
BUNDLE_ID="com.propertydna.app"
PROJECT_DIR="/Users/danstuart/propertydna-landing/app/frontend/ios/App"
PROJECT="$PROJECT_DIR/App.xcodeproj"
SCHEME="App"
ARCHIVE_PATH="/tmp/PropertyDNA.xcarchive"
EXPORT_PATH="/tmp/PropertyDNA-export"
EXPORT_OPTIONS="/tmp/ExportOptions.plist"
LOG="/tmp/propertydna-submit.log"

log() { echo "$(date '+%H:%M:%S') $*" | tee -a "$LOG"; }

log "═══════════════════════════════════════════════════"
log "PropertyDNA Auto-Submit Pipeline starting"
log "═══════════════════════════════════════════════════"

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
if [ ! -d "/Applications/Xcode.app" ]; then
  log "ERROR: Xcode not installed. Aborting."
  exit 1
fi

XCODE_VERSION=$(xcodebuild -version 2>/dev/null | head -1)
log "Found: $XCODE_VERSION"

# Accept license if needed (non-interactive — if sudo prompts, skip)
sudo -n xcodebuild -license accept 2>/dev/null || log "  (skipping sudo license accept — assumed already accepted)"
sudo -n xcode-select -s /Applications/Xcode.app/Contents/Developer 2>/dev/null || true

# ── 2. Sync latest web build ──────────────────────────────────────────────────
log "Building web bundle and syncing to iOS..."
cd /Users/danstuart/propertydna-landing/app/frontend
npm run build 2>&1 | tail -5 | tee -a "$LOG"
npx cap sync ios 2>&1 | tail -10 | tee -a "$LOG"

# ── 3. Resolve Swift Packages ─────────────────────────────────────────────────
log "Resolving Swift Package dependencies..."
xcodebuild -resolvePackageDependencies \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  2>&1 | tail -3 | tee -a "$LOG"

# ── 4. Archive ────────────────────────────────────────────────────────────────
log "Creating archive (this takes 5–10 min)..."
rm -rf "$ARCHIVE_PATH"

xcodebuild archive \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  2>&1 | tail -30 | tee -a "$LOG"

if [ ! -d "$ARCHIVE_PATH" ]; then
  log "ERROR: Archive failed. Check log at $LOG"
  osascript -e 'display notification "Archive failed — check /tmp/propertydna-submit.log" with title "PropertyDNA Build Failed" sound name "Sosumi"'
  exit 1
fi
log "Archive created ✓"

# ── 5. Generate ExportOptions.plist ───────────────────────────────────────────
cat > "$EXPORT_OPTIONS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>$TEAM_ID</string>
    <key>uploadSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>manual</string>
    <key>destination</key>
    <string>upload</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.thepropertydna.app</key>
        <string>5f745471-83f6-4464-a21c-eb22a5440c1d</string>
    </dict>
</dict>
</plist>
PLIST

# ── 6. Export IPA ─────────────────────────────────────────────────────────────
log "Exporting IPA..."
rm -rf "$EXPORT_PATH"

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates \
  2>&1 | tail -15 | tee -a "$LOG"

IPA_FILE=$(find "$EXPORT_PATH" -name "*.ipa" | head -1)
if [ -z "$IPA_FILE" ]; then
  log "ERROR: IPA export failed"
  exit 1
fi
log "IPA exported: $IPA_FILE"

# ── 7. Upload to App Store Connect ────────────────────────────────────────────
if [ -z "$APP_STORE_CONNECT_KEY_ID" ] || [ -z "$APP_STORE_CONNECT_ISSUER_ID" ] || [ -z "$APP_STORE_CONNECT_KEY_PATH" ]; then
  log ""
  log "⚠ App Store Connect API credentials not set."
  log ""
  log "The IPA is ready at: $IPA_FILE"
  log ""
  log "To create an App Store Connect API key:"
  log "  1. Go to https://appstoreconnect.apple.com/access/integrations/api"
  log "  2. Click '+' → name 'PropertyDNA Auto-Deploy' → role 'Developer'"
  log "  3. Click 'Generate' → download the .p8 file"
  log "  4. Note the Key ID (10 chars) and Issuer ID (UUID at top of page)"
  log ""
  log "Then run:"
  log "  export APP_STORE_CONNECT_KEY_ID=YOUR_KEY_ID"
  log "  export APP_STORE_CONNECT_ISSUER_ID=YOUR_ISSUER_UUID"
  log "  export APP_STORE_CONNECT_KEY_PATH=~/Downloads/AuthKey_XXX.p8"
  log "  bash $0"
  log ""
  osascript -e 'display notification "IPA ready! Need App Store Connect API key to upload." with title "PropertyDNA Build Complete" sound name "Glass"'
  exit 0
fi

log "Uploading to App Store Connect via altool..."
xcrun altool --upload-app \
  --type ios \
  --file "$IPA_FILE" \
  --apiKey "$APP_STORE_CONNECT_KEY_ID" \
  --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID" \
  2>&1 | tee -a "$LOG"

if [ $? -eq 0 ]; then
  log ""
  log "═══════════════════════════════════════════════════"
  log "✅ UPLOAD COMPLETE"
  log "═══════════════════════════════════════════════════"
  log ""
  log "Build will appear in App Store Connect → TestFlight in ~10–30 min"
  log "after Apple processes it. You'll get an email when ready."
  log ""

  # Read marketing version + build number from project
  BUILD_VERSION=$(grep "MARKETING_VERSION" "$PROJECT/project.pbxproj" | head -1 | grep -o '= [^;]*' | tr -d '= ')
  BUILD_NUMBER=$(grep "CURRENT_PROJECT_VERSION" "$PROJECT/project.pbxproj" | head -1 | grep -o '= [^;]*' | tr -d '= ')
  TESTFLIGHT_URL="https://appstoreconnect.apple.com/teams/$TEAM_ID/apps"

  # Wait for Apple to process the build (typically 5–15 min)
  log "Waiting 8 minutes for Apple to process build..."
  sleep 480

  # Fire notifications: SMS + Email + macOS notification
  bash /Users/danstuart/propertydna-landing/tools/notify-launch.sh \
    "PropertyDNA $BUILD_VERSION (build $BUILD_NUMBER)" \
    "$TESTFLIGHT_URL" >> "$LOG" 2>&1

else
  log "ERROR: Upload failed. Check log."
  osascript -e 'display notification "Upload failed — check /tmp/propertydna-submit.log" with title "PropertyDNA Upload Failed" sound name "Sosumi"'

  # Notify failure
  osascript <<AS
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+16196770900" of targetService
    send "❌ PropertyDNA build upload failed. Check /tmp/propertydna-submit.log on Mac." to targetBuddy
end tell
AS
  exit 1
fi
