import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores";
import type {
  Workspace,
  WorkspaceAgent,
  WorkspaceMcpServer,
  WorkspaceSkill,
} from "@/types";

/**
 * Hook for local workspace management - handles CRUD operations for workspaces,
 * agent detection, and MCP/Skills configuration within workspaces.
 *
 * Note: This is different from `useWorkspaces` in use-browse-mcp which handles
 * cloud workspace sync. This hook manages local file-system based workspaces.
 */
export function useLocalWorkspaces() {
  const {
    workspaces,
    activeWorkspaceId,
    selectedAgentId,
    isLoading,
    error,
    discoveryTasks,
    setWorkspaces,
    addWorkspace: addWorkspaceToStore,
    removeWorkspace: removeWorkspaceFromStore,
    setActiveWorkspace,
    setSelectedAgentId,
    setLoading,
    setError,
    getWorkspace,
    getActiveWorkspace,
    startDiscovery,
    completeDiscovery,
    failDiscovery,
    getDiscoveryTask,
    hasRunningDiscovery,
  } = useWorkspaceStore();

  // Load workspaces on mount (without auto-discovery - that happens on workspace detail page)
  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Workspace[]>("list_workspaces");
      setWorkspaces(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [setWorkspaces, setLoading, setError]);

  // Run auto-discovery for a workspace
  const runDiscovery = useCallback(
    async (workspaceId: string) => {
      startDiscovery(workspaceId);
      try {
        const agents = await invoke<WorkspaceAgent[]>("detect_workspace_agents", {
          workspaceId,
        });
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
        title: "Select Workspace Folder",
      });

      if (!selected) return null;

      const path = typeof selected === "string" ? selected : selected;
      const workspace = await invoke<Workspace>("add_workspace", { path });
      addWorkspaceToStore(workspace);

      // Note: Discovery will happen when user navigates to the workspace detail page
      return workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [addWorkspaceToStore, setError]);

  // Remove workspace
  const removeWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        await invoke("remove_workspace", { workspaceId });
        removeWorkspaceFromStore(workspaceId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [removeWorkspaceFromStore, setError]
  );

  // Set active workspace
  const selectWorkspace = useCallback(
    async (workspaceId: string | null) => {
      try {
        await invoke("set_active_workspace", { workspaceId });
        setActiveWorkspace(workspaceId);
        if (workspaceId) {
          await invoke("update_workspace_accessed", { workspaceId });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    },
    [setActiveWorkspace, setError]
  );

  // Load on mount
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

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
    getActiveWorkspace,
    getDiscoveryTask,
    hasRunningDiscovery,
  };
}

/**
 * Hook for managing agents within a workspace
 * Uses store-based discovery state for debouncing/backpressure
 */
export function useWorkspaceAgents(workspaceId: string | null) {
  const [agents, setAgents] = useState<WorkspaceAgent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Get store functions directly (these are stable)
  const startDiscovery = useWorkspaceStore((s) => s.startDiscovery);
  const completeDiscovery = useWorkspaceStore((s) => s.completeDiscovery);
  const failDiscovery = useWorkspaceStore((s) => s.failDiscovery);
  const discoveryTasks = useWorkspaceStore((s) => s.discoveryTasks);

  const discoveryTask = workspaceId ? discoveryTasks[workspaceId] : undefined;
  const loading = discoveryTask?.status === "running";

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
      const result = await invoke<WorkspaceAgent[]>("detect_workspace_agents", {
        workspaceId,
      });
      setAgents(result);
      completeDiscovery(workspaceId, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      failDiscovery(workspaceId, message);
    }
  }, [workspaceId, startDiscovery, completeDiscovery, failDiscovery]);

  // Update agents when discovery completes from elsewhere
  useEffect(() => {
    if (discoveryTask?.status === "completed" && discoveryTask.agents) {
      setAgents(discoveryTask.agents);
    }
  }, [discoveryTask?.status, discoveryTask?.agents]);

  // Reset agents when workspace changes
  useEffect(() => {
    setAgents([]);
    setError(null);
  }, [workspaceId]);

  return {
    agents,
    loading,
    error,
    loadAgents,
  };
}

/**
 * Hook for managing MCP servers within an agent
 */
export function useWorkspaceMcpServers(
  workspaceId: string | null,
  agentId: string | null
) {
  const [servers, setServers] = useState<WorkspaceMcpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServers = useCallback(async () => {
    if (!workspaceId || !agentId) {
      setServers([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WorkspaceMcpServer[]>(
        "get_workspace_mcp_servers",
        { workspaceId, agentId }
      );
      setServers(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, agentId]);

  const addServer = useCallback(
    async (server: WorkspaceMcpServer) => {
      if (!workspaceId || !agentId) return;

      try {
        await invoke("add_workspace_mcp_server", {
          workspaceId,
          agentId,
          server,
        });
        await loadServers();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspaceId, agentId, loadServers]
  );

  const updateServer = useCallback(
    async (serverName: string, server: WorkspaceMcpServer) => {
      if (!workspaceId || !agentId) return;

      try {
        await invoke("update_workspace_mcp_server", {
          workspaceId,
          agentId,
          serverName,
          server,
        });
        await loadServers();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspaceId, agentId, loadServers]
  );

  const deleteServer = useCallback(
    async (serverName: string) => {
      if (!workspaceId || !agentId) return;

      try {
        await invoke("delete_workspace_mcp_server", {
          workspaceId,
          agentId,
          serverName,
        });
        await loadServers();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspaceId, agentId, loadServers]
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
 * Hook for managing skills within an agent
 */
export function useWorkspaceSkills(
  workspaceId: string | null,
  agentId: string | null
) {
  const [skills, setSkills] = useState<WorkspaceSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    if (!workspaceId || !agentId) {
      setSkills([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WorkspaceSkill[]>("get_workspace_skills", {
        workspaceId,
        agentId,
      });
      setSkills(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, agentId]);

  const addSkill = useCallback(
    async (skill: WorkspaceSkill) => {
      if (!workspaceId || !agentId) return;

      try {
        await invoke("add_workspace_skill", {
          workspaceId,
          agentId,
          skill,
        });
        await loadSkills();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspaceId, agentId, loadSkills]
  );

  const deleteSkill = useCallback(
    async (skillId: string) => {
      if (!workspaceId || !agentId) return;

      try {
        await invoke("delete_workspace_skill", {
          workspaceId,
          agentId,
          skillId,
        });
        await loadSkills();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [workspaceId, agentId, loadSkills]
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
