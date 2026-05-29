import { useEffect } from "react";

/**
 * Hook to apply safe area insets on mobile platforms.
 * Uses tauri-plugin-safe-area-insets-css to get the actual inset values
 * and sets them as CSS custom properties on the document root.
 */
export function useSafeArea() {
  useEffect(() => {
    async function applySafeArea() {
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
        // Left and right are typically 0 on phones (no side notches)
        document.documentElement.style.setProperty(
          "--safe-area-inset-left",
          "0px"
        );
        document.documentElement.style.setProperty(
          "--safe-area-inset-right",
          "0px"
        );

        console.log("[SafeArea] Applied insets:", { top, bottom });
      } catch (e) {
        // Not on mobile or plugin not available - use CSS env() fallback
        console.debug("[SafeArea] Plugin not available, using CSS env() fallback", e);
      }
    }

    applySafeArea();
  }, []);
}
