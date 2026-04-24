import { useEffect, useRef } from "react";
import { useVoiceStore } from "@/stores/voice-store";
import { loadVoiceConfig } from "@/lib/voice/secure-config";

/**
 * Loads voice configuration from disk into the Zustand store at app startup.
 * Call once in AppLayout so sidebar and other components can access wake word config.
 */
export function useVoiceConfigInit() {
  const { configLoaded, actions } = useVoiceStore();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (configLoaded || loadedRef.current) return;
    loadedRef.current = true;

    loadVoiceConfig()
      .then((config) => {
        actions.setConfig(config);
        actions.setConfigLoaded(true);
      })
      .catch((err) => {
        console.error("[useVoiceConfigInit] Failed to load voice config:", err);
      });
  }, [configLoaded, actions]);
}
