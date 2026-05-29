import { useEffect } from "react";

/**
 * Hook to apply safe area insets on mobile platforms.
 * Uses tauri-plugin-safe-area-insets-css to get the actual inset values
 * and sets them as CSS custom properties on the document root.
 *
 * Retries a few times since WindowInsets may not be available immediately
 * after app launch.
 */
export function useSafeArea() {
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 200; // ms

    async function applySafeArea(): Promise<boolean> {
      try {
        const { getTopInset, getBottomInset } = await import(
          "@saurl/tauri-plugin-safe-area-insets-css-api"
        );

        const topResult = await getTopInset();
        const bottomResult = await getBottomInset();

        const top = topResult?.inset ?? 0;
        const bottom = bottomResult?.inset ?? 0;

        console.log("[SafeArea] Got insets:", { top, bottom, attempt: attempts + 1 });

        // If both are 0, the insets might not be available yet
        if (top === 0 && bottom === 0 && attempts < maxAttempts - 1) {
          return false; // Signal to retry
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
        return true; // Success
      } catch (e) {
        console.debug("[SafeArea] Plugin not available, using CSS env() fallback", e);
        return true; // Don't retry on error
      }
    }

    async function tryApplySafeArea() {
      const success = await applySafeArea();
      if (!success && attempts < maxAttempts) {
        attempts++;
        setTimeout(tryApplySafeArea, retryDelay);
      }
    }

    // Start after a small delay to let the window settle
    setTimeout(tryApplySafeArea, 100);
  }, []);
}
