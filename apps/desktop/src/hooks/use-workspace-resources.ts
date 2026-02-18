/**
 * Hooks for workspace-scoped resources (executors, models, agents)
 *
 * These hooks fetch resources that are scoped to a specific workspace,
 * combining global availability with workspace-specific configurations.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  getGatewayClient,
  type ExecutorInfo,
  type AgentInfo,
  type WorkspaceModel,
  type ChatListItem,
  type ChatListCounts,
  type CreateAgentOptions,
  type UpdateAgentOptions,
  type AgentResponse,
  type AgentTemplate,
  GatewayError,
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

  // Track current workspacePath to prevent stale data from old requests
  const currentPathRef = useRef(workspacePath);
  currentPathRef.current = workspacePath;

  // Clear state when workspacePath changes to avoid showing stale data
  useEffect(() => {
    setExecutors([]);
    setTotal(0);
    setError(null);
  }, [workspacePath]);

  const loadExecutors = useCallback(async () => {
    const requestPath = workspacePath; // Capture at request time
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const response = await client.getExecutors({
        workspacePath: workspacePath || undefined,
        includeGlobal,
      });
      // Only update state if this request is still relevant
      if (currentPathRef.current === requestPath) {
        setExecutors(response.executors);
        setTotal(response.total);
      }
    } catch (err) {
      if (currentPathRef.current === requestPath) {
        const message =
          err instanceof Error ? err.message : "Failed to load executors";
        setError(message);
        console.error("[useExecutors] Error:", err);
      }
    } finally {
      if (currentPathRef.current === requestPath) {
        setLoading(false);
      }
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

  // Clear state when workspacePath changes to avoid showing stale data
  useEffect(() => {
    setModels([]);
    setTotal(0);
    setError(null);
  }, [workspacePath]);

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
  // Data
  /** List of agents (both workspace and global if includeGlobal=true) */
  agents: AgentInfo[];
  /** Default agent ID */
  defaultAgentId: string | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Total count */
  total: number;

  // Read operations
  /** Refresh agents */
  refresh: () => Promise<void>;
  /** Get agent by ID */
  getAgent: (id: string) => AgentInfo | undefined;
  /** Get workspace-scoped agents */
  getWorkspaceAgents: () => AgentInfo[];
  /** Get global agents */
  getGlobalAgents: () => AgentInfo[];

  // CRUD operations (all agents are user-created and editable)
  /** Create a new agent */
  createAgent: (options: CreateAgentOptions) => Promise<AgentResponse>;
  /** Update an agent */
  updateAgent: (id: string, updates: UpdateAgentOptions) => Promise<AgentResponse>;
  /** Remove an agent */
  removeAgent: (id: string) => Promise<void>;
  /** Set the default agent */
  setDefaultAgent: (id: string) => Promise<void>;

  // Templates
  /** List of agent templates */
  templates: AgentTemplate[];
  /** Refresh templates */
  refreshTemplates: () => Promise<void>;
  /** Create a template from an agent */
  createTemplate: (agentId: string, templateId: string) => Promise<AgentTemplate>;
  /** Create an agent from a template */
  createFromTemplate: (templateId: string, agentId: string) => Promise<AgentResponse>;
}

/**
 * Hook to get agents with optional workspace scope
 *
 * When workspacePath is provided with includeGlobal=true (default):
 * - Returns both workspace-scoped and global agents
 * - source field indicates "workspace" or "global"
 *
 * Also provides CRUD operations for agents via Gateway API.
 */
