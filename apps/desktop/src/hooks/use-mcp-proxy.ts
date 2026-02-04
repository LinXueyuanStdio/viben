import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePython } from "./use-python";

export interface McpProxyConfig {
  python_path: string;
  host: string;
  port: number;
  auth_token?: string;
}

export interface McpProxyStatus {
  running: boolean;
  pid: number | null;
  host: string | null;
  port: number | null;
  auth_token: string | null;
  url: string | null;
}

interface UseMcpProxyReturn {
  status: McpProxyStatus | null;
  isLoading: boolean;
  error: string | null;
  isInstalled: boolean | null;
  startProxy: (config?: Partial<McpProxyConfig>) => Promise<McpProxyStatus>;
  stopProxy: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  checkInstalled: () => Promise<boolean>;
  installProxy: () => Promise<void>;
}

const DEFAULT_CONFIG: McpProxyConfig = {
  python_path: "python",
  host: "127.0.0.1",
  port: 6277,
};

export function useMcpProxy(): UseMcpProxyReturn {
  const [status, setStatus] = useState<McpProxyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);

  // Get python path from usePython hook
  const { selectedPython } = usePython();
  const pythonPath = selectedPython?.path;

  const refreshStatus = useCallback(async () => {
    try {
      const result = await invoke<McpProxyStatus>("get_mcp_proxy_status");
      setStatus(result);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const checkInstalled = useCallback(async (): Promise<boolean> => {
    try {
      const path = pythonPath || DEFAULT_CONFIG.python_path;
      const result = await invoke<boolean>("check_mcp_proxy_installed", {
        pythonPath: path,
      });
      setIsInstalled(result);
      return result;
    } catch (e) {
      setIsInstalled(false);
      return false;
    }
  }, [pythonPath]);

  const startProxy = useCallback(async (config?: Partial<McpProxyConfig>): Promise<McpProxyStatus> => {
    setIsLoading(true);
    setError(null);

    try {
      const fullConfig: McpProxyConfig = {
        ...DEFAULT_CONFIG,
        python_path: pythonPath || DEFAULT_CONFIG.python_path,
        ...config,
      };

      const result = await invoke<McpProxyStatus>("start_mcp_proxy", {
        config: fullConfig,
      });

      setStatus(result);
      return result;
    } catch (e) {
      const errorMsg = String(e);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [pythonPath]);

  const stopProxy = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await invoke("stop_mcp_proxy");
      setStatus({
        running: false,
        pid: null,
        host: null,
        port: null,
        auth_token: null,
        url: null,
      });
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installProxy = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const path = pythonPath || DEFAULT_CONFIG.python_path;
      await invoke("install_mcp_proxy", { pythonPath: path });
      setIsInstalled(true);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [pythonPath]);

  // Check installation and status on mount
  useEffect(() => {
    checkInstalled();
    refreshStatus();
  }, [checkInstalled, refreshStatus]);

  return {
    status,
    isLoading,
    error,
    isInstalled,
    startProxy,
    stopProxy,
    refreshStatus,
    checkInstalled,
    installProxy,
  };
}

/**
 * Build proxy URL for MCP connection
 */
export function buildProxyUrl(
  proxyUrl: string,
  targetUrl: string,
  transportType: "stdio" | "sse" | "streamable-http" = "streamable-http"
): string {
  const endpoint = transportType === "stdio" ? "/stdio" :
                   transportType === "sse" ? "/sse" : "/mcp";

  const url = new URL(endpoint, proxyUrl);
  url.searchParams.set("url", targetUrl);
  url.searchParams.set("transport_type", transportType);

  return url.toString();
}

/**
 * Build headers for proxy request
 */
export function buildProxyHeaders(
  authToken: string,
  customHeaders?: Record<string, string>
): Record<string, string> {
  return {
    "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
    ...customHeaders,
  };
}
