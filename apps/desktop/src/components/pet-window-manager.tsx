// apps/desktop/src/components/pet-window-manager.tsx
import { usePetWindow } from "@/hooks";

/**
 * Component that manages the pet window visibility.
 * Include this in the main app to auto-show/hide the pet window based on settings.
 */
export function PetWindowManager() {
  usePetWindow();
  return null;
}
