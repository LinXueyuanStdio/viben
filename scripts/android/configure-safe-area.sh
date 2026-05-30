#!/bin/bash
# Configure Android safe area handling
# - Enable edge-to-edge mode with transparent system bars
# - Use addJavascriptInterface to expose insets to JavaScript
# - Retry injection with handler to ensure it works after page loads

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

# Check if already patched
if grep -q "injectSafeAreaInsets" "$MAIN_ACTIVITY"; then
  echo "Safe area already configured"
  exit 0
fi

# Get the package name from the file
PACKAGE_NAME=$(grep "^package " "$MAIN_ACTIVITY" | sed 's/package //' | tr -d '\r')
echo "Package: $PACKAGE_NAME"

# Create the new MainActivity.kt
cat > "$MAIN_ACTIVITY" << 'KOTLIN_CODE'
package PACKAGE_PLACEHOLDER

import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import kotlin.math.roundToInt

class MainActivity : TauriActivity() {
    private var webViewRef: WebView? = null
    private var currentInsets: IntArray = intArrayOf(0, 0, 0, 0)
    private val handler = Handler(Looper.getMainLooper())
    private var injectionAttempts = 0
    private val maxAttempts = 10

    // JavaScript interface to expose insets
    inner class SafeAreaInterface {
        @JavascriptInterface
        fun getTop(): Int = currentInsets[0]

        @JavascriptInterface
        fun getBottom(): Int = currentInsets[1]

        @JavascriptInterface
        fun getLeft(): Int = currentInsets[2]

        @JavascriptInterface
        fun getRight(): Int = currentInsets[3]
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable edge-to-edge - content extends behind system bars
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Make system bars transparent so app background shows through
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        // Set up inset listener
        val contentView = findViewById<android.view.View>(android.R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(contentView) { _, insets ->
            val systemBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )

            val density = resources.displayMetrics.density
            val topDp = (systemBars.top / density).roundToInt()
            val bottomDp = (systemBars.bottom / density).roundToInt()
            val leftDp = (systemBars.left / density).roundToInt()
            val rightDp = (systemBars.right / density).roundToInt()

            currentInsets = intArrayOf(topDp, bottomDp, leftDp, rightDp)
            android.util.Log.d("SafeArea", "Insets received: top=$topDp, bottom=$bottomDp, left=$leftDp, right=$rightDp")

            // Inject immediately if webview is ready
            webViewRef?.let { injectSafeAreaInsets() }

            insets
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        webViewRef = webView

        // Add JavaScript interface
        webView.addJavascriptInterface(SafeAreaInterface(), "AndroidSafeArea")

        // Start injection attempts with retry
        injectionAttempts = 0
        scheduleInjection()

        // Request fresh insets
        webView.post {
            window.decorView.requestApplyInsets()
        }
    }

    private fun scheduleInjection() {
        handler.postDelayed({
            injectSafeAreaInsets()
            injectionAttempts++
            // Keep retrying for first few seconds to catch page load
            if (injectionAttempts < maxAttempts) {
                scheduleInjection()
            }
        }, if (injectionAttempts == 0) 500 else 1000)
    }

    private fun injectSafeAreaInsets() {
        val top = currentInsets[0]
        val bottom = currentInsets[1]
        val left = currentInsets[2]
        val right = currentInsets[3]

        webViewRef?.post {
            val script = """
                (function() {
                    if (typeof window.__safeAreaSet === 'undefined' || !window.__safeAreaSet) {
                        var root = document.documentElement;
                        if (root) {
                            root.style.setProperty('--safe-area-inset-top', '${top}px');
                            root.style.setProperty('--safe-area-inset-bottom', '${bottom}px');
                            root.style.setProperty('--safe-area-inset-left', '${left}px');
                            root.style.setProperty('--safe-area-inset-right', '${right}px');
                            window.__safeAreaSet = true;
                            console.log('[SafeArea] Android insets applied:', {top: $top, bottom: $bottom, left: $left, right: $right});
                        }
                    }
                })();
            """.trimIndent()
            webViewRef?.evaluateJavascript(script, null)
        }
    }
}
KOTLIN_CODE

# Replace package placeholder
sed -i "s/package PACKAGE_PLACEHOLDER/package $PACKAGE_NAME/" "$MAIN_ACTIVITY"

echo "=== After modification ==="
cat "$MAIN_ACTIVITY"
