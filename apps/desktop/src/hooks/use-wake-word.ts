import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type WakeWordState = "inactive" | "loading" | "listening" | "detected";

interface WakeWordDetectionEvent {
  keyword: string;
  score: number;
}

type DetectionCallback = (detection: WakeWordDetectionEvent) => void;

interface UseWakeWordOptions {
  threshold?: number;
}

interface UseWakeWordReturn {
  state: WakeWordState;
  isListening: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function useWakeWord(
  onDetected: DetectionCallback,
  options: UseWakeWordOptions = {}
): UseWakeWordReturn {
  const { threshold = 0.5 } = options;

  const [state, setState] = useState<WakeWordState>("inactive");
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    const unlisten = listen<WakeWordDetectionEvent>("wakeword-detected", (event) => {
      setState("detected");
      onDetectedRef.current(event.payload);
      setTimeout(() => setState("listening"), 1000);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const start = useCallback(async () => {
    if (state === "listening" || state === "loading") return;
    setState("loading");
    try {
      await invoke("start_wakeword", { threshold });
      setState("listening");
    } catch (err) {
      console.error("[useWakeWord] Failed to start:", err);
      setState("inactive");
      throw err;
    }
  }, [state, threshold]);

  const stop = useCallback(async () => {
    try {
      await invoke("stop_wakeword");
    } finally {
      setState("inactive");
    }
  }, []);

  return {
    state,
    isListening: state === "listening",
    start,
    stop,
  };
}

export type { WakeWordState, WakeWordDetectionEvent, UseWakeWordOptions, UseWakeWordReturn };
