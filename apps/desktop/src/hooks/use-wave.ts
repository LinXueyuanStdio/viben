import { useCallback, useEffect, useMemo, useRef } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { WaveState, WaveConfig } from "@/types/overlay";

interface UseWaveReturn {
  enabled: boolean;
  state: WaveState;
  config: WaveConfig;
  setEnabled: (enabled: boolean) => void;
  setState: (state: WaveState) => void;
  setConfig: (config: Partial<WaveConfig>) => void;
  startListening: () => void;
  startSpeaking: (mood?: "calm" | "excited" | "happy") => void;
  stopSpeaking: () => void;
  reset: () => void;
}

export function useWave(): UseWaveReturn {
  const store = useOverlayStore();
  const { waveEnabled: enabled, waveState: state, waveConfig: config, actions } = store;
  const endingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to prevent stale state updates
  useEffect(() => {
    return () => {
      if (endingTimeoutRef.current) {
        clearTimeout(endingTimeoutRef.current);
      }
    };
  }, []);

  const clearEndingTimeout = useCallback(() => {
    if (endingTimeoutRef.current) {
      clearTimeout(endingTimeoutRef.current);
      endingTimeoutRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    clearEndingTimeout();
    actions.setWaveState("listening");
  }, [actions, clearEndingTimeout]);

  const startSpeaking = useCallback(
    (mood: "calm" | "excited" | "happy" = "calm") => {
      clearEndingTimeout();
      actions.setWaveState(`speaking-${mood}`);
    },
    [actions, clearEndingTimeout]
  );

  const stopSpeaking = useCallback(() => {
    clearEndingTimeout();
    actions.setWaveState("ending");
    endingTimeoutRef.current = setTimeout(() => {
      actions.setWaveState("idle");
    }, 300);
  }, [actions, clearEndingTimeout]);

  const reset = useCallback(() => {
    clearEndingTimeout();
    actions.setWaveState("idle");
  }, [actions, clearEndingTimeout]);

  return useMemo(
    () => ({
      enabled,
      state,
      config,
      setEnabled: actions.setWaveEnabled,
      setState: actions.setWaveState,
      setConfig: actions.setWaveConfig,
      startListening,
      startSpeaking,
      stopSpeaking,
      reset,
    }),
    [enabled, state, config, actions, startListening, startSpeaking, stopSpeaking, reset]
  );
}
