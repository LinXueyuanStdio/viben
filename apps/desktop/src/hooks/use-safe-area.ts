import { useEffect } from "react";

/**
 * Hook to initialize safe area insets on mobile platforms.
 *
 * On Android: Insets are injected by native MainActivity.kt via evaluateJavascript.
 * On iOS: Uses CSS env(safe-area-inset-*) which works natively with viewport-fit=cover,
 *         or falls back to the Tauri plugin if env() doesn't work.
 *
 * CSS variables set: --safe-area-inset-top, --safe-area-inset-bottom,
 * --safe-area-inset-left, --safe-area-inset-right
 */
export function useSafeArea() {
  useEffect(() => {
    async function initSafeArea() {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /android/i.test(navigator.userAgent);

      if (isIOS) {
        // On iOS, CSS env() should work natively with viewport-fit=cover
        // Try plugin first, then fall back to CSS env() mapping
        try {
          const { getTopInset, getBottomInset } = await import(
            "@saurl/tauri-plugin-safe-area-insets-css-api"
          );

          const topResult = await getTopInset();
          const bottomResult = await getBottomInset();

          const top = topResult?.inset ?? 0;
          const bottom = bottomResult?.inset ?? 0;

          if (top > 0 || bottom > 0) {
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
            console.log("[SafeArea] iOS plugin insets applied:", { top, bottom });
            return;
          }
        } catch (e) {
          console.debug("[SafeArea] iOS plugin not available:", e);
        }

        // Fall back to CSS env() values
        document.documentElement.style.setProperty(
          "--safe-area-inset-top",
          "env(safe-area-inset-top, 0px)"
        );
        document.documentElement.style.setProperty(
          "--safe-area-inset-bottom",
          "env(safe-area-inset-bottom, 0px)"
        );
        document.documentElement.style.setProperty(
          "--safe-area-inset-left",
          "env(safe-area-inset-left, 0px)"
        );
        document.documentElement.style.setProperty(
          "--safe-area-inset-right",
          "env(safe-area-inset-right, 0px)"
        );
        console.log("[SafeArea] iOS using CSS env() fallback");
      }

      if (isAndroid) {
        // On Android, insets are injected by native MainActivity.kt
        // The native code retries injection multiple times, so we just need to wait
        console.log("[SafeArea] Android mode - waiting for native injection");

        // Also try to get insets from JavaScript interface as fallback
        const tryGetFromInterface = () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const androidSafeArea = (window as any).AndroidSafeArea;
          if (androidSafeArea) {
            try {
              const top = androidSafeArea.getTop();
              const bottom = androidSafeArea.getBottom();
              const left = androidSafeArea.getLeft();
              const right = androidSafeArea.getRight();

              if (top > 0 || bottom > 0) {
                document.documentElement.style.setProperty('--safe-area-inset-top', `${top}px`);
                document.documentElement.style.setProperty('--safe-area-inset-bottom', `${bottom}px`);
                document.documentElement.style.setProperty('--safe-area-inset-left', `${left}px`);
                document.documentElement.style.setProperty('--safe-area-inset-right', `${right}px`);
                console.log("[SafeArea] Android insets from interface:", { top, bottom, left, right });
                return true;
              }
            } catch (e) {
              console.debug("[SafeArea] Android interface error:", e);
            }
          }
          return false;
        };

        // Try immediately and retry a few times
        if (!tryGetFromInterface()) {
          let attempts = 0;
          const interval = setInterval(() => {
            attempts++;
            if (tryGetFromInterface() || attempts >= 5) {
              clearInterval(interval);
            }
          }, 500);
        }
      }
    }

    // Small delay to let the app initialize
    setTimeout(initSafeArea, 100);
  }, []);
}
