#!/bin/bash
# Configure Android safe area handling via native WindowInsets API
# This patches MainActivity.kt to apply padding to the WebView container

set -e

ANDROID_DIR="${1:-apps/desktop/src-tauri/gen/android}"

cd "$ANDROID_DIR"

# Find MainActivity.kt
MAIN_ACTIVITY=$(find app/src/main -name "MainActivity.kt" 2>/dev/null | head -1)

if [ -z "$MAIN_ACTIVITY" ]; then
  echo "MainActivity.kt not found, skipping safe area configuration"
  exit 0
fi

echo "Found MainActivity at: $MAIN_ACTIVITY"
echo "=== Current content ==="
cat "$MAIN_ACTIVITY"

# Check if already patched
if grep -q "setOnApplyWindowInsetsListener" "$MAIN_ACTIVITY"; then
  echo "Safe area already configured"
  exit 0
fi

# Get the package name from the file
PACKAGE_NAME=$(grep "^package " "$MAIN_ACTIVITY" | sed 's/package //' | tr -d '\r')
echo "Package: $PACKAGE_NAME"

# Create the new MainActivity.kt - apply padding directly to content view
cat > "$MAIN_ACTIVITY" << 'KOTLIN_CODE'
package PACKAGE_PLACEHOLDER

import android.os.Bundle
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Enable edge-to-edge BEFORE super.onCreate
        WindowCompat.setDecorFitsSystemWindows(window, false)

        super.onCreate(savedInstanceState)

        // Apply padding to the content view to avoid system bars
        val contentView = findViewById<View>(android.R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(contentView) { view, insets ->
            val systemBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )

            view.setPadding(
                systemBars.left,
                systemBars.top,
                systemBars.right,
                systemBars.bottom
            )

            WindowInsetsCompat.CONSUMED
        }
    }
}
KOTLIN_CODE

# Replace package placeholder with actual package
sed -i "s/package PACKAGE_PLACEHOLDER/package $PACKAGE_NAME/" "$MAIN_ACTIVITY"

echo "=== After modification ==="
cat "$MAIN_ACTIVITY"
