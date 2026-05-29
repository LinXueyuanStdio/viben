import { useEffect } from "react";

/**
 * Hook to apply safe area insets on mobile platforms.
 * Uses tauri-plugin-safe-area-insets to get the actual inset values
 * and sets them as CSS custom properties on the document root.
 */
export function useSafeArea() {
  useEffect(() => {
    async function applySafeArea() {
      try {
        const { getInsets } = await import("tauri-plugin-safe-area-insets");
        const insets = await getInsets();

        document.documentElement.style.setProperty(
          "--safe-area-inset-top",
          `${insets.top}px`
        );
        document.documentElement.style.setProperty(
          "--safe-area-inset-bottom",
          `${insets.bottom}px`
        );
        document.documentElement.style.setProperty(
          "--safe-area-inset-left",
          `${insets.left}px`
        );
        document.documentElement.style.setProperty(
          "--safe-area-inset-right",
          `${insets.right}px`
        );

        console.log("[SafeArea] Applied insets:", insets);
      } catch (e) {
        // Not on mobile or plugin not available - use CSS env() fallback
        console.debug("[SafeArea] Plugin not available, using CSS env() fallback");
      }
    }

    applySafeArea();
  }, []);
}
