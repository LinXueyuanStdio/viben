#!/bin/bash
# Configure Android safe area handling
# - Enable edge-to-edge mode with transparent system bars
# - Inject CSS variables after page loads so the app can apply padding with its own background color

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
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import kotlin.math.roundToInt

class MainActivity : TauriActivity() {
    private var webViewRef: WebView? = null
    private var currentInsets: IntArray? = null
    private var pageLoaded = false

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

            // Only inject if page has loaded
            if (pageLoaded && webViewRef != null) {
                injectSafeAreaInsets(topDp, bottomDp, leftDp, rightDp)
            }

            insets
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        webViewRef = webView

        // Set up WebViewClient to detect when page loads
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pageLoaded = true

                // Inject insets now that page is loaded
                currentInsets?.let { insets ->
                    injectSafeAreaInsets(insets[0], insets[1], insets[2], insets[3])
                }
            }
        }

        // Request fresh insets
        webView.post {
            window.decorView.requestApplyInsets()
        }
    }

    private fun injectSafeAreaInsets(top: Int, bottom: Int, left: Int, right: Int) {
        webViewRef?.post {
            val script = """
                (function() {
                    var root = document.documentElement;
                    root.style.setProperty('--safe-area-inset-top', '${top}px');
                    root.style.setProperty('--safe-area-inset-bottom', '${bottom}px');
                    root.style.setProperty('--safe-area-inset-left', '${left}px');
                    root.style.setProperty('--safe-area-inset-right', '${right}px');
                    console.log('[SafeArea] Android insets set:', {top: $top, bottom: $bottom, left: $left, right: $right});
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
