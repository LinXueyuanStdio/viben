#!/bin/bash
# Configure Android theme to disable edge-to-edge mode
# This lets the system handle safe area insets automatically

set -e

ANDROID_DIR="${1:-apps/desktop/src-tauri/gen/android}"

cd "$ANDROID_DIR"

echo "=== Android res directory structure ==="
find app/src/main/res -name "*.xml" 2>/dev/null || echo "No xml files found"

# Find the theme file (themes.xml or styles.xml)
THEMES_FILE="app/src/main/res/values/themes.xml"
STYLES_FILE="app/src/main/res/values/styles.xml"

if [ -f "$THEMES_FILE" ]; then
  THEME_FILE="$THEMES_FILE"
elif [ -f "$STYLES_FILE" ]; then
  THEME_FILE="$STYLES_FILE"
else
  echo "No theme file found, skipping configuration"
  exit 0
fi

echo "Using theme file: $THEME_FILE"
echo "=== Current content ==="
cat "$THEME_FILE"

# Add fitsSystemWindows=true to disable edge-to-edge mode
# This makes the system handle safe areas automatically - no JS needed
if grep -q "fitsSystemWindows" "$THEME_FILE"; then
  echo "fitsSystemWindows already configured"
else
  sed -i 's|<style name="Theme\.[^"]*" parent="[^"]*">|&\n        <item name="android:fitsSystemWindows">true</item>|' "$THEME_FILE"
fi

# Ensure status bar and navigation bar are visible (not translucent/transparent)
if ! grep -q "windowTranslucentStatus" "$THEME_FILE"; then
  sed -i 's|<style name="Theme\.[^"]*" parent="[^"]*">|&\n        <item name="android:windowTranslucentStatus">false</item>\n        <item name="android:windowTranslucentNavigation">false</item>|' "$THEME_FILE"
fi

echo "=== After modification ==="
cat "$THEME_FILE"
