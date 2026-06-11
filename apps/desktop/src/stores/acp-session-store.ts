/**
 * ACP Session Store
 *
 * Zustand store for managing global ACP WebSocket connection state.
 * This state survives component mode switches (floating -> expanded -> full).
 */

import { create } from "zustand";
import type { ConnectionStatus } from "@/components/acp-chat/acp-client";


interface AcpSessionState {
  // Connection state
  status: ConnectionStatus;
  hasAutoConnected: boolean;
  initializeResult: unknown;

  // Config selections (persisted across mode switches)
  selectedAgentId: string | null;
  selectedProviderId: string | null;
  executorType: string | null;
  model: string | null;

  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setHasAutoConnected: (connected: boolean) => void;
  setInitializeResult: (result: unknown) => void;
  setSelectedAgentId: (id: string | null) => void;
  setSelectedProviderId: (id: string | null) => void;
  setExecutorType: (type: string) => void;
  setModel: (model: string) => void;

  // Reset connection state (for reconnect scenarios)
  resetConnectionState: () => void;
}

export const useAcpSessionStore = create<AcpSessionState>()((set) => ({
  // Initial state
  status: "idle",
  hasAutoConnected: false,
  initializeResult: null,
  selectedAgentId: null,
  selectedProviderId: null,
  executorType: null,
  model: null,

  // Actions
  setStatus: (status) => set({ status }),
  setHasAutoConnected: (hasAutoConnected) => set({ hasAutoConnected }),
  setInitializeResult: (initializeResult) => set({ initializeResult }),
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),
  setSelectedProviderId: (selectedProviderId) => set({ selectedProviderId }),
  setExecutorType: (executorType) => set({ executorType }),
  setModel: (model) => set({ model }),

  resetConnectionState: () =>
    set({
      status: "idle",
      hasAutoConnected: false,
      initializeResult: null,
    }),
}));
