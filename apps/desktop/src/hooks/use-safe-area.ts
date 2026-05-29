import { useEffect } from "react";

// Typical Android system bar sizes in dp (will be used as fallback)
const ANDROID_STATUS_BAR_HEIGHT = 24; // Standard Android status bar
const ANDROID_NAV_BAR_HEIGHT = 48; // Standard 3-button navigation bar

/**
 * Hook to apply safe area insets on mobile platforms.
 * Uses tauri-plugin-safe-area-insets-css when available, with fallbacks
 * for typical Android system bar sizes.
 */
export function useSafeArea() {
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 300; // ms

    async function applySafeArea(): Promise<boolean> {
      try {
        const { getTopInset, getBottomInset } = await import(
          "@saurl/tauri-plugin-safe-area-insets-css-api"
        );

        const topResult = await getTopInset();
        const bottomResult = await getBottomInset();

        let top = topResult?.inset ?? 0;
        let bottom = bottomResult?.inset ?? 0;

        console.log("[SafeArea] Plugin returned:", { top, bottom, attempt: attempts + 1 });

        // If plugin returns 0, use fallback values on Android
        // The plugin's rootWindowInsets can be null in some cases
        if (top === 0 && bottom === 0) {
          // Check if we're on Android by looking at user agent
          const isAndroid = /android/i.test(navigator.userAgent);
          if (isAndroid) {
            // Use standard Android system bar sizes as fallback
            top = ANDROID_STATUS_BAR_HEIGHT;
            bottom = ANDROID_NAV_BAR_HEIGHT;
            console.log("[SafeArea] Using Android fallback values:", { top, bottom });
          } else if (attempts < maxAttempts - 1) {
            // On other platforms, retry in case insets aren't ready
            return false;
          }
        }

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

        console.log("[SafeArea] Applied insets:", { top, bottom });
        return true;
      } catch (e) {
        // Plugin not available - check if on mobile and use fallbacks
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isAndroid) {
          document.documentElement.style.setProperty(
            "--safe-area-inset-top",
            `${ANDROID_STATUS_BAR_HEIGHT}px`
          );
          document.documentElement.style.setProperty(
            "--safe-area-inset-bottom",
            `${ANDROID_NAV_BAR_HEIGHT}px`
          );
          console.log("[SafeArea] Plugin error, using Android fallback:", e);
        } else {
          console.debug("[SafeArea] Plugin not available:", e);
        }
        return true;
      }
    }

    async function tryApplySafeArea() {
      const success = await applySafeArea();
      if (!success && attempts < maxAttempts) {
        attempts++;
        setTimeout(tryApplySafeArea, retryDelay);
      }
    }

    // Start after a delay to let the window settle
    setTimeout(tryApplySafeArea, 100);
  }, []);
}
