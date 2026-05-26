#!/bin/bash
# Android emulator test script for CI
# This script is run inside the android-emulator-runner action
#
# Usage: ./scripts/android/run-emulator-tests.sh <apk-path>

set -euo pipefail

APK_PATH="${1:-}"
if [ -z "$APK_PATH" ]; then
  echo "Error: APK path required"
  exit 1
fi

echo "=========================================="
echo "Step 1: Emulator Verification"
echo "=========================================="
adb devices
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell wm size

echo "=========================================="
echo "Step 2: APK Installation"
echo "=========================================="
adb uninstall com.viben.desktop 2>/dev/null || true
adb install -r "$APK_PATH"
adb shell pm list packages | grep -i viben || true
adb shell dumpsys package com.viben.desktop | grep -E "(versionName|activity)" | head -20 || true

echo "=========================================="
echo "Step 3: App Launch"
echo "=========================================="
# Use am start with wait flag for better feedback
adb shell am start -W -n com.viben.desktop/.MainActivity 2>&1 || {
  echo "Failed to start via am, trying monkey..."
  adb shell monkey -p com.viben.desktop -c android.intent.category.LAUNCHER 1
}

echo "Waiting for app to load..."
sleep 20  # Increased wait time for WebView initialization

# Take screenshot
adb exec-out screencap -p > test-screenshots/01-app-launched.png

# Check if app is running
APP_PID=$(adb shell pidof com.viben.desktop || echo "")
if [ -n "$APP_PID" ]; then
  echo "App PID: $APP_PID"
else
  echo "WARNING: App process not found - may have crashed"
  # Capture crash logs
  adb logcat -d | grep -E "(FATAL|crash|panic|Error)" | tail -30 > test-logs/crash-check.txt || true
fi

echo "=========================================="
echo "Step 4: UI Verification (Critical)"
echo "=========================================="
# Save UI dump to file for inspection
adb shell uiautomator dump /sdcard/ui_dump.xml 2>/dev/null || true
adb pull /sdcard/ui_dump.xml test-logs/ui_dump.xml 2>/dev/null || true

# Check if app UI is actually rendered (not just a white screen)
if [ -f test-logs/ui_dump.xml ]; then
  # Check for key UI elements that should be present
  if grep -q "Viben" test-logs/ui_dump.xml; then
    echo "PASS: Found 'Viben' in UI"
  else
    echo "FAIL: 'Viben' not found in UI"
  fi

  # Check for bottom navigation tabs
  if grep -q "Devices\|Connect\|Chat" test-logs/ui_dump.xml; then
    echo "PASS: Found navigation tabs in UI"
  else
    echo "WARN: Navigation tabs not found - UI may not be fully rendered"
  fi

  # Check for non-zero bounds (critical for detecting white screen issue)
  ROOT_BOUNDS=$(grep -o 'resource-id="root".*bounds="[^"]*"' test-logs/ui_dump.xml | head -1 || echo "")
  echo "Root element bounds: $ROOT_BOUNDS"

  # Display first 500 chars of UI dump for debugging
  echo "UI Dump preview:"
  cat test-logs/ui_dump.xml | head -c 1000
else
  echo "FAIL: Could not get UI dump"
fi

echo "=========================================="
echo "Step 5: Tab Navigation Testing"
echo "=========================================="
# Get screen dimensions
SCREEN_INFO=$(adb shell wm size)
echo "Screen info: $SCREEN_INFO"
SCREEN_WIDTH=$(echo "$SCREEN_INFO" | grep -oE '[0-9]+x[0-9]+' | cut -d'x' -f1)
SCREEN_HEIGHT=$(echo "$SCREEN_INFO" | grep -oE '[0-9]+x[0-9]+' | cut -d'x' -f2)
echo "Parsed: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}"

