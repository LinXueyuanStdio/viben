#!/usr/bin/env bash
#
# Viben Desktop E2E Test Script (Linux)
#
# Tests the desktop app on Linux using WebdriverIO and tauri-driver.
#
# Usage:
#   ./scripts/linux/test-desktop-ui.sh
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
}
trap cleanup EXIT

echo ""
echo -e "${CYAN}${BOLD}  Viben Desktop E2E Test (Linux)${NC}"
echo ""

# =============================================================================
# Step 1: Install DEB package
# =============================================================================
section "Installing Desktop App"

DEB_FILE=$(find desktop-artifact -name "*.deb" -type f 2>/dev/null | head -1)
if [ -z "$DEB_FILE" ]; then
    fail "No .deb file found in desktop-artifact/"
    exit 1
fi

info "Installing $DEB_FILE..."
sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y
success "Desktop app installed"

# =============================================================================
# Step 2: Find installed app path
# =============================================================================
section "Locating Installed App"

APP_PATH=""
# Prefer the system-installed desktop binary (not npm CLI)
if [ -f "/usr/bin/viben-desktop" ]; then
    APP_PATH="/usr/bin/viben-desktop"
elif [ -f "/usr/bin/viben" ]; then
    # Check if /usr/bin/viben is an ELF binary (desktop app) not a script (CLI)
    if file /usr/bin/viben | grep -q "ELF"; then
        APP_PATH="/usr/bin/viben"
    fi
fi

# Fallback: search in common locations
if [ -z "$APP_PATH" ]; then
    APP_PATH=$(find /usr -name "viben*" -type f -executable 2>/dev/null | xargs -I{} sh -c 'file "{}" | grep -q ELF && echo "{}"' | head -1)
fi

if [ -z "$APP_PATH" ] || [ ! -f "$APP_PATH" ]; then
    fail "Could not find installed Viben desktop app"
    exit 1
fi

info "Found app at: $APP_PATH"
export TAURI_APP_PATH="$APP_PATH"

# =============================================================================
# Step 3: Ensure WebKitWebDriver is available
# =============================================================================
section "Checking WebKitWebDriver"

# tauri-driver requires WebKitWebDriver in PATH
find_webdriver() {
    if command -v WebKitWebDriver &>/dev/null; then
        command -v WebKitWebDriver
    elif [ -f "/usr/bin/WebKitWebDriver" ]; then
        echo "/usr/bin/WebKitWebDriver"
    elif [ -f "/usr/lib/webkit2gtk-4.1/WebKitWebDriver" ]; then
        echo "/usr/lib/webkit2gtk-4.1/WebKitWebDriver"
    elif [ -f "/usr/lib/webkit2gtk-4.0/WebKitWebDriver" ]; then
        echo "/usr/lib/webkit2gtk-4.0/WebKitWebDriver"
    fi
}

WEBDRIVER_PATH=$(find_webdriver)

if [ -z "$WEBDRIVER_PATH" ]; then
    warn "WebKitWebDriver not found. Installing webkit2gtk-driver..."
    sudo apt-get update -qq
    sudo apt-get install -y webkit2gtk-driver
    WEBDRIVER_PATH=$(find_webdriver)
fi

if [ -z "$WEBDRIVER_PATH" ]; then
    fail "WebKitWebDriver not found even after installation attempt."
    info "Please manually install: sudo apt-get install webkit2gtk-driver"
    exit 1
fi

info "Found WebKitWebDriver at: $WEBDRIVER_PATH"

# Ensure it's in PATH for tauri-driver
if ! command -v WebKitWebDriver &>/dev/null; then
    info "Adding WebKitWebDriver to PATH..."
    export PATH="$(dirname "$WEBDRIVER_PATH"):$PATH"
fi

success "WebKitWebDriver is available"

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
# Step 5: Run E2E tests with xvfb
# =============================================================================
section "Running E2E Tests"

info "Running WebdriverIO tests with xvfb..."

mkdir -p test-screenshots

cd apps/desktop

set +e
xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" \
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
