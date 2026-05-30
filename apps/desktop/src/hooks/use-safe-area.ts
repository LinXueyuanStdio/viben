import { useEffect } from "react";

/**
 * Hook to initialize safe area insets on mobile platforms.
 *
 * On Android: Insets are injected by native MainActivity.kt via evaluateJavascript.
 * On iOS: Uses tauri-plugin-safe-area-insets-css if available.
 *
 * CSS variables set: --safe-area-inset-top, --safe-area-inset-bottom,
 * --safe-area-inset-left, --safe-area-inset-right
 */
export function useSafeArea() {
  useEffect(() => {
    async function initSafeArea() {
      // Check if we're on iOS and try to use the plugin
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS) {
        try {
          const { getTopInset, getBottomInset } = await import(
            "@saurl/tauri-plugin-safe-area-insets-css-api"
          );

          const topResult = await getTopInset();
          const bottomResult = await getBottomInset();

          const top = topResult?.inset ?? 0;
          const bottom = bottomResult?.inset ?? 0;

          document.documentElement.style.setProperty(
            "--safe-area-inset-top",
            `${top}px`
          );
          document.documentElement.style.setProperty(
            "--safe-area-inset-bottom",
            `${bottom}px`
          );
          document.documentElement.style.setProperty(
            "--safe-area-inset-left",
            "0px"
          );
          document.documentElement.style.setProperty(
            "--safe-area-inset-right",
            "0px"
          );

          console.log("[SafeArea] iOS insets applied:", { top, bottom });
        } catch (e) {
          console.debug("[SafeArea] iOS plugin not available:", e);
        }
      }

      // On Android, insets are injected by native MainActivity.kt
      // No JavaScript action needed - just log for debugging
      const isAndroid = /android/i.test(navigator.userAgent);
      if (isAndroid) {
        console.log("[SafeArea] Android mode - waiting for native insets injection");
      }
    }

    // Small delay to let the app initialize
    setTimeout(initSafeArea, 100);
  }, []);
}
