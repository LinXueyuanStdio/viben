import { useState, useCallback, useEffect } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type {
  WorkspaceAgentConfigData,
  WorkspaceCommandData,
  WorkspacePromptData,
} from "@/lib/gateway";

// Re-export types with backward-compatible names
export type WorkspaceAgentConfig = WorkspaceAgentConfigData;
export type WorkspaceCommand = WorkspaceCommandData;
export type WorkspacePrompt = WorkspacePromptData;

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

/**
 * Hook for fetching prompt files from .claude/prompts/ folder
 * Uses HTTP API via Gateway client
 *
 * @param workspacePath - The workspace path (e.g., "/Users/foo/project")
 * @param executorType - The executor type (e.g., "CLAUDE_CODE", "cursor")
 */
export function useWorkspacePrompts(
  workspacePath: string | null,
  executorType: string | null
) {
  const [prompts, setPrompts] = useState<WorkspacePrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrompts = useCallback(async () => {
    if (!executorType) {
      setPrompts([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const response = await client.getPrompts(workspacePath ?? undefined, executorType);
      setPrompts(response.prompts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, executorType]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  return { prompts, loading, error, loadPrompts };
}

/**
 * Hook for reading a single prompt file
 * Uses HTTP API via Gateway client
 */
export function usePromptContent() {
  const [prompt, setPrompt] = useState<WorkspacePrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readPrompt = useCallback(
    async (workspacePath: string | undefined, executorType: string, promptId: string) => {
      setLoading(true);
      setError(null);
      try {
        const client = getGatewayClient();
        const response = await client.getPrompt(workspacePath, executorType, promptId);
        setPrompt(response.prompt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setPrompt(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearPrompt = useCallback(() => {
    setPrompt(null);
    setError(null);
  }, []);

  return { prompt, loading, error, readPrompt, clearPrompt };
}
