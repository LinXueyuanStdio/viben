/**
 * Gateway-integrated MCP Inspector Proxy Hook
 *
 * Uses the built-in MCP Inspector proxy in Gateway (/api/mcp/inspector/*)
 * instead of a separate Python proxy process.
 */
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  /** Refresh status and return fresh status (useful for getting updated auth token) */
  refreshStatus: () => Promise<GatewayInspectorStatus | null>;
  refreshSessions: () => Promise<void>;
  closeSession: (sessionId: string) => Promise<void>;
}

/**
 * Hook to use Gateway's built-in MCP Inspector proxy
 */
export function useGatewayInspector(): UseGatewayInspectorReturn {
  const { t } = useTranslation();
  const [status, setStatus] = useState<GatewayInspectorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<McpInspectorSession[]>([]);

  const refreshStatus = useCallback(async (): Promise<GatewayInspectorStatus | null> => {
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

      const newStatus: GatewayInspectorStatus = {
        available: health.status === "ok",
        sessions: health.sessions,
        authToken: tokenInfo.token,
        authDisabled: tokenInfo.authDisabled,
        proxyUrl,
      };

      setStatus(newStatus);
      return newStatus;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
      return null;
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
      throw new Error(t("errors.gateway.notAuthenticated"));
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
  }, [status?.authToken, status?.authDisabled, refreshSessions, refreshStatus, t]);

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
 *
 * Note: The client always uses streamable-http to connect to the proxy.
 * For stdio and sse targets, we use specific endpoints (/stdio, /sse) that establish
 * GET-based SSE connections. But since our client uses streamable-http (POST-based),
 * we should always use the /mcp endpoint and let the proxy handle the target transport.
 */
export function buildGatewayInspectorUrl(
  proxyBaseUrl: string,
  targetUrl: string,
  transportType: "stdio" | "sse" | "streamable-http" = "streamable-http"
): string {
  // When client uses streamable-http transport (POST-based), always use /mcp endpoint
  // The transportType query param tells the proxy how to connect to the target server
  // Only use /stdio or /sse endpoints when the CLIENT is using those transports (GET-based)
  const endpoint = "mcp";

  // Ensure base URL ends with / for proper path joining
  const base = proxyBaseUrl.endsWith("/") ? proxyBaseUrl : proxyBaseUrl + "/";
  const url = new URL(endpoint, base);
  url.searchParams.set("url", targetUrl);
  url.searchParams.set("transportType", transportType);

  return url.toString();
}

/**
 * Build headers for Gateway Inspector proxy request
 *
 * The Gateway Inspector proxy only forwards certain headers to the target MCP server:
 * - Authorization (automatically forwarded)
 * - Headers starting with "mcp-"
 * - Headers specified in X-Custom-Auth-Headers (JSON array of header names)
 *
 * This function sets up the headers correctly so Gateway knows which ones to forward.
 */
export function buildGatewayInspectorHeaders(
  authToken: string | null,
  customHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Gateway Inspector proxy authentication
  if (authToken) {
    headers["X-MCP-Proxy-Auth"] = `Bearer ${authToken}`;
  }

  if (customHeaders) {
    // Copy all custom headers
    Object.assign(headers, customHeaders);

    // Tell Gateway which custom headers to forward to the target server
    // Gateway automatically forwards "authorization" and "mcp-*" headers,
    // but other custom headers need to be explicitly listed
    const customHeaderNames = Object.keys(customHeaders).filter((name) => {
      const lowerName = name.toLowerCase();
      // These are already auto-forwarded by Gateway
      return lowerName !== "authorization" && !lowerName.startsWith("mcp-");
    });

    if (customHeaderNames.length > 0) {
      headers["X-Custom-Auth-Headers"] = JSON.stringify(customHeaderNames);
    }
  }

  return headers;
}
