import { create } from "zustand";

type VoiceAgentRequestSource = "wake_word";

interface VoiceAgentRequestState {
  connectionRequestId: number;
  connectionRequestSource: VoiceAgentRequestSource | null;
  requestConnection: (source: VoiceAgentRequestSource) => void;
}

export const useVoiceAgentRequestStore = create<VoiceAgentRequestState>()((set) => ({
  connectionRequestId: 0,
  connectionRequestSource: null,
  requestConnection: (source) =>
    set((state) => ({
      connectionRequestId: state.connectionRequestId + 1,
      connectionRequestSource: source,
    })),
}));
