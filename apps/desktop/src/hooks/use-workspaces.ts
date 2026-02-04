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
    setWorkspaces,
    addWorkspace: addWorkspaceToStore,
    removeWorkspace: removeWorkspaceFromStore,
    setActiveWorkspace,
    setSelectedAgentId,
    setLoading,
    setError,
    getWorkspace,
    getActiveWorkspace,
  } = useWorkspaceStore();

  // Load workspaces on mount
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
    // Actions
    loadWorkspaces,
    addWorkspace,
    removeWorkspace,
    selectWorkspace,
    setSelectedAgentId,
    // Getters
    getWorkspace,
    getActiveWorkspace,
  };
}

/**
 * Hook for managing agents within a workspace
 */
export function useWorkspaceAgents(workspaceId: string | null) {
  const [agents, setAgents] = useState<WorkspaceAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    if (!workspaceId) {
      setAgents([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WorkspaceAgent[]>("detect_workspace_agents", {
        workspaceId,
      });
      setAgents(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

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
