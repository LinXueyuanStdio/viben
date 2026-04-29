import { useEffect, useCallback, useState } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import { loadOverlayConfig, saveOverlayConfig } from "@/lib/overlay-config";
import type { OverlaySettings } from "@/types/overlay";
import i18n from "@/i18n";

interface UseOverlayReturn {
  visible: boolean;
  opacity: number;
  configLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  setOpacity: (opacity: number) => void;
  saveSettings: (settings: OverlaySettings) => Promise<void>;
}

export function useOverlay(): UseOverlayReturn {
  const store = useOverlayStore();
  const { visible, opacity, configLoaded, actions } = store;
  const [isLoading, setIsLoading] = useState(!configLoaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configLoaded) return;

    setIsLoading(true);
    setError(null);

    loadOverlayConfig()
      .then((settings) => {
        actions.loadConfig(settings);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : i18n.t("errors.overlay.loadConfigFailed", "Failed to load config"));
        console.error("[useOverlay] Failed to load config:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [configLoaded, actions]);

  const saveSettings = useCallback(async (settings: OverlaySettings) => {
    try {
      await saveOverlayConfig(settings);
      actions.loadConfig(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("errors.overlay.saveConfigFailed", "Failed to save config"));
      throw err;
    }
  }, [actions]);

  return {
    visible,
    opacity,
    configLoaded,
    isLoading,
    error,
    show: actions.show,
    hide: actions.hide,
    toggle: actions.toggle,
    setOpacity: actions.setOpacity,
    saveSettings,
  };
}
