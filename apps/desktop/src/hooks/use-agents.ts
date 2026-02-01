import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AgentInfo, AgentMcpConfig } from "@/types";

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detected = await invoke<AgentInfo[]>("detect_agents");
      setAgents(detected);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const readAgentConfig = useCallback(async (agentId: string) => {
    try {
      return await invoke<AgentMcpConfig | null>("read_agent_config", {
        agentId,
      });
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const writeAgentConfig = useCallback(
    async (agentId: string, config: AgentMcpConfig) => {
      try {
        await invoke("write_agent_config", { agentId, config });
        // Refresh agents after writing config
        await detectAgents();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err));
      }
    },
    [detectAgents]
  );

  const configureBrowseMcp = useCallback(
    async (
      agentId: string,
      pythonPath?: string,
      serverConfig?: {
        transport: "stdio" | "sse" | "http";
        port?: number;
        apiKeyId?: string;
      }
    ) => {
      try {
        await invoke("configure_browse_mcp", {
          agentId,
          pythonPath: pythonPath || null,
          transport: serverConfig?.transport || "stdio",
          port: serverConfig?.port || null,
          apiKeyId: serverConfig?.apiKeyId || null,
        });
        // Refresh agents after configuring
        await detectAgents();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err));
      }
    },
    [detectAgents]
  );

  const isBrowseMcpConfigured = useCallback(async (agentId: string) => {
    try {
      return await invoke<boolean>("is_browse_mcp_configured", { agentId });
    } catch (err) {
      return false;
    }
  }, []);

  // Auto-detect on mount
  useEffect(() => {
    detectAgents();
  }, [detectAgents]);

  return {
    agents,
    loading,
    error,
    detectAgents,
    readAgentConfig,
    writeAgentConfig,
    configureBrowseMcp,
    isBrowseMcpConfigured,
  };
}
