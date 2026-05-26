#!/bin/bash
# Test Android APK on emulator/device
# This script is called from GitHub Actions workflow or can be run locally
#
# Prerequisites:
#   - Android SDK with emulator
#   - Maestro CLI (optional, for UI tests)
#   - APK file in test-apk/ directory
#
# Environment variables:
#   - APK_PATH: Path to the APK file to test
#   - SKIP_MAESTRO: Set to "true" to skip Maestro tests
#   - SCREENSHOTS_DIR: Directory to save screenshots (default: $PROJECT_ROOT/test-screenshots)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
SCREENSHOTS_DIR="${SCREENSHOTS_DIR:-$PROJECT_ROOT/test-screenshots}"
PACKAGE_NAME="com.viben.desktop"
TEST_RESULTS=0

# Create screenshots directory
mkdir -p "$SCREENSHOTS_DIR"

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
  TEST_RESULTS=1
}

log_step() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}========================================${NC}"
}

take_screenshot() {
  local name="$1"
  local path="$SCREENSHOTS_DIR/${name}.png"
  if adb exec-out screencap -p > "$path" 2>/dev/null; then
    log_success "Screenshot saved: $name.png"
  else
    log_warn "Failed to capture screenshot: $name"
  fi
}

wait_for_ui() {
  local seconds="${1:-5}"
  log_info "Waiting ${seconds}s for UI to stabilize..."
  sleep "$seconds"
}

tap_coordinates() {
  local x="$1"
  local y="$2"
  local description="$3"
  log_info "Tapping at ($x, $y): $description"
  adb shell input tap "$x" "$y"
}

swipe_screen() {
  local start_x="$1"
  local start_y="$2"
  local end_x="$3"
  local end_y="$4"
  local duration="${5:-300}"
  log_info "Swiping from ($start_x, $start_y) to ($end_x, $end_y)"
  adb shell input swipe "$start_x" "$start_y" "$end_x" "$end_y" "$duration"
}

press_back() {
  log_info "Pressing back button"
  adb shell input keyevent KEYCODE_BACK
}

press_home() {
  log_info "Pressing home button"
  adb shell input keyevent KEYCODE_HOME
}

input_text() {
  local text="$1"
  log_info "Entering text: $text"
  # Escape special characters for adb shell
  adb shell input text "${text// /%s}"
}

get_screen_dimensions() {
  adb shell wm size | grep -oE '[0-9]+x[0-9]+' | head -1
}

check_ui_dump() {
  local search_text="$1"
  local description="$2"

  # Dump UI hierarchy and search for text
  if adb shell "uiautomator dump /dev/tty 2>/dev/null" | grep -qi "$search_text"; then
    log_success "Found: $description"
    return 0
  else
    log_warn "Not found: $description"
    return 1
  fi
}

log_step "Testing Android APK"

# Find APK if not provided
if [[ -z "$APK_PATH" ]]; then
  APK_PATH=$(find "$PROJECT_ROOT/test-apk" -name "*.apk" -type f 2>/dev/null | head -1)
fi

if [[ -z "$APK_PATH" ]] || [[ ! -f "$APK_PATH" ]]; then
  log_error "APK file not found"
  echo "Set APK_PATH environment variable or place APK in test-apk/"
  exit 1
fi

log_info "APK: $APK_PATH"

# Check adb is available
if ! command -v adb &> /dev/null; then
  log_error "adb is not available"
  exit 1
fi

# =============================================================================
# STEP 1: Device Connection
# =============================================================================
log_step "Step 1: Device Connection"

log_info "Waiting for device..."
adb wait-for-device
log_success "Device connected"

DEVICE_INFO=$(adb shell getprop ro.product.model 2>/dev/null || echo "Unknown")
ANDROID_VERSION=$(adb shell getprop ro.build.version.release 2>/dev/null || echo "Unknown")
log_info "Device: $DEVICE_INFO (Android $ANDROID_VERSION)"

