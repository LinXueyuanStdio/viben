#!/bin/bash
# Configure Android theme settings
# Note: Safe area insets are now handled by tauri-plugin-safe-area-insets
# This script only configures display cutout mode for notches

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

# Add windowLayoutInDisplayCutoutMode for notch handling
# Safe area insets are handled by tauri-plugin-safe-area-insets on the frontend
if grep -q "windowLayoutInDisplayCutoutMode" "$THEME_FILE"; then
  echo "windowLayoutInDisplayCutoutMode already configured"
else
  sed -i 's|<style name="Theme\.[^"]*" parent="[^"]*">|&\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>|' "$THEME_FILE"
  echo "=== After modification ==="
  cat "$THEME_FILE"
fi
