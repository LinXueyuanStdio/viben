import { useCallback, useEffect, useRef, useState } from "react";
import { wakeWordEngine } from "@/lib/voice/wake-word-engine";
import type { WakeWordDetection } from "@/lib/voice/wake-word-engine";
import { useSharedAudio } from "./use-shared-audio";

type WakeWordState = "inactive" | "loading" | "listening" | "detected";
type DetectionCallback = (detection: WakeWordDetection) => void;

interface UseWakeWordOptions {
  threshold?: number;
  autoStart?: boolean;
}

interface UseWakeWordReturn {
  state: WakeWordState;
  isListening: boolean;
  activeKeywords: string[];
  start: () => Promise<void>;
  stop: () => void;
  setActiveKeywords: (keywords: string[]) => void;
  loadKeyword: (name: string, modelPath?: string) => Promise<void>;
}

/**
 * Wake word detection hook
 * Based on openWakeWord ONNX engine
 */
export function useWakeWord(
  onDetected: DetectionCallback,
  options: UseWakeWordOptions = {}
): UseWakeWordReturn {
  const { threshold = 0.5, autoStart = false } = options;

  const [state, setState] = useState<WakeWordState>("inactive");
  const [activeKeywords, setActiveKeywordsState] = useState<string[]>([]);

  const sharedAudio = useSharedAudio();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const detectionUnsubRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const stateRef = useRef(state);

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      unsubscribeRef.current?.();
      detectionUnsubRef.current?.();
    };
  }, []);

  // Subscribe to detection events
  useEffect(() => {
    detectionUnsubRef.current = wakeWordEngine.onDetection((detection) => {
      if (mountedRef.current) {
        setState("detected");
        onDetected(detection);
        // Brief detected state, then resume listening
        setTimeout(() => {
          if (mountedRef.current && stateRef.current === "detected") {
            setState("listening");
          }
        }, 1000);
      }
    });

    return () => {
      detectionUnsubRef.current?.();
    };
  }, [onDetected]);

  const start = useCallback(async () => {
    if (stateRef.current === "listening" || stateRef.current === "loading") return;

    setState("loading");

    try {
      // Initialize audio stream
      if (!sharedAudio.isInitialized) {
        await sharedAudio.initialize();
      }

      // Load engine
      if (!wakeWordEngine.loaded) {
        await wakeWordEngine.load();
      }

      // Subscribe to audio frames
      unsubscribeRef.current = sharedAudio.subscribe((audioData) => {
        wakeWordEngine.processFrame(audioData, threshold);
      });

      if (mountedRef.current) {
        setState("listening");
      }
    } catch (err) {
      console.error("[useWakeWord] Failed to start:", err);
      if (mountedRef.current) {
        setState("inactive");
      }
      throw err;
    }
  }, [sharedAudio, threshold]);

  const stop = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setState("inactive");
  }, []);

  // Auto-start
  useEffect(() => {
    if (autoStart && state === "inactive") {
      start();
    }
  }, [autoStart, state, start]);

  const setActiveKeywords = useCallback((keywords: string[]) => {
    setActiveKeywordsState(keywords);
    wakeWordEngine.setActiveKeywords(keywords);
  }, []);

  const loadKeyword = useCallback(async (name: string, modelPath?: string) => {
    await wakeWordEngine.loadKeyword(name, modelPath);
  }, []);

  return {
    state,
    isListening: state === "listening",
    activeKeywords,
    start,
    stop,
    setActiveKeywords,
    loadKeyword,
  };
}

export type { WakeWordState, WakeWordDetection, UseWakeWordOptions, UseWakeWordReturn };