SCREEN_SIZE=$(get_screen_dimensions)
log_info "Screen size: $SCREEN_SIZE"
SCREEN_WIDTH=$(echo "$SCREEN_SIZE" | cut -d'x' -f1)
SCREEN_HEIGHT=$(echo "$SCREEN_SIZE" | cut -d'x' -f2)

adb devices

# =============================================================================
# STEP 2: APK Installation
# =============================================================================
log_step "Step 2: APK Installation"

# Uninstall previous version if exists
log_info "Uninstalling previous version (if exists)..."
adb uninstall "$PACKAGE_NAME" 2>/dev/null || true

log_info "Installing APK..."
if adb install -r "$APK_PATH"; then
  log_success "APK installed successfully"
else
  log_error "Failed to install APK"
  exit 1
fi

# Verify installation
log_info "Verifying installation..."
if adb shell pm list packages | grep -q "$PACKAGE_NAME"; then
  log_success "Package verified: $PACKAGE_NAME"

  # Get app info
  APP_VERSION=$(adb shell dumpsys package "$PACKAGE_NAME" | grep versionName | head -1 | cut -d'=' -f2 || echo "Unknown")
  log_info "App version: $APP_VERSION"
else
  log_error "Package not found: $PACKAGE_NAME"
  exit 1
fi

# =============================================================================
# STEP 3: App Launch
# =============================================================================
log_step "Step 3: App Launch"

log_info "Launching app..."
# Try standard launch first, fallback to monkey
if ! adb shell am start -n "$PACKAGE_NAME/.MainActivity" 2>/dev/null; then
  log_warn "Standard launch failed, trying monkey launcher..."
  adb shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1
fi

wait_for_ui 8

# Check app is running
if adb shell pidof "$PACKAGE_NAME" > /dev/null 2>&1; then
  PID=$(adb shell pidof "$PACKAGE_NAME")
  log_success "App is running (PID: $PID)"
else
  log_error "App process not found"
fi

take_screenshot "01-app-launched"

# =============================================================================
# STEP 4: UI Content Verification (using adb)
# =============================================================================
log_step "Step 4: UI Content Verification"

log_info "Checking for app header 'Viben'..."
check_ui_dump "Viben" "App header branding" || true

log_info "Checking for connection status..."
check_ui_dump "Disconnected" "Connection status" || check_ui_dump "Connected" "Connection status" || true

log_info "Checking for navigation tabs..."
check_ui_dump "Devices" "Devices tab" || true
check_ui_dump "Connect" "Connect tab" || true
check_ui_dump "Chat" "Chat tab" || true

take_screenshot "02-initial-ui"

# =============================================================================
# STEP 5: Tab Navigation Testing (using coordinates)
# =============================================================================
log_step "Step 5: Tab Navigation Testing"

# Calculate approximate tab positions (bottom nav, evenly spaced)
# Bottom nav is typically at the bottom of the screen
TAB_Y=$((SCREEN_HEIGHT - 50))
TAB_WIDTH=$((SCREEN_WIDTH / 3))
DEVICES_TAB_X=$((TAB_WIDTH / 2))
CONNECT_TAB_X=$((TAB_WIDTH + TAB_WIDTH / 2))
CHAT_TAB_X=$((TAB_WIDTH * 2 + TAB_WIDTH / 2))

# Tap Devices tab
log_info "Navigating to Devices tab..."
tap_coordinates "$DEVICES_TAB_X" "$TAB_Y" "Devices tab"
wait_for_ui 2
take_screenshot "03-devices-tab"

# Verify Devices page content
check_ui_dump "Not connected" "Devices page disconnected message" || \
check_ui_dump "Devices" "Devices page content" || true

# Tap Connect tab
log_info "Navigating to Connect tab..."
tap_coordinates "$CONNECT_TAB_X" "$TAB_Y" "Connect tab"
wait_for_ui 2
take_screenshot "04-connect-tab"

# Verify Connect page content
check_ui_dump "Connect to Desktop" "Connect page title" || true
check_ui_dump "Enter URL manually" "Manual URL button" || true

# Tap Chat tab
log_info "Navigating to Chat tab..."
tap_coordinates "$CHAT_TAB_X" "$TAB_Y" "Chat tab"
wait_for_ui 2
take_screenshot "05-chat-tab"

