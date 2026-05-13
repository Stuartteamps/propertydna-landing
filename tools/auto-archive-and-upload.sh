#!/bin/bash
set -e
PROFILE_UUID="$1"
LOG="/tmp/propertydna-final.log"

echo "$(date '+%H:%M:%S') Starting archive with profile $PROFILE_UUID" > "$LOG"

# Notify
osascript <<NOT
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+16196770900" of targetService
    send "📦 Archive started. ETA 5-10 min." to targetBuddy
end tell
NOT

cd /Users/danstuart/propertydna-landing/app/frontend

# Archive with manual signing
xcodebuild archive \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -archivePath /tmp/PropertyDNA.xcarchive \
  -destination 'generic/platform=iOS' \
  DEVELOPMENT_TEAM=8NR9GCA6GQ \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Apple Distribution: Daniel Stuart" \
  PROVISIONING_PROFILE_SPECIFIER="$PROFILE_UUID" \
  >> "$LOG" 2>&1

if [ ! -d /tmp/PropertyDNA.xcarchive ]; then
  echo "Archive failed" >> "$LOG"
  osascript <<NOT
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+16196770900" of targetService
    send "❌ Archive failed. Check /tmp/propertydna-final.log" to targetBuddy
end tell
NOT
  exit 1
fi

osascript <<NOT
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+16196770900" of targetService
    send "✅ Archive complete! Exporting IPA..." to targetBuddy
end tell
NOT

# Export IPA for App Store
cat > /tmp/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>8NR9GCA6GQ</string>
    <key>uploadSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>manual</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.thepropertydna.app</key>
        <string>$PROFILE_UUID</string>
    </dict>
</dict>
</plist>
PLIST

xcodebuild -exportArchive \
  -archivePath /tmp/PropertyDNA.xcarchive \
  -exportPath /tmp/PropertyDNA-export \
  -exportOptionsPlist /tmp/ExportOptions.plist \
  >> "$LOG" 2>&1

IPA=$(find /tmp/PropertyDNA-export -name "*.ipa" | head -1)
if [ -z "$IPA" ]; then
  osascript <<NOT
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+16196770900" of targetService
    send "❌ IPA export failed. Check log." to targetBuddy
end tell
NOT
  exit 1
fi

osascript <<NOT
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+16196770900" of targetService
    send "✅ IPA exported ($(du -h "$IPA" | awk '{print $1}')). Uploading to App Store Connect..." to targetBuddy
end tell
NOT

# Upload via altool with our existing API key
xcrun altool --upload-app \
  --type ios \
  --file "$IPA" \
  --apiKey T2D638UCM9 \
  --apiIssuer a3b6d4a4-760b-4e37-846e-6c2a9f2f536d >> "$LOG" 2>&1

if [ $? -eq 0 ]; then
  osascript <<NOT
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+16196770900" of targetService
    send "🚀🚀🚀 UPLOADED TO APP STORE CONNECT! Build will appear in TestFlight in 10-30 min after Apple processes it. You'll get an email from Apple. PropertyDNA is officially in flight." to targetBuddy
end tell
NOT
  echo "$(date '+%H:%M:%S') ✅ UPLOAD COMPLETE" >> "$LOG"
else
  osascript <<NOT
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+16196770900" of targetService
    send "❌ Upload failed. Check /tmp/propertydna-final.log" to targetBuddy
end tell
NOT
fi
