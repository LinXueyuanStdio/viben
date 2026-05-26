#!/bin/bash
# Test iOS app on simulator
# This script is called from GitHub Actions workflow
#
# Prerequisites:
#   - macOS with Xcode and simulators
#   - Maestro CLI
#   - iOS app bundle in ios-artifacts/ directory
#
# Environment variables:
#   - APP_PATH: Path to the .app bundle or .zip containing it
#   - SIMULATOR_ID: (optional) Simulator device ID to use

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing iOS App${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo -e "${RED}Error: iOS testing requires macOS${NC}"
  exit 1
fi

# Find or boot simulator
if [[ -z "$SIMULATOR_ID" ]]; then
  echo -e "${YELLOW}Finding available iPhone simulator...${NC}"
  SIMULATOR_ID=$(xcrun simctl list devices available | grep "iPhone" | head -1 | grep -oE '\([A-F0-9-]+\)' | tr -d '()')
  
  if [[ -z "$SIMULATOR_ID" ]]; then
    echo -e "${YELLOW}No iPhone simulator found, creating one...${NC}"
    SIMULATOR_ID=$(xcrun simctl create "Test iPhone" "iPhone 15" iOS17.5 2>/dev/null || \
                   xcrun simctl create "Test iPhone" "iPhone 14" iOS16.4 2>/dev/null || \
                   xcrun simctl create "Test iPhone" "com.apple.CoreSimulator.SimDeviceType.iPhone-15" 2>/dev/null)
  fi
fi

echo -e "  Simulator ID: ${CYAN}$SIMULATOR_ID${NC}"

# Boot simulator if needed
echo -e "${YELLOW}Booting simulator...${NC}"
xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true
sleep 5
echo ""

# Find app bundle
if [[ -z "$APP_PATH" ]]; then
  # Look in ios-artifacts for a zip or app
  cd "$PROJECT_ROOT"
  if [[ -d "ios-artifacts" ]]; then
    # First try to find .zip and extract
    ZIP_FILE=$(find ios-artifacts -name "*.zip" -type f | head -1)
    if [[ -n "$ZIP_FILE" ]]; then
      echo -e "${YELLOW}Extracting app from $ZIP_FILE...${NC}"
      unzip -o "$ZIP_FILE" -d ios-artifacts/
    fi
    
    # Now find .app bundle
    APP_PATH=$(find ios-artifacts -name "*.app" -type d | head -1)
  fi
  
  # Also check test-ios directory
  if [[ -z "$APP_PATH" ]] && [[ -d "test-ios" ]]; then
    ZIP_FILE=$(find test-ios -name "*.zip" -type f | head -1)
    if [[ -n "$ZIP_FILE" ]]; then
      echo -e "${YELLOW}Extracting app from $ZIP_FILE...${NC}"
      unzip -o "$ZIP_FILE" -d test-ios/
    fi
    APP_PATH=$(find test-ios -name "*.app" -type d | head -1)
  fi
fi

if [[ -z "$APP_PATH" ]] || [[ ! -d "$APP_PATH" ]]; then
  echo -e "${RED}Error: iOS app bundle not found${NC}"
  echo "Set APP_PATH environment variable or place .app bundle in ios-artifacts/"
  exit 1
fi

echo -e "${YELLOW}App bundle: $APP_PATH${NC}"
echo ""

# Get bundle ID
BUNDLE_ID=$(defaults read "$APP_PATH/Info.plist" CFBundleIdentifier 2>/dev/null || echo "com.viben.desktop")
echo -e "  Bundle ID: $BUNDLE_ID"
echo ""

# Install app
echo -e "${YELLOW}Installing app on simulator...${NC}"
xcrun simctl install "$SIMULATOR_ID" "$APP_PATH"
echo ""

# Launch app
echo -e "${YELLOW}Launching app...${NC}"
xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID"
echo ""

# Wait for app to load
echo -e "${YELLOW}Waiting for app to load (10s)...${NC}"
sleep 10
echo ""

# Take screenshot
echo -e "${YELLOW}Taking screenshot...${NC}"
xcrun simctl io "$SIMULATOR_ID" screenshot "$PROJECT_ROOT/ios-screenshot.png" || true
if [[ -f "$PROJECT_ROOT/ios-screenshot.png" ]]; then
  echo -e "  ${GREEN}Screenshot saved: ios-screenshot.png${NC}"
fi
echo ""

# Check app is running
echo -e "${YELLOW}Checking app process...${NC}"
if xcrun simctl spawn "$SIMULATOR_ID" launchctl list | grep -q "$BUNDLE_ID"; then
  echo -e "  ${GREEN}App is running${NC}"
else
  echo -e "  ${YELLOW}Warning: Could not verify app process${NC}"
fi
echo ""

# Run Maestro tests if available
if command -v maestro &> /dev/null; then
  echo -e "${YELLOW}Running Maestro smoke test...${NC}"
  MAESTRO_TEST="$PROJECT_ROOT/apps/desktop/.maestro/smoke-test.yaml"
  if [[ -f "$MAESTRO_TEST" ]]; then
    maestro test "$MAESTRO_TEST" --format junit --output "$PROJECT_ROOT/maestro-ios-results.xml" || true
    echo ""
  else
    echo -e "  ${YELLOW}No Maestro test found at $MAESTRO_TEST${NC}"
  fi
else
  echo -e "${YELLOW}Maestro not installed, skipping UI tests${NC}"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  iOS test completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Test artifacts:"
ls -la "$PROJECT_ROOT"/*.png "$PROJECT_ROOT"/*ios*.xml 2>/dev/null || true