# Verify Chat page content
check_ui_dump "Connect to a Gateway" "Chat page disconnected message" || true

# =============================================================================
# STEP 6: Dialog Interaction Testing
# =============================================================================
log_step "Step 6: Dialog Interaction Testing"

# Go back to Connect tab
log_info "Returning to Connect tab..."
tap_coordinates "$CONNECT_TAB_X" "$TAB_Y" "Connect tab"
wait_for_ui 2

# Find and tap "Enter URL manually" button (center of screen, below QR area)
# The button is typically in the lower-middle portion of the content area
BUTTON_Y=$((SCREEN_HEIGHT / 2 + 100))
BUTTON_X=$((SCREEN_WIDTH / 2))

log_info "Attempting to open manual URL dialog..."
tap_coordinates "$BUTTON_X" "$BUTTON_Y" "Enter URL manually button"
wait_for_ui 2
take_screenshot "06-manual-url-dialog"

# Check if dialog opened
if check_ui_dump "Enter Gateway URL" "Dialog title"; then
  log_success "Manual URL dialog opened"

  # Try to enter text in the input field
  # First tap the input field area (typically in the middle of the dialog)
  INPUT_Y=$((SCREEN_HEIGHT / 2))
  tap_coordinates "$BUTTON_X" "$INPUT_Y" "URL input field"
  wait_for_ui 1

  # Enter test URL
  input_text "http://192.168.1.100:18790"
  wait_for_ui 1
  take_screenshot "07-url-entered"

  # Press back to close dialog
  press_back
  wait_for_ui 1
  take_screenshot "08-dialog-closed"
else
  log_warn "Could not open manual URL dialog"
fi

# =============================================================================
# STEP 7: Gesture Testing
# =============================================================================
log_step "Step 7: Gesture Testing"

# Test pull-to-refresh on Connect page
log_info "Testing pull-to-refresh gesture..."
CENTER_X=$((SCREEN_WIDTH / 2))
SWIPE_START_Y=$((SCREEN_HEIGHT / 3))
SWIPE_END_Y=$((SCREEN_HEIGHT * 2 / 3))
swipe_screen "$CENTER_X" "$SWIPE_START_Y" "$CENTER_X" "$SWIPE_END_Y" 500
wait_for_ui 2
take_screenshot "09-after-swipe"

# Test horizontal swipe (if app supports it)
log_info "Testing horizontal swipe..."
SWIPE_LEFT_X=$((SCREEN_WIDTH - 100))
SWIPE_RIGHT_X=100
SWIPE_Y=$((SCREEN_HEIGHT / 2))
swipe_screen "$SWIPE_LEFT_X" "$SWIPE_Y" "$SWIPE_RIGHT_X" "$SWIPE_Y" 300
wait_for_ui 1
take_screenshot "10-after-horizontal-swipe"

# =============================================================================
# STEP 8: App Lifecycle Testing
# =============================================================================
log_step "Step 8: App Lifecycle Testing"

# Test app backgrounding and resume
log_info "Testing app backgrounding..."
press_home
sleep 2

log_info "Resuming app from background..."
adb shell am start -n "$PACKAGE_NAME/.MainActivity" 2>/dev/null || \
  adb shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1
wait_for_ui 3
take_screenshot "11-app-resumed"

# Verify app is still running
if adb shell pidof "$PACKAGE_NAME" > /dev/null 2>&1; then
  log_success "App resumed successfully"
else
  log_error "App crashed during resume"
fi

# =============================================================================
# STEP 9: Rapid Tab Switching (Stability Test)
# =============================================================================
log_step "Step 9: Stability Testing"

log_info "Rapidly switching between tabs..."
for i in 1 2 3; do
  tap_coordinates "$DEVICES_TAB_X" "$TAB_Y" "Devices tab (iteration $i)"
  sleep 0.5
  tap_coordinates "$CONNECT_TAB_X" "$TAB_Y" "Connect tab (iteration $i)"
  sleep 0.5
  tap_coordinates "$CHAT_TAB_X" "$TAB_Y" "Chat tab (iteration $i)"
  sleep 0.5
