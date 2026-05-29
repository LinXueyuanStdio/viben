#!/bin/bash
# Configure Android theme for proper system bar handling
# This script adds fitsSystemWindows=true to prevent content from
# overlapping with system status/navigation bars

set -e

ANDROID_DIR="${1:-apps/desktop/src-tauri/gen/android}"

cd "$ANDROID_DIR"

echo "=== Android res directory structure ==="
find app/src/main/res -name "*.xml" 2>/dev/null || echo "No xml files found"

# Tauri uses themes.xml instead of styles.xml
THEMES_FILE="app/src/main/res/values/themes.xml"
STYLES_FILE="app/src/main/res/values/styles.xml"

if [ -f "$THEMES_FILE" ]; then
  THEME_FILE="$THEMES_FILE"
elif [ -f "$STYLES_FILE" ]; then
  THEME_FILE="$STYLES_FILE"
else
  # Create themes.xml if neither exists
  mkdir -p app/src/main/res/values
  THEME_FILE="$THEMES_FILE"
  cat > "$THEME_FILE" << 'THEMES_XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.App" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="android:fitsSystemWindows">true</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
</resources>
THEMES_XML
  echo "Created new themes.xml"
  cat "$THEME_FILE"
  exit 0
fi

echo "Using theme file: $THEME_FILE"
echo "=== Before modification ==="
cat "$THEME_FILE"

# Add fitsSystemWindows attribute to existing theme
# This tells Android to automatically add padding for system bars
sed -i 's|<style name="Theme.App"[^>]*>|&\n        <item name="android:fitsSystemWindows">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>|' "$THEME_FILE"

echo "=== After modification ==="
cat "$THEME_FILE"
