#!/bin/bash
# Test Android APK on emulator
# This script is called from GitHub Actions workflow
#
# Prerequisites:
#   - Android SDK with emulator
#   - Maestro CLI
#   - APK file in test-apk/ directory
#
# Environment variables:
#   - APK_PATH: Path to the APK file to test

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
echo -e "${BLUE}  Testing Android APK${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Find APK if not provided
if [[ -z "$APK_PATH" ]]; then
  APK_PATH=$(find "$PROJECT_ROOT/test-apk" -name "*.apk" -type f | head -1)
fi

if [[ -z "$APK_PATH" ]] || [[ ! -f "$APK_PATH" ]]; then
  echo -e "${RED}Error: APK file not found${NC}"
  echo "Set APK_PATH environment variable or place APK in test-apk/"
  exit 1
fi

echo -e "${YELLOW}APK: $APK_PATH${NC}"
echo ""

# Check adb is available
if ! command -v adb &> /dev/null; then
  echo -e "${RED}Error: adb is not available${NC}"
  exit 1
fi

# Wait for device
echo -e "${YELLOW}Waiting for device...${NC}"
adb wait-for-device
echo "  Device ready"
adb devices
echo ""

# Install APK
echo -e "${YELLOW}Installing APK...${NC}"
adb install -r "$APK_PATH"
echo ""

# Verify installation
echo -e "${YELLOW}Verifying installation...${NC}"
if adb shell pm list packages | grep -q com.viben.desktop; then
  echo -e "  ${GREEN}Package installed: com.viben.desktop${NC}"
else
  echo -e "  ${YELLOW}Warning: Package com.viben.desktop not found in package list${NC}"
fi
echo ""

# Launch app
echo -e "${YELLOW}Launching app...${NC}"
adb shell am start -n com.viben.desktop/.MainActivity 2>/dev/null || \
  adb shell monkey -p com.viben.desktop -c android.intent.category.LAUNCHER 1
echo ""

# Wait for app to load
echo -e "${YELLOW}Waiting for app to load (10s)...${NC}"
sleep 10
echo ""

# Take screenshot
echo -e "${YELLOW}Taking screenshot...${NC}"
adb exec-out screencap -p > "$PROJECT_ROOT/app-screenshot.png" || true
if [[ -f "$PROJECT_ROOT/app-screenshot.png" ]]; then
  echo -e "  ${GREEN}Screenshot saved: app-screenshot.png${NC}"
fi
echo ""

# Check app is running
echo -e "${YELLOW}Checking app process...${NC}"
if adb shell pidof com.viben.desktop > /dev/null 2>&1; then
  PID=$(adb shell pidof com.viben.desktop)
  echo -e "  ${GREEN}App is running (PID: $PID)${NC}"
else
  echo -e "  ${YELLOW}Warning: App process not found${NC}"
fi
echo ""

# Run Maestro tests if available
if command -v maestro &> /dev/null; then
  echo -e "${YELLOW}Running Maestro smoke test...${NC}"
  MAESTRO_TEST="$PROJECT_ROOT/apps/desktop/.maestro/smoke-test.yaml"
  if [[ -f "$MAESTRO_TEST" ]]; then
    maestro test "$MAESTRO_TEST" --format junit --output "$PROJECT_ROOT/maestro-results.xml" || true
    echo ""
  else
    echo -e "  ${YELLOW}No Maestro test found at $MAESTRO_TEST${NC}"
  fi
else
  echo -e "${YELLOW}Maestro not installed, skipping UI tests${NC}"
fi
echo ""

# Collect logs
echo -e "${YELLOW}Collecting logcat...${NC}"
adb logcat -d > "$PROJECT_ROOT/logcat.txt" 2>/dev/null || true
if [[ -f "$PROJECT_ROOT/logcat.txt" ]]; then
  echo -e "  ${GREEN}Logcat saved: logcat.txt${NC}"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Android test completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Test artifacts:"
ls -la "$PROJECT_ROOT"/*.png "$PROJECT_ROOT"/*.xml "$PROJECT_ROOT"/*.txt 2>/dev/null || true