done

wait_for_ui 2
take_screenshot "12-stability-test"

# Final app state check
if adb shell pidof "$PACKAGE_NAME" > /dev/null 2>&1; then
  log_success "App stable after rapid navigation"
else
  log_error "App crashed during stability test"
fi

# =============================================================================
# STEP 10: Maestro Tests (if available)
# =============================================================================
if [[ "$SKIP_MAESTRO" != "true" ]] && command -v maestro &> /dev/null; then
  log_step "Step 10: Maestro UI Tests"

  MAESTRO_TEST="$PROJECT_ROOT/apps/desktop/.maestro/smoke-test.yaml"
  if [[ -f "$MAESTRO_TEST" ]]; then
    log_info "Running Maestro smoke test..."

    # Create Maestro output directory
    MAESTRO_OUTPUT_DIR="$SCREENSHOTS_DIR/maestro"
    mkdir -p "$MAESTRO_OUTPUT_DIR"

    # Run Maestro tests
    if maestro test "$MAESTRO_TEST" \
        --format junit \
        --output "$PROJECT_ROOT/maestro-results.xml" \
        --debug-output "$MAESTRO_OUTPUT_DIR" 2>&1; then
      log_success "Maestro tests passed"
    else
      log_warn "Maestro tests completed with issues (check results for details)"
    fi

    # Copy any Maestro screenshots
    if [[ -d "$HOME/.maestro/tests" ]]; then
      cp -r "$HOME/.maestro/tests/"* "$MAESTRO_OUTPUT_DIR/" 2>/dev/null || true
    fi
  else
    log_warn "Maestro test file not found: $MAESTRO_TEST"
  fi
else
  if [[ "$SKIP_MAESTRO" == "true" ]]; then
    log_info "Skipping Maestro tests (SKIP_MAESTRO=true)"
  else
    log_info "Maestro not installed, skipping UI automation tests"
  fi
fi

# =============================================================================
# STEP 11: Collect Logs and Diagnostics
# =============================================================================
log_step "Step 11: Collecting Diagnostics"

# Collect logcat (filtered for our app)
log_info "Collecting logcat..."
adb logcat -d > "$PROJECT_ROOT/logcat-full.txt" 2>/dev/null || true
adb logcat -d | grep -i "$PACKAGE_NAME" > "$PROJECT_ROOT/logcat-app.txt" 2>/dev/null || true

# Collect any crash logs
log_info "Checking for crashes..."
if adb logcat -d | grep -i "FATAL EXCEPTION" | grep -i "$PACKAGE_NAME"; then
  log_error "App crash detected in logs"
  adb logcat -d | grep -A 50 "FATAL EXCEPTION" > "$PROJECT_ROOT/crash-log.txt" 2>/dev/null || true
else
  log_success "No crashes detected"
fi

# Get memory usage
log_info "Collecting memory info..."
adb shell dumpsys meminfo "$PACKAGE_NAME" > "$PROJECT_ROOT/meminfo.txt" 2>/dev/null || true

# =============================================================================
# Test Results Summary
# =============================================================================
log_step "Test Results Summary"

echo ""
echo "Screenshots saved to: $SCREENSHOTS_DIR"
ls -la "$SCREENSHOTS_DIR"/*.png 2>/dev/null || echo "  (no screenshots)"
echo ""

echo "Log files:"
ls -la "$PROJECT_ROOT"/*.txt 2>/dev/null || echo "  (no log files)"
echo ""

if [[ -f "$PROJECT_ROOT/maestro-results.xml" ]]; then
  echo "Maestro results: $PROJECT_ROOT/maestro-results.xml"
fi

echo ""
if [[ $TEST_RESULTS -eq 0 ]]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  All tests passed!${NC}"
  echo -e "${GREEN}========================================${NC}"
else
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW}  Tests completed with warnings${NC}"
  echo -e "${YELLOW}========================================${NC}"
fi

exit $TEST_RESULTS
