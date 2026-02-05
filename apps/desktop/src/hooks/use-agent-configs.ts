import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceAgentConfig, WorkspaceCommand } from "@/types";

/**
 * Hook for fetching agent config files (.claude/agents/*.md)
 */
export function useWorkspaceAgentConfigs(
  workspaceId: string | null,
  agentId: string | null
) {
  const [configs, setConfigs] = useState<WorkspaceAgentConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    if (!workspaceId || !agentId) {
      setConfigs([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WorkspaceAgentConfig[]>(
        "get_workspace_agent_configs",
        { workspaceId, agentId }
      );
      setConfigs(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, agentId]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  return { configs, loading, error, loadConfigs };
}

/**
 * Hook for reading a single agent config file
 */
export function useAgentConfigContent() {
  const [config, setConfig] = useState<WorkspaceAgentConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readConfig = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WorkspaceAgentConfig>("read_agent_config_file", {
        path,
      });
      setConfig(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearConfig = useCallback(() => {
    setConfig(null);
    setError(null);
  }, []);

  return { config, loading, error, readConfig, clearConfig };
}

/**
 * Hook for fetching command files from .claude/commands/ folder
 */
export function useWorkspaceCommands(
  workspaceId: string | null,
  agentId: string | null
) {
  const [commands, setCommands] = useState<WorkspaceCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCommands = useCallback(async () => {
    if (!workspaceId || !agentId) {
      setCommands([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WorkspaceCommand[]>("get_workspace_commands", {
        workspaceId,
        agentId,
      });
      setCommands(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setCommands([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, agentId]);

  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  return { commands, loading, error, loadCommands };
}

/**
 * Hook for reading a single command file
 */
export function useCommandContent() {
  const [command, setCommand] = useState<WorkspaceCommand | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readCommand = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<WorkspaceCommand>("read_command_file", {
        path,
      });
      setCommand(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setCommand(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCommand = useCallback(() => {
    setCommand(null);
    setError(null);
  }, []);

  return { command, loading, error, readCommand, clearCommand };
}
