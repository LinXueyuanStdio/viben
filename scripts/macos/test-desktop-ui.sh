#!/usr/bin/env bash
#
# Viben Desktop Smoke Test Script (macOS)
#
# This script performs a basic smoke test for the desktop app on macOS.
#
# NOTE: Unlike Linux, macOS cannot use tauri-driver for E2E testing because
# tauri-driver relies on WebKitWebDriver which is not available for WKWebView
# on macOS. See: https://v2.tauri.app/develop/tests/webdriver
#
# Instead, this script performs a smoke test that:
#   1. Mounts the DMG and installs the app
#   2. Launches the app to verify it starts without crashing
#   3. Takes a screenshot using macOS built-in screencapture
#   4. Verifies the app process is running
#   5. Gracefully terminates the app
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

APP_PID=""
VOLUME_PATH=""
APP_NAME=""

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
    # Kill the app if it's still running
    if [ -n "$APP_PID" ]; then
        info "Stopping app (PID $APP_PID)..."
        kill "$APP_PID" 2>/dev/null || true
        # Give it a moment to terminate gracefully
        sleep 1
        # Force kill if still running
        kill -9 "$APP_PID" 2>/dev/null || true
    fi
    # Also kill by app name in case PID tracking failed
    if [ -n "$APP_NAME" ]; then
        pkill -f "$APP_NAME" 2>/dev/null || true
    fi
    # Detach DMG if still mounted
    if [ -n "$VOLUME_PATH" ] && [ -d "$VOLUME_PATH" ]; then
        info "Detaching DMG volume..."
        hdiutil detach "$VOLUME_PATH" 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo ""
echo -e "${CYAN}${BOLD}  Viben Desktop Smoke Test (macOS)${NC}"
echo ""
echo -e "${YELLOW}  NOTE: Full E2E testing with tauri-driver is not supported on macOS.${NC}"
echo -e "${YELLOW}  This script performs a smoke test to verify the app can launch.${NC}"
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
success "DMG mounted successfully"

# =============================================================================
# Step 2: Copy app to /Applications
# =============================================================================
section "Copying App to /Applications"

APP_BUNDLE=$(find "$VOLUME_PATH" -name "*.app" -maxdepth 1 -type d | head -1)
if [ -z "$APP_BUNDLE" ]; then
    fail "No .app bundle found in DMG"
    exit 1
fi

APP_NAME=$(basename "$APP_BUNDLE")
info "Found app bundle: $APP_NAME"

# Remove existing installation if present
if [ -d "/Applications/$APP_NAME" ]; then
    info "Removing existing installation..."
    rm -rf "/Applications/$APP_NAME"
fi

cp -R "$APP_BUNDLE" /Applications/

# Clear quarantine attribute to allow the app to run
info "Clearing quarantine attribute..."
xattr -cr "/Applications/$APP_NAME"

success "App installed at /Applications/$APP_NAME"

# Detach DMG - no longer needed
hdiutil detach "$VOLUME_PATH" 2>/dev/null || true
VOLUME_PATH=""

# =============================================================================
# Step 3: Find app executable
# =============================================================================
section "Locating App Executable"

APP_EXECUTABLE="/Applications/$APP_NAME/Contents/MacOS/${APP_NAME%.app}"
if [ ! -f "$APP_EXECUTABLE" ]; then
    # Try to find any executable in MacOS directory
    APP_EXECUTABLE=$(find "/Applications/$APP_NAME/Contents/MacOS" -type f -perm +111 2>/dev/null | head -1)
fi

if [ -z "$APP_EXECUTABLE" ] || [ ! -f "$APP_EXECUTABLE" ]; then
    fail "Could not find app executable"
    exit 1
fi

info "Found executable: $APP_EXECUTABLE"

# =============================================================================
# Step 4: Launch App and Verify Startup
# =============================================================================
section "Launching App (Smoke Test)"

# Create screenshots directory
mkdir -p test-screenshots

info "Launching $APP_NAME..."

# Launch the app in background
# Using open command which is the standard way to launch apps on macOS
open -a "/Applications/$APP_NAME" &

# Wait for the app to start
info "Waiting for app to initialize (5 seconds)..."
sleep 5

# Find the app's PID
# The app name without .app extension is typically the process name
PROCESS_NAME="${APP_NAME%.app}"
APP_PID=$(pgrep -f "$PROCESS_NAME" 2>/dev/null | head -1 || true)

if [ -z "$APP_PID" ]; then
    # Try alternative ways to find the process
    APP_PID=$(pgrep -f "$APP_EXECUTABLE" 2>/dev/null | head -1 || true)
fi

if [ -z "$APP_PID" ]; then
    fail "App process not found - app may have crashed on startup"
    exit 1
fi

info "App is running with PID: $APP_PID"
success "App launched successfully"

# =============================================================================
# Step 5: Take Screenshot
# =============================================================================
section "Capturing Screenshot"

# Use macOS built-in screencapture command
# -x: Do not play sounds
# -C: Capture the cursor as well
# Note: In headless CI, this may capture a blank screen, but it verifies
# the command works and the app hasn't crashed

SCREENSHOT_FILE="test-screenshots/macos-smoke-test-$(date +%Y%m%d-%H%M%S).png"

info "Taking screenshot..."
if screencapture -x "$SCREENSHOT_FILE" 2>/dev/null; then
    if [ -f "$SCREENSHOT_FILE" ]; then
        SCREENSHOT_SIZE=$(stat -f%z "$SCREENSHOT_FILE" 2>/dev/null || echo "0")
        if [ "$SCREENSHOT_SIZE" -gt 0 ]; then
            success "Screenshot saved: $SCREENSHOT_FILE (${SCREENSHOT_SIZE} bytes)"
        else
            warn "Screenshot file is empty (may be running headless)"
        fi
    else
        warn "Screenshot file was not created"
    fi
else
    warn "screencapture command failed (may be running headless)"
fi

# =============================================================================
# Step 6: Verify App Is Still Running
# =============================================================================
section "Verifying App Stability"

info "Waiting 3 more seconds to verify app stability..."
sleep 3

# Check if the app is still running
if kill -0 "$APP_PID" 2>/dev/null; then
    success "App is still running after 8 seconds - no crash detected"
else
    fail "App crashed during smoke test"
    exit 1
fi

# =============================================================================
# Step 7: Graceful Shutdown
# =============================================================================
section "Shutting Down App"

info "Sending SIGTERM to app..."
kill "$APP_PID" 2>/dev/null || true

# Wait for graceful shutdown
sleep 2

# Check if app terminated
if kill -0 "$APP_PID" 2>/dev/null; then
    info "App still running, sending SIGKILL..."
    kill -9 "$APP_PID" 2>/dev/null || true
    sleep 1
fi

# Clear PID so cleanup doesn't try to kill again
APP_PID=""

success "App shut down successfully"

# =============================================================================
# Summary
# =============================================================================
section "Summary"

SCREENSHOT_COUNT=$(find test-screenshots -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
info "Screenshots captured: $SCREENSHOT_COUNT"

echo ""
echo -e "${GREEN}${BOLD}  Smoke test passed!${NC}"
echo ""
echo -e "  The following verifications succeeded:"
echo -e "    - DMG mounted successfully"
echo -e "    - App installed to /Applications"
echo -e "    - App launched without crashing"
echo -e "    - App remained stable for 8+ seconds"
echo -e "    - App shut down gracefully"
echo ""
echo -e "${YELLOW}  NOTE: Full E2E UI testing requires Linux with tauri-driver.${NC}"
echo ""

exit 0
