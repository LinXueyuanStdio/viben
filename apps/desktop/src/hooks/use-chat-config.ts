/**
 * useChatConfig Hook
 *
 * Provides context-aware agent and model selection for ChatInput.
 * Reads from global store and filters based on current route.
 *
 * Context-aware filtering:
 * - Agent debug page (/agents/:id): Hide agent/model selectors completely
 * - Workspace chat (/workspace/:id/chat): Show workspace-specific + global agents
 * - Default: Show all available agents/models
 */

import { useEffect, useMemo, useCallback } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useChatConfigStore } from "@/stores/chat-config-store";
import { useAgents } from "./use-workspace-resources";
import { useModels } from "./use-models";
import type {
  ChatAgentConfig,
  ChatModelConfig,
  ChatContextType,
  ChatContextInfo,
  ChatSelectorVisibility,
} from "@/types/chat-config";
import type { BaseCodingAgent } from "@/types/agent";
import { AGENT_TYPES } from "@/types/agent";

// ============================================================================
// Route Detection
// ============================================================================

/**
 * Extract chat context from current location/params
 */
function useChatContext(): ChatContextInfo {
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

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseChatConfigReturn {
  // Filtered lists based on context
  agents: ChatAgentConfig[];
  models: ChatModelConfig[];
  executors: typeof AGENT_TYPES;

  // Selection state
  selectedAgentId: string | null;
  selectedModelId: string | null;
  selectedAgent: ChatAgentConfig | undefined;
  selectedModel: ChatModelConfig | undefined;
  selectedExecutor: BaseCodingAgent;

  // Actions
  setSelectedAgentId: (id: string) => void;
  setSelectedModelId: (id: string) => void;
  setSelectedExecutor: (executor: BaseCodingAgent) => void;

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

export function useChatConfig(): UseChatConfigReturn {
  // Get context from route
  const context = useChatContext();

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

  // Sync viben agents to store
  useEffect(() => {
    if (!agentsLoading && vibenAgents.length > 0) {
      const chatAgents: ChatAgentConfig[] = vibenAgents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        model: a.model,
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
        }));
      setGlobalModels(chatModels);
    }
  }, [vibenModels, modelsLoading, setGlobalModels]);

  // Update loading state
  useEffect(() => {
    setLoading(agentsLoading || modelsLoading);
  }, [agentsLoading, modelsLoading, setLoading]);

  // Update error state
  useEffect(() => {
    const errorMsg = agentsError || modelsError || null;
    setError(errorMsg);
  }, [agentsError, modelsError, setError]);

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
    (id: string) => {
      setSelectedAgentId(id);
    },
    [setSelectedAgentId]
  );

  const handleSetModelId = useCallback(
    (id: string) => {
      setSelectedModelId(id);
    },
    [setSelectedModelId]
  );

  const handleSetExecutor = useCallback(
    (executor: BaseCodingAgent) => {
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
    executors: AGENT_TYPES,

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
    isLoading: storeLoading || agentsLoading || modelsLoading,
    error,
  };
}
