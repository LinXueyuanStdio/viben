// apps/desktop/src/hooks/use-voice-agent.ts
import { useCallback } from "react";
import { useVoiceStore } from "@/stores/voice-store";
import {
  connectVoiceAgent,
  disconnectVoiceAgent,
  toggleVoiceAgentMicrophone,
} from "@/lib/voice/voice-agent-service";
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

  const { connectionState, userTranscript, agentResponse } = store;

  // 连接
  const connect = useCallback(() => connectVoiceAgent(), []);

  // 断开
  const disconnect = useCallback(() => disconnectVoiceAgent(), []);

  // 切换麦克风
  const toggleMicrophone = useCallback(() => toggleVoiceAgentMicrophone(), []);

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
