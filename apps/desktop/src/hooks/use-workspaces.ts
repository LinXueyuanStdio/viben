import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores";
import { getGatewayClient } from "@/lib/gateway";
import type { WorkspaceResponse } from "@/lib/gateway";
import type {
  Workspace,
  WorkspaceAgent,
  WorkspaceMcpServer,
  WorkspaceSkill,
} from "@/types";

// Helper to transform gateway response to hook format
function transformWorkspaceResponse(response: WorkspaceResponse): Workspace {
  return {
    id: response.id,
    path: response.path,
    name: response.name,
    type: response.type || "custom",
    created_at: response.created_at || new Date().toISOString(),
    last_accessed: response.updated_at || new Date().toISOString(),
  };
}

/**
 * Hook for local workspace management - handles CRUD operations for workspaces,
 * agent detection, and MCP/Skills configuration within workspaces.
 *
 * Note: This is different from `useWorkspaces` in use-browse-mcp which handles
 * cloud workspace sync. This hook manages local file-system based workspaces.
 */
export function useLocalWorkspaces() {
  const { t } = useTranslation();
  const {
    workspaces,
    activeWorkspaceId,
    selectedAgentId,
    isLoading,
    error,
    discoveryTasks,
    addWorkspace: addWorkspaceToStore,
    removeWorkspace: removeWorkspaceFromStore,
    setActiveWorkspace,
    setSelectedAgentId,
    setError,
    getWorkspace,
    getActiveWorkspace,
    startDiscovery,
    completeDiscovery,
    failDiscovery,
    getDiscoveryTask,
    hasRunningDiscovery,
    getWorkspaceByPath,
  } = useWorkspaceStore();

  // Load workspaces from backend
  // This should only be called:
  // 1. When connecting to gateway
  // 2. When gateway sends workspace change event
  const loadWorkspaces = useCallback(async () => {
    const { setLoading, setError, setWorkspaces } = useWorkspaceStore.getState();

    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const response = await client.listWorkspaces();
      const workspacesList = response.workspaces.map(transformWorkspaceResponse);
      setWorkspaces(workspacesList);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error("Failed to load workspaces:", message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run auto-discovery for a workspace
  const runDiscovery = useCallback(
    async (workspaceId: string) => {
      startDiscovery(workspaceId);
      try {
        const client = getGatewayClient();
        const response = await client.detectWorkspaceAgents(workspaceId);
        // Transform gateway response to WorkspaceAgent (Executor) format
        const agents: WorkspaceAgent[] = response.agents.map((a) => ({
          id: a.id,
          workspace_id: workspaceId,
          name: a.name,
          type: (a.type as any) || "UNKNOWN",
          config_path: a.config_path || "",
          mcp_config_file: null,
          skills_config_file: null,
        }));
        completeDiscovery(workspaceId, agents);
        return agents;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failDiscovery(workspaceId, message);
        throw new Error(message);
      }
    },
    [startDiscovery, completeDiscovery, failDiscovery]
  );

  // Add workspace via folder picker
  const addWorkspace = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("workspace.selectFolderTitle", "Select Workspace Folder"),
      });

      if (!selected) return null;

      const path = typeof selected === "string" ? selected : selected;
      const client = getGatewayClient();
      const response = await client.createWorkspace(path);
      const workspace = transformWorkspaceResponse(response);
      addWorkspaceToStore(workspace);

      // Note: Discovery will happen when user navigates to the workspace detail page
      return workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [t, addWorkspaceToStore, setError]);

  // Remove workspace
  const removeWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const client = getGatewayClient();
        await client.deleteWorkspace(workspaceId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
      removeWorkspaceFromStore(workspaceId);
    },
    [removeWorkspaceFromStore, setError]
  );

  // Set active workspace
  // Local state is the source of truth - no backend sync needed
  const selectWorkspace = useCallback(
    (workspaceId: string | null) => {
      setActiveWorkspace(workspaceId);
    },
    [setActiveWorkspace]
  );

  // No auto-loading - workspaces are persisted and loaded via gateway events

  return {
    // State
    workspaces,
    activeWorkspaceId,
    selectedAgentId,
    isLoading,
    error,
    discoveryTasks,
    // Actions
    loadWorkspaces,
    addWorkspace,
    removeWorkspace,
    selectWorkspace,
    setSelectedAgentId,
    runDiscovery,
    // Getters
    getWorkspace,
    getWorkspaceByPath,
    getActiveWorkspace,
    getDiscoveryTask,
    hasRunningDiscovery,
  };
}

/**
 * @deprecated Use useExecutors from use-workspace-resources.ts instead
 * Legacy hook for backwards compatibility - uses Tauri-based workspace agent detection
 */
