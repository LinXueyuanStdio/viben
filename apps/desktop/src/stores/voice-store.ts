import { create } from "zustand";
import type {
  VoiceConnectionState,
  WakeWordState,
  VoiceConfig,
  AgentResponse,
} from "@/types/voice";
import { DEFAULT_VOICE_CONFIG } from "@/types/voice";

interface VoiceState {
  // 连接状态
  connectionState: VoiceConnectionState;
  wakeWordState: WakeWordState;

  // 配置
  config: VoiceConfig;
  configLoaded: boolean;

  // 数据
  userTranscript: string;
  agentResponse: AgentResponse;
  error: string | null;

  // 静默计时
  silenceStartTime: number | null;
}

interface VoiceActions {
  // 状态控制
  setConnectionState: (state: VoiceConnectionState) => void;
  setWakeWordState: (state: WakeWordState) => void;
  setError: (error: string | null) => void;

  // 配置
  setConfig: (config: Partial<VoiceConfig>) => void;
  setConfigLoaded: (loaded: boolean) => void;

  // 字幕
  updateUserTranscript: (text: string) => void;
  clearUserTranscript: () => void;

  // Agent 回复
  startNewAgentResponse: () => void; // 开始新回复（生成新 responseId，清空文本，显示 loading）
  appendAgentResponse: (chunk: string) => void;
  clearAgentResponse: () => void;
  setPopupOpacity: (opacity: number) => void;
  hidePopup: () => void;

  // 静默计时
  startSilenceTimer: () => void;
  resetSilenceTimer: () => void;

  // 重置
  reset: () => void;
}

const initialAgentResponse: AgentResponse = {
  text: '',
  charCount: 0,
  isStreaming: false,
  showPopup: false,
  popupOpacity: 1,
  responseId: null,
};

const initialState: VoiceState = {
  connectionState: 'idle',
  wakeWordState: 'inactive',
  config: DEFAULT_VOICE_CONFIG,
  configLoaded: false,
  userTranscript: '',
  agentResponse: initialAgentResponse,
  error: null,
  silenceStartTime: null,
};

export const useVoiceStore = create<VoiceState & { actions: VoiceActions }>((set) => ({
  ...initialState,

  actions: {
    setConnectionState: (connectionState) => set({ connectionState }),
    setWakeWordState: (wakeWordState) => set({ wakeWordState }),
    setError: (error) => set({ error }),

    setConfig: (config) => set((s) => ({
      config: { ...s.config, ...config },
    })),
    setConfigLoaded: (configLoaded) => set({ configLoaded }),

    updateUserTranscript: (text) => set({ userTranscript: text }),
    clearUserTranscript: () => set({ userTranscript: '' }),

    startNewAgentResponse: () => set((s) => ({
      agentResponse: {
        text: '',
        charCount: 0,
        isStreaming: true,
        showPopup: true, // 立即显示弹窗
        popupOpacity: 1,
        responseId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      },
    })),

    appendAgentResponse: (chunk) => set((s) => {
      const newText = s.agentResponse.text + chunk;
      const charCount = newText.length;
      return {
        agentResponse: {
          ...s.agentResponse,
          text: newText,
          charCount,
          isStreaming: true,
          showPopup: true, // 始终显示
        },
      };
    }),

    clearAgentResponse: () => set({ agentResponse: initialAgentResponse }),

    setPopupOpacity: (opacity) => set((s) => ({
      agentResponse: { ...s.agentResponse, popupOpacity: opacity },
    })),

    hidePopup: () => set((s) => ({
      agentResponse: { ...s.agentResponse, showPopup: false },
    })),

    startSilenceTimer: () => set({ silenceStartTime: Date.now() }),
    resetSilenceTimer: () => set({ silenceStartTime: null }),

    reset: () => set(initialState),
  },
}));