/**
 * Chat Config Store
 *
 * Zustand store for managing chat configuration state:
 * - Global agents and models lists (loaded from viben-core)
 * - Selection state for current agent and model
 * - Executor selection for which coding agent to use (CLAUDE_CODE, CODEX, etc.)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatAgentConfig, ChatModelConfig } from "@/types/chat-config";
import type { ExecutorType } from "@viben/core/shared";
import type { SandboxConfig, SandboxProviderType } from "@/hooks/use-sandbox";

// ============================================================================
// Store Interface
// ============================================================================

interface ChatConfigState {
  // Global lists (populated by hooks from viben-core)
  globalAgents: ChatAgentConfig[];
  globalModels: ChatModelConfig[];

  // Selection state
  selectedAgentId: string | null;
  selectedModelId: string | null;

  // Executor selection (which coding agent to use: CLAUDE_CODE, CODEX, etc.)
  selectedExecutor: ExecutorType;

  // Sandbox configuration (session-level)
  sandboxConfig: SandboxConfig;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions - List management
  setGlobalAgents: (agents: ChatAgentConfig[]) => void;
  setGlobalModels: (models: ChatModelConfig[]) => void;

  // Actions - Selection
  setSelectedAgentId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  setSelectedExecutor: (executor: ExecutorType) => void;

  // Actions - Sandbox
  setSandboxEnabled: (enabled: boolean) => void;
  setSandboxProvider: (provider: SandboxProviderType | undefined) => void;
  setSandboxConfig: (config: Partial<SandboxConfig>) => void;

  // Actions - Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Getters
  getSelectedAgent: () => ChatAgentConfig | undefined;
  getSelectedModel: () => ChatModelConfig | undefined;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useChatConfigStore = create<ChatConfigState>()(
  persist(
    (set, get) => ({
      // Initial state
      globalAgents: [],
      globalModels: [],
      selectedAgentId: null,
      selectedModelId: null,
      selectedExecutor: "CLAUDE_CODE" as ExecutorType,
      sandboxConfig: {
        enabled: false,
        provider: undefined,
      },
      isLoading: false,
      error: null,

      // List management
      setGlobalAgents: (agents) => {
        set({ globalAgents: agents });
        // Auto-select first agent if none selected and agents available
        const state = get();
        if (!state.selectedAgentId && agents.length > 0) {
          set({ selectedAgentId: agents[0].id });
        }
      },

      setGlobalModels: (models) => {
        set({ globalModels: models });
        // Auto-select first model if none selected and models available
        const state = get();
        if (!state.selectedModelId && models.length > 0) {
          set({ selectedModelId: models[0].id });
        }
      },

      // Selection
      setSelectedAgentId: (id) => set({ selectedAgentId: id }),
      setSelectedModelId: (id) => set({ selectedModelId: id }),
      setSelectedExecutor: (executor) => set({ selectedExecutor: executor }),

      // Sandbox
      setSandboxEnabled: (enabled) =>
        set((state) => ({
          sandboxConfig: { ...state.sandboxConfig, enabled },
        })),
      setSandboxProvider: (provider) =>
        set((state) => ({
          sandboxConfig: { ...state.sandboxConfig, provider },
        })),
      setSandboxConfig: (config) =>
        set((state) => ({
          sandboxConfig: { ...state.sandboxConfig, ...config },
        })),

      // Loading state
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Getters
      getSelectedAgent: () => {
        const state = get();
        return state.globalAgents.find((a) => a.id === state.selectedAgentId);
      },

      getSelectedModel: () => {
        const state = get();
        return state.globalModels.find((m) => m.id === state.selectedModelId);
      },
    }),
    {
      name: "chat-config-storage",
      partialize: (state) => ({
        // Only persist selection state, not the lists
        selectedAgentId: state.selectedAgentId,
        selectedModelId: state.selectedModelId,
        selectedExecutor: state.selectedExecutor,
        sandboxConfig: state.sandboxConfig,
      }),
    }
  )
);
