#!/usr/bin/env bash
#
# Viben Desktop E2E Test Script (macOS)
#
# Tests the desktop app on macOS using WebdriverIO and tauri-driver.
#
# Usage:
#   ./scripts/macos/test-desktop-ui.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

TAURI_DRIVER_PID=""
VOLUME_PATH=""

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail()    { echo -e "${RED}[FAIL]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }

section() {
    echo ""
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}  ──────────────────────────────────────────────${NC}"
}

cleanup() {
    if [ -n "$TAURI_DRIVER_PID" ]; then
        info "Stopping tauri-driver (PID $TAURI_DRIVER_PID)..."
        kill "$TAURI_DRIVER_PID" 2>/dev/null || true
        wait "$TAURI_DRIVER_PID" 2>/dev/null || true
    fi
    if [ -n "$VOLUME_PATH" ] && [ -d "$VOLUME_PATH" ]; then
        info "Detaching DMG volume..."
        hdiutil detach "$VOLUME_PATH" 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo ""
echo -e "${CYAN}${BOLD}  Viben Desktop E2E Test (macOS)${NC}"
echo ""

# =============================================================================
# Step 1: Find and mount DMG
# =============================================================================
section "Installing Desktop App"

# Find aarch64 DMG (macOS-latest is ARM64)
DMG_FILE=$(find desktop-artifact -name "*aarch64*.dmg" -type f 2>/dev/null | head -1)
if [ -z "$DMG_FILE" ]; then
    # Fallback to any DMG
    DMG_FILE=$(find desktop-artifact -name "*.dmg" -type f 2>/dev/null | head -1)
fi

if [ -z "$DMG_FILE" ]; then
    fail "No .dmg file found in desktop-artifact/"
    exit 1
fi

info "Mounting $DMG_FILE..."
MOUNT_OUTPUT=$(hdiutil attach "$DMG_FILE" -nobrowse)
VOLUME_PATH=$(echo "$MOUNT_OUTPUT" | grep "/Volumes" | awk '{print $3}')

if [ -z "$VOLUME_PATH" ] || [ ! -d "$VOLUME_PATH" ]; then
    fail "Failed to mount DMG"
    exit 1
fi

info "Mounted at: $VOLUME_PATH"

# =============================================================================
# Step 2: Copy app to /Applications
# =============================================================================
info "Copying app to /Applications..."

APP_BUNDLE=$(find "$VOLUME_PATH" -name "*.app" -maxdepth 1 -type d | head -1)
if [ -z "$APP_BUNDLE" ]; then
    fail "No .app bundle found in DMG"
    exit 1
fi

APP_NAME=$(basename "$APP_BUNDLE")
cp -R "$APP_BUNDLE" /Applications/

# Clear quarantine attribute
info "Clearing quarantine attribute..."
xattr -cr "/Applications/$APP_NAME"

success "App installed at /Applications/$APP_NAME"

# Detach DMG
hdiutil detach "$VOLUME_PATH" 2>/dev/null || true
VOLUME_PATH=""

# =============================================================================
# Step 3: Find app executable
# =============================================================================
section "Locating App Executable"

APP_EXECUTABLE="/Applications/$APP_NAME/Contents/MacOS/${APP_NAME%.app}"
if [ ! -f "$APP_EXECUTABLE" ]; then
    # Try common variations
    APP_EXECUTABLE=$(find "/Applications/$APP_NAME/Contents/MacOS" -type f -perm +111 | head -1)
fi

if [ -z "$APP_EXECUTABLE" ] || [ ! -f "$APP_EXECUTABLE" ]; then
    fail "Could not find app executable"
    exit 1
fi

info "Found executable: $APP_EXECUTABLE"
export TAURI_APP_PATH="$APP_EXECUTABLE"

# =============================================================================
# Step 4: Start tauri-driver
# =============================================================================
section "Starting tauri-driver"

info "Starting tauri-driver on port 4444..."
tauri-driver &
TAURI_DRIVER_PID=$!

# Wait for tauri-driver to be ready
sleep 3

if ! kill -0 "$TAURI_DRIVER_PID" 2>/dev/null; then
    fail "tauri-driver failed to start"
    exit 1
fi

success "tauri-driver started (PID $TAURI_DRIVER_PID)"

# =============================================================================
# Step 5: Run E2E tests
# =============================================================================
section "Running E2E Tests"

info "Running WebdriverIO tests..."

mkdir -p test-screenshots

cd apps/desktop

set +e
npx wdio run wdio.conf.ts
TEST_EXIT_CODE=$?
set -e

cd ../..

# =============================================================================
# Summary
# =============================================================================
section "Summary"

SCREENSHOT_COUNT=$(find test-screenshots -name "*.png" 2>/dev/null | wc -l)
info "Screenshots captured: $SCREENSHOT_COUNT"

if [ -f "apps/desktop/wdio-results.xml" ]; then
    cp apps/desktop/wdio-results.xml ./wdio-results.xml
    info "Test results saved to wdio-results.xml"
fi

if [ -d "apps/desktop/test-screenshots" ]; then
    cp -r apps/desktop/test-screenshots/* test-screenshots/ 2>/dev/null || true
fi

if [ "$TEST_EXIT_CODE" -eq 0 ]; then
    echo ""
    echo -e "${GREEN}${BOLD}  All E2E tests passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}${BOLD}  E2E tests failed (exit code: $TEST_EXIT_CODE)${NC}"
    exit "$TEST_EXIT_CODE"
fi
