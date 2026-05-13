#!/bin/bash
# Watches ~/Downloads for new ASC API .p8 file and auto-configures pipeline
# Skips AuthKey_FZPBZNQ668.p8 which is the Sign In with Apple key (not ASC)

LOG="/tmp/asc-key-watcher.log"
KNOWN_KEY="FZPBZNQ668"
echo "$(date '+%H:%M:%S') ASC key watcher started" > "$LOG"

while true; do
  # Find new .p8 files in Downloads (not the Sign In with Apple key)
  for keyfile in ~/Downloads/AuthKey_*.p8; do
    [ -e "$keyfile" ] || continue
    KEY_BASENAME=$(basename "$keyfile" .p8 | sed 's/AuthKey_//')

    if [ "$KEY_BASENAME" != "$KNOWN_KEY" ]; then
      echo "$(date '+%H:%M:%S') Found new ASC key: $KEY_BASENAME" >> "$LOG"

      # Move to a known location
      mkdir -p ~/.appstoreconnect/private_keys
      cp "$keyfile" ~/.appstoreconnect/private_keys/

      # Notify user we found the key, ask for Issuer ID
      osascript -e "display notification \"Found ASC API key $KEY_BASENAME — need Issuer ID to upload. Reply with it in Claude.\" with title \"PropertyDNA — ASC Key Detected\" sound name \"Glass\""

      # Send iMessage prompt
      osascript <<APPLESCRIPT
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+16196770900" of targetService
    send "✅ Detected your ASC API key: $KEY_BASENAME

Reply to Claude with the Issuer ID (UUID) shown at the top of the App Store Connect API page. The build will upload automatically once I have it." to targetBuddy
end tell
APPLESCRIPT

      # Save key info for the build script to find
      cat > /tmp/asc-key-info.env <<ENV
APP_STORE_CONNECT_KEY_ID=$KEY_BASENAME
APP_STORE_CONNECT_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_${KEY_BASENAME}.p8
# APP_STORE_CONNECT_ISSUER_ID — fill this in when user provides it
ENV

      echo "$(date '+%H:%M:%S') Key info saved to /tmp/asc-key-info.env" >> "$LOG"
      exit 0
    fi
  done
  sleep 5
done
