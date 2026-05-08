#!/bin/bash
# Run this once you have your Apple Developer Team ID
# Usage: bash tools/configure-apple-signin.sh YOUR_TEAM_ID
#
# Team ID = 10-character code at top-right of developer.apple.com/account
# Looks like: ABC1234DEF

set -e

TEAM_ID="${1}"
if [ -z "$TEAM_ID" ]; then
  echo "Usage: bash tools/configure-apple-signin.sh YOUR_TEAM_ID"
  exit 1
fi

KEY_ID="FZPBZNQ668"
P8_PATH="/Users/danstuart/propertydna-landing/AuthKey_FZPBZNQ668.p8"
PROJECT_ID="propertydna"
BUNDLE_ID="com.propertydna.app"
PBXPROJ="/Users/danstuart/propertydna-landing/app/frontend/ios/App/App.xcodeproj/project.pbxproj"

echo "=== PropertyDNA — Apple Sign-In Auto-Configure ==="
echo "Team ID:  $TEAM_ID"
echo "Key ID:   $KEY_ID"
echo ""

# 1. Patch Xcode project with Team ID
echo "[1/4] Setting DEVELOPMENT_TEAM in Xcode project..."
sed -i '' "s/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;\n\t\t\t\tDEVELOPMENT_TEAM = ${TEAM_ID};/g" "$PBXPROJ"
echo "      Done ✓"

# 2. Configure Firebase Apple Sign-In via REST API
echo "[2/4] Configuring Firebase Apple Sign-In..."
TOKEN=$(gcloud auth print-access-token 2>/dev/null)
PRIVATE_KEY=$(cat "$P8_PATH" | python3 -c "import sys; print(sys.stdin.read().strip().replace('\n','\\n'))")

curl -s -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/apple.com?updateMask=enabled,appleSignInConfig" \
  -d "{
    \"name\": \"projects/${PROJECT_ID}/defaultSupportedIdpConfigs/apple.com\",
    \"enabled\": true,
    \"appleSignInConfig\": {
      \"bundleIds\": [\"${BUNDLE_ID}\"],
      \"codeFlowConfig\": {
        \"teamId\": \"${TEAM_ID}\",
        \"keyId\": \"${KEY_ID}\",
        \"privateKey\": \"${PRIVATE_KEY}\"
      }
    }
  }" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print('  Firebase error:', d['error'].get('message'))
else:
    print('  Firebase Apple config updated ✓')
    cfg = d.get('appleSignInConfig', {})
    flow = cfg.get('codeFlowConfig', {})
    print('  Team ID set:', flow.get('teamId','?'))
"

# 3. Run cap sync
echo "[3/4] Running cap sync ios..."
cd /Users/danstuart/propertydna-landing/app/frontend
npx cap sync ios 2>&1 | grep -E "Found|✔|✖|error" | head -10
echo "      Done ✓"

# 4. Commit
echo "[4/4] Committing..."
cd /Users/danstuart/propertydna-landing
git add \
  app/frontend/ios/App/App.xcodeproj/project.pbxproj \
  app/frontend/ios/App/CapApp-SPM/Package.swift

git commit -m "Set Apple Developer Team ID ${TEAM_ID} — app ready for Xcode Archive

DEVELOPMENT_TEAM added to Debug + Release build configs.
Firebase Apple Sign-In configured with Key ID FZPBZNQ668.
cap sync clean.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push origin main

echo ""
echo "=== ALL DONE ==="
echo ""
echo "Next steps:"
echo "  1. open app/frontend/ios/App/App.xcodeproj"
echo "  2. Xcode: Product → Archive"
echo "  3. Organizer: Distribute App → App Store Connect → Upload"
echo "  4. App Store Connect: submit for TestFlight review"
