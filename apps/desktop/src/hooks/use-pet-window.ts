// apps/desktop/src/hooks/use-pet-window.ts
import { useEffect, useCallback } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const API_BASE = "http://127.0.0.1:18790";

interface PetConfigResponse {
  current: string | null;
  enabled: boolean;
  preferences: {
    size: number;
    position: { right: number; bottom: number };
  };
}

async function fetchPetConfig(): Promise<PetConfigResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/pet/config`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.config;
  } catch {
    return null;
  }
}

/**
 * Hook to manage the pet window visibility based on pet settings.
 * Call this in the main app to auto-show/hide the pet window.
 */
export function usePetWindow() {
  const checkAndShowPetWindow = useCallback(async () => {
    const config = await fetchPetConfig();
    const petWindow = await WebviewWindow.getByLabel("pet-window");

    if (!petWindow) return;

    if (config?.enabled && config.current) {
      // Pet is enabled and selected, show the window
      // The pet-window page will handle loading the pet and positioning
      await petWindow.show();
    } else {
      // Pet is disabled or not selected, hide the window
      await petWindow.hide();
    }
  }, []);

  useEffect(() => {
    // Check on mount
    checkAndShowPetWindow();

    // Listen for config changes (poll every 5 seconds)
    const interval = setInterval(checkAndShowPetWindow, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [checkAndShowPetWindow]);

  return { refresh: checkAndShowPetWindow };
}
