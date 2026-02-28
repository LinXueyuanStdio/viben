/**
 * Gateway-integrated MCP Inspector Proxy Hook
 *
 * Uses the built-in MCP Inspector proxy in Gateway (/api/mcp/inspector/*)
 * instead of a separate Python proxy process.
 */
import { useState, useCallback, useEffect } from "react";
import {
  getGatewayClient,
  getGatewayUrl,
  type McpInspectorHealth,
  type McpInspectorToken,
  type McpInspectorSession,
} from "@/lib/gateway";

export type { McpInspectorHealth, McpInspectorToken, McpInspectorSession };

/** Status of the Gateway Inspector proxy */
export interface GatewayInspectorStatus {
  available: boolean;
  sessions: number;
  authToken: string | null;
  authDisabled: boolean;
  proxyUrl: string;
}

interface UseGatewayInspectorReturn {
  status: GatewayInspectorStatus | null;
  isLoading: boolean;
  error: string | null;
  sessions: McpInspectorSession[];
  refreshStatus: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  closeSession: (sessionId: string) => Promise<void>;
}

/**
 * Hook to use Gateway's built-in MCP Inspector proxy
 */
export function useGatewayInspector(): UseGatewayInspectorReturn {
  const [status, setStatus] = useState<GatewayInspectorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<McpInspectorSession[]>([]);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();

      // Get health status
      const health = await client.getMcpInspectorHealth();

      // Get auth token
      const tokenInfo = await client.getMcpInspectorToken();

      // Build proxy URL from Gateway URL
      const gatewayUrl = getGatewayUrl();
      const proxyUrl = `${gatewayUrl}/api/mcp/inspector`;

      setStatus({
        available: health.status === "ok",
        sessions: health.sessions,
        authToken: tokenInfo.token,
        authDisabled: tokenInfo.authDisabled,
        proxyUrl,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    if (!status?.authToken && !status?.authDisabled) {
      return;
    }

    try {
      const client = getGatewayClient();
      const authToken = status.authToken || "";
      const sessionList = await client.getMcpInspectorSessions(authToken);
      setSessions(sessionList);
    } catch (e) {
      console.error("Failed to refresh sessions:", e);
    }
  }, [status?.authToken, status?.authDisabled]);

  const closeSession = useCallback(async (sessionId: string) => {
    if (!status?.authToken && !status?.authDisabled) {
      throw new Error("Not authenticated");
    }

    try {
      const client = getGatewayClient();
      const authToken = status.authToken || "";
      await client.closeMcpInspectorSession(authToken, sessionId);

      // Refresh sessions list
      await refreshSessions();
      // Refresh status to update session count
      await refreshStatus();
    } catch (e) {
      throw e;
    }
  }, [status?.authToken, status?.authDisabled, refreshSessions, refreshStatus]);

  // Initialize on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    error,
    sessions,
    refreshStatus,
    refreshSessions,
    closeSession,
  };
}

/**
 * Build proxy URL for MCP connection using Gateway Inspector
 *
 * @param proxyBaseUrl - Gateway inspector base URL (e.g., http://127.0.0.1:18790/api/mcp/inspector)
 * @param targetUrl - Target MCP server URL
 * @param transportType - Transport type (stdio, sse, streamable-http)
 */
export function buildGatewayInspectorUrl(
  proxyBaseUrl: string,
  targetUrl: string,
  transportType: "stdio" | "sse" | "streamable-http" = "streamable-http"
): string {
  const endpoint = transportType === "stdio" ? "/stdio" :
                   transportType === "sse" ? "/sse" : "/mcp";

  const url = new URL(endpoint, proxyBaseUrl);
  url.searchParams.set("url", targetUrl);
  url.searchParams.set("transportType", transportType);

  return url.toString();
}

/**
 * Build headers for Gateway Inspector proxy request
 */
export function buildGatewayInspectorHeaders(
  authToken: string | null,
  customHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (authToken) {
    headers["X-MCP-Proxy-Auth"] = `Bearer ${authToken}`;
  }

  if (customHeaders) {
    Object.assign(headers, customHeaders);
  }

  return headers;
}
