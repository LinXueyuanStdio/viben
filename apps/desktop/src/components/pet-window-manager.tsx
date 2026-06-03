// apps/desktop/src/components/pet-window-manager.tsx
import { useEffect } from "react";
import { usePetWindow } from "@/hooks";

/**
 * Component that manages the pet window visibility.
 * Include this in the main app to auto-show/hide the pet window based on settings.
 */
export function PetWindowManager() {
  useEffect(() => {
    console.log("[PetWindowManager] Component mounted");
    return () => {
      console.log("[PetWindowManager] Component unmounted");
    };
  }, []);

  const { refresh } = usePetWindow();

  useEffect(() => {
    console.log("[PetWindowManager] usePetWindow hook initialized, refresh function available:", !!refresh);
  }, [refresh]);

  return null;
}