export function useAgents(options?: UseAgentsOptions): UseAgentsReturn {
  const workspacePath = options?.workspacePath;
  const includeGlobal = options?.includeGlobal ?? true;

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [defaultAgentId, setDefaultAgentIdState] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Track current workspacePath to prevent stale data from old requests
  const currentPathRef = useRef(workspacePath);
  currentPathRef.current = workspacePath;

  // Clear state when workspacePath changes to avoid showing stale data
  useEffect(() => {
    setAgents([]);
    setTotal(0);
    setError(null);
  }, [workspacePath]);

  const loadAgents = useCallback(async () => {
    const requestPath = workspacePath; // Capture at request time
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const [agentsResponse, defaultId] = await Promise.all([
        client.getAgents({
          workspacePath: workspacePath || undefined,
          includeGlobal,
        }),
        client.getDefaultAgentId().catch(() => null),
      ]);
      // Only update state if this request is still relevant
      if (currentPathRef.current === requestPath) {
        setAgents(agentsResponse.agents);
        setTotal(agentsResponse.total);
        setDefaultAgentIdState(defaultId);
      }
    } catch (err) {
      if (currentPathRef.current === requestPath) {
        const message =
          err instanceof Error ? err.message : "Failed to load agents";
        setError(message);
        console.error("[useAgents] Error:", err);
      }
    } finally {
      if (currentPathRef.current === requestPath) {
        setLoading(false);
      }
    }
  }, [workspacePath, includeGlobal]);

  const loadTemplates = useCallback(async () => {
    try {
      const client = getGatewayClient();
      const templateList = await client.listAgentTemplates();
      setTemplates(templateList);
    } catch (err) {
      console.error("[useAgents] Failed to load templates:", err);
    }
  }, []);

  // Load on mount and when options change
  useEffect(() => {
    loadAgents();
    loadTemplates();
  }, [loadAgents, loadTemplates]);

  // Read operations
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

  // CRUD operations
  const createAgent = useCallback(
    async (createOptions: CreateAgentOptions): Promise<AgentResponse> => {
      const client = getGatewayClient();
      // Add workspace path if creating workspace-scoped agent
      const optionsWithPath = workspacePath
        ? { ...createOptions, base_path: createOptions.base_path || workspacePath }
        : createOptions;
      const result = await client.createAgent(optionsWithPath);
      // Refresh agent list after creation
      await loadAgents();
      return result;
    },
    [workspacePath, loadAgents]
  );

  const updateAgent = useCallback(
    async (id: string, updates: UpdateAgentOptions): Promise<AgentResponse> => {
      const client = getGatewayClient();
      const result = await client.updateAgent(id, updates);
      // Refresh agent list after update
      await loadAgents();
      return result;
    },
    [loadAgents]
  );

  const removeAgent = useCallback(
    async (id: string): Promise<void> => {
      const client = getGatewayClient();
      await client.deleteAgent(id);
      // Refresh agent list after deletion
      await loadAgents();
    },
    [loadAgents]
  );

  const setDefaultAgent = useCallback(
    async (id: string): Promise<void> => {
      const client = getGatewayClient();
      await client.setDefaultAgent(id);
      setDefaultAgentIdState(id);
    },
    []
  );

  // Template operations
  const createTemplate = useCallback(
    async (agentId: string, templateId: string): Promise<AgentTemplate> => {
      const client = getGatewayClient();
      const result = await client.createAgentTemplate(agentId, templateId);
      // Refresh templates after creation
      await loadTemplates();
      return result;
    },
    [loadTemplates]
  );

  const createFromTemplate = useCallback(
    async (templateId: string, agentId: string): Promise<AgentResponse> => {
      const client = getGatewayClient();
      const result = await client.createAgentFromTemplate(templateId, agentId);
      // Refresh agent list after creation
      await loadAgents();
      return result;
    },
    [loadAgents]
  );

  return {
    // Data
    agents,
    defaultAgentId,
    loading,
    error,
    total,

    // Read operations
    refresh: loadAgents,
    getAgent,
    getWorkspaceAgents,
    getGlobalAgents,

    // CRUD operations
    createAgent,
    updateAgent,
    removeAgent,
    setDefaultAgent,

    // Templates
    templates,
    refreshTemplates: loadTemplates,
    createTemplate,
    createFromTemplate,
  };
}

// ============================================================================
// Agent Detail Hook (On-demand single agent loading)
// ============================================================================

