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
# Match any theme name pattern (Theme.App, Theme.Viben_desktop, etc.)
sed -i 's|<style name="Theme\.[^"]*" parent="[^"]*">|&\n        <item name="android:fitsSystemWindows">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>|' "$THEME_FILE"

echo "=== After modification ==="
cat "$THEME_FILE"

# Also modify the activity layout to add fitsSystemWindows
LAYOUT_FILE="app/src/main/res/layout/activity_main.xml"
if [ -f "$LAYOUT_FILE" ]; then
  echo ""
  echo "=== Modifying activity_main.xml ==="
  echo "=== Before ==="
  cat "$LAYOUT_FILE"

  # Add android:fitsSystemWindows="true" to the root element
  # This ensures the WebView content doesn't overlap with system bars
  sed -i 's|xmlns:android="http://schemas.android.com/apk/res/android"|xmlns:android="http://schemas.android.com/apk/res/android"\n    android:fitsSystemWindows="true"|' "$LAYOUT_FILE"

  echo "=== After ==="
  cat "$LAYOUT_FILE"
fi

# Find and modify WryActivity.kt to set fitsSystemWindows on the WebView
echo ""
echo "=== Looking for WryActivity.kt ==="
WRY_ACTIVITY=$(find . -name "WryActivity.kt" 2>/dev/null | head -1)
if [ -n "$WRY_ACTIVITY" ] && [ -f "$WRY_ACTIVITY" ]; then
  echo "Found: $WRY_ACTIVITY"
  echo "=== Before ==="
  cat "$WRY_ACTIVITY"

  # Add fitsSystemWindows=true after the WebView is created
  # Look for the onCreate method and add window insets handling
  if grep -q "WindowCompat" "$WRY_ACTIVITY"; then
    echo "WindowCompat already present, skipping"
  else
    # Add import for WindowCompat at the top of the file
    sed -i '/^package /a import androidx.core.view.WindowCompat' "$WRY_ACTIVITY"

    # Add WindowCompat.setDecorFitsSystemWindows(window, true) in onCreate
    # This ensures the content fits within the system windows
    sed -i 's|super.onCreate(savedInstanceState)|super.onCreate(savedInstanceState)\n        WindowCompat.setDecorFitsSystemWindows(window, true)|' "$WRY_ACTIVITY"

    echo "=== After ==="
    cat "$WRY_ACTIVITY"
  fi
else
  echo "WryActivity.kt not found"
  find . -name "*.kt" 2>/dev/null | head -10
fi
