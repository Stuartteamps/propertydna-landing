#!/bin/bash
# PropertyDNA Sona Setup — One-Command Workflow
# Usage: bash tools/sona-go.sh
# Total Dan time: ~10 seconds (just type the 6-digit code from your phone)

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${GREEN}🚀 PropertyDNA Sona Setup Workflow${NC}"
echo ""
echo "This will:"
echo "  1. Open browser to Quo login"
echo "  2. Auto-fill your email + request verification code"
echo "  3. Pause and ask you for the 6-digit code from your phone"
echo "  4. Auto-fill all Sona fields (greeting, instructions, FAQs, URLs)"
echo "  5. Pause at Publish so you can verify"
echo ""
echo -e "${YELLOW}Make sure your phone is nearby for the Quo verification email.${NC}"
echo ""
read -p "Ready? Press Enter to start..."

# Ensure googleapis is available (in case it was cleaned up)
if [ ! -d "/tmp/node_modules/googleapis" ]; then
  echo "Installing dependencies..."
  cd /tmp && npm install googleapis --silent && cd - > /dev/null
fi

node tools/sona-deploy.js
