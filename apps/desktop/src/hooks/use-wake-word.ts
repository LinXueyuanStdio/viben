import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useVoiceStore } from "@/stores/voice-store";
import type { WakeWordState } from "@/types/voice";

interface WakeWordDetectionEvent {
  keyword: string;
  score: number;
}

interface WakeWordScoreEvent {
  keyword: string;
  score: number;
  threshold: number;
  above_threshold: boolean;
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

let listenerRegistered = false;
let detectionCount = 0;

export function useWakeWord(
  onDetected: DetectionCallback,
  options: UseWakeWordOptions = {}
): UseWakeWordReturn {
  const { threshold = 0.5 } = options;

  const state = useVoiceStore((s) => s.wakeWordState);
  const setWakeWordState = useVoiceStore((s) => s.actions.setWakeWordState);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (listenerRegistered) return;
    listenerRegistered = true;

    const unlistenDetected = listen<WakeWordDetectionEvent>("wakeword-detected", (event) => {
      const { keyword, score } = event.payload;
      detectionCount++;
      const ts = new Date().toLocaleTimeString();
      console.log(
        `%c[WakeWord] 🔔 [${ts}] 检测到唤醒词! keyword="${keyword}" score=${score.toFixed(4)} (#${detectionCount})`,
        "color: #22c55e; font-weight: bold",
      );

      const { setWakeWordState: setState } = useVoiceStore.getState().actions;
      setState("detected");
      onDetectedRef.current(event.payload);
      setTimeout(() => setState("listening"), 1000);
    });

    const unlistenScore = listen<WakeWordScoreEvent>("wakeword-score", (event) => {
      const { keyword, score, threshold: th, above_threshold } = event.payload;
      if (above_threshold) return;
      if (score > 0.1) {
        const ts = new Date().toLocaleTimeString();
        console.log(
          `%c[WakeWord] 📊 [${ts}] keyword="${keyword}" score=${score.toFixed(4)} (低于阈值 ${th.toFixed(2)})`,
          "color: #eab308",
        );
      }
    });

    return () => {
      listenerRegistered = false;
      unlistenDetected.then((fn) => fn());
      unlistenScore.then((fn) => fn());
    };
  }, []);

  const start = useCallback(async () => {
    const currentState = useVoiceStore.getState().wakeWordState;
    if (currentState === "listening" || currentState === "loading") return;
    setWakeWordState("loading");
    console.log("[WakeWord] ⏳ 正在加载唤醒词模型...");
    try {
      await invoke("start_wakeword", { threshold });
      setWakeWordState("listening");
      detectionCount = 0;
      console.log(
        `[WakeWord] 🎙️ 开始监听，阈值: ${threshold}`,
      );
    } catch (err) {
      console.error("[WakeWord] ❌ 启动失败:", err);
      setWakeWordState("inactive");
      throw err;
    }
  }, [threshold, setWakeWordState]);

  const stop = useCallback(async () => {
    try {
      await invoke("stop_wakeword");
    } finally {
      setWakeWordState("inactive");
      console.log(`[WakeWord] ⏹️ 已停止。共检测到 ${detectionCount} 次唤醒词。`);
    }
  }, [setWakeWordState]);

  return {
    state,
    isListening: state === "listening",
    start,
    stop,
  };
}

export type { WakeWordState, WakeWordDetectionEvent, UseWakeWordOptions, UseWakeWordReturn };
