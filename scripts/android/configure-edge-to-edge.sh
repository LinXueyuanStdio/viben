#!/bin/bash
# Configure Android for proper edge-to-edge mode with correct inset reporting
# This patches the MainActivity to enable edge-to-edge mode via WindowCompat

set -e

ANDROID_DIR="${1:-apps/desktop/src-tauri/gen/android}"

cd "$ANDROID_DIR"

# Find MainActivity.kt
MAIN_ACTIVITY=$(find app/src/main -name "MainActivity.kt" 2>/dev/null | head -1)

if [ -z "$MAIN_ACTIVITY" ]; then
  echo "MainActivity.kt not found, skipping edge-to-edge configuration"
  exit 0
fi

echo "Found MainActivity at: $MAIN_ACTIVITY"
echo "=== Current content ==="
cat "$MAIN_ACTIVITY"

# Check if already patched
if grep -q "setDecorFitsSystemWindows" "$MAIN_ACTIVITY"; then
  echo "Edge-to-edge already configured"
  exit 0
fi

# Add import for WindowCompat
if ! grep -q "import androidx.core.view.WindowCompat" "$MAIN_ACTIVITY"; then
  sed -i '/^import /a import androidx.core.view.WindowCompat' "$MAIN_ACTIVITY"
fi

# Find the onCreate method and add the edge-to-edge setup
# Look for "super.onCreate" and add our code after it
if grep -q "super.onCreate" "$MAIN_ACTIVITY"; then
  sed -i '/super.onCreate/a\        // Enable edge-to-edge mode for proper safe area inset reporting\n        WindowCompat.setDecorFitsSystemWindows(window, false)' "$MAIN_ACTIVITY"
  echo "=== After modification ==="
  cat "$MAIN_ACTIVITY"
else
  echo "Could not find super.onCreate in MainActivity, skipping patch"
fi
