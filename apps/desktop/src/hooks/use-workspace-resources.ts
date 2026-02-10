/**
 * Hooks for workspace-scoped resources (executors, models, agents)
 *
 * These hooks fetch resources that are scoped to a specific workspace,
 * combining global availability with workspace-specific configurations.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getGatewayClient,
  type WorkspaceExecutor,
  type WorkspaceModel,
  type WorkspaceAgent,
  type WorkspaceExecutorsResponse,
  type WorkspaceModelsResponse,
  type WorkspaceAgentsResponse,
} from "@/lib/gateway";

// ============================================================================
// Workspace Executors Hook
// ============================================================================

export interface UseWorkspaceExecutorsReturn {
  /** List of executors with workspace context */
  executors: WorkspaceExecutor[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh executors */
  refresh: () => Promise<void>;
  /** Get available executors (installed or logged in) */
  getAvailableExecutors: () => WorkspaceExecutor[];
  /** Get executors with workspace config */
  getConfiguredExecutors: () => WorkspaceExecutor[];
}

/**
 * Hook to get executors available for a workspace
 */
export function useWorkspaceExecutors(
  workspacePath: string | null
): UseWorkspaceExecutorsReturn {
  const [executors, setExecutors] = useState<WorkspaceExecutor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExecutors = useCallback(async () => {
    if (!workspacePath) {
      setExecutors([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const response = await client.getWorkspaceExecutors(workspacePath);
      setExecutors(response.executors);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load executors";
      setError(message);
      console.error("[useWorkspaceExecutors] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  // Load on mount and when workspace changes
  useEffect(() => {
    loadExecutors();
  }, [loadExecutors]);

  const getAvailableExecutors = useCallback(() => {
    return executors.filter(
      (e) =>
        e.availability.type === "LOGIN_DETECTED" ||
        e.availability.type === "INSTALLATION_FOUND"
    );
  }, [executors]);

  const getConfiguredExecutors = useCallback(() => {
    return executors.filter((e) => e.has_workspace_config);
  }, [executors]);

  return {
    executors,
    loading,
    error,
    refresh: loadExecutors,
    getAvailableExecutors,
    getConfiguredExecutors,
  };
}

// ============================================================================
// Workspace Models Hook
// ============================================================================

export interface UseWorkspaceModelsReturn {
  /** List of models with workspace context */
  models: WorkspaceModel[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Total number of models */
  total: number;
  /** Refresh models */
  refresh: () => Promise<void>;
  /** Get available models (API key configured) */
  getAvailableModels: () => WorkspaceModel[];
  /** Get models by provider */
  getModelsByProvider: (providerId: string) => WorkspaceModel[];
}

/**
 * Hook to get models available for a workspace
 */
export function useWorkspaceModels(
  workspacePath: string | null
): UseWorkspaceModelsReturn {
  const [models, setModels] = useState<WorkspaceModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadModels = useCallback(async () => {
    if (!workspacePath) {
      setModels([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const response = await client.getWorkspaceModels(workspacePath);
      setModels(response.models);
      setTotal(response.total);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load models";
      setError(message);
      console.error("[useWorkspaceModels] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  // Load on mount and when workspace changes
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const getAvailableModels = useCallback(() => {
    return models.filter((m) => m.is_available);
  }, [models]);

  const getModelsByProvider = useCallback(
    (providerId: string) => {
      return models.filter(
        (m) => m.provider_id.toLowerCase() === providerId.toLowerCase()
      );
    },
    [models]
  );

  return {
    models,
    loading,
    error,
    total,
    refresh: loadModels,
    getAvailableModels,
    getModelsByProvider,
  };
}

// ============================================================================
// Workspace Agents Hook
// ============================================================================

export interface UseWorkspaceAgentsFromGatewayReturn {
  /** List of agents with workspace context */
  agents: WorkspaceAgent[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Total number of agents */
  total: number;
  /** Refresh agents */
  refresh: () => Promise<void>;
  /** Get Viben agents */
  getVibenAgents: () => WorkspaceAgent[];
  /** Get IDE agents (Claude Code, Cursor, etc.) */
  getIdeAgents: () => WorkspaceAgent[];
  /** Get agent by ID */
  getAgent: (id: string) => WorkspaceAgent | undefined;
}

/**
 * Hook to get agents available for a workspace (from Gateway API)
 * This returns agents discovered in the workspace including IDE configs
 */
export function useWorkspaceAgentsFromGateway(
  workspacePath: string | null
): UseWorkspaceAgentsFromGatewayReturn {
  const [agents, setAgents] = useState<WorkspaceAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadAgents = useCallback(async () => {
    if (!workspacePath) {
      setAgents([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const response = await client.getWorkspaceAgents(workspacePath);
      setAgents(response.agents);
      setTotal(response.total);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load agents";
      setError(message);
      console.error("[useWorkspaceAgentsFromGateway] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  // Load on mount and when workspace changes
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const getVibenAgents = useCallback(() => {
    return agents.filter((a) => a.agent_type === "viben");
  }, [agents]);

  const getIdeAgents = useCallback(() => {
    return agents.filter((a) => a.agent_type !== "viben");
  }, [agents]);

  const getAgent = useCallback(
    (id: string) => {
      return agents.find((a) => a.id === id);
    },
    [agents]
  );

  return {
    agents,
    loading,
    error,
    total,
    refresh: loadAgents,
    getVibenAgents,
    getIdeAgents,
    getAgent,
  };
}

// ============================================================================
// Combined Workspace Resources Hook
// ============================================================================

export interface UseWorkspaceResourcesReturn {
  executors: UseWorkspaceExecutorsReturn;
  models: UseWorkspaceModelsReturn;
  agents: UseWorkspaceAgentsFromGatewayReturn;
  /** Refresh all resources */
  refreshAll: () => Promise<void>;
  /** Any resource is loading */
  isLoading: boolean;
}

/**
 * Hook to get all workspace resources at once
 */
export function useWorkspaceResources(
  workspacePath: string | null
): UseWorkspaceResourcesReturn {
  const executors = useWorkspaceExecutors(workspacePath);
  const models = useWorkspaceModels(workspacePath);
  const agents = useWorkspaceAgentsFromGateway(workspacePath);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      executors.refresh(),
      models.refresh(),
      agents.refresh(),
    ]);
  }, [executors, models, agents]);

  const isLoading = executors.loading || models.loading || agents.loading;

  return {
    executors,
    models,
    agents,
    refreshAll,
    isLoading,
  };
}
