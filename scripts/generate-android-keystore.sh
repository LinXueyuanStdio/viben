#!/bin/bash
# Generate Android release keystore for app signing
#
# Usage: ./scripts/generate-android-keystore.sh
#
# This script generates a keystore file for signing Android APKs/AABs.
# The keystore should be kept secure and NOT committed to git.
#
# After generating, you need to:
# 1. Store the keystore file securely
# 2. Add these secrets to GitHub Actions:
#    - ANDROID_KEYSTORE_BASE64: base64 encoded keystore file
#    - ANDROID_KEYSTORE_PASSWORD: keystore password
#    - ANDROID_KEY_ALIAS: key alias (viben)
#    - ANDROID_KEY_PASSWORD: key password

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
KEYSTORE_DIR="apps/desktop/src-tauri/keys"
KEYSTORE_FILE="$KEYSTORE_DIR/viben-release.keystore"
KEY_ALIAS="viben"
VALIDITY_DAYS=10000  # ~27 years

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
    echo -e "${RED}Error: keytool not found${NC}"
    echo "Please install Java JDK to use keytool"
    echo ""
    echo "On macOS: brew install openjdk"
    echo "On Ubuntu: sudo apt install default-jdk"
    echo "On Windows: Install JDK from https://adoptium.net/"
    exit 1
fi

# Create keys directory
mkdir -p "$KEYSTORE_DIR"

# Check if keystore already exists
if [ -f "$KEYSTORE_FILE" ]; then
    echo -e "${YELLOW}Warning: Keystore already exists at $KEYSTORE_FILE${NC}"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    rm -f "$KEYSTORE_FILE"
fi

echo -e "${BLUE}Generating Android release keystore...${NC}"
echo ""

# Prompt for passwords
echo -e "${YELLOW}Enter keystore password (min 6 characters):${NC}"
read -s STORE_PASS
echo ""

echo -e "${YELLOW}Confirm keystore password:${NC}"
read -s STORE_PASS_CONFIRM
echo ""

if [ "$STORE_PASS" != "$STORE_PASS_CONFIRM" ]; then
    echo -e "${RED}Passwords do not match!${NC}"
    exit 1
fi

if [ ${#STORE_PASS} -lt 6 ]; then
    echo -e "${RED}Password must be at least 6 characters!${NC}"
    exit 1
fi

# Prompt for key password (can be same as keystore password)
echo -e "${YELLOW}Enter key password (press Enter to use same as keystore password):${NC}"
read -s KEY_PASS
echo ""

if [ -z "$KEY_PASS" ]; then
    KEY_PASS="$STORE_PASS"
fi

# Prompt for certificate details
echo -e "${YELLOW}Enter certificate details (press Enter for defaults):${NC}"
echo ""

read -p "Organization name [Viben]: " ORG_NAME
ORG_NAME=${ORG_NAME:-Viben}

read -p "Organization unit [Mobile]: " ORG_UNIT
ORG_UNIT=${ORG_UNIT:-Mobile}

read -p "City [Beijing]: " CITY
CITY=${CITY:-Beijing}

read -p "State/Province [Beijing]: " STATE
STATE=${STATE:-Beijing}

read -p "Country code (2 letters) [CN]: " COUNTRY
COUNTRY=${COUNTRY:-CN}

# Generate keystore
DNAME="CN=$ORG_NAME, OU=$ORG_UNIT, O=$ORG_NAME, L=$CITY, ST=$STATE, C=$COUNTRY"

echo ""
echo -e "${BLUE}Generating keystore with:${NC}"
echo "  Alias: $KEY_ALIAS"
echo "  Validity: $VALIDITY_DAYS days"
echo "  DN: $DNAME"
echo ""

keytool -genkey -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY_DAYS" \
    -storepass "$STORE_PASS" \
    -keypass "$KEY_PASS" \
    -dname "$DNAME"

echo ""
echo -e "${GREEN}Keystore generated successfully!${NC}"
echo ""
echo "File: $KEYSTORE_FILE"
echo ""

# Show keystore info
echo -e "${BLUE}Keystore contents:${NC}"
keytool -list -v -keystore "$KEYSTORE_FILE" -storepass "$STORE_PASS" | head -20

echo ""
echo -e "${YELLOW}IMPORTANT: Keep this keystore secure!${NC}"
echo ""
echo "To add to GitHub Actions secrets:"
echo ""
echo "1. Generate base64 encoded keystore:"
echo -e "   ${BLUE}base64 -i $KEYSTORE_FILE | tr -d '\\n' > keystore.base64${NC}"
echo ""
echo "2. Add these secrets to your repository:"
echo "   - ANDROID_KEYSTORE_BASE64: contents of keystore.base64"
echo "   - ANDROID_KEYSTORE_PASSWORD: your keystore password"
echo "   - ANDROID_KEY_ALIAS: $KEY_ALIAS"
echo "   - ANDROID_KEY_PASSWORD: your key password"
echo ""
echo -e "${RED}DO NOT commit the keystore file to git!${NC}"

# Add to gitignore if not already there
GITIGNORE="apps/desktop/src-tauri/.gitignore"
if [ -f "$GITIGNORE" ]; then
    if ! grep -q "keys/" "$GITIGNORE"; then
        echo "" >> "$GITIGNORE"
        echo "# Android signing keys (DO NOT COMMIT)" >> "$GITIGNORE"
        echo "keys/" >> "$GITIGNORE"
        echo -e "${GREEN}Added keys/ to .gitignore${NC}"
    fi
else
    echo "# Android signing keys (DO NOT COMMIT)" > "$GITIGNORE"
    echo "keys/" >> "$GITIGNORE"
    echo -e "${GREEN}Created .gitignore with keys/ entry${NC}"
fi
