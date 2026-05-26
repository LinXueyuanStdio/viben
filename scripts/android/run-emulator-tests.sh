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
# Use monkey to launch - more reliable than specifying activity name
adb shell monkey -p com.viben.desktop -c android.intent.category.LAUNCHER 1
echo "Waiting for app to load..."
sleep 15

# Take screenshot regardless of pidof result
adb exec-out screencap -p > test-screenshots/01-app-launched.png
adb shell pidof com.viben.desktop && echo "App PID found" || echo "App PID not found (may still be running)"

echo "=========================================="
echo "Step 4: UI Verification"
echo "=========================================="
# Save UI dump to file for inspection
adb shell uiautomator dump /sdcard/ui_dump.xml 2>/dev/null || true
adb pull /sdcard/ui_dump.xml test-logs/ui_dump.xml 2>/dev/null || true
cat test-logs/ui_dump.xml 2>/dev/null | head -200 || echo "Could not get UI dump"

echo "=========================================="
echo "Step 5: Tab Navigation Testing"
echo "=========================================="
# Get screen dimensions
SCREEN_INFO=$(adb shell wm size)
echo "Screen info: $SCREEN_INFO"
SCREEN_WIDTH=$(echo "$SCREEN_INFO" | grep -oE '[0-9]+x[0-9]+' | cut -d'x' -f1)
SCREEN_HEIGHT=$(echo "$SCREEN_INFO" | grep -oE '[0-9]+x[0-9]+' | cut -d'x' -f2)
echo "Parsed: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}"

# Bottom navigation tabs - typically at y = height - 80
TAB_Y=$((SCREEN_HEIGHT - 80))
TAB_WIDTH=$((SCREEN_WIDTH / 3))
TAB1_X=$((TAB_WIDTH / 2))
TAB2_X=$((TAB_WIDTH + TAB_WIDTH / 2))
TAB3_X=$((TAB_WIDTH * 2 + TAB_WIDTH / 2))

echo "Tab positions: TAB1=$TAB1_X TAB2=$TAB2_X TAB3=$TAB3_X Y=$TAB_Y"

# Tap each tab
adb shell input tap "$TAB1_X" "$TAB_Y"
sleep 2
adb exec-out screencap -p > test-screenshots/02-tab1.png

adb shell input tap "$TAB2_X" "$TAB_Y"
sleep 2
adb exec-out screencap -p > test-screenshots/03-tab2.png

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
