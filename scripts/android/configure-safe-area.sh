#!/bin/bash
# Configure Android safe area handling via native WindowInsets API
# This patches MainActivity.kt to properly handle system bar insets

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

# Create the new MainActivity.kt with proper safe area handling
cat > "$MAIN_ACTIVITY" << 'KOTLIN_CODE'
package PACKAGE_PLACEHOLDER

import android.os.Bundle
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import kotlin.math.roundToInt

class MainActivity : TauriActivity() {
    private var cachedWebView: WebView? = null
    private var pendingInsets: IntArray? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable edge-to-edge mode - required to receive inset values
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Set up inset listener on the root view
        val rootView = window.decorView
        ViewCompat.setOnApplyWindowInsetsListener(rootView) { _, insets ->
            val systemBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )

            val density = resources.displayMetrics.density
            val topDp = (systemBars.top / density).roundToInt()
            val bottomDp = (systemBars.bottom / density).roundToInt()
            val leftDp = (systemBars.left / density).roundToInt()
            val rightDp = (systemBars.right / density).roundToInt()

            android.util.Log.d("SafeArea", "Insets received: top=$topDp, bottom=$bottomDp, left=$leftDp, right=$rightDp")

            // Try to inject immediately, or cache for later
            if (cachedWebView != null) {
                injectSafeAreaInsets(topDp, bottomDp, leftDp, rightDp)
            } else {
                pendingInsets = intArrayOf(topDp, bottomDp, leftDp, rightDp)
            }

            insets
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        cachedWebView = webView

        android.util.Log.d("SafeArea", "WebView created, checking for pending insets")

        // If we have pending insets, inject them now
        pendingInsets?.let { insets ->
            android.util.Log.d("SafeArea", "Injecting pending insets")
            injectSafeAreaInsets(insets[0], insets[1], insets[2], insets[3])
            pendingInsets = null
        }

        // Also request a fresh inset dispatch
        webView.post {
            window.decorView.requestApplyInsets()
        }
    }

    private fun injectSafeAreaInsets(top: Int, bottom: Int, left: Int, right: Int) {
        cachedWebView?.let { webView ->
            webView.post {
                val script = """
                    (function() {
                        document.documentElement.style.setProperty('--safe-area-inset-top', '${top}px');
                        document.documentElement.style.setProperty('--safe-area-inset-bottom', '${bottom}px');
                        document.documentElement.style.setProperty('--safe-area-inset-left', '${left}px');
                        document.documentElement.style.setProperty('--safe-area-inset-right', '${right}px');
                        console.log('[SafeArea] Native insets applied:', {top: $top, bottom: $bottom, left: $left, right: $right});
                    })();
                """.trimIndent()
                webView.evaluateJavascript(script, null)
                android.util.Log.d("SafeArea", "Injected CSS variables: top=$top, bottom=$bottom")
            }
        }
    }
}
KOTLIN_CODE

# Replace package placeholder with actual package
sed -i "s/package PACKAGE_PLACEHOLDER/package $PACKAGE_NAME/" "$MAIN_ACTIVITY"

echo "=== After modification ==="
cat "$MAIN_ACTIVITY"
