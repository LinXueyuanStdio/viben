import { useState, useCallback, useEffect } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type {
  WorkspaceAgentConfigData,
  WorkspaceCommandData,
} from "@/lib/gateway";

// Re-export types with backward-compatible names
export type WorkspaceAgentConfig = WorkspaceAgentConfigData;
export type WorkspaceCommand = WorkspaceCommandData;

/**
 * Hook for fetching agent config files (.claude/agents/*.md)
 * Uses HTTP API via Gateway client
 *
 * @param workspacePath - The workspace path (e.g., "/Users/foo/project")
 * @param executorType - The executor type (e.g., "CLAUDE_CODE", "cursor")
 */
export function useWorkspaceAgentConfigs(
  workspacePath: string | null,
  executorType: string | null
) {
  const [configs, setConfigs] = useState<WorkspaceAgentConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    if (!executorType) {
      setConfigs([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const response = await client.getAgentConfigs(workspacePath ?? undefined, executorType);
      setConfigs(response.configs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, executorType]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  return { configs, loading, error, loadConfigs };
}

/**
 * Hook for reading a single agent config file
 * Uses HTTP API via Gateway client
 */
export function useAgentConfigContent() {
  const [config, setConfig] = useState<WorkspaceAgentConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readConfig = useCallback(
    async (workspacePath: string | undefined, executorType: string, configId: string) => {
      setLoading(true);
      setError(null);
      try {
        const client = getGatewayClient();
        const response = await client.getAgentConfig(workspacePath, executorType, configId);
        setConfig(response.config);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setConfig(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearConfig = useCallback(() => {
    setConfig(null);
    setError(null);
  }, []);

  return { config, loading, error, readConfig, clearConfig };
}

/**
 * Hook for fetching command files from .claude/commands/ folder
 * Uses HTTP API via Gateway client
 *
 * @param workspacePath - The workspace path (e.g., "/Users/foo/project")
 * @param executorType - The executor type (e.g., "CLAUDE_CODE", "cursor")
 */
export function useWorkspaceCommands(
  workspacePath: string | null,
  executorType: string | null
) {
  const [commands, setCommands] = useState<WorkspaceCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCommands = useCallback(async () => {
    if (!executorType) {
      setCommands([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const response = await client.getCommands(workspacePath ?? undefined, executorType);
      setCommands(response.commands);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setCommands([]);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, executorType]);

  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  return { commands, loading, error, loadCommands };
}

/**
 * Hook for reading a single command file
 * Uses HTTP API via Gateway client
 */
export function useCommandContent() {
  const [command, setCommand] = useState<WorkspaceCommand | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readCommand = useCallback(
    async (workspacePath: string | undefined, executorType: string, commandId: string) => {
      setLoading(true);
      setError(null);
      try {
        const client = getGatewayClient();
        const response = await client.getCommand(workspacePath, executorType, commandId);
        setCommand(response.command);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setCommand(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearCommand = useCallback(() => {
    setCommand(null);
    setError(null);
  }, []);

  return { command, loading, error, readCommand, clearCommand };
}
