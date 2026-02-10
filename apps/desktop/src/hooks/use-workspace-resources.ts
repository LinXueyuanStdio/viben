/**
 * Hooks for workspace-scoped resources (executors, models, agents)
 *
 * These hooks fetch resources that are scoped to a specific workspace,
 * combining global availability with workspace-specific configurations.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getGatewayClient,
  type ExecutorInfo,
  type AgentInfo,
  type WorkspaceModel,
  // Legacy types for backwards compatibility
  type WorkspaceExecutor,
  type WorkspaceAgent,
} from "@/lib/gateway";

// ============================================================================
// Executors Hook (New API: /api/executors)
// ============================================================================

export interface UseExecutorsOptions {
  /** Workspace path to scope executors */
  workspacePath?: string | null;
  /** Include global executors (default: true) */
  includeGlobal?: boolean;
}

export interface UseExecutorsReturn {
  /** List of executors (merged if both workspace and global exist) */
  executors: ExecutorInfo[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Total count */
  total: number;
  /** Refresh executors */
  refresh: () => Promise<void>;
  /** Get available executors (installed or logged in) */
  getAvailableExecutors: () => ExecutorInfo[];
  /** Get executors with project config */
  getProjectExecutors: () => ExecutorInfo[];
  /** Get executors with global config only */
  getGlobalOnlyExecutors: () => ExecutorInfo[];
  /** Get merged executors (both project and global configs) */
  getMergedExecutors: () => ExecutorInfo[];
}

/**
 * Hook to get executors with optional workspace scope
 *
 * When workspacePath is provided with includeGlobal=true (default):
 * - Returns merged executors (same-name executors are combined)
 * - source="merged" means both project and global configs exist
 * - project_config_path is prioritized for editing
 */
export function useExecutors(options?: UseExecutorsOptions): UseExecutorsReturn {
  const workspacePath = options?.workspacePath;
  const includeGlobal = options?.includeGlobal ?? true;

  const [executors, setExecutors] = useState<ExecutorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadExecutors = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const response = await client.getExecutors({
        workspacePath: workspacePath || undefined,
        includeGlobal,
      });
      setExecutors(response.executors);
      setTotal(response.total);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load executors";
      setError(message);
      console.error("[useExecutors] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, includeGlobal]);

  // Load on mount and when options change
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

  /** Get executors that have workspace-level config */
  const getProjectExecutors = useCallback(() => {
    return executors.filter((e) => e.has_workspace_config);
  }, [executors]);

  /** Get executors that only have global config (no workspace config) */
  const getGlobalOnlyExecutors = useCallback(() => {
    return executors.filter((e) => !e.has_workspace_config && e.global_config_path);
  }, [executors]);

  /** Get executors that have both workspace and global config */
  const getMergedExecutors = useCallback(() => {
    return executors.filter((e) => e.has_workspace_config && e.global_config_path);
  }, [executors]);

  return {
    executors,
    loading,
    error,
    total,
    refresh: loadExecutors,
    getAvailableExecutors,
    getProjectExecutors,
    getGlobalOnlyExecutors,
    getMergedExecutors,
  };
}

// ============================================================================
// Workspace Executors Hook (Legacy - uses new API internally)
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
 * @deprecated Use useExecutors() instead for more detailed config info
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
      const response = await client.getExecutors({ workspacePath, includeGlobal: true });
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
      const response = await client.getModels({ workspacePath, includeGlobal: true });
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
// Agents Hook (New API: /api/agents)
// ============================================================================

export interface UseAgentsOptions {
  /** Workspace path to scope agents */
  workspacePath?: string | null;
  /** Include global agents (default: true) */
  includeGlobal?: boolean;
}

export interface UseAgentsReturn {
  /** List of agents (both workspace and global if includeGlobal=true) */
  agents: AgentInfo[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Total count */
  total: number;
  /** Refresh agents */
  refresh: () => Promise<void>;
  /** Get Viben agents */
  getVibenAgents: () => AgentInfo[];
  /** Get IDE agents (Claude Code, Cursor, etc.) */
  getIdeAgents: () => AgentInfo[];
  /** Get agent by ID */
  getAgent: (id: string) => AgentInfo | undefined;
  /** Get workspace-scoped agents */
  getWorkspaceAgents: () => AgentInfo[];
  /** Get global agents */
  getGlobalAgents: () => AgentInfo[];
}

/**
 * Hook to get agents with optional workspace scope
 *
 * When workspacePath is provided with includeGlobal=true (default):
 * - Returns both workspace-scoped and global agents
 * - source field indicates "workspace" or "global"
 */
export function useAgents(options?: UseAgentsOptions): UseAgentsReturn {
  const workspacePath = options?.workspacePath;
  const includeGlobal = options?.includeGlobal ?? true;

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const response = await client.getAgents({
        workspacePath: workspacePath || undefined,
        includeGlobal,
      });
      setAgents(response.agents);
      setTotal(response.total);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load agents";
      setError(message);
      console.error("[useAgents] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, includeGlobal]);

  // Load on mount and when options change
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

  const getWorkspaceAgents = useCallback(() => {
    return agents.filter((a) => a.source === "workspace");
  }, [agents]);

  const getGlobalAgents = useCallback(() => {
    return agents.filter((a) => a.source === "global");
  }, [agents]);

  return {
    agents,
    loading,
    error,
    total,
    refresh: loadAgents,
    getVibenAgents,
    getIdeAgents,
    getAgent,
    getWorkspaceAgents,
    getGlobalAgents,
  };
}

// ============================================================================
// Workspace Agents Hook (Legacy - uses new API internally)
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
 * @deprecated Use useAgents() instead for more detailed source info
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
      const response = await client.getAgents({ workspacePath, includeGlobal: true });
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