export function useWorkspaceAgents(workspaceId: string | null) {
  const [agents, setAgents] = useState<WorkspaceAgent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Get store functions directly (these are stable)
  const startDiscovery = useWorkspaceStore((s) => s.startDiscovery);
  const completeDiscovery = useWorkspaceStore((s) => s.completeDiscovery);
  const failDiscovery = useWorkspaceStore((s) => s.failDiscovery);

  // Subscribe to specific discovery task status for this workspace
  // This ensures re-render when status changes
  const discoveryTaskStatus = useWorkspaceStore(
    (s) => workspaceId ? s.discoveryTasks[workspaceId]?.status : undefined
  );
  const discoveryTaskAgents = useWorkspaceStore(
    (s) => workspaceId ? s.discoveryTasks[workspaceId]?.agents : undefined
  );

  const loading = discoveryTaskStatus === "running";

  // Stable loadAgents function - only depends on workspaceId
  const loadAgents = useCallback(async () => {
    if (!workspaceId) {
      setAgents([]);
      return;
    }

    // Backpressure: don't start if already running
    // Check directly from store state to avoid stale closure
    const store = useWorkspaceStore.getState();
    const currentTask = store.discoveryTasks[workspaceId];
    if (currentTask?.status === "running") {
      return;
    }

    startDiscovery(workspaceId);
    setError(null);

    try {
      const client = getGatewayClient();
      const response = await client.detectWorkspaceAgents(workspaceId);
      // Transform gateway response to WorkspaceAgent (Executor) format
      const result: WorkspaceAgent[] = response.agents.map((a) => ({
        id: a.id,
        workspace_id: workspaceId,
        name: a.name,
        type: (a.type as any) || "UNKNOWN",
        config_path: a.config_path || "",
        mcp_config_file: null,
        skills_config_file: null,
      }));
      setAgents(result);
      completeDiscovery(workspaceId, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      failDiscovery(workspaceId, message);
    }
  }, [workspaceId, startDiscovery, completeDiscovery, failDiscovery]);

  // Initialize agents from existing discovery task or reset when workspace changes
  // This handles both:
  // 1. Navigating to a workspace where discovery already completed
  // 2. Switching to a different workspace (need to reset)
  useEffect(() => {
    if (!workspaceId) {
      setAgents([]);
      setError(null);
      return;
    }

    // Check if there's already completed discovery data for this workspace
    const store = useWorkspaceStore.getState();
    const task = store.discoveryTasks[workspaceId];
    if (task?.status === "completed" && task.agents) {
      // Use cached discovery results
      setAgents(task.agents);
    } else {
      // No cached data, reset and wait for discovery
      setAgents([]);
    }
    setError(null);
  }, [workspaceId]);

  // Keep agents in sync when discovery completes (from loadAgents call or elsewhere)
  useEffect(() => {
    if (discoveryTaskStatus === "completed" && discoveryTaskAgents) {
      setAgents(discoveryTaskAgents);
    }
  }, [discoveryTaskStatus, discoveryTaskAgents]);

  return {
    agents,
    loading,
    error,
    loadAgents,
  };
}

/**
 * Hook for managing MCP servers within an executor
 * Uses HTTP API via Gateway client
 *
 * @param workspacePath - The workspace path (e.g., "/Users/foo/project")
 * @param executorType - The executor type (e.g., "CLAUDE_CODE", "CURSOR")
 */
export function useWorkspaceMcpServers(
  workspacePath: string | null,
  executorType: string | null
) {
  const [servers, setServers] = useState<WorkspaceMcpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServers = useCallback(async () => {
    if (!executorType) {
      setServers([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const response = await client.getMcpServers(workspacePath ?? undefined, executorType);
      setServers(response.servers);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, executorType]);

  const addServer = useCallback(
    async (server: WorkspaceMcpServer) => {
      if (!executorType) return;

      try {
        const client = getGatewayClient();
        await client.addMcpServer(workspacePath ?? undefined, executorType, server);
        await loadServers();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspacePath, executorType, loadServers]
  );

  const updateServer = useCallback(
    async (serverName: string, server: WorkspaceMcpServer) => {
      if (!executorType) return;

      try {
        const client = getGatewayClient();
        await client.updateMcpServer(workspacePath ?? undefined, executorType, serverName, server);
        await loadServers();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspacePath, executorType, loadServers]
  );

  const deleteServer = useCallback(
    async (serverName: string) => {
      if (!executorType) return;

      try {
        const client = getGatewayClient();
        await client.deleteMcpServer(workspacePath ?? undefined, executorType, serverName);
        await loadServers();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspacePath, executorType, loadServers]
  );

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  return {
    servers,
    loading,
    error,
    loadServers,
    addServer,
    updateServer,
    deleteServer,
  };
}

/**
 * Hook for managing skills within an executor
 * Uses HTTP API via Gateway client
 *
 * @param workspacePath - The workspace path (e.g., "/Users/foo/project")
 * @param executorType - The executor type (e.g., "CLAUDE_CODE", "CURSOR")
 */
export function useWorkspaceSkills(
  workspacePath: string | null,
  executorType: string | null
) {
  const [skills, setSkills] = useState<WorkspaceSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    if (!executorType) {
      setSkills([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const response = await client.getSkills(workspacePath ?? undefined, executorType);
      setSkills(response.skills);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, executorType]);

  const addSkill = useCallback(
    async (skill: WorkspaceSkill) => {
      if (!executorType) return;

      try {
        const client = getGatewayClient();
        await client.addSkill(workspacePath ?? undefined, executorType, skill);
        await loadSkills();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspacePath, executorType, loadSkills]
  );

  const deleteSkill = useCallback(
    async (skillId: string) => {
      if (!executorType) return;

      try {
        const client = getGatewayClient();
        await client.deleteSkill(workspacePath ?? undefined, executorType, skillId);
        await loadSkills();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspacePath, executorType, loadSkills]
  );

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  return {
    skills,
    loading,
    error,
    loadSkills,
    addSkill,
    deleteSkill,
  };
}
