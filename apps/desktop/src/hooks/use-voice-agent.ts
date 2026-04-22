// apps/desktop/src/hooks/use-voice-agent.ts
import { useCallback, useEffect, useRef } from "react";
import { useVoiceStore } from "@/stores/voice-store";
import { vocalBridgeClient } from "@/lib/voice/vocal-bridge-client";
import type { TranscriptEvent, VocalBridgeState } from "@/lib/voice/vocal-bridge-client";
import { playSound } from "@/lib/voice/audio-feedback";
import { useWave } from "./use-wave";
import type { VoiceConnectionState, AgentResponse } from "@/types/voice";

interface UseVoiceAgentReturn {
  // 状态
  state: VoiceConnectionState;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;

  // 操作
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;

  // 数据
  userTranscript: string;
  agentResponse: AgentResponse;
}

/**
 * Voice Agent Hook
 * 管理与 Vocal Bridge 的连接和状态
 */
export function useVoiceAgent(): UseVoiceAgentReturn {
  const store = useVoiceStore();
  const wave = useWave();
  const mountedRef = useRef(true);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { connectionState, userTranscript, agentResponse, config } = store;

  // 清理静默计时器
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // 启动静默计时器
  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    // 仅在 listening 状态下计时
    if (store.connectionState !== "listening") return;

    silenceTimerRef.current = setTimeout(() => {
      if (mountedRef.current && store.connectionState === "listening") {
        console.log("[useVoiceAgent] Silence timeout, disconnecting...");
        vocalBridgeClient.disconnect();
      }
    }, config.silenceTimeout * 1000);
  }, [config.silenceTimeout, store.connectionState, clearSilenceTimer]);

  // 重置静默计时器
  const resetSilenceTimer = useCallback(() => {
    if (store.connectionState === "listening") {
      startSilenceTimer();
    }
  }, [store.connectionState, startSilenceTimer]);

  // 组件挂载/卸载
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSilenceTimer();
    };
  }, [clearSilenceTimer]);

  // 监听 Vocal Bridge 状态变化
  useEffect(() => {
    const unsubState = vocalBridgeClient.onStateChange((state: VocalBridgeState) => {
      if (!mountedRef.current) return;

      switch (state) {
        case "connecting":
          store.actions.setConnectionState("connecting");
          break;
        case "connected":
        case "waiting_for_agent":
          store.actions.setConnectionState("listening");
          wave.startListening();
          startSilenceTimer();
          break;
        case "disconnected":
          store.actions.setConnectionState("idle");
          wave.stopSpeaking();
          clearSilenceTimer();
          break;
        case "error":
          store.actions.setConnectionState("error");
          wave.stopSpeaking();
          clearSilenceTimer();
          break;
      }
    });

    const unsubTranscript = vocalBridgeClient.onTranscript((event: TranscriptEvent) => {
      if (!mountedRef.current) return;

      if (event.role === "user") {
        store.actions.updateUserTranscript(event.text);
        // 用户说话时重置静默计时
        resetSilenceTimer();
        // 弹窗降低透明度
        store.actions.setPopupOpacity(0.3);
      } else {
        store.actions.appendAgentResponse(event.text);
        // Agent 说话时切换波浪状态
        store.actions.setConnectionState("speaking");
        wave.startSpeaking("calm");
        // 暂停静默计时
        clearSilenceTimer();
      }
    });

    const unsubError = vocalBridgeClient.onError((err) => {
      if (!mountedRef.current) return;
      console.error("[useVoiceAgent] Error:", err);
      store.actions.setError(err.message);
      if (config.enableSoundEffects) {
        playSound("error");
      }
    });

    // 监听音频级别变化，驱动波浪动效
    const unsubAudioLevel = vocalBridgeClient.onAudioLevel((level) => {
      if (!mountedRef.current) return;
      wave.setAudioLevel(level);
    });

    return () => {
      unsubState();
      unsubTranscript();
      unsubError();
      unsubAudioLevel();
    };
  }, [store, wave, config.enableSoundEffects, startSilenceTimer, resetSilenceTimer, clearSilenceTimer]);

  // 连接
  const connect = useCallback(async () => {
    if (connectionState !== "idle") {
      console.log("[useVoiceAgent] Already connected, state:", connectionState);
      return;
    }

    if (!config.vocalBridgeApiKey) {
      console.error("[useVoiceAgent] No API Key configured");
      store.actions.setError("请先配置 API Key");
      return;
    }

    if (!config.vocalBridgeAgentId) {
      console.error("[useVoiceAgent] No Agent ID configured");
      store.actions.setError("请先配置 Agent ID");
      return;
    }

    console.log("[useVoiceAgent] Connecting with API Key:", config.vocalBridgeApiKey.slice(0, 8) + "...", "Agent ID:", config.vocalBridgeAgentId);

    // 配置客户端
    vocalBridgeClient.configure(config.vocalBridgeApiKey, config.vocalBridgeAgentId);

    store.actions.setConnectionState("connecting");
    store.actions.clearAgentResponse();
    store.actions.updateUserTranscript("");

    try {
      await vocalBridgeClient.connect();
      console.log("[useVoiceAgent] Connected successfully");
      if (config.enableSoundEffects) {
        playSound("wake-up");
      }
    } catch (err) {
      console.error("[useVoiceAgent] Connection failed:", err);
      store.actions.setConnectionState("error");
      store.actions.setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [connectionState, config, store]);

  // 断开
  const disconnect = useCallback(async () => {
    clearSilenceTimer();
    await vocalBridgeClient.disconnect();
    store.actions.setConnectionState("idle");
    store.actions.clearAgentResponse();
    wave.stopSpeaking();
  }, [store, wave, clearSilenceTimer]);

  // 切换麦克风
  const toggleMicrophone = useCallback(async () => {
    await vocalBridgeClient.toggleMicrophone();
  }, []);

  return {
    state: connectionState,
    isConnected:
      connectionState === "listening" ||
      connectionState === "speaking" ||
      connectionState === "processing",
    isListening: connectionState === "listening",
    isSpeaking: connectionState === "speaking",
    connect,
    disconnect,
    toggleMicrophone,
    userTranscript,
    agentResponse,
  };
}
