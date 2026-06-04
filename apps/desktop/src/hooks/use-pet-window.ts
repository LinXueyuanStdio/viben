// apps/desktop/src/hooks/use-pet-window.ts
import { useEffect, useCallback } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { getGatewayClient } from "@/lib/gateway";

interface PetConfigResponse {
  current: string | null;
  enabled: boolean;
  preferences: {
    size: number;
    position: { right: number; bottom: number } | null;
  };
}

async function fetchPetConfig(): Promise<PetConfigResponse | null> {
  try {
    const data = await getGatewayClient().get<{ config: PetConfigResponse }>("/api/pet/config");
    return data.config;
  } catch {
    return null;
  }
}

/**
 * Hook to manage the pet window visibility based on pet settings.
 * The pet-window page handles its own show/hide internally.
 * This hook only emits reload events to trigger the pet window to re-check config.
 */
export function usePetWindow() {
  const checkAndShowPetWindow = useCallback(async () => {
    const config = await fetchPetConfig();
    const petWindow = await WebviewWindow.getByLabel("pet-window");
    if (!petWindow) return;

    if (config?.enabled && config.current) {
      await petWindow.show();
    } else {
      await petWindow.hide();
    }
  }, []);

  useEffect(() => {
    checkAndShowPetWindow();

    // Listen for config change events instead of polling
    const unlisten = listen("pet-config-changed", () => {
      checkAndShowPetWindow();
    });

    // Fallback poll every 10s for resilience
    const interval = setInterval(checkAndShowPetWindow, 10000);

    return () => {
      clearInterval(interval);
      unlisten.then((fn) => fn());
    };
  }, [checkAndShowPetWindow]);

  return { refresh: checkAndShowPetWindow };
}