export interface UseAgentDetailReturn {
  /** The agent data */
  agent: AgentResponse | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Whether the agent was not found (404) */
  notFound: boolean;
  /** Refresh the agent data */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch a single agent's details on-demand
 *
 * Used for right sidebar detail panels where we want to load
 * complete agent info when user clicks, rather than loading
 * all details upfront.
 *
 * @param agentId - The agent ID
 * @param workspacePath - Optional workspace path to check workspace agents first
 */
export function useAgentDetail(
  agentId: string | null,
  workspacePath?: string | null
): UseAgentDetailReturn {
  const [agent, setAgent] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadAgent = useCallback(async () => {
    if (!agentId) {
      setAgent(null);
      setLoading(false);
      setError(null);
      setNotFound(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const client = getGatewayClient();
      const agentData = await client.getAgentById(agentId, workspacePath || undefined);
      setAgent(agentData);
    } catch (err) {
      if (err instanceof GatewayError && err.statusCode === 404) {
        setNotFound(true);
        setAgent(null);
      } else {
        const message = err instanceof Error ? err.message : "Failed to load agent";
        setError(message);
        console.error("[useAgentDetail] Error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [agentId, workspacePath]);

  // Load on mount and when agentId/workspacePath changes
  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  return {
    agent,
    loading,
    error,
    notFound,
    refresh: loadAgent,
  };
}

// ============================================================================
// Workspace Agents Hook (Legacy - uses new API internally)
// ============================================================================

export interface UseWorkspaceAgentsFromGatewayReturn {
  /** List of agents with workspace context */
  agents: AgentInfo[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Total number of agents */
  total: number;
  /** Refresh agents */
  refresh: () => Promise<void>;
  /** Get agent by ID */
  getAgent: (id: string) => AgentInfo | undefined;
}

/**
 * Hook to get agents available for a workspace (from Gateway API)
 * This returns agents discovered in the workspace including IDE configs
 * @deprecated Use useAgents() instead for more detailed source info
 */
export function useWorkspaceAgentsFromGateway(
  workspacePath: string | null
): UseWorkspaceAgentsFromGatewayReturn {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Clear state when workspacePath changes to avoid showing stale data
  useEffect(() => {
    setAgents([]);
    setTotal(0);
    setError(null);
  }, [workspacePath]);

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
    getAgent,
  };
}

// ============================================================================
// Combined Workspace Resources Hook
// ============================================================================

export interface UseWorkspaceResourcesReturn {
  executors: UseExecutorsReturn;
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
  const executors = useExecutors({ workspacePath, includeGlobal: true });
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

// ============================================================================
// Agent List Hook (Executors + Agents)
// ============================================================================

export interface UseAgentListOptions {
  /** Workspace path to scope items */
  workspacePath?: string | null;
  /** Include global items (default: true) */
  includeGlobal?: boolean;
}

/** Unified list item type: "executor" or "agent" */
export type AgentListItemType = "executor" | "agent";

/** A unified agent list item that can represent either executor or agent */
export interface AgentListItem {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Item type */
  item_type: AgentListItemType;
  /** Source: "global" or "workspace" */
  source: "global" | "workspace";
  /** The workspace path this item belongs to */
  workspace_path: string;
  /** Description (optional) */
  description?: string;
  /** Config path (for both executors and agents) */
  config_path?: string;

  // Executor-specific fields
  /** Whether this executor supports MCP (executors only) */
  supports_mcp?: boolean;
  /** Executor capabilities (executors only) */
  capabilities?: string[];
  /** Global availability info (executors only) */
  availability?: import("@/lib/gateway").AvailabilityInfo;
  /** Path to global config file (executors only) */
  global_config_path?: string;
  /** Path to workspace config file (executors only) */
  workspace_config_path?: string;
  /** Has workspace-level config (executors only) */
  has_workspace_config?: boolean;

  // Agent-specific fields
  /** Executor type this agent uses (agents only) */
  executor_type?: string;
}

/** Counts by item type */
export interface AgentListCounts {
  executors: number;
  agents: number;
}

export interface UseAgentListReturn {
  /** All items (executors + agents) */
  items: AgentListItem[];
  /** Executors only */
  executors: AgentListItem[];
  /** Agents only */
  agents: AgentListItem[];
  /** Counts by type */
  counts: AgentListCounts;
  /** Total count */
  total: number;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh all data */
  refresh: () => Promise<void>;
  /** Agent CRUD operations */
  agentOperations: AgentOperations;
}

/**
 * Hook to get a unified list of executors and agents
 *
 * This provides a combined view for agent management pages:
 * - Executors: From /api/executors (with merged project/global configs)
 * - Agents: From /api/agents (user-created agents)
 *
 * When workspacePath is provided with includeGlobal=true (default):
 * - Project-level configs are merged with global configs
 * - If project-level doesn't exist, global-level is still included
 *
 * @param options - Configuration options
 * @returns Combined list of executors and agents with operations
 */
export function useAgentList(options?: UseAgentListOptions): UseAgentListReturn {
  const workspacePath = options?.workspacePath;
  const includeGlobal = options?.includeGlobal ?? true;

  const [executorItems, setExecutorItems] = useState<AgentListItem[]>([]);
  const [agentItems, setAgentItems] = useState<AgentListItem[]>([]);
  const [defaultAgentId, setDefaultAgentIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current workspacePath to prevent stale data from old requests
  const currentPathRef = useRef(workspacePath);
  currentPathRef.current = workspacePath;

  // Clear state when workspacePath changes to avoid showing stale data
  useEffect(() => {
    setExecutorItems([]);
    setAgentItems([]);
    setError(null);
  }, [workspacePath]);

  const loadData = useCallback(async () => {
    const requestPath = workspacePath; // Capture at request time
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();

      // Fetch executors, agents, and default agent ID in parallel
      const [executorsResponse, agentsResponse, defaultId] = await Promise.all([
        client.getExecutors({
          workspacePath: workspacePath || undefined,
          includeGlobal,
        }),
        client.getAgents({
          workspacePath: workspacePath || undefined,
          includeGlobal,
        }),
        client.getDefaultAgentId().catch(() => null),
      ]);

      // Only update state if this request is still relevant
      if (currentPathRef.current !== requestPath) {
        return;
      }

      // Transform executors to unified format
      const executors: AgentListItem[] = executorsResponse.executors.map((e) => ({
        id: e.type,
        name: e.name,
        item_type: "executor" as const,
        source: e.has_workspace_config ? "workspace" as const : "global" as const,
        workspace_path: e.workspace_path,
        config_path: e.workspace_config_path || e.global_config_path,
        supports_mcp: e.supports_mcp,
        capabilities: e.capabilities,
        availability: e.availability,
        global_config_path: e.global_config_path,
        workspace_config_path: e.workspace_config_path,
        has_workspace_config: e.has_workspace_config,
      }));

      // Transform agents to unified format
      const agents: AgentListItem[] = agentsResponse.agents.map((a) => ({
        id: a.id,
        name: a.name,
        item_type: "agent" as const,
        source: a.source as "global" | "workspace",
        workspace_path: workspacePath || "",
        config_path: a.config_path,
        executor_type: a.executor_type,
      }));

      setExecutorItems(executors);
      setAgentItems(agents);
      setDefaultAgentIdState(defaultId);
    } catch (err) {
      // Only update error if this request is still relevant
      if (currentPathRef.current === requestPath) {
        const message =
          err instanceof Error ? err.message : "Failed to load agent list";
        setError(message);
        console.error("[useAgentList] Error:", err);
      }
    } finally {
      // Only update loading if this request is still relevant
      if (currentPathRef.current === requestPath) {
        setLoading(false);
      }
    }
  }, [workspacePath, includeGlobal]);

  // Load on mount and when options change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Combined items
  const items = useMemo(
    () => [...executorItems, ...agentItems],
    [executorItems, agentItems]
  );

  // Counts
  const counts = useMemo<AgentListCounts>(
    () => ({
      executors: executorItems.length,
      agents: agentItems.length,
    }),
    [executorItems, agentItems]
  );

  // Agent operations
  const setDefaultAgent = useCallback(
    async (id: string): Promise<void> => {
      const client = getGatewayClient();
      await client.setDefaultAgent(id);
      setDefaultAgentIdState(id);
    },
    []
  );

  const removeAgent = useCallback(
    async (id: string): Promise<void> => {
      const client = getGatewayClient();
      await client.deleteAgent(id);
      await loadData();
    },
    [loadData]
  );

  const updateAgent = useCallback(
    async (id: string, updates: UpdateAgentOptions): Promise<AgentResponse> => {
      const client = getGatewayClient();
      const result = await client.updateAgent(id, updates);
      await loadData();
      return result;
    },
    [loadData]
  );

  const createAgent = useCallback(
    async (createOptions: CreateAgentOptions): Promise<AgentResponse> => {
      const client = getGatewayClient();
      const optionsWithPath = workspacePath
        ? { ...createOptions, base_path: createOptions.base_path || workspacePath }
        : createOptions;
      const result = await client.createAgent(optionsWithPath);
      await loadData();
      return result;
    },
    [workspacePath, loadData]
  );

  const agentOperations: AgentOperations = {
    defaultAgentId,
    setDefaultAgent,
    removeAgent,
    updateAgent,
    createAgent,
  };

  return {
    items,
    executors: executorItems,
    agents: agentItems,
    counts,
    total: items.length,
    loading,
    error,
    refresh: loadData,
    agentOperations,
  };
}

// ============================================================================
// Chat List Hook (Aggregated)
// ============================================================================

export interface UseChatListOptions {
  /** Workspace path to scope items */
  workspacePath?: string | null;
  /** Include global items (default: true) */
  includeGlobal?: boolean;
}

/** Agent operations available from useChatList */
export interface AgentOperations {
  /** Default agent ID */
  defaultAgentId: string | null;
  /** Set the default agent */
  setDefaultAgent: (id: string) => Promise<void>;
  /** Remove an agent */
  removeAgent: (id: string) => Promise<void>;
  /** Update an agent */
  updateAgent: (id: string, updates: UpdateAgentOptions) => Promise<AgentResponse>;
  /** Create a new agent */
  createAgent: (options: CreateAgentOptions) => Promise<AgentResponse>;
}

export interface UseChatListReturn {
  /** All chat list items (group chats, executors, agents) */
  items: ChatListItem[];
  /** Items filtered by type */
  groupChats: ChatListItem[];
  executors: ChatListItem[];
  agents: ChatListItem[];
  /** Counts by type */
  counts: ChatListCounts;
  /** Total count */
  total: number;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh chat list */
  refresh: () => Promise<void>;
  /** Agent operations (delegate to useAgents internally) */
  agentOperations: AgentOperations;
}

/**
 * Hook to get aggregated chat list (group chats, executors, agents)
 *
 * This provides a unified view for the chat sidebar, combining:
 * - Group chats (from workspace + global)
 * - Executors (with config)
 * - Agents (from workspace + global)
 *
 * Also provides agentOperations for managing agents.
 */
export function useChatList(options?: UseChatListOptions): UseChatListReturn {
  const workspacePath = options?.workspacePath;
  const includeGlobal = options?.includeGlobal ?? true;

  const [items, setItems] = useState<ChatListItem[]>([]);
  const [counts, setCounts] = useState<ChatListCounts>({
    group_chats: 0,
    executors: 0,
    agents: 0,
  });
  const [defaultAgentId, setDefaultAgentIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current workspacePath to prevent stale data from old requests
  const currentPathRef = useRef(workspacePath);
  currentPathRef.current = workspacePath;

  // Clear state when workspacePath changes to avoid showing stale data
  useEffect(() => {
    setItems([]);
    setCounts({ group_chats: 0, executors: 0, agents: 0 });
    setError(null);
  }, [workspacePath]);

  const loadChatList = useCallback(async () => {
    const requestPath = workspacePath; // Capture at request time
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const [response, defaultId] = await Promise.all([
        client.getChatList({
          workspacePath: workspacePath || undefined,
          includeGlobal,
        }),
        client.getDefaultAgentId().catch(() => null),
      ]);
      // Only update state if this request is still relevant
      if (currentPathRef.current === requestPath) {
        setItems(response.items);
        setCounts(response.counts);
        setDefaultAgentIdState(defaultId);
      }
    } catch (err) {
      // Only update error if this request is still relevant
      if (currentPathRef.current === requestPath) {
        const message =
          err instanceof Error ? err.message : "Failed to load chat list";
        setError(message);
        console.error("[useChatList] Error:", err);
      }
    } finally {
      // Only update loading if this request is still relevant
      if (currentPathRef.current === requestPath) {
        setLoading(false);
      }
    }
  }, [workspacePath, includeGlobal]);

  // Load on mount and when options change
  useEffect(() => {
    loadChatList();
  }, [loadChatList]);

  // Filter items by type
  const groupChats = items.filter((item) => item.item_type === "group_chat");
  const executors = items.filter((item) => item.item_type === "executor");
  const agents = items.filter((item) => item.item_type === "agent");

  // Agent operations
  const setDefaultAgent = useCallback(
    async (id: string): Promise<void> => {
      const client = getGatewayClient();
      await client.setDefaultAgent(id);
      setDefaultAgentIdState(id);
    },
    []
  );

  const removeAgent = useCallback(
    async (id: string): Promise<void> => {
      const client = getGatewayClient();
      await client.deleteAgent(id);
      // Refresh chat list after deletion
      await loadChatList();
    },
    [loadChatList]
  );

  const updateAgent = useCallback(
    async (id: string, updates: UpdateAgentOptions): Promise<AgentResponse> => {
      const client = getGatewayClient();
      const result = await client.updateAgent(id, updates);
      // Refresh chat list after update
      await loadChatList();
      return result;
    },
    [loadChatList]
  );

  const createAgent = useCallback(
    async (createOptions: CreateAgentOptions): Promise<AgentResponse> => {
      const client = getGatewayClient();
      // Add workspace path if creating workspace-scoped agent
      const optionsWithPath = workspacePath
        ? { ...createOptions, base_path: createOptions.base_path || workspacePath }
        : createOptions;
      const result = await client.createAgent(optionsWithPath);
      // Refresh chat list after creation
      await loadChatList();
      return result;
    },
    [workspacePath, loadChatList]
  );

  const agentOperations: AgentOperations = {
    defaultAgentId,
    setDefaultAgent,
    removeAgent,
    updateAgent,
    createAgent,
  };

  return {
    items,
    groupChats,
    executors,
    agents,
    counts,
    total: items.length,
    loading,
    error,
    refresh: loadChatList,
    agentOperations,
  };
}
