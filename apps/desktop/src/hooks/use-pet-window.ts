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
    console.log("[usePetWindow] Fetching pet config from:", `${API_BASE}/api/pet/config`);
    const res = await fetch(`${API_BASE}/api/pet/config`);
    console.log("[usePetWindow] fetchPetConfig response status:", res.status, res.ok);
    if (!res.ok) {
      console.log("[usePetWindow] fetchPetConfig failed with status:", res.status);
      return null;
    }
    const data = await res.json();
    console.log("[usePetWindow] fetchPetConfig raw data:", JSON.stringify(data, null, 2));
    console.log("[usePetWindow] fetchPetConfig returning config:", JSON.stringify(data.config, null, 2));
    return data.config;
  } catch (error) {
    console.error("[usePetWindow] fetchPetConfig error:", error);
    return null;
  }
}

/**
 * Hook to manage the pet window visibility based on pet settings.
 * Call this in the main app to auto-show/hide the pet window.
 */
export function usePetWindow() {
  const checkAndShowPetWindow = useCallback(async () => {
    console.log("[usePetWindow] checkAndShowPetWindow called");

    const config = await fetchPetConfig();
    console.log("[usePetWindow] config received:", config);
    console.log("[usePetWindow] config?.enabled:", config?.enabled);
    console.log("[usePetWindow] config?.current:", config?.current);

    const petWindow = await WebviewWindow.getByLabel("pet-window");
    console.log("[usePetWindow] petWindow from getByLabel:", petWindow);
    console.log("[usePetWindow] petWindow exists:", !!petWindow);

    if (!petWindow) {
      console.warn("[usePetWindow] Pet window not found! The window with label 'pet-window' does not exist.");
      console.log("[usePetWindow] This could mean:");
      console.log("  1. The pet window was not created in tauri.conf.json");
      console.log("  2. The pet window failed to initialize");
      console.log("  3. The window label is incorrect");
      return;
    }

    const shouldShow = !!(config?.enabled && config.current);
    console.log("[usePetWindow] Decision - shouldShow:", shouldShow);
    console.log("[usePetWindow] Decision logic: enabled=", config?.enabled, "current=", config?.current, "=> shouldShow=", shouldShow);

    if (shouldShow) {
      // Pet is enabled and selected, show the window
      // The pet-window page will handle loading the pet and positioning
      console.log("[usePetWindow] Showing pet window...");
      try {
        await petWindow.show();
        console.log("[usePetWindow] Pet window show() completed successfully");
      } catch (error) {
        console.error("[usePetWindow] Error showing pet window:", error);
      }
    } else {
      // Pet is disabled or not selected, hide the window
      console.log("[usePetWindow] Hiding pet window (enabled:", config?.enabled, ", current:", config?.current, ")");
      try {
        await petWindow.hide();
        console.log("[usePetWindow] Pet window hide() completed successfully");
      } catch (error) {
        console.error("[usePetWindow] Error hiding pet window:", error);
      }
    }
  }, []);

  useEffect(() => {
    console.log("[usePetWindow] useEffect mounted, starting initial check");
    // Check on mount
    checkAndShowPetWindow();

    // Listen for config changes (poll every 5 seconds)
    console.log("[usePetWindow] Setting up 5-second polling interval");
    const interval = setInterval(() => {
      console.log("[usePetWindow] Polling interval triggered");
      checkAndShowPetWindow();
    }, 5000);

    return () => {
      console.log("[usePetWindow] useEffect cleanup, clearing interval");
      clearInterval(interval);
    };
  }, [checkAndShowPetWindow]);

  return { refresh: checkAndShowPetWindow };
}
