/**
 * useChatConfig Hook
 *
 * Provides context-aware agent and model selection for ChatInput.
 * Optionally filters based on a ChatContextInfo (e.g. derived from route).
 *
 * Context-aware filtering:
 * - Agent debug page (/agents/:id): Hide agent/model selectors completely
 * - Workspace chat (/workspace/:id/chat): Show workspace-specific + global agents
 * - Default: Show all available agents/models
 *
 * Route detection is decoupled into useRouteChatContext() so that
 * useChatConfig can be used outside of a <Router> context.
 */

import { useEffect, useMemo, useCallback } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useChatConfigStore } from "@/stores/chat-config-store";
import { useAgents, useExecutors } from "@/hooks/use-workspace-resources";
import { useModels } from "@/hooks/use-models";
import type {
  ChatAgentConfig,
  ChatModelConfig,
  ChatContextType,
  ChatContextInfo,
  ChatSelectorVisibility,
} from "@/types/chat-config";
import type { ExecutorType } from "@viben/core/shared";
import type { ExecutorInfo } from "@/lib/gateway";

// ============================================================================
// Route Detection (requires <Router> context)
// ============================================================================

/**
 * Extract chat context from current route location/params.
 *
 * IMPORTANT: This hook uses useLocation/useParams and must be called
 * inside a <Router> context. For Router-free usage, pass context
 * directly to useChatConfig({ context }).
 */
export function useRouteChatContext(): ChatContextInfo {
  const location = useLocation();
  const params = useParams<{
    workspaceId?: string;
    agentId?: string;
  }>();

  return useMemo(() => {
    const pathname = location.pathname;

    // Agent debug page detection
    // Matches: /agents/:agentId (top-level agent detail)
    // Does NOT match: /workspace/:id/agent/:agentId (workspace agent, different context)
    if (pathname.match(/^\/agents\/[^/]+\/?$/) && params.agentId) {
      return {
        type: "agent-debug" as ChatContextType,
        agentId: params.agentId,
      };
    }

    // Workspace chat page detection
    // Matches: /workspace/:workspaceId/chat
    if (pathname.includes("/workspace/") && pathname.includes("/chat")) {
      return {
        type: "workspace" as ChatContextType,
        workspaceId: params.workspaceId,
      };
    }

    // Default context for other pages
    return {
      type: "default" as ChatContextType,
    };
  }, [location.pathname, params.agentId, params.workspaceId]);
}

const DEFAULT_CONTEXT: ChatContextInfo = { type: "default" };

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseChatConfigOptions {
  /** Chat context for filtering agents/models/visibility.
   *  Defaults to { type: "default" } (show everything).
   *  Use useRouteChatContext() inside a <Router> for route-aware filtering. */
  context?: ChatContextInfo;
}

export interface UseChatConfigReturn {
  // Filtered lists based on context
  agents: ChatAgentConfig[];
  models: ChatModelConfig[];
  /** Executors loaded from Gateway API */
  executors: ExecutorInfo[];

  // Selection state
  selectedAgentId: string | null;
  selectedModelId: string | null;
  selectedAgent: ChatAgentConfig | undefined;
  selectedModel: ChatModelConfig | undefined;
  selectedExecutor: ExecutorType;

  // Actions
  setSelectedAgentId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  setSelectedExecutor: (executor: ExecutorType) => void;

  // Visibility control
  visibility: ChatSelectorVisibility;