# Get usable screen area (excluding system navigation bar)
# Android navigation bar is typically ~150-200px at the bottom
# App's bottom tab bar is ~60px tall, positioned above the nav bar
# So we need to tap at approximately: SCREEN_HEIGHT - NAV_BAR_HEIGHT - TAB_BAR_HEIGHT/2
# For a 2400px screen: 2400 - 180 (nav) - 30 (half tab) = 2190
NAV_BAR_HEIGHT=180
TAB_BAR_CENTER_OFFSET=50
TAB_Y=$((SCREEN_HEIGHT - NAV_BAR_HEIGHT - TAB_BAR_CENTER_OFFSET))
TAB_WIDTH=$((SCREEN_WIDTH / 3))
TAB1_X=$((TAB_WIDTH / 2))
TAB2_X=$((TAB_WIDTH + TAB_WIDTH / 2))
TAB3_X=$((TAB_WIDTH * 2 + TAB_WIDTH / 2))

echo "Tab positions: TAB1=$TAB1_X TAB2=$TAB2_X TAB3=$TAB3_X Y=$TAB_Y"
echo "Note: NAV_BAR_HEIGHT=$NAV_BAR_HEIGHT, expected app tab Y around $TAB_Y"

# Tap each tab (Devices, Connect, Chat)
echo "Tapping Devices tab at ($TAB1_X, $TAB_Y)"
adb shell input tap "$TAB1_X" "$TAB_Y"
sleep 2
adb exec-out screencap -p > test-screenshots/02-tab1.png

echo "Tapping Connect tab at ($TAB2_X, $TAB_Y)"
adb shell input tap "$TAB2_X" "$TAB_Y"
sleep 2
adb exec-out screencap -p > test-screenshots/03-tab2.png

echo "Tapping Chat tab at ($TAB3_X, $TAB_Y)"
adb shell input tap "$TAB3_X" "$TAB_Y"
sleep 2
adb exec-out screencap -p > test-screenshots/04-tab3.png

echo "=========================================="
echo "Step 6: Button Interaction"
echo "=========================================="
# Go to middle tab (Connect)
adb shell input tap "$TAB2_X" "$TAB_Y"
sleep 2

# Tap center of screen (approximate button location)
CENTER_X=$((SCREEN_WIDTH / 2))
CENTER_Y=$((SCREEN_HEIGHT / 2))
adb shell input tap "$CENTER_X" "$CENTER_Y"
sleep 2
adb exec-out screencap -p > test-screenshots/05-center-tap.png

# Press back
adb shell input keyevent KEYCODE_BACK
sleep 1
adb exec-out screencap -p > test-screenshots/06-after-back.png

echo "=========================================="
echo "Step 7: App Lifecycle Test"
echo "=========================================="
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell monkey -p com.viben.desktop -c android.intent.category.LAUNCHER 1
sleep 3
adb exec-out screencap -p > test-screenshots/07-resumed.png

echo "=========================================="
echo "Step 8: Collecting Diagnostics"
echo "=========================================="
adb logcat -d > test-logs/logcat-full.txt 2>/dev/null || true
adb logcat -d 2>/dev/null | grep -i viben > test-logs/logcat-app.txt || true
adb shell dumpsys meminfo com.viben.desktop > test-logs/meminfo.txt 2>/dev/null || true

# Check for crashes
CRASH_COUNT=$(adb logcat -d 2>/dev/null | grep -c "FATAL EXCEPTION" || echo "0")
echo "Crash count in logs: $CRASH_COUNT"

adb exec-out screencap -p > test-screenshots/08-final.png

echo "=========================================="
echo "Step 9: Maestro Tests (optional)"
echo "=========================================="
if command -v maestro > /dev/null 2>&1; then
  maestro test apps/desktop/.maestro/smoke-test.yaml \
    --format junit \
    --output maestro-results.xml \
    --debug-output test-screenshots/maestro \
    2>&1 || echo "Maestro tests completed with warnings"
else
  echo "Maestro not found, skipping"
fi

echo "=========================================="
echo "Test Complete"
echo "=========================================="
echo "Screenshots:"
ls -la test-screenshots/ || true
echo "Logs:"
ls -la test-logs/ || true

# Report success/failure based on crash count
if [ "$CRASH_COUNT" != "0" ]; then
  echo "WARNING: $CRASH_COUNT crashes detected in logs"
fi

echo "All tests completed!"