  // Context info
  context: ChatContextInfo;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useChatConfig(options?: UseChatConfigOptions): UseChatConfigReturn {
  const context = options?.context ?? DEFAULT_CONTEXT;

  // Get store state
  const {
    globalAgents,
    globalModels,
    selectedAgentId,
    selectedModelId,
    selectedExecutor,
    isLoading: storeLoading,
    error,
    setGlobalAgents,
    setGlobalModels,
    setSelectedAgentId,
    setSelectedModelId,
    setSelectedExecutor,
    setLoading,
    setError,
    getSelectedAgent,
    getSelectedModel,
  } = useChatConfigStore();

  // Load agents and models from Gateway API
  const {
    agents: vibenAgents,
    loading: agentsLoading,
    error: agentsError,
  } = useAgents();

  const {
    models: vibenModels,
    loading: modelsLoading,
    error: modelsError,
  } = useModels();

  // Load executors from Gateway API
  const {
    executors,
    loading: executorsLoading,
    error: executorsError,
  } = useExecutors();

  // Sync viben agents to store
  useEffect(() => {
    if (!agentsLoading && vibenAgents.length > 0) {
      const chatAgents: ChatAgentConfig[] = vibenAgents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        model: a.model,
        executor_type: a.executor_type,
      }));
      setGlobalAgents(chatAgents);
    }
  }, [vibenAgents, agentsLoading, setGlobalAgents]);

  // Sync viben models to store
  useEffect(() => {
    if (!modelsLoading && vibenModels.length > 0) {
      const chatModels: ChatModelConfig[] = vibenModels
        .filter((m) => m.is_available) // Only show available models
        .map((m) => ({
          id: m.id,
          name: m.name,
          provider: m.provider_id,
          provider_id: m.provider_id,
        }));
      setGlobalModels(chatModels);
    }
  }, [vibenModels, modelsLoading, setGlobalModels]);

  // Update loading state
  useEffect(() => {
    setLoading(agentsLoading || modelsLoading || executorsLoading);
  }, [agentsLoading, modelsLoading, executorsLoading, setLoading]);

  // Update error state
  useEffect(() => {
    const errorMsg = agentsError || modelsError || executorsError || null;
    setError(errorMsg);
  }, [agentsError, modelsError, executorsError, setError]);

  // Filter agents based on context
  const filteredAgents = useMemo((): ChatAgentConfig[] => {
    switch (context.type) {
      case "agent-debug":
        // In agent debug mode, return empty - selectors will be hidden
        return [];

      case "workspace":
        // In workspace context, show all global agents
        // Future: could add workspace-specific agents here
        return globalAgents;

      case "default":
      default:
        // Show all global agents
        return globalAgents;
    }
  }, [context.type, globalAgents]);

  // Filter models based on context
  const filteredModels = useMemo((): ChatModelConfig[] => {
    switch (context.type) {
      case "agent-debug":
        // In agent debug mode, return empty - selectors will be hidden
        return [];

      case "workspace":
      case "default":
      default:
        // Show all global models
        return globalModels;
    }
  }, [context.type, globalModels]);

  // Determine selector visibility
  const visibility = useMemo((): ChatSelectorVisibility => {
    switch (context.type) {
      case "agent-debug":
        // Hide both selectors in agent debug mode
        return {
          showAgentSelector: false,
          showModelSelector: false,
        };

      case "workspace":
      case "default":
      default:
        // Show both selectors
        return {
          showAgentSelector: true,
          showModelSelector: true,
        };
    }
  }, [context.type]);

  // Memoized selection handlers
  const handleSetAgentId = useCallback(
    (id: string | null) => {
      setSelectedAgentId(id);
    },
    [setSelectedAgentId]
  );

  const handleSetModelId = useCallback(
    (id: string | null) => {
      setSelectedModelId(id);
    },
    [setSelectedModelId]
  );

  const handleSetExecutor = useCallback(
    (executor: ExecutorType) => {
      setSelectedExecutor(executor);
    },
    [setSelectedExecutor]
  );

  // Get current selections
  const selectedAgent = getSelectedAgent();
  const selectedModel = getSelectedModel();

  return {
    // Filtered lists
    agents: filteredAgents,
    models: filteredModels,
    executors,

    // Selection state
    selectedAgentId,
    selectedModelId,
    selectedAgent,
    selectedModel,
    selectedExecutor,

    // Actions
    setSelectedAgentId: handleSetAgentId,
    setSelectedModelId: handleSetModelId,
    setSelectedExecutor: handleSetExecutor,

    // Visibility
    visibility,

    // Context
    context,

    // Loading state
    isLoading: storeLoading || agentsLoading || modelsLoading || executorsLoading,
    error,
  };
}
